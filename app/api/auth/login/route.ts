/**
 * ✅ MIGRATED TO PRISMA DATABASE
 *
 * User Login endpoint - now uses Prisma as the single source of truth.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { isAdminUser } from "@/lib/admin";

// Secret key for JWT (in production, use environment variable)
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

// POST: Login user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    console.log("🔐 Login attempt:", { email });

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user by email (include profile for business info)
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      console.log("❌ User not found:", email);
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log("❌ Invalid password for:", email);
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // CRITICAL: JWT payload uses userId as STRING (CUID), not number
    // This matches Prisma's String ID type
    const token = await new SignJWT({
      userId: user.id, // String CUID
      email: user.email,
      name: user.name,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d") // Token expires in 7 days
      .sign(SECRET_KEY);

    console.log(`✅ Login successful: ${user.id} (${user.email})`);

    // Create response with user data (without password)
    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id, // CUID string
        email: user.email,
        name: user.name,
        dealer_number: user.dealerNumber,
        business_name: user.profile?.businessName,
        is_admin: isAdminUser(user.email, user.id),
      },
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;

  } catch (error) {
    console.error("❌ Error logging in:", error);
    return NextResponse.json(
      { success: false, error: "Failed to login" },
      { status: 500 }
    );
  }
}
