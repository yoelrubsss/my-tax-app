import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";
import { assertIsAdmin } from "@/lib/admin";

/**
 * GET /api/admin/users — list all users with transaction counts (admin only).
 */
export async function GET() {
  try {
    const userId = await requireAuth();
    if (!(await assertIsAdmin(userId))) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        whatsappPhone: true,
        whatsappPhone2: true,
        createdAt: true,
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        whatsappPhone: u.whatsappPhone,
        whatsappPhone2: u.whatsappPhone2,
        createdAt: u.createdAt.toISOString(),
        transactionCount: u._count.transactions,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Authentication required" || msg.includes("authentication")) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }
    console.error("GET /api/admin/users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list users" },
      { status: 500 }
    );
  }
}
