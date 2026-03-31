import { prisma } from "@/lib/prisma";

/**
 * Admin access for /admin and internal dashboards.
 * Set ADMIN_EMAIL (lowercase match) and/or comma-separated ADMIN_USER_IDS in env.
 */
export function isAdminUser(email: string, userId: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail && email.trim().toLowerCase() === adminEmail) {
    return true;
  }
  const ids = process.env.ADMIN_USER_IDS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  if (ids.length > 0 && ids.includes(userId)) {
    return true;
  }
  return false;
}

/** Returns true if the user exists and is an admin (for API routes after requireAuth). */
export async function assertIsAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return !!(user && isAdminUser(user.email, userId));
}
