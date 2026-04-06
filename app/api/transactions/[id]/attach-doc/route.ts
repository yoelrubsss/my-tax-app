/**
 * ✅ MIGRATED TO PRISMA DATABASE
 *
 * Document attachment now uses Prisma directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { devLog } from "@/lib/dev-log";

// POST: Attach document to transaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user (returns CUID string)
    const userId = await requireAuth();

    const { id: transactionId } = await params;

    // Parse request body
    const body = await request.json();
    const { documentPath } = body;

    if (!documentPath || typeof documentPath !== "string") {
      return NextResponse.json(
        { success: false, error: "Document path is required" },
        { status: 400 }
      );
    }

    // Fetch transaction to verify ownership
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Authorization check: Ensure transaction belongs to current user
    if (transaction.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You can only attach documents to your own transactions" },
        { status: 403 }
      );
    }

    // Update document path
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { receiptUrl: documentPath },
    });

    devLog(`✅ Attached document to transaction ${transactionId}`);

    return NextResponse.json({
      success: true,
      message: "Document attached successfully",
      documentPath,
    });

  } catch (error: any) {
    console.error("❌ Error attaching document:", error);

    // Handle authentication errors
    if (error.message === "Authentication required" || error.message.includes("authentication")) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to attach document" },
      { status: 500 }
    );
  }
}
