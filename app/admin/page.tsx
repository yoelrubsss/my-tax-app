import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-server";
import { isAdminUser } from "@/lib/admin";

function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export default async function AdminPage() {
  let userId: string;
  try {
    const id = await getCurrentUserId();
    if (!id) {
      redirect("/login");
    }
    userId = id;
  } catch {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user || !isAdminUser(user.email, user.id)) {
    redirect("/");
  }

  const [totalUsers, receiptsScannedToday, latestFeedback] = await Promise.all([
    prisma.user.count(),
    prisma.transaction.count({
      where: {
        createdAt: { gte: startOfTodayUtc() },
        AND: [
          { receiptUrl: { not: null } },
          { receiptUrl: { not: "" } },
        ],
      },
    }),
    prisma.feedbackLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        user: { select: { email: true } },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">ניהול — סיכום</h1>
          <Link
            href="/"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow ring-1 ring-gray-200 hover:bg-gray-50"
          >
            חזרה לדשבורד
          </Link>
        </div>

        <p className="mb-6 text-sm text-gray-600">
          גישה מוגבלת (ADMIN_EMAIL / ADMIN_USER_IDS).
        </p>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-6 shadow ring-1 ring-gray-100">
            <p className="text-sm font-medium text-gray-500">סה״כ משתמשים</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{totalUsers}</p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow ring-1 ring-gray-100">
            <p className="text-sm font-medium text-gray-500">קבלות נסרקו היום (עסקאות עם קובץ)</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{receiptsScannedToday}</p>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow ring-1 ring-gray-100">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">דיווחי משתמשים אחרונים</h2>
          {latestFeedback.length === 0 ? (
            <p className="text-gray-500">אין דיווחים עדיין.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {latestFeedback.map((row) => (
                <li key={row.id} className="py-4 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-gray-500">
                    <span>{row.user.email}</span>
                    <time dateTime={row.createdAt.toISOString()}>
                      {row.createdAt.toLocaleString("he-IL")}
                    </time>
                  </div>
                  <p className="mt-1 break-all text-sm text-blue-700">{row.pageUrl}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{row.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
