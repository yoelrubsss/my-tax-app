/**
 * Export Professional Monthly Income & Expense Report to CSV
 *
 * Generates a comprehensive CSV report with 3 sections:
 * 1. Income (הכנסות)
 * 2. Expenses (הוצאות)
 * 3. Summary (סיכום דוח)
 *
 * Includes UTF-8 BOM for proper Hebrew display in Excel.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";
import { getCategoryById } from "@/lib/tax-knowledge";

/**
 * Helper function to get Hebrew month name
 */
function getMonthName(month: number): string {
  const hebrewMonths = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
  ];
  return hebrewMonths[month - 1];
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user ID
    const userId = await requireAuth();
    const userIdStr = String(userId);

    // Get month parameter from query string (e.g., "2026-03")
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");

    if (!monthParam) {
      return NextResponse.json(
        { success: false, error: "Month parameter is required (format: YYYY-MM)" },
        { status: 400 }
      );
    }

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json(
        { success: false, error: "Invalid month format. Use YYYY-MM (e.g., 2026-03)" },
        { status: 400 }
      );
    }

    const [year, month] = monthParam.split("-").map(Number);

    // ═══════════════════════════════════════════════════════════════
    // Calculate bi-monthly VAT period (Israeli VAT is reported every 2 months)
    // ═══════════════════════════════════════════════════════════════
    // Period 1: Jan-Feb (months 1-2)
    // Period 2: Mar-Apr (months 3-4)
    // Period 3: May-Jun (months 5-6)
    // Period 4: Jul-Aug (months 7-8)
    // Period 5: Sep-Oct (months 9-10)
    // Period 6: Nov-Dec (months 11-12)

    const periodIndex = Math.ceil(month / 2); // 1→1, 2→1, 3→2, 4→2, 5→3, etc.
    const startMonth = (periodIndex - 1) * 2 + 1; // Period 1→1, Period 2→3, Period 3→5, etc.
    const endMonth = startMonth + 1; // Period 1→2, Period 2→4, Period 3→6, etc.

    // Calculate start and end dates for the bi-monthly period
    const startDate = new Date(year, startMonth - 1, 1); // First day of first month
    const endDate = new Date(year, endMonth, 0, 23, 59, 59, 999); // Last day of second month

    // Generate period label for display
    const periodLabel = `${getMonthName(startMonth)}-${getMonthName(endMonth)} ${year}`;

    console.log(`📥 GET /api/export - User: ${userIdStr}, Month: ${monthParam}`);
    console.log(`   VAT Period ${periodIndex}: ${periodLabel}`);
    console.log(`   Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // ═══════════════════════════════════════════════════════════════
    // PERFORMANCE OPTIMIZED: Single query to fetch user + transactions
    // ═══════════════════════════════════════════════════════════════
    const [user, transactions] = await Promise.all([
      // Fetch user profile for business name (with fallback to user name)
      prisma.user.findUnique({
        where: { id: userIdStr },
        select: {
          name: true, // Secondary fallback if no business name
          profile: {
            select: { businessName: true },
          },
        },
      }),
      // Fetch all COMPLETED transactions for the bi-monthly period
      prisma.transaction.findMany({
        where: {
          userId: userIdStr,
          status: "COMPLETED",
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: "asc" },
      }),
    ]);

    console.log(`✅ Found ${transactions.length} completed transaction(s) for VAT Period ${periodIndex}`);

    // Generate professional CSV report
    const csvContent = generateProfessionalReport(transactions, periodIndex, periodLabel);

    // ═══════════════════════════════════════════════════════════════
    // PROFESSIONAL FILENAME: [BusinessName]_[HebrewMonths]_[Year].csv
    // Fallback chain: businessName → userName → "Business"
    // ═══════════════════════════════════════════════════════════════
    const businessName = user?.profile?.businessName || user?.name || "Business";
    // Sanitize business name for filename (remove special characters)
    const sanitizedBusinessName = businessName
      .replace(/[^a-zA-Z0-9\u0590-\u05FF_]/g, "_") // Keep Hebrew, English, numbers, underscores
      .replace(/_+/g, "_") // Replace multiple underscores with single
      .replace(/^_|_$/g, ""); // Remove leading/trailing underscores

    // Hebrew month names for filename
    const startMonthName = getMonthName(startMonth);
    const endMonthName = getMonthName(endMonth);

    // Full filename with Hebrew characters
    const filename = `${sanitizedBusinessName}_${startMonthName}_${endMonthName}_${year}.csv`;

    // RFC 5987 compliant encoding for non-ASCII filenames
    // Use ASCII fallback + UTF-8 encoded filename* parameter
    const asciiFilename = `vat_report_${year}_period_${periodIndex}.csv`;
    const encodedFilename = encodeURIComponent(filename);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        // RFC 5987: filename (ASCII fallback) + filename* (UTF-8 encoded)
        "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
      },
    });
  } catch (error: unknown) {
    console.error("❌ Error exporting transactions:", error);

    // Handle authentication errors
    if (error instanceof Error && (error.message === "Authentication required" || error.message.includes("authentication"))) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "שגיאה ביצוא הנתונים" },
      { status: 500 }
    );
  }
}

/**
 * Generate professional CSV report with Income, Expenses, and Summary sections
 * Includes UTF-8 BOM for proper Hebrew display in Excel
 */
function generateProfessionalReport(
  transactions: Array<{
    date: Date;
    merchant: string;
    category: string;
    amount: number;
    vatAmount: number;
    recognizedVatAmount: number;
    receiptUrl: string | null;
    type: string;
  }>,
  periodIndex: number,
  periodLabel: string
): string {
  // UTF-8 BOM (Byte Order Mark) for Excel compatibility with Hebrew
  const BOM = "\uFEFF";

  // Helper function to escape CSV fields
  const escapeCsvField = (field: string | null | number) => {
    if (field === null) return "";
    const str = String(field);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Helper function to format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Separate transactions by type
  const incomeTransactions = transactions.filter((tx) => tx.type === "INCOME");
  const expenseTransactions = transactions.filter((tx) => tx.type === "EXPENSE");

  // Initialize CSV content array
  const lines: string[] = [];

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: INCOME (הכנסות)
  // ═══════════════════════════════════════════════════════════════
  lines.push("--- הכנסות ---");
  lines.push(""); // Empty row

  // Income headers
  const incomeHeaders = ["תאריך", "לקוח/תיאור", "סכום כולל", 'מע"מ עסקאות (18%)'];
  lines.push(incomeHeaders.join(","));

  // Income rows
  if (incomeTransactions.length === 0) {
    lines.push("אין הכנסות לתקופה זו");
  } else {
    incomeTransactions.forEach((tx) => {
      const row = [
        escapeCsvField(formatDate(tx.date)),
        escapeCsvField(tx.merchant),
        escapeCsvField(tx.amount.toFixed(2)),
        escapeCsvField(tx.vatAmount.toFixed(2)),
      ];
      lines.push(row.join(","));
    });
  }

  lines.push(""); // Empty row
  lines.push(""); // Empty row

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: EXPENSES (הוצאות)
  // ═══════════════════════════════════════════════════════════════
  lines.push("--- הוצאות ---");
  lines.push(""); // Empty row

  // Expense headers
  const expenseHeaders = [
    "תאריך",
    "בית עסק",
    "קטגוריה",
    "סכום כולל",
    'מע"מ שולם',
    'מע"מ מוכר',
    "לינק",
  ];
  lines.push(expenseHeaders.join(","));

  // Expense rows
  if (expenseTransactions.length === 0) {
    lines.push("אין הוצאות לתקופה זו");
  } else {
    expenseTransactions.forEach((tx) => {
      const category = getCategoryById(tx.category);
      const categoryLabel = category ? category.label : tx.category;

      const row = [
        escapeCsvField(formatDate(tx.date)),
        escapeCsvField(tx.merchant),
        escapeCsvField(categoryLabel),
        escapeCsvField(tx.amount.toFixed(2)),
        escapeCsvField(tx.vatAmount.toFixed(2)),
        escapeCsvField(tx.recognizedVatAmount.toFixed(2)),
        escapeCsvField(tx.receiptUrl),
      ];
      lines.push(row.join(","));
    });
  }

  lines.push(""); // Empty row
  lines.push(""); // Empty row

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: SUMMARY (סיכום דוח)
  // ═══════════════════════════════════════════════════════════════
  lines.push("--- סיכום תקופתי ---");
  lines.push(""); // Empty row

  // Calculate totals
  const totalIncome = incomeTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const totalIncomeVAT = incomeTransactions.reduce((sum, tx) => sum + tx.vatAmount, 0);
  const totalIncomeNet = totalIncome - totalIncomeVAT;

  const totalRecognizedVAT = expenseTransactions.reduce(
    (sum, tx) => sum + tx.recognizedVatAmount,
    0
  );

  // VAT balance: VAT to pay (from income) - VAT to claim (from expenses)
  const vatBalance = totalIncomeVAT - totalRecognizedVAT;

  // Summary rows
  lines.push(`סך הכל הכנסות (ללא מע"מ),₪${totalIncomeNet.toFixed(2)}`);
  lines.push(`סך הכל מע"מ עסקאות (לשלם),₪${totalIncomeVAT.toFixed(2)}`);
  lines.push(`סך הכל מע"מ תשומות מוכר (לקבל),₪${totalRecognizedVAT.toFixed(2)}`);
  lines.push(""); // Empty row

  // VAT balance - indicate if to pay or refund
  const vatBalanceLabel =
    vatBalance > 0
      ? `יתרת מע"מ לתשלום,₪${vatBalance.toFixed(2)}`
      : vatBalance < 0
      ? `יתרת מע"מ להחזר,₪${Math.abs(vatBalance).toFixed(2)}`
      : `יתרת מע"מ,₪0.00`;

  lines.push(vatBalanceLabel);

  lines.push(""); // Empty row
  lines.push(`תקופת דוח: תקופה ${periodIndex} (${periodLabel})`);

  // Combine all lines with BOM
  return BOM + lines.join("\n");
}
