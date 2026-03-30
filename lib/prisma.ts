import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton for Next.js (especially dev / HMR).
 * Each hot reload would otherwise instantiate a new PrismaClient and exhaust DB connections.
 *
 * Pattern: reuse `globalThis.prisma` in development; production uses a fresh client per isolated runtime.
 *
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
