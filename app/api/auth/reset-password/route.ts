/**
 * ✅ PASSWORD RESET - RESET PASSWORD ENDPOINT
 *
 * Validates token and updates user's password.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// POST: Reset password with token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    console.log("🔑 Password reset attempt with token");

    // Validate required fields
    if (!token || !password) {
      return NextResponse.json(
        { success: false, error: "טוקן וסיסמה נדרשים" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "הסיסמה חייבת להכיל לפחות 6 תווים" },
        { status: 400 }
      );
    }

    // Find valid token
    const resetToken = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      console.log("❌ Invalid reset token");
      return NextResponse.json(
        { success: false, error: "קישור איפוס הסיסמה אינו תקין" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date() > resetToken.expiresAt) {
      console.log("❌ Expired reset token");
      // Delete expired token
      await prisma.passwordReset.delete({
        where: { id: resetToken.id },
      });
      return NextResponse.json(
        { success: false, error: "קישור איפוס הסיסמה פג תוקפו. אנא בקש קישור חדש." },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user's password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    // Delete used token
    await prisma.passwordReset.delete({
      where: { id: resetToken.id },
    });

    // Delete all other reset tokens for this user (if any)
    await prisma.passwordReset.deleteMany({
      where: { userId: resetToken.userId },
    });

    console.log(`✅ Password reset successful for user: ${resetToken.user.email}`);

    return NextResponse.json({
      success: true,
      message: "הסיסמה אופסה בהצלחה",
    });

  } catch (error) {
    console.error("❌ Error in reset-password:", error);
    return NextResponse.json(
      { success: false, error: "שגיאה באיפוס הסיסמה" },
      { status: 500 }
    );
  }
}
