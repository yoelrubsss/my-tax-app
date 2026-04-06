/**
 * ✅ MIGRATED TO PRISMA DATABASE
 *
 * User Registration endpoint - now uses Prisma as the single source of truth.
 * Creates User AND UserProfile atomically to prevent foreign key errors.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isAdminUser } from "@/lib/admin";
import { devLog } from "@/lib/dev-log";

// POST: Register new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, dealer_number, business_name } = body;

    devLog("📝 Registration attempt:", { email, name, dealer_number, business_name });

    // Validate required fields
    if (!email || !password || !name || !dealer_number) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Validate dealer number format (9 digits)
    const dealerRegex = /^\d{9}$/;
    if (!dealerRegex.test(dealer_number)) {
      return NextResponse.json(
        { success: false, error: "Dealer number must be 9 digits" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Email already registered" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user AND profile atomically (prevents foreign key errors)
    const newUser = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        name,
        dealerNumber: dealer_number,
        profile: {
          create: {
            businessName: business_name || null,
            businessType: "OSEK_MURSHE", // Default to Osek Murshe (most common)
          },
        },
      },
      include: {
        profile: true, // Include profile in response
      },
    });

    devLog(`✅ User created successfully: ${newUser.id} (${newUser.email})`);

    return NextResponse.json({
      success: true,
      data: {
        id: newUser.id, // CUID string
        email: newUser.email,
        name: newUser.name,
        dealer_number: newUser.dealerNumber,
        business_name: newUser.profile?.businessName,
        is_admin: isAdminUser(newUser.email, newUser.id),
      },
    }, { status: 201 });

  } catch (error) {
    console.error("❌ Error registering user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register user" },
      { status: 500 }
    );
  }
}
