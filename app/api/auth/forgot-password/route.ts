/**
 * ✅ PASSWORD RESET - FORGOT PASSWORD ENDPOINT
 *
 * Generates a secure token and sends password reset email via Resend.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST: Request password reset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    console.log("🔑 Password reset request:", { email });

    // Validate email
    if (!email) {
      return NextResponse.json(
        { success: false, error: "כתובת האימייל נדרשת" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Don't reveal if user exists or not (security best practice)
    if (!user) {
      console.log("⚠️ Password reset requested for non-existent email:", email);
      return NextResponse.json({
        success: true,
        message: "אם כתובת האימייל קיימת במערכת, נשלח אליך קישור לאיפוס סיסמה",
      });
    }

    // Generate secure token (32 bytes = 64 hex characters)
    const token = crypto.randomBytes(32).toString("hex");

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Save token to database
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Create reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;

    // Send email via Resend
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: email,
        subject: "איפוס סיסמה - מערכת ניהול מע״מ",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">איפוס סיסמה</h2>
            <p>שלום ${user.name || "משתמש יקר"},</p>
            <p>קיבלנו בקשה לאיפוס סיסמה עבור חשבונך במערכת ניהול המע״מ.</p>
            <p>לחץ על הכפתור למעבר לעמוד איפוס הסיסמה:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                אפס סיסמה
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">או העתק את הקישור הבא לדפדפן:</p>
            <p style="word-break: break-all; color: #2563eb; font-size: 12px;">${resetUrl}</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #666; font-size: 12px;">
              הקישור תקף למשך שעה אחת בלבד.<br>
              אם לא ביקשת לאפס את הסיסמה, התעלם מהודעה זו.
            </p>
            <p style="color: #666; font-size: 12px;">
              מערכת מאובטחת לניהול מע״מ
            </p>
          </div>
        `,
      });

      console.log(`✅ Password reset email sent to: ${email}`);
    } catch (emailError) {
      console.error("❌ Failed to send email:", emailError);
      // Don't fail the request if email fails - token is still saved
      return NextResponse.json({
        success: true,
        message: "אם כתובת האימייל קיימת במערכת, נשלח אליך קישור לאיפוס סיסמה",
        warning: "שגיאה בשליחת האימייל, אנא נסה שנית מאוחר יותר",
      });
    }

    return NextResponse.json({
      success: true,
      message: "אם כתובת האימייל קיימת במערכת, נשלח אליך קישור לאיפוס סיסמה",
    });

  } catch (error) {
    console.error("❌ Error in forgot-password:", error);
    return NextResponse.json(
      { success: false, error: "שגיאה בשליחת בקשת איפוס הסיסמה" },
      { status: 500 }
    );
  }
}
