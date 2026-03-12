/**
 * ✅ MIGRATED TO PRISMA DATABASE
 *
 * Server-side authentication utilities.
 * Verifies JWT tokens and returns Prisma CUID strings (not numbers).
 */

import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

// Secret key for JWT (must match login route)
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

/**
 * Get the currently authenticated user's ID from JWT token
 * Returns the user ID (CUID string) if authenticated, or null if not authenticated
 * @throws Error if token exists but is invalid/expired
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return null;
    }

    // Verify JWT token
    const { payload } = await jwtVerify(token, SECRET_KEY);

    // CRITICAL: After Prisma migration, userId is a STRING (CUID), not a number
    if (!payload.userId || typeof payload.userId !== "string") {
      throw new Error("Invalid token payload: userId must be a string");
    }

    const userId = payload.userId as string;

    // OPTIONAL: Verify user still exists in Prisma database
    // This prevents deleted users from using old tokens
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }, // Only fetch ID for performance
    });

    if (!user) {
      throw new Error("User no longer exists");
    }

    return userId;
  } catch (error) {
    // If token exists but is invalid/expired, throw error
    console.error("❌ Error verifying auth token:", error);
    throw new Error("Invalid or expired authentication token");
  }
}

/**
 * Get the currently authenticated user's ID or throw an error
 * Use this when authentication is required
 * @throws Error if not authenticated or token is invalid
 * @returns User ID as CUID string (e.g., "clh1234567890")
 */
export async function requireAuth(): Promise<string> {
  const userId = await getCurrentUserId();

  if (userId === null) {
    throw new Error("Authentication required");
  }

  return userId;
}
