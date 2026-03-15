"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Receipt, LogOut, User, TrendingUp, TrendingDown, DollarSign, Settings } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import TransactionManager from "@/components/TransactionManager";
import DraftsInbox from "@/components/DraftsInbox";
import TransactionEditor from "@/components/TransactionEditor";
import BulkUploadArea from "@/components/BulkUploadArea";
import AIChat from "@/components/AIChat";

interface Transaction {
  id: string | number; // Support both CUID and legacy numeric IDs
  type?: "income" | "expense";
  amount?: number;
  vat_amount?: number;
  recognized_vat_amount?: number; // CLAIMABLE VAT after category rules
  date?: string;
  description?: string;
  category?: string;
  is_vat_deductible?: boolean;
  document_path?: string;
  status?: "DRAFT" | "COMPLETED";
  created_at?: string;
}

interface DashboardStats {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  vatToPay: number;
  incomeVAT: number;
  expenseVAT: number;
}

export default function HomeContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<Transaction | null>(null);
  // AI suggestions map: draft transaction id → suggested amount (populated by BulkUploadArea)
  const [aiSuggestionsMap, setAiSuggestionsMap] = useState<Record<string, number>>({});
  // Currency warnings map: draft transaction id → warning message (populated by BulkUploadArea)
  const [currencyWarningsMap, setCurrencyWarningsMap] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<DashboardStats>({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    vatToPay: 0,
    incomeVAT: 0,
    expenseVAT: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // ═══════════════════════════════════════════════════════════════
  // PERFORMANCE OPTIMIZED: Fetch stats with stable reference
  // RACE CONDITION PROTECTED: Uses AbortController for cancellation
  // ═══════════════════════════════════════════════════════════════
  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoadingStats(true);

      // Clear old stats immediately to prevent ghosting
      setStats({
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
        vatToPay: 0,
        incomeVAT: 0,
        expenseVAT: 0,
      });

      // Get date range from URL query params
      const monthParam = searchParams?.get("month");
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (monthParam) {
        // monthParam format: YYYY-MM (always odd month - period start)
        const [year, month] = monthParam.split("-");
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);

        // BI-MONTHLY LOGIC: Filter from start of current month to end of NEXT month
        // Example: Jan (01) -> Jan 1 to Feb 28/29
        //          Mar (03) -> Mar 1 to Apr 30

        // Start date: First day of current month
        startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;

        // End date: Last day of NEXT month (current month + 1)
        const nextMonth = monthNum + 1;
        let endYear = yearNum;
        let endMonthNum = nextMonth;

        // Handle year rollover (Dec -> Jan)
        if (nextMonth > 12) {
          endYear = yearNum + 1;
          endMonthNum = 1;
        }

        // Calculate last day of the NEXT month
        let lastDay: number;
        if (endMonthNum === 2) {
          // February - check for leap year
          const isLeapYear = (endYear % 4 === 0 && endYear % 100 !== 0) || (endYear % 400 === 0);
          lastDay = isLeapYear ? 29 : 28;
        } else if ([4, 6, 9, 11].includes(endMonthNum)) {
          // April, June, September, November have 30 days
          lastDay = 30;
        } else {
          // January, March, May, July, August, October, December have 31 days
          lastDay = 31;
        }

        endDate = `${endYear}-${String(endMonthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        console.log(`📅 BI-MONTHLY VAT Period: ${monthParam} (${startDate} to ${endDate})`);
      }

      // Build query string (NOTE: Prisma schema has no status field, so we fetch all)
      let query = "";
      if (startDate) query += `${query ? '&' : ''}startDate=${startDate}`;
      if (endDate) query += `${query ? '&' : ''}endDate=${endDate}`;

      // Fetch transactions (all transactions are considered complete in Prisma schema)
      const apiUrl = `/api/transactions${query ? `?${query}` : ''}`;
      console.log(`🔍 Fetching transactions from: ${apiUrl}`);

      const response = await fetch(apiUrl, { signal });

      // If request was aborted, exit early
      if (signal?.aborted) {
        console.log("⚠️ Fetch aborted - period changed");
        return;
      }

      const result = await response.json();

      console.log(`📥 API Response:`, {
        success: result.success,
        dataLength: result.data?.length,
        query: query || 'none',
      });

      if (result.success && Array.isArray(result.data)) {
        const transactions: Transaction[] = result.data;

        console.log(`📊 Found ${transactions.length} raw transactions from API`);

        // Filter to only transactions with valid amounts
        const validTransactions = transactions.filter(
          (t) => t.amount != null && t.amount > 0
        );

        console.log(`✅ ${validTransactions.length} transactions with valid amounts`);

        if (validTransactions.length < transactions.length) {
          console.warn(`⚠️ Filtered out ${transactions.length - validTransactions.length} transactions with invalid amounts`);
        }

        const completedTransactions = validTransactions;

        // Calculate income totals
        const incomeTransactions = completedTransactions.filter((t) => t.type === "income");
        const totalIncome = incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        const incomeVAT = incomeTransactions.reduce((sum, t) => sum + (t.vat_amount || 0), 0);

        console.log("💰 Income:", incomeTransactions.length, "transactions, total:", totalIncome, "VAT:", incomeVAT);

        // Calculate expense totals
        const expenseTransactions = completedTransactions.filter((t) => t.type === "expense");
        const totalExpenses = expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        // CRITICAL FIX: Use RECOGNIZED VAT (not total VAT from receipts)
        const expenseVAT = expenseTransactions.reduce((sum, t) => sum + (t.recognized_vat_amount || t.vat_amount || 0), 0);

        console.log("💸 Expenses:", expenseTransactions.length, "transactions, total:", totalExpenses, "Recognized VAT:", expenseVAT);

        // Calculate net profit and VAT to pay
        const netProfit = totalIncome - totalExpenses;
        const vatToPay = incomeVAT - expenseVAT;

        console.log("📈 Net Profit:", netProfit, "VAT to Pay:", vatToPay);

        setStats({
          totalIncome,
          totalExpenses,
          netProfit,
          vatToPay,
          incomeVAT,
          expenseVAT,
        });
      } else {
        console.warn("Failed to fetch transactions or no data");
        // Set to 0 if no transactions
        setStats({
          totalIncome: 0,
          totalExpenses: 0,
          netProfit: 0,
          vatToPay: 0,
          incomeVAT: 0,
          expenseVAT: 0,
        });
      }
    } catch (error) {
      // Ignore abort errors (they're intentional when period changes)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("⚠️ Fetch cancelled - period changed");
        return;
      }

      console.error("Error fetching stats:", error);
      // Set to 0 on error
      setStats({
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
        vatToPay: 0,
        incomeVAT: 0,
        expenseVAT: 0,
      });
    } finally {
      setLoadingStats(false);
    }
  }, [searchParams]); // Stable dependency - only searchParams

  // ═══════════════════════════════════════════════════════════════
  // UNIFIED MOUNT LOGIC: Handle period redirect + stats fetch
  // RACE CONDITION PROTECTED: Cancels previous fetch when period changes
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const monthParam = searchParams?.get("month");

    // Create AbortController for this fetch
    const abortController = new AbortController();

    // ═══════════════════════════════════════════════════════════════
    // ANTI-GHOSTING FIX: Clear old stats immediately when month changes
    // ═══════════════════════════════════════════════════════════════
    setLoadingStats(true);

    // Check if we need to redirect to correct period
    let needsRedirect = false;
    let targetMonth = "";

    if (!monthParam) {
      // No month in URL - calculate current VAT period start month
      const now = new Date();
      const year = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12

      // If current month is even (Feb, Apr, Jun, etc.), subtract 1 to get period start
      // Jan-Feb period starts in Jan (1), Mar-Apr starts in Mar (3), etc.
      const periodStartMonth = currentMonth % 2 === 0 ? currentMonth - 1 : currentMonth;
      const periodStartMonthStr = String(periodStartMonth).padStart(2, '0');
      targetMonth = `${year}-${periodStartMonthStr}`;

      console.log(`📅 No month parameter found, redirecting to current VAT period: ${targetMonth} (bi-monthly period for month ${currentMonth})`);
      needsRedirect = true;
    } else {
      // Month exists in URL - check if it's even (e.g., 2026-02)
      const [year, month] = monthParam.split("-");
      const monthNum = parseInt(month);

      // If even month, redirect to the odd month before it
      if (monthNum % 2 === 0) {
        const oddMonth = monthNum - 1;
        const oddMonthStr = String(oddMonth).padStart(2, '0');
        targetMonth = `${year}-${oddMonthStr}`;

        console.log(`📅 Even month detected (${monthParam}), redirecting to period start: ${targetMonth}`);
        needsRedirect = true;
      }
    }

    if (needsRedirect) {
      // Redirect to correct period (this will trigger this effect again with correct month)
      router.replace(`/?month=${targetMonth}`);
    } else {
      // Period is correct - fetch stats immediately with abort signal
      fetchStats(abortController.signal);
    }

    // Cleanup: abort fetch if effect runs again (period changed)
    return () => {
      abortController.abort();
    };
  }, [searchParams, router, fetchStats, refreshTrigger]);

  const handleReviewDraft = (draft: Transaction) => {
    setSelectedDraft(draft);
    setEditorOpen(true);
  };

  // Lookup AI-suggested amount for a draft (keyed by string id)
  const getAiSuggestedAmount = (draftId: string | number): number | undefined => {
    return aiSuggestionsMap[String(draftId)];
  };

  // Lookup currency warning for a draft (keyed by string id)
  const getCurrencyWarning = (draftId: string | number): string | undefined => {
    return currencyWarningsMap[String(draftId)];
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setSelectedDraft(null);
  };

  const handleEditorSave = () => {
    triggerRefresh();
    setEditorOpen(false);
    setSelectedDraft(null);
  };

  const handleLogout = async () => {
    if (window.confirm("האם אתה בטוח שברצונך להתנתק?")) {
      await logout();
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-24">
        {/* Header */}
        <div className="max-w-6xl mx-auto mb-6 px-4 md:px-0">
          <div className="bg-gradient-to-l from-blue-600 to-blue-700 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <Receipt className="w-8 h-8 md:w-12 md:h-12 flex-shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-base md:text-3xl font-bold leading-tight truncate">
                    ניהול מע״מ - עוסק מורשה
                  </h1>
                  <p className="text-blue-100 text-xs md:text-base">
                    מערכת לניהול דו״חות מע״מ דו-חודשיים
                  </p>
                </div>
              </div>

              {/* User Info & Logout */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-left hidden md:block">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <User className="w-4 h-4" />
                    <span>{user?.name || "משתמש"}</span>
                  </div>
                  {user?.business_name && (
                    <p className="text-xs text-blue-200 mt-1">
                      {user.business_name}
                    </p>
                  )}
                </div>

                {/* Settings Button */}
                <button
                  onClick={() => router.push("/settings")}
                  className="flex items-center gap-1 md:gap-2 px-2 py-2 md:px-4 bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors text-sm font-medium"
                  title="הגדרות"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden md:inline">הגדרות</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 md:gap-2 px-2 py-2 md:px-4 bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors text-sm font-medium"
                  title="התנתקות"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline">יציאה</span>
                </button>
              </div>
            </div>

            <div className="flex gap-6 mt-4 text-sm flex-wrap">
              <span className="bg-blue-500 bg-opacity-50 px-3 py-1 rounded">
                שיעור מע״מ: 18%
              </span>
              <span className="bg-blue-500 bg-opacity-50 px-3 py-1 rounded">
                תדירות דיווח: דו-חודשי
              </span>
              {user?.dealer_number && (
                <span className="bg-blue-500 bg-opacity-50 px-3 py-1 rounded">
                  מספר עוסק: {user.dealer_number}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard Stats Cards */}
        <div className="max-w-6xl mx-auto mb-6 px-4 md:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Income */}
            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">סך הכנסות</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {loadingStats ? "..." : `₪${stats.totalIncome.toFixed(2)}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    מע״מ: ₪{stats.incomeVAT.toFixed(2)}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            {/* Total Expenses */}
            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">סך הוצאות</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {loadingStats ? "..." : `₪${stats.totalExpenses.toFixed(2)}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    מע״מ: ₪{stats.expenseVAT.toFixed(2)}
                  </p>
                </div>
                <div className="bg-red-100 p-3 rounded-full">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            {/* Net Profit */}
            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">רווח נקי</p>
                  <p className={`text-2xl font-bold mt-1 ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {loadingStats ? "..." : `₪${stats.netProfit.toFixed(2)}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    הכנסות - הוצאות
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* VAT to Pay */}
            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">מע״מ לתשלום</p>
                  <p className={`text-2xl font-bold mt-1 ${stats.vatToPay >= 0 ? 'text-purple-600' : 'text-green-600'}`}>
                    {loadingStats ? "..." : `₪${stats.vatToPay.toFixed(2)}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.vatToPay >= 0 ? 'חובה' : 'זכאות להחזר'}
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <Receipt className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Upload Area */}
        <BulkUploadArea
          onUploadComplete={(newSuggestions, currencyWarnings) => {
            setAiSuggestionsMap((prev) => ({ ...prev, ...newSuggestions }));
            setCurrencyWarningsMap((prev) => ({ ...prev, ...currencyWarnings }));
          }}
          onRefreshNeeded={triggerRefresh}
        />

        {/* Drafts Inbox - Pending Receipts */}
        <div className="max-w-6xl mx-auto mb-6 px-4 md:px-0">
          <DraftsInbox onReviewDraft={handleReviewDraft} onRefreshNeeded={triggerRefresh} refreshTrigger={refreshTrigger} />
        </div>

        {/* Transaction Manager - Only COMPLETED transactions */}
        <TransactionManager triggerRefresh={triggerRefresh} />
      </div>

      {/* Transaction Editor Modal */}
      <TransactionEditor
        transaction={selectedDraft}
        isOpen={editorOpen}
        onClose={handleEditorClose}
        onSave={handleEditorSave}
        aiSuggestedAmount={selectedDraft ? getAiSuggestedAmount(selectedDraft.id) : undefined}
        currencyWarning={selectedDraft ? getCurrencyWarning(selectedDraft.id) : undefined}
      />

      {/* AI Chat Assistant */}
      <AIChat />
    </>
  );
}
