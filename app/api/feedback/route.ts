import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";

const MAX_MESSAGE_LEN = 8000;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.trim() : "";

    if (!message) {
      return NextResponse.json(
        { success: false, error: "הודעה ריקה" },
        { status: 400 }
      );
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return NextResponse.json(
        { success: false, error: "ההודעה ארוכה מדי" },
        { status: 400 }
      );
    }

    const safeUrl = pageUrl.slice(0, 2048);

    await prisma.feedbackLog.create({
      data: {
        userId,
        message,
        pageUrl: safeUrl || "(לא צוין)",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "Authentication required" || msg.includes("authentication")) {
      return NextResponse.json(
        { success: false, error: "לא מחובר" },
        { status: 401 }
      );
    }
    console.error("POST /api/feedback:", error);
    return NextResponse.json(
      { success: false, error: "שמירת הדיווח נכשלה" },
      { status: 500 }
    );
  }
}
