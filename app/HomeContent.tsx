"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type ComponentProps } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Receipt,
  LogOut,
  User,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Settings,
  CheckCircle2,
  Circle,
  MessageCircle,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import TransactionManager from "@/components/TransactionManager";
import DraftsInbox from "@/components/DraftsInbox";
import TransactionEditor from "@/components/TransactionEditor";
import BulkUploadArea from "@/components/BulkUploadArea";
import AIChat from "@/components/AIChat";
import ReportIssueFAB from "@/components/ReportIssueFAB";
import ThemeToggle from "@/components/ThemeToggle";
import HelpTooltip from "@/components/HelpTooltip";
import { formatMoney } from "@/lib/utils";
import { getVatPeriodDateBoundsFromMonthParam } from "@/lib/fiscal-utils";

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

const ONBOARDING_DISMISSED_KEY = "mytax_onboarding_dismissed";

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
  /** True once we know the user has at least one transaction (any status). Used for empty-state onboarding only. */
  const [hasAnyTransactions, setHasAnyTransactions] = useState<boolean | null>(null);
  /** Single source for dashboard lists: one GET /api/transactions per refresh (null = first load not finished). */
  const [transactionsCache, setTransactionsCache] = useState<Transaction[] | null>(null);

  const [onboardingLSReady, setOnboardingLSReady] = useState(false);
  const [onboardingPhase, setOnboardingPhase] = useState<"tasks" | "success" | "hidden">("tasks");
  const [settingsSnapshot, setSettingsSnapshot] = useState<{
    whatsapp_phone: string | null;
    whatsapp_phone_2: string | null;
    business_name: string | null;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  /** Increments every 10s while tab is visible — silent data refresh (WhatsApp drafts, etc.). */
  const [silentPollTick, setSilentPollTick] = useState(0);
  /** Global fingerprint (matches GET ?summary=1 and response meta.summary) — not period-scoped. */
  const dataFingerprintRef = useRef<{ count: number; latestCreatedAt: string | null } | null>(null);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  /** Silent refresh: one GET /api/transactions every 10s when the tab is visible (no loading spinners). */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setSilentPollTick((t) => t + 1);
    }, 10_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1") {
        setOnboardingPhase("hidden");
      }
    } catch {
      /* ignore */
    }
    setOnboardingLSReady(true);
  }, []);

  /** Profile / WhatsApp rarely changes — one GET /api/settings on mount (not joined with every transactions fetch). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (cancelled || !json?.success || !json.data) return;
        const d = json.data;
        setSettingsSnapshot({
          whatsapp_phone: (d.whatsapp_phone ?? d.whatsappPhone ?? null) as string | null,
          whatsapp_phone_2: (d.whatsapp_phone_2 ?? d.whatsappPhone2 ?? null) as string | null,
          business_name: (d.business_name ?? d.businessName ?? null) as string | null,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const whatsappConnected = useMemo(() => {
    const a = settingsSnapshot?.whatsapp_phone?.trim();
    const b = settingsSnapshot?.whatsapp_phone_2?.trim();
    return !!(a || b);
  }, [settingsSnapshot]);

  const businessVerified = useMemo(() => {
    const name = (settingsSnapshot?.business_name ?? user?.business_name ?? "").trim();
    const dealer = (user?.dealer_number ?? "").trim();
    return name.length > 0 && dealer.length > 0;
  }, [settingsSnapshot, user]);

  const firstReceiptDone = hasAnyTransactions === true;
  const allOnboardingTasksComplete =
    whatsappConnected && firstReceiptDone && businessVerified;

  useEffect(() => {
    if (!onboardingLSReady) return;
    if (onboardingPhase !== "tasks") return;
    if (!allOnboardingTasksComplete) return;
    setOnboardingPhase("success");
  }, [onboardingLSReady, onboardingPhase, allOnboardingTasksComplete]);

  useEffect(() => {
    if (onboardingPhase !== "success") return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
      } catch {
        /* ignore */
      }
      setOnboardingPhase("hidden");
    }, 5000);
    return () => window.clearTimeout(t);
  }, [onboardingPhase]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const onAllDraftsResolved = useCallback(() => {
    setToastMessage("All caught up! ✅");
  }, []);

  const fetchStats = useCallback(
    async (signal?: AbortSignal, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      try {
        if (!silent) {
          setLoadingStats(true);
          setStats({
            totalIncome: 0,
            totalExpenses: 0,
            netProfit: 0,
            vatToPay: 0,
            incomeVAT: 0,
            expenseVAT: 0,
          });
        }

        const monthParam = searchParams?.get("month");
        const periodBounds = getVatPeriodDateBoundsFromMonthParam(monthParam);
        if (periodBounds && process.env.NODE_ENV === "development") {
          console.log(
            `📅 BI-MONTHLY VAT Period: ${monthParam} (${periodBounds.startDate} to ${periodBounds.endDate})`
          );
        }

        const txParams = new URLSearchParams();
        if (periodBounds) {
          txParams.set("startDate", periodBounds.startDate);
          txParams.set("endDate", periodBounds.endDate);
        }
        const apiUrl =
          txParams.toString().length > 0
            ? `/api/transactions?${txParams.toString()}`
            : "/api/transactions";
        if (!silent && process.env.NODE_ENV === "development") {
          console.log(`🔍 Fetching transactions from: ${apiUrl}`);
        }

        const response = await fetch(apiUrl, {
          signal,
          cache: "no-store",
        });

        if (signal?.aborted) {
          console.log("⚠️ Fetch aborted - period changed");
          return;
        }

        const result = await response.json();

        if (!silent && process.env.NODE_ENV === "development") {
          console.log(`📥 API Response:`, {
            success: result.success,
            dataLength: result.data?.length,
            period: monthParam ?? "all",
          });
        }

        const meta = (result as {
          meta?: {
            summary?: { count: number; latestCreatedAt: string | null };
            hasAnyTransaction?: boolean;
          };
        }).meta;

        if (meta?.summary) {
          dataFingerprintRef.current = {
            count: meta.summary.count,
            latestCreatedAt: meta.summary.latestCreatedAt,
          };
        }

        if (result.success && Array.isArray(result.data)) {
          const transactions: Transaction[] = result.data;

          if (typeof meta?.hasAnyTransaction === "boolean") {
            setHasAnyTransactions(meta.hasAnyTransaction);
          } else {
            setHasAnyTransactions(transactions.length > 0);
          }

          setTransactionsCache(transactions);

          if (!silent && process.env.NODE_ENV === "development") {
            console.log(`📊 Found ${transactions.length} raw transactions from API`);
          }

          // COMPLETED rows are already scoped by the server for the VAT period; DRAFTs are included for inbox.
          const validTransactions = transactions.filter(
            (t) =>
              String(t.status).toUpperCase() === "COMPLETED" &&
              t.amount != null &&
              t.amount > 0
          );

          if (!silent && process.env.NODE_ENV === "development") {
            console.log(
              `✅ ${validTransactions.length} transactions with valid amounts (in selected period)`
            );
          }

          const completedTransactions = validTransactions;

          const incomeTransactions = completedTransactions.filter((t) => t.type === "income");
          const totalIncome = incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
          const incomeVAT = incomeTransactions.reduce((sum, t) => sum + (t.vat_amount || 0), 0);

          if (process.env.NODE_ENV === "development") {
            console.log(
              "💰 Income:",
              incomeTransactions.length,
              "transactions, total:",
              totalIncome,
              "VAT:",
              incomeVAT
            );
          }

          const expenseTransactions = completedTransactions.filter((t) => t.type === "expense");
          const totalExpenses = expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
          const expenseVAT = expenseTransactions.reduce(
            (sum, t) => sum + (t.recognized_vat_amount ?? t.vat_amount ?? 0),
            0
          );

          if (process.env.NODE_ENV === "development") {
            console.log(
              "💸 Expenses:",
              expenseTransactions.length,
              "transactions, total:",
              totalExpenses,
              "Recognized VAT:",
              expenseVAT
            );
          }

          const netProfit = totalIncome - totalExpenses;
          const vatToPay = incomeVAT - expenseVAT;

          if (process.env.NODE_ENV === "development") {
            console.log("📈 Net Profit:", netProfit, "VAT to Pay:", vatToPay);
          }

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
          if (!silent) {
            setTransactionsCache([]);
            setHasAnyTransactions(false);
            setStats({
              totalIncome: 0,
              totalExpenses: 0,
              netProfit: 0,
              vatToPay: 0,
              incomeVAT: 0,
              expenseVAT: 0,
            });
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("⚠️ Fetch cancelled - period changed");
          return;
        }

        console.error("Error fetching stats:", error);
        if (!silent) {
          setTransactionsCache([]);
          setHasAnyTransactions(true);
          setStats({
            totalIncome: 0,
            totalExpenses: 0,
            netProfit: 0,
            vatToPay: 0,
            incomeVAT: 0,
            expenseVAT: 0,
          });
        }
      } finally {
        if (!silent) {
          setLoadingStats(false);
        }
      }
    },
    [searchParams]
  );

  // Single effect: month URL change OR manual refresh — one /api/transactions fetch (not both).
  useEffect(() => {
    const abortController = new AbortController();
    const monthParam = searchParams?.get("month");

    let needsRedirect = false;
    let targetMonth = "";

    if (!monthParam) {
      const now = new Date();
      const year = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const periodStartMonth = currentMonth % 2 === 0 ? currentMonth - 1 : currentMonth;
      const periodStartMonthStr = String(periodStartMonth).padStart(2, "0");
      targetMonth = `${year}-${periodStartMonthStr}`;
      if (process.env.NODE_ENV === "development") {
        console.log(
          `📅 No month parameter found, redirecting to current VAT period: ${targetMonth} (bi-monthly period for month ${currentMonth})`
        );
      }
      needsRedirect = true;
    } else {
      const [year, month] = monthParam.split("-");
      const monthNum = parseInt(month, 10);
      if (monthNum % 2 === 0) {
        const oddMonth = monthNum - 1;
        const oddMonthStr = String(oddMonth).padStart(2, "0");
        targetMonth = `${year}-${oddMonthStr}`;
        if (process.env.NODE_ENV === "development") {
          console.log(
            `📅 Even month detected (${monthParam}), redirecting to period start: ${targetMonth}`
          );
        }
        needsRedirect = true;
      }
    }

    if (needsRedirect) {
      router.replace(`/?month=${targetMonth}`);
      return () => abortController.abort();
    }

    fetchStats(abortController.signal, { silent: false });

    return () => abortController.abort();
  }, [searchParams, router, fetchStats, refreshTrigger]);

  /** Background poll: lightweight summary first; full fetch only if count or latest createdAt changed. */
  useEffect(() => {
    if (silentPollTick === 0) return;
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/transactions?summary=1", {
          signal: ac.signal,
          cache: "no-store",
        });
        const result = await res.json();
        if (!result.success || !result.summary) return;
        const { count, latestCreatedAt } = result.summary as {
          count: number;
          latestCreatedAt: string | null;
        };
        const prev = dataFingerprintRef.current;
        if (
          prev !== null &&
          prev.count === count &&
          prev.latestCreatedAt === latestCreatedAt
        ) {
          return;
        }
        await fetchStats(ac.signal, { silent: true });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Silent poll (summary) failed:", error);
      }
    })();
    return () => ac.abort();
  }, [silentPollTick, fetchStats]);

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
      <div className="ui-surface min-h-screen p-4 pb-24 md:p-8">
        {/* Header */}
        <div className="mx-auto mb-8 max-w-6xl px-4 md:px-0">
          <div className="rounded-lg border border-blue-500/30 bg-gradient-to-l from-blue-600 to-blue-700 p-5 text-white shadow-sm dark:border-blue-900/70 dark:from-blue-900 dark:to-blue-950 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <Receipt className="h-8 w-8 flex-shrink-0 text-blue-100 md:h-12 md:w-12" />
                <div className="min-w-0">
                  <h1 className="truncate text-base font-bold leading-tight md:text-3xl">
                    ניהול מע״מ - עוסק מורשה
                  </h1>
                  <p className="text-xs text-blue-100 md:text-base">
                    מערכת לניהול דו״חות מע״מ דו-חודשיים
                  </p>
                </div>
              </div>

              {/* User Info & Logout */}
              <div className="flex flex-shrink-0 items-center gap-2">
                <div className="hidden text-left md:block">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <User className="w-4 h-4" />
                    <span>{user?.name || "משתמש"}</span>
                  </div>
                  {user?.business_name && <p className="mt-1 text-xs text-blue-200">{user.business_name}</p>}
                </div>

                <ThemeToggle />

                {/* Settings Button */}
                <button
                  onClick={() => router.push("/settings")}
                  className="ui-button ui-button-primary gap-1 px-2 py-2 text-sm md:gap-2 md:px-4"
                  title="הגדרות"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden md:inline">הגדרות</span>
                </button>

                {user?.is_admin && (
                  <Link
                    href="/admin"
                    className="ui-button ui-button-ghost gap-1 px-2 py-2 text-sm text-primary md:gap-2 md:px-4"
                    title="ניהול"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="hidden md:inline">ניהול</span>
                  </Link>
                )}

                <button
                  onClick={handleLogout}
                  className="ui-button ui-button-ghost gap-1 px-2 py-2 text-sm md:gap-2 md:px-4"
                  title="התנתקות"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline">יציאה</span>
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="ui-chip px-3 py-1 text-text">
                שיעור מע״מ: 18%
              </span>
              <span className="ui-chip px-3 py-1 text-text">
                תדירות דיווח: דו-חודשי
              </span>
              {user?.dealer_number && (
                <span className="ui-chip px-3 py-1 text-text">
                  מספר עוסק: {user.dealer_number}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Getting Started — hidden permanently after success + localStorage */}
        {onboardingLSReady && (onboardingPhase === "tasks" || onboardingPhase === "success") && (
          <div className="mx-auto mb-8 max-w-6xl px-4 md:px-0">
            <div className="ui-toolbar rounded-xl p-5 md:p-6">
              {onboardingPhase === "success" ? (
                <div className="py-2 text-center md:text-start">
                  <p className="text-base font-semibold text-text md:text-lg">
                    You are all set! App is ready for work.
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-text md:text-xl">מתחילים</h2>
                  <p className="mt-1 text-sm text-text-muted">
                    השלם את שלושת השלבים כדי להפיק את המירב מהמערכת.
                  </p>
                  <ul className="mt-4 space-y-3">
                    <li className="ui-card flex gap-3 bg-card/80 p-3 ring-1 ring-border">
                      {whatsappConnected ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden />
                      ) : (
                        <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text">חבר את WhatsApp</p>
                        <p className="text-sm text-text-muted">
                          בהגדרות — הוסף מספר (או מספר שני) לשליחת קבלות.
                        </p>
                        <button
                          type="button"
                          onClick={() => router.push("/settings")}
                          className="ui-button ui-button-ghost mt-2 h-auto border-0 bg-transparent px-0 py-0 text-sm text-primary hover:bg-transparent hover:underline"
                        >
                          פתח הגדרות
                        </button>
                      </div>
                    </li>
                    <li className="ui-card flex gap-3 bg-card/80 p-3 ring-1 ring-border">
                      {firstReceiptDone ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden />
                      ) : (
                        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text">שלח את הקבלה הראשונה</p>
                        <p className="text-sm text-text-muted">
                          העלה קובץ או גרור לאזור ההעלאה למטה.
                        </p>
                        <a
                          href="#bulk-upload"
                          className="ui-button ui-button-ghost mt-2 inline-block h-auto border-0 bg-transparent px-0 py-0 text-sm text-primary hover:bg-transparent hover:underline"
                        >
                          קפוץ להעלאה
                        </a>
                      </div>
                    </li>
                    <li className="ui-card flex gap-3 bg-card/80 p-3 ring-1 ring-border">
                      {businessVerified ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden />
                      ) : (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary opacity-60" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text">אמת פרטי עסק</p>
                        <p className="text-sm text-text-muted">
                          שם עסק, סוג עוסק ומספר עוסק מול רשויות המס.
                        </p>
                        <button
                          type="button"
                          onClick={() => router.push("/settings")}
                          className="ui-button ui-button-ghost mt-2 h-auto border-0 bg-transparent px-0 py-0 text-sm text-primary hover:bg-transparent hover:underline"
                        >
                          עדכן בפרופיל
                        </button>
                      </div>
                    </li>
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

        {/* Dashboard Stats Cards */}
        <div className="mx-auto mb-9 max-w-6xl px-4 md:px-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {/* Total Income */}
            <div className="ui-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-muted sm:text-sm">סך הכנסות</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-text sm:text-2xl">
                    {loadingStats ? "..." : `₪${formatMoney(stats.totalIncome)}`}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-text-muted">
                    מע״מ: ₪{formatMoney(stats.incomeVAT)}
                  </p>
                </div>
                <div className="rounded-full border border-border bg-card-muted p-2.5">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>

            {/* Total Expenses */}
            <div className="ui-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-muted sm:text-sm">סך הוצאות</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-text sm:text-2xl">
                    {loadingStats ? "..." : `₪${formatMoney(stats.totalExpenses)}`}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs tabular-nums text-text-muted">
                    <span>מע״מ מוכר: ₪{formatMoney(stats.expenseVAT)}</span>
                    <HelpTooltip text="זה המע״מ על הוצאות שהמדינה מאפשרת לך לקזז." label="מה זה מע״מ מוכר" />
                  </p>
                </div>
                <div className="rounded-full border border-border bg-card-muted p-2.5">
                  <TrendingDown className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>

            {/* Net Profit */}
            <div className="ui-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-xs font-medium text-text-muted sm:text-sm">
                    <span>רווח נקי</span>
                    <HelpTooltip
                      text="זה מה שנשאר לך מהעסק אחרי שמפחיתים את ההוצאות מההכנסות."
                      label="מה זה רווח נקי"
                    />
                  </p>
                  <p className={`text-xl sm:text-2xl font-bold mt-1 tabular-nums ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {loadingStats ? "..." : `₪${formatMoney(stats.netProfit)}`}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    הכנסות - הוצאות
                  </p>
                </div>
                <div className="rounded-full border border-border bg-card-muted p-2.5">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>

            {/* VAT to Pay */}
            <div className="ui-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-xs font-medium text-text-muted sm:text-sm">
                    <span>מע״מ לתשלום</span>
                    <HelpTooltip
                      text="זה הסכום שצפוי לשלם במע״מ אחרי קיזוז ההוצאות המוכרות."
                      label="מה זה מע״מ לתשלום"
                    />
                  </p>
                  <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${stats.vatToPay >= 0 ? 'text-danger' : 'text-success'}`}>
                    {loadingStats ? "..." : `₪${formatMoney(stats.vatToPay)}`}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {stats.vatToPay >= 0 ? 'חובה' : 'זכאות להחזר'}
                  </p>
                </div>
                <div className="rounded-full border border-border bg-card-muted p-2.5">
                  <Receipt className="h-6 w-6 text-primary" />
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
        <div className="mx-auto mb-8 max-w-6xl px-4 md:px-0">
          <DraftsInbox
            onReviewDraft={handleReviewDraft}
            onRefreshNeeded={triggerRefresh}
            sharedTransactions={
              transactionsCache as unknown as ComponentProps<typeof DraftsInbox>["sharedTransactions"]
            }
            onAllDraftsResolved={onAllDraftsResolved}
          />
        </div>

        {/* Transaction Manager - Only COMPLETED transactions */}
        <TransactionManager
          triggerRefresh={triggerRefresh}
          sharedTransactions={
            transactionsCache as unknown as ComponentProps<typeof TransactionManager>["sharedTransactions"]
          }
        />
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

      <ReportIssueFAB />

      {toastMessage && (
        <div
          className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 px-4"
          role="status"
          aria-live="polite"
        >
          <div className="ui-card rounded-full bg-card px-5 py-3 text-sm font-medium shadow-lg">
            {toastMessage}
          </div>
        </div>
      )}
    </>
  );
}
