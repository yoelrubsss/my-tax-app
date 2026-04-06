/**
 * ✅ MIGRATED TO PRISMA DATABASE
 *
 * DELETE endpoint for transactions - now uses Prisma.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";
import { devLog } from "@/lib/dev-log";

// DELETE: Remove a transaction by ID (with authorization check)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated user ID
    const userId = await requireAuth();

    // CRITICAL: Convert userId to string for Prisma
    const userIdStr = String(userId);

    const { id } = await params;

    devLog(`🗑️  DELETE /api/transactions/${id} - User: ${userIdStr}`);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

    // Fetch the transaction first to verify ownership
    const transaction = await prisma.transaction.findUnique({
      where: { id: id },
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Authorization check: Ensure the transaction belongs to the current user
    if (transaction.userId !== userIdStr) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You can only delete your own transactions" },
        { status: 403 }
      );
    }

    // Proceed with deletion
    await prisma.transaction.delete({
      where: { id: id },
    });

    devLog(`✅ Deleted transaction ${id}`);

    return NextResponse.json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (error: any) {
    console.error("❌ Error deleting transaction:", error);

    // Handle authentication errors
    if (error.message === "Authentication required" || error.message.includes("authentication")) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
