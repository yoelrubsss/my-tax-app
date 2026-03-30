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
