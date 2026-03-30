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
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";
import { getCategoryById } from "@/lib/tax-knowledge";
import { formatIsraeliPhoneForDisplay } from "@/lib/phone-utils";

// GET: Fetch all transactions for the authenticated user
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user ID
    const userId = await requireAuth();

    // CRITICAL: Convert userId to string for Prisma
    const userIdStr = String(userId);

    const { searchParams } = new URL(request.url);

    /** Lightweight fingerprint for dashboard polling (count + newest row). Uses idx_user_created_at. */
    if (searchParams.get("summary") === "1") {
      const agg = await prisma.transaction.aggregate({
        where: { userId: userIdStr },
        _count: { _all: true },
        _max: { createdAt: true },
      });
      return NextResponse.json({
        success: true,
        summary: {
          count: agg._count._all,
          latestCreatedAt: agg._max.createdAt?.toISOString() ?? null,
        },
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`📥 GET /api/transactions - User: ${userIdStr}`);
    }

    // Get filters from query params
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const statusParam = searchParams.get("status");
    const includeProfile = searchParams.get("includeProfile") === "1";

    if (process.env.NODE_ENV === "development") {
      console.log(
        `   Filters: startDate=${startDate}, endDate=${endDate}, includeProfile=${includeProfile}`
      );
    }

    // Build Prisma where clause
    const where: Prisma.TransactionWhereInput = {
      userId: userIdStr,
    };

    // Optional status filtering (export / VAT report / etc.)
    if (statusParam) {
      const normalizedStatus = statusParam.toString().toUpperCase();
      if (normalizedStatus === "DRAFT" || normalizedStatus === "COMPLETED") {
        where.status = normalizedStatus;
      }
    }

    // Date range: when both bounds set, return COMPLETED in range OR any DRAFT (inbox always sees pending drafts).
    if (startDate && endDate && !statusParam) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.OR = [
        { status: "DRAFT" },
        {
          status: "COMPLETED",
          date: { gte: start, lte: end },
        },
      ];
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.date.lte = endDateTime;
      }
    }

    // Global fingerprint + hasAny (parallel with list; cheap with idx_user_created_at)
    const globalAggPromise = prisma.transaction.aggregate({
      where: { userId: userIdStr },
      _count: { _all: true },
      _max: { createdAt: true },
    });

    // Fetch transactions (+ optional profile)
    const [transactions, globalAgg, profileUser] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
      }),
      globalAggPromise,
      includeProfile
        ? prisma.user.findUnique({
            where: { id: userIdStr },
            select: {
              whatsappPhone: true,
              whatsappPhone2: true,
              profile: true,
            },
          })
        : Promise.resolve(null),
    ]);

    // Map Prisma fields to frontend-expected format (snake_case for backward compatibility)
    const mappedTransactions = transactions.map(tx => {
      const isDraft = tx.status === 'DRAFT';
      const isVatDeductible = tx.type === "EXPENSE" ? tx.isRecognized : true;

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
        is_vat_deductible: isVatDeductible,
        document_path: tx.receiptUrl, // Map receiptUrl → document_path
        receiptUrl: tx.receiptUrl,
        status: isDraft ? 'DRAFT' : 'COMPLETED',
        created_at: tx.createdAt.toISOString(),
      };
    });

    // Count drafts for logging
    const draftCount = mappedTransactions.filter(tx => tx.status === 'DRAFT').length;
    const completedCount = mappedTransactions.length - draftCount;

    if (process.env.NODE_ENV === "development") {
      console.log(
        `✅ Found ${transactions.length} transaction(s): ${completedCount} completed, ${draftCount} drafts`
      );
    }

    const payload: {
      success: boolean;
      data: typeof mappedTransactions;
      profile?: Record<string, unknown>;
      meta?: {
        summary: { count: number; latestCreatedAt: string | null };
        hasAnyTransaction: boolean;
      };
    } = {
      success: true,
      data: mappedTransactions,
      meta: {
        summary: {
          count: globalAgg._count._all,
          latestCreatedAt: globalAgg._max.createdAt?.toISOString() ?? null,
        },
        hasAnyTransaction: globalAgg._count._all > 0,
      },
    };

    if (includeProfile && profileUser) {
      const profile = profileUser.profile ?? null;
      payload.profile = {
        ...(profile ?? {}),
        whatsapp_phone: profileUser.whatsappPhone
          ? formatIsraeliPhoneForDisplay(profileUser.whatsappPhone)
          : null,
        whatsapp_phone_2: profileUser.whatsappPhone2
          ? formatIsraeliPhoneForDisplay(profileUser.whatsappPhone2)
          : null,
      };
    }

    return NextResponse.json(payload);
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
    const {
      type,
      amount,
      vatAmount: bodyVatAmount,
      date,
      description,
      merchant,
      category,
      receiptUrl,
      document_path,
      status,
      is_vat_deductible,
    } = body;

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

    // Calculate RECOGNIZED VAT based on category rules + UI choice (is_vat_deductible)
    let recognizedVatAmount = vatAmount; // Default: full VAT for income
    let isRecognized = true;
    if (finalType === "EXPENSE") {
      const taxCategory = getCategoryById(finalCategory);
      const vatPercentage = taxCategory?.vatPercentage ?? 1.0; // Default to 100% if category not found

      // If UI explicitly set it, respect that. Otherwise (e.g. AI quick draft), infer from category.
      if (typeof is_vat_deductible === "boolean") {
        isRecognized = is_vat_deductible;
      } else {
        isRecognized = vatPercentage > 0;
      }

      recognizedVatAmount = isRecognized ? vatAmount * vatPercentage : 0;

      console.log(
        `   💰 VAT Calculation: Total VAT: ₪${vatAmount.toFixed(
          2
        )}, Category: ${finalCategory}, is_vat_deductible: ${isRecognized}, Recognition: ${(
          vatPercentage * 100
        ).toFixed(0)}%, Recognized: ₪${recognizedVatAmount.toFixed(2)}`
      );
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
        isRecognized,
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
      is_vat_deductible: transaction.type === "EXPENSE" ? transaction.isRecognized : true,
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
    const {
      id,
      amount,
      description,
      date,
      category,
      merchant,
      type,
      status,
      is_vat_deductible,
    } = body;

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

    // -----------------------------
    // Coherent VAT computation
    // (Fixes drift when both amount + category change together)
    // -----------------------------
    const finalType = type ? type.toUpperCase() : existingTransaction.type;
    if (finalType !== "INCOME" && finalType !== "EXPENSE") {
      return NextResponse.json(
        { success: false, error: "Type must be 'income' or 'expense'" },
        { status: 400 }
      );
    }

    const finalAmount =
      amount !== undefined ? parseFloat(amount) : existingTransaction.amount;

    const vatRate = existingTransaction.vatRate ?? 0.18;
    const computedVatAmount =
      finalAmount > 0 ? (finalAmount * vatRate) / (1 + vatRate) : 0;
    const computedNetAmount = finalAmount - computedVatAmount;

    // If amount didn't change, reuse stored VAT to avoid rounding drift
    const vatAmountToUse =
      amount !== undefined
        ? computedVatAmount
        : existingTransaction.vatAmount;

    const netAmountToUse =
      amount !== undefined
        ? computedNetAmount
        : existingTransaction.netAmount;

    const finalCategory =
      category !== undefined
        ? (category || "Uncategorized")
        : existingTransaction.category;

    // UI may explicitly set deductibility; otherwise keep stored value
    let finalIsRecognized = existingTransaction.isRecognized;
    if (is_vat_deductible !== undefined) {
      finalIsRecognized = !!is_vat_deductible;
    }

    // For income, VAT is always treated as recognized
    if (finalType === "INCOME") {
      finalIsRecognized = true;
    }

    let finalRecognizedVatAmount = vatAmountToUse;
    if (finalType === "EXPENSE") {
      const taxCategory = getCategoryById(finalCategory);
      const vatPercentage = taxCategory?.vatPercentage ?? 1.0;
      finalRecognizedVatAmount = finalIsRecognized
        ? vatAmountToUse * vatPercentage
        : 0;
    }

    const roundedRecognizedVatAmount = parseFloat(
      finalRecognizedVatAmount.toFixed(2)
    );
    const roundedVatAmount = parseFloat(vatAmountToUse.toFixed(2));
    const roundedNetAmount = parseFloat(netAmountToUse.toFixed(2));

    // Prepare updates
    const updates: any = {};

    // Handle amount updates (VAT + net)
    if (amount !== undefined) {
      updates.amount = finalAmount;
      updates.vatAmount = roundedVatAmount;
      updates.netAmount = roundedNetAmount;
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
      updates.category = finalCategory;
    }

    // Handle type
    if (type !== undefined) {
      updates.type = finalType;
    }

    // Persist UI deductibility choice (maps to Prisma `isRecognized`)
    if (is_vat_deductible !== undefined) {
      updates.isRecognized = finalIsRecognized;
    }

    // Recalculate recognized VAT if any of its inputs changed
    const shouldRecalculateRecognizedVat =
      amount !== undefined ||
      category !== undefined ||
      type !== undefined ||
      is_vat_deductible !== undefined;

    if (shouldRecalculateRecognizedVat) {
      updates.recognizedVatAmount = roundedRecognizedVatAmount;
      // Ensure consistency when type flips expense <-> income
      if (finalType === "INCOME") {
        updates.isRecognized = true;
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
      is_vat_deductible:
        updatedTransaction.type === "EXPENSE"
          ? updatedTransaction.isRecognized
          : true,
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
