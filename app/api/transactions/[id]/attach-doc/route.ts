import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { getTransactionById, updateTransactionDocument } from "@/lib/db-operations";
import "@/lib/init-db";

// POST: Attach document to transaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const userId = await requireAuth();

    const { id: idString } = await params;
    const transactionId = parseInt(idString);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { success: false, error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

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
    const transaction = getTransactionById(transactionId);

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Authorization check: Ensure transaction belongs to current user
    if (transaction.user_id !== userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You can only attach documents to your own transactions" },
        { status: 403 }
      );
    }

    // Update document path
    const result = updateTransactionDocument(transactionId, documentPath);

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to update transaction" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Document attached successfully",
      documentPath,
    });

  } catch (error: any) {
    console.error("Error attaching document:", error);

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
