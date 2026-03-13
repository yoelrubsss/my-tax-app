/**
 * ✅ MIGRATED TO PRISMA DATABASE
 *
 * This API route now uses Prisma as the single source of truth.
 * All transactions are stored in the Prisma database (prisma/schema.prisma).
 *
 * Key Changes:
 * - Uses prisma.transaction instead of db-operations
 * - No status field (all transactions are complete)
 * - String user IDs (cuid) instead of numeric IDs
 * - CamelCase field names (userId, vatAmount, receiptUrl)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";
import { getCategoryById } from "@/lib/tax-knowledge";

// GET: Fetch all transactions for the authenticated user
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user ID
    const userId = await requireAuth();

    // CRITICAL: Convert userId to string for Prisma
    const userIdStr = String(userId);

    console.log(`📥 GET /api/transactions - User: ${userIdStr}`);

    // Get filters from query params
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    console.log(`   Filters: startDate=${startDate}, endDate=${endDate}`);

    // Build Prisma where clause
    const where: any = {
      userId: userIdStr,
    };

    // Add date filtering if provided
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        // Include the entire end date (23:59:59)
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.date.lte = endDateTime;
      }
    }

    // Fetch transactions from Prisma
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    // Map Prisma fields to frontend-expected format (snake_case for backward compatibility)
    const mappedTransactions = transactions.map(tx => {
      const isDraft = tx.status === 'DRAFT';

      return {
        id: tx.id,
        user_id: tx.userId, // Map userId → user_id
        type: tx.type.toLowerCase(), // INCOME → income, EXPENSE → expense
        amount: tx.amount,
        vat_amount: tx.vatAmount, // Map vatAmount → vat_amount (TOTAL VAT from receipt)
        recognized_vat_amount: tx.recognizedVatAmount, // CLAIMABLE VAT after category rules
        date: tx.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
        description: tx.description || tx.merchant,
        merchant: tx.merchant,
        category: tx.category,
        is_vat_deductible: true, // Prisma doesn't track this, assume true
        document_path: tx.receiptUrl, // Map receiptUrl → document_path
        receiptUrl: tx.receiptUrl,
        status: isDraft ? 'DRAFT' : 'COMPLETED',
        created_at: tx.createdAt.toISOString(),
      };
    });

    // Count drafts for logging
    const draftCount = mappedTransactions.filter(tx => tx.status === 'DRAFT').length;
    const completedCount = mappedTransactions.length - draftCount;

    console.log(`✅ Found ${transactions.length} transaction(s): ${completedCount} completed, ${draftCount} drafts`);

    return NextResponse.json({ success: true, data: mappedTransactions });
  } catch (error: any) {
    console.error("❌ Error fetching transactions:", error);

    // Handle authentication errors
    if (error.message === "Authentication required" || error.message.includes("authentication")) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// POST: Create new transaction (supports incomplete "drafts")
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user ID
    const userId = await requireAuth();

    // CRITICAL: Convert userId to string for Prisma
    const userIdStr = String(userId);

    const body = await request.json();
    const { type, amount, vatAmount: bodyVatAmount, date, description, merchant, category, receiptUrl, document_path, status } = body;

    // Use receiptUrl or document_path (support both field names)
    const finalReceiptUrl = receiptUrl || document_path || null;

    console.log(`📤 POST /api/transactions - User: ${userIdStr}, Type: ${type || 'draft'}, ReceiptUrl: ${finalReceiptUrl ? 'Yes' : 'No'}`);

    // RELAXED VALIDATION: Allow incomplete transactions if receiptUrl is present
    // This enables "Quick Draft" functionality where user uploads receipt first
    const isQuickDraft = finalReceiptUrl && (!type || !amount || (!description && !merchant));

    if (isQuickDraft) {
      console.log(`   📝 Quick Draft mode: Creating incomplete transaction with defaults`);
    }

    // Apply defaults for missing fields
    const finalType = type ? type.toUpperCase() : 'EXPENSE'; // Default to EXPENSE
    const finalAmount = amount ? parseFloat(amount) : 0; // Default to 0
    const finalMerchant = merchant || description || 'Draft Transaction'; // Default placeholder
    const finalDescription = description || merchant || ''; // Empty string instead of "Pending review"
    const finalCategory = category || 'Uncategorized';
    const finalDate = date ? new Date(date) : new Date();
    const finalStatus = status === 'DRAFT' ? 'DRAFT' : 'COMPLETED';

    // Validate type (but only if provided)
    if (type && finalType !== "INCOME" && finalType !== "EXPENSE") {
      return NextResponse.json(
        { success: false, error: "Type must be 'income' or 'expense'" },
        { status: 400 }
      );
    }

    // Calculate VAT amounts — use AI-provided vatAmount if supplied, otherwise derive from total
    const vatRate = 0.18; // 18% VAT
    const vatAmount = bodyVatAmount
      ? parseFloat(bodyVatAmount)
      : finalAmount > 0 ? finalAmount * vatRate / (1 + vatRate) : 0;
    const netAmount = finalAmount > 0 ? finalAmount - vatAmount : 0;

    // Calculate RECOGNIZED VAT based on category rules (for expenses only)
    let recognizedVatAmount = vatAmount; // Default: full VAT for income
    if (finalType === 'EXPENSE') {
      const taxCategory = getCategoryById(finalCategory);
      const vatPercentage = taxCategory?.vatPercentage ?? 1.0; // Default to 100% if category not found
      recognizedVatAmount = vatAmount * vatPercentage;

      console.log(`   💰 VAT Calculation: Total VAT: ₪${vatAmount.toFixed(2)}, Category: ${finalCategory}, Recognition: ${(vatPercentage * 100).toFixed(0)}%, Recognized: ₪${recognizedVatAmount.toFixed(2)}`);
    }

    // Create transaction in Prisma
    const transaction = await prisma.transaction.create({
      data: {
        userId: userIdStr,
        type: finalType,
        date: finalDate,
        merchant: finalMerchant,
        description: finalDescription,
        amount: finalAmount,
        vatRate: vatRate,
        vatAmount: parseFloat(vatAmount.toFixed(2)),
        netAmount: parseFloat(netAmount.toFixed(2)),
        recognizedVatAmount: parseFloat(recognizedVatAmount.toFixed(2)),
        category: finalCategory,
        receiptUrl: finalReceiptUrl,
        status: finalStatus,
      },
    });

    console.log(`✅ Created transaction ${transaction.id} (${isQuickDraft ? 'Draft' : 'Complete'})`);

    // Map to frontend format
    const isDraft = transaction.status === 'DRAFT';

    const mapped = {
      id: transaction.id,
      user_id: transaction.userId,
      type: transaction.type.toLowerCase(),
      amount: transaction.amount,
      vat_amount: transaction.vatAmount,
      recognized_vat_amount: transaction.recognizedVatAmount,
      date: transaction.date.toISOString().split('T')[0],
      description: transaction.description || transaction.merchant,
      merchant: transaction.merchant,
      category: transaction.category,
      is_vat_deductible: true,
      document_path: transaction.receiptUrl,
      receiptUrl: transaction.receiptUrl,
      status: isDraft ? 'DRAFT' : 'COMPLETED',
      created_at: transaction.createdAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: mapped,
    });
  } catch (error: any) {
    console.error("❌ Error creating transaction:", error);

    if (error.message === "Authentication required" || error.message.includes("authentication")) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}

// PUT: Update existing transaction
export async function PUT(request: NextRequest) {
  try {
    // Get authenticated user ID
    const userId = await requireAuth();

    // CRITICAL: Convert userId to string for Prisma
    const userIdStr = String(userId);

    const body = await request.json();
    const { id, amount, description, date, category, merchant, type, status } = body;

    console.log(`📝 PUT /api/transactions - User: ${userIdStr}, ID: ${id}`);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Verify transaction exists and belongs to user
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id: id },
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (existingTransaction.userId !== userIdStr) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Prepare updates
    const updates: any = {};

    // Handle amount updates (recalculate VAT)
    if (amount !== undefined) {
      const totalAmount = parseFloat(amount);
      const vatRate = 0.18;
      const vatAmount = totalAmount * vatRate / (1 + vatRate);
      const netAmount = totalAmount - vatAmount;

      updates.amount = totalAmount;
      updates.vatAmount = parseFloat(vatAmount.toFixed(2));
      updates.netAmount = parseFloat(netAmount.toFixed(2));

      // Recalculate recognized VAT (if category is known)
      if (existingTransaction.type === 'EXPENSE') {
        const categoryId = category || existingTransaction.category;
        const taxCategory = getCategoryById(categoryId);
        const vatPercentage = taxCategory?.vatPercentage ?? 1.0;
        const recognizedVatAmount = vatAmount * vatPercentage;
        updates.recognizedVatAmount = parseFloat(recognizedVatAmount.toFixed(2));

        console.log(`   💰 VAT Update: Total VAT: ₪${vatAmount.toFixed(2)}, Recognition: ${(vatPercentage * 100).toFixed(0)}%, Recognized: ₪${recognizedVatAmount.toFixed(2)}`);
      }
    }

    // Handle merchant/description
    if (merchant !== undefined) {
      updates.merchant = merchant;
      updates.description = merchant; // Also update description
    } else if (description !== undefined) {
      updates.merchant = description;
      updates.description = description;
    }

    // Handle date
    if (date !== undefined) {
      updates.date = new Date(date);
    }

    // Handle category (and recalculate recognized VAT for expenses)
    if (category !== undefined) {
      updates.category = category || 'Uncategorized';

      // If category changes for an expense, recalculate recognized VAT
      if (existingTransaction.type === 'EXPENSE') {
        const taxCategory = getCategoryById(category || 'Uncategorized');
        const vatPercentage = taxCategory?.vatPercentage ?? 1.0;
        const recognizedVatAmount = existingTransaction.vatAmount * vatPercentage;
        updates.recognizedVatAmount = parseFloat(recognizedVatAmount.toFixed(2));

        console.log(`   📝 Category Changed: ${existingTransaction.category} → ${category}, VAT Recognition: ${(vatPercentage * 100).toFixed(0)}%`);
      }
    }

    // Handle type
    if (type !== undefined) {
      const normalizedType = type.toUpperCase();
      if (normalizedType === "INCOME" || normalizedType === "EXPENSE") {
        updates.type = normalizedType;
      }
    }

    // Handle status
    if (status === "COMPLETED" || status === "DRAFT") {
      updates.status = status;
    }

    // Update transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id: id },
      data: updates,
    });

    console.log(`✅ Updated transaction ${id}`);

    // Map to frontend format
    const isDraft = updatedTransaction.status === 'DRAFT';

    const mapped = {
      id: updatedTransaction.id,
      user_id: updatedTransaction.userId,
      type: updatedTransaction.type.toLowerCase(),
      amount: updatedTransaction.amount,
      vat_amount: updatedTransaction.vatAmount,
      recognized_vat_amount: updatedTransaction.recognizedVatAmount,
      date: updatedTransaction.date.toISOString().split('T')[0],
      description: updatedTransaction.description || updatedTransaction.merchant,
      merchant: updatedTransaction.merchant,
      category: updatedTransaction.category,
      is_vat_deductible: true,
      document_path: updatedTransaction.receiptUrl,
      receiptUrl: updatedTransaction.receiptUrl,
      status: isDraft ? 'DRAFT' : 'COMPLETED',
      created_at: updatedTransaction.createdAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: mapped,
    });
  } catch (error: any) {
    console.error("❌ Error updating transaction:", error);

    if (error.message === "Authentication required" || error.message.includes("authentication")) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}
