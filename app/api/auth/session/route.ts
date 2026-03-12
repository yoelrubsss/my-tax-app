import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getUser } from "@/lib/db-operations";

// Secret key for JWT (must match login route)
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

// GET: Get current session
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify JWT token
    const { payload } = await jwtVerify(token, SECRET_KEY);

    // Get fresh user data from database
    const user = getUser(payload.userId as number);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Return user data (without password)
    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        dealer_number: user.dealer_number,
        business_name: user.business_name,
      },
    });

  } catch (error) {
    console.error("Error verifying session:", error);
    return NextResponse.json(
      { success: false, error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}
