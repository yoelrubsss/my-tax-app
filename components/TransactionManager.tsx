"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, TrendingUp, TrendingDown, Calendar, Tag, Trash2, AlertCircle, ExternalLink, Sparkles, ChevronLeft, ChevronRight, Pencil, Download } from "lucide-react";
import FileUpload from "./FileUpload";
import EditTransactionModal from "./EditTransactionModal";
import HelpTooltip from "./HelpTooltip";
import {
  TAX_CATEGORIES,
  TaxCategory,
  suggestCategory,
  getCategoryById
} from "@/lib/tax-knowledge";
import {
  getCurrentPeriod,
  getPeriodLabel,
  getPreviousPeriod,
  getNextPeriod,
  getDeadline,
  getDeadlineStatus,
  filterTransactionsByPeriod,
  getVatPeriodFromMonthParam,
  VATperiod
} from "@/lib/fiscal-utils";
import { formatMoney } from "@/lib/utils";

interface Transaction {
  id: string | number; // Support both CUID (string) and legacy numeric IDs
  type: "income" | "expense";
  amount: number;
  vat_amount: number;
  recognized_vat_amount?: number; // CLAIMABLE VAT after category rules
  date: string;
  description: string;
  category?: string;
  is_vat_deductible: boolean;
  document_path?: string;
  /** Present on rows from /api/transactions (parent passes full list). */
  status?: "DRAFT" | "COMPLETED";
}

interface TransactionManagerProps {
  triggerRefresh: () => void;
  /** Parent-owned list from one /api/transactions fetch (null = dashboard still loading). */
  sharedTransactions: Transaction[] | null;
}

export default function TransactionManager({
  triggerRefresh,
  sharedTransactions,
}: TransactionManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const monthFromUrl = searchParams.get("month");
  const currentPeriod = useMemo(
    () => getVatPeriodFromMonthParam(monthFromUrl) ?? getCurrentPeriod(),
    [monthFromUrl]
  );

  const [activeTab, setActiveTab] = useState<"income" | "expense">("income");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [category, setCategory] = useState("");
  const [isVatDeductible, setIsVatDeductible] = useState(false);

  // Tax category selection
  const [selectedTaxCategory, setSelectedTaxCategory] = useState<TaxCategory | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [manualCategoryOverride, setManualCategoryOverride] = useState(false);

  // Calculated values
  const [vatAmount, setVatAmount] = useState<number | null>(null);
  const [netAmount, setNetAmount] = useState<number | null>(null);
  const [deductibleVatAmount, setDeductibleVatAmount] = useState<number | null>(null);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);

  // Auto-detect tax category when description changes
  useEffect(() => {
    // If description is cleared, reset manual override
    if (!description || description.length === 0) {
      setManualCategoryOverride(false);
      setSelectedTaxCategory(null);
      setCategory("");
      setAutoDetected(false);
      return;
    }

    // Only auto-detect if:
    // 1. It's an expense
    // 2. User hasn't manually overridden the category
    // 3. Description is long enough
    if (description && description.length > 3 && activeTab === "expense" && !manualCategoryOverride) {
      const suggested = suggestCategory(description);
      if (suggested) {
        // Allow re-detection even if category already selected
        setSelectedTaxCategory(suggested);
        setCategory(suggested.id);
        setAutoDetected(true);

        // Auto-set VAT deductible based on category
        if (suggested.vatPercentage > 0) {
          setIsVatDeductible(true);
        } else {
          setIsVatDeductible(false);
        }
      }
    }
  }, [description, activeTab, manualCategoryOverride]);

  // Auto-calculate VAT and Net when total amount or category changes
  useEffect(() => {
    if (totalAmount && !isNaN(parseFloat(totalAmount))) {
      const total = parseFloat(totalAmount);
      const fullVat = total * 0.18 / 1.18;
      const net = total - fullVat;

      setVatAmount(parseFloat(fullVat.toFixed(2)));
      setNetAmount(parseFloat(net.toFixed(2)));

      // Calculate deductible VAT based on category
      if (selectedTaxCategory && activeTab === "expense") {
        const deductibleVat = fullVat * selectedTaxCategory.vatPercentage;
        setDeductibleVatAmount(parseFloat(deductibleVat.toFixed(2)));
      } else {
        setDeductibleVatAmount(null);
      }
    } else {
      setVatAmount(null);
      setNetAmount(null);
      setDeductibleVatAmount(null);
    }
  }, [totalAmount, selectedTaxCategory, activeTab]);

  useEffect(() => {
    if (sharedTransactions === null) return;
    const completed = sharedTransactions.filter((t) => t.status === "COMPLETED") as Transaction[];
    setTransactions(filterTransactionsByPeriod<Transaction>(completed, currentPeriod));
  }, [sharedTransactions, currentPeriod]);

  const handlePreviousPeriod = () => {
    const newPeriod = getPreviousPeriod(currentPeriod);
    const startMonth = (newPeriod.periodIndex - 1) * 2 + 1;
    const monthStr = `${newPeriod.year}-${String(startMonth).padStart(2, "0")}`;
    router.push(`/?month=${monthStr}`);
  };

  const handleNextPeriod = () => {
    const newPeriod = getNextPeriod(currentPeriod);
    const startMonth = (newPeriod.periodIndex - 1) * 2 + 1;
    const monthStr = `${newPeriod.year}-${String(startMonth).padStart(2, "0")}`;
    router.push(`/?month=${monthStr}`);
  };

  const handleCategoryChange = (categoryId: string) => {
    const taxCategory = getCategoryById(categoryId);
    setSelectedTaxCategory(taxCategory || null);
    setCategory(categoryId);
    setAutoDetected(false);

    // Mark as manual override to prevent auto-detection
    setManualCategoryOverride(true);

    // Update VAT deductible based on category
    if (taxCategory && taxCategory.vatPercentage > 0) {
      setIsVatDeductible(true);
    } else {
      setIsVatDeductible(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeTab,
          amount: parseFloat(totalAmount),
          date,
          description,
          category: category || undefined,
          is_vat_deductible: activeTab === "expense" ? isVatDeductible : false,
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Reset form
        setDescription("");
        setTotalAmount("");
        setCategory("");
        setIsVatDeductible(false);
        setSelectedTaxCategory(null);
        setAutoDetected(false);
        setManualCategoryOverride(false);
        triggerRefresh();
      } else {
        alert("שגיאה בשמירת העסקה: " + result.error);
      }
    } catch (error) {
      console.error("Error creating transaction:", error);
      alert("שגיאה בשמירת העסקה");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    triggerRefresh();
    setEditModalOpen(false);
    setTransactionToEdit(null);
  };

  const handleDelete = async (id: string | number, description: string) => {
    const confirmed = window.confirm(
      `האם אתה בטוח שברצונך למחוק את העסקה:\n"${description}"?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();
      if (result.success) {
        triggerRefresh();
      } else {
        alert("שגיאה במחיקת העסקה: " + result.error);
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("שגיאה במחיקת העסקה");
    }
  };

  const handleDownloadCSV = async () => {
    try {
      // Calculate the month parameter from current period
      // Period 1 = Jan-Feb (start month 1), Period 2 = Mar-Apr (start month 3), etc.
      const startMonth = (currentPeriod.periodIndex - 1) * 2 + 1;
      const monthStr = `${currentPeriod.year}-${String(startMonth).padStart(2, '0')}`;

      // Fetch bi-monthly VAT report from export API
      const response = await fetch(`/api/export?month=${monthStr}`);

      if (!response.ok) {
        const errorData = await response.json();
        alert(`שגיאה ביצוא: ${errorData.error || 'שגיאה לא ידועה'}`);
        return;
      }

      // ═══════════════════════════════════════════════════════════════
      // EXTRACT FILENAME FROM CONTENT-DISPOSITION HEADER
      // ═══════════════════════════════════════════════════════════════
      let filename = `vat_report_${currentPeriod.year}_period_${currentPeriod.periodIndex}.csv`; // Fallback

      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        // Try to extract filename*=UTF-8'' (RFC 5987 encoded Hebrew filename)
        const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/i);
        if (filenameStarMatch) {
          filename = decodeURIComponent(filenameStarMatch[1]);
        } else {
          // Fallback to filename= (ASCII)
          const filenameMatch = contentDisposition.match(/filename="?(.+?)"?(?:;|$)/i);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
      }

      // Get the CSV content
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link and trigger download with extracted filename
      const a = document.createElement("a");
      a.href = url;
      a.download = filename; // Use extracted professional filename
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading VAT report:", error);
      alert("שגיאה בהורדת דוח המע\"מ");
    }
  };

  // Display ALL transactions for the selected period (no limit)
  const displayedTransactions = transactions;

  return (
    <div className="mx-auto max-w-6xl px-0 sm:px-0">
      <div className="ui-card p-5 sm:p-6">
        <h2 className="mb-4 text-xl font-bold text-text sm:mb-6 sm:text-2xl">ניהול עסקאות</h2>

        {/* Period Management Toolbar */}
        <div className="ui-toolbar mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-y-3">
            {/* Left Side: Period Navigation */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <button
                onClick={handlePreviousPeriod}
                className="ui-button ui-button-ghost px-2 py-2"
                aria-label="תקופה קודמת"
              >
                <ChevronRight className="h-5 w-5 text-primary" />
              </button>

              <div className="min-w-[10rem] text-center text-sm font-semibold text-text sm:text-base md:text-lg">
                {getPeriodLabel(currentPeriod)}
              </div>

              <button
                onClick={handleNextPeriod}
                className="ui-button ui-button-ghost px-2 py-2"
                aria-label="תקופה הבאה"
              >
                <ChevronLeft className="h-5 w-5 text-primary" />
              </button>

              {/* Download Bi-Monthly VAT Report Button */}
              <button
                onClick={handleDownloadCSV}
                className="ui-button ui-button-ghost text-xs text-primary sm:mr-2 sm:text-sm"
                title="הורד דוח מע״מ דו-חודשי מקיף (הכנסות, הוצאות וסיכום)"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">הורד דוח דו-חודשי</span>
              </button>
            </div>

            {/* Right Side: Deadline Badge & Countdown */}
            <div className="flex items-center flex-wrap gap-2">
              {/* Deadline Badge */}
              <div className="text-xs text-text-muted md:text-sm">
                <span className="font-medium">להגשה עד: </span>
                <span className="font-semibold">
                  {getDeadline(currentPeriod).toLocaleDateString('he-IL')}
                </span>
              </div>

              {/* Countdown with Color Coding */}
              {(() => {
                const deadlineStatus = getDeadlineStatus(currentPeriod);
                const colorClasses = {
                  ok: "bg-green-100 text-green-800 border-green-300",
                  warning: "bg-yellow-100 text-yellow-800 border-yellow-300",
                  urgent: "bg-red-100 text-red-800 border-red-300",
                  overdue: "bg-red-100 text-red-800 border-red-300"
                };

                return (
                  <div className={`px-3 py-1 md:px-4 md:py-2 rounded-full border-2 font-semibold text-xs md:text-sm ${colorClasses[deadlineStatus.status]}`}>
                    {deadlineStatus.message}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab("income")}
            className={`flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-medium transition-colors shrink-0 ${
              activeTab === "income"
                ? "border-b-2 border-primary text-primary"
                : "text-text-muted hover:text-text"
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            הכנסה
          </button>
          <button
            onClick={() => setActiveTab("expense")}
            className={`flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-medium transition-colors shrink-0 ${
              activeTab === "expense"
                ? "border-b-2 border-primary text-primary"
                : "text-text-muted hover:text-text"
            }`}
          >
            <TrendingDown className="w-5 h-5" />
            הוצאה
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mb-8 space-y-5">
          {/* Date */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-text">
              <Calendar className="w-4 h-4" />
              תאריך
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="ui-input"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              {activeTab === "income" ? "לקוח / תיאור" : "ספק / תיאור"}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder={
                activeTab === "income"
                  ? "לדוגמה: תשלום מלקוח ABC"
                  : "לדוגמה: קניית ציוד משרדי"
              }
              className="ui-input"
            />
          </div>

          {/* Tax Category - Smart Selection (appears below description for better UX) */}
          {activeTab === "expense" && (
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-text">
                <Tag className="w-4 h-4" />
                <span>קטגוריה מס</span>
                <HelpTooltip
                  text="הקטגוריה עוזרת למערכת להבין איך להתייחס להוצאה בדיווח."
                  label="מה זו קטגוריה מס"
                />
                {autoDetected && (
                  <span className="ui-chip text-primary">
                    <Sparkles className="w-3 h-3" />
                    זוהה אוטומטית
                  </span>
                )}
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="ui-input"
              >
                <option value="">בחר קטגוריה...</option>
                {TAX_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tax Category Warning & Legal Reference */}
          {selectedTaxCategory && activeTab === "expense" && (
            <div className="ui-notice ui-notice-warning p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="mb-2 text-sm text-text">
                    <strong>הנחיה משפטית:</strong> {selectedTaxCategory.warning}
                  </p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-text-muted">
                      ניכוי מע״מ: <strong>{(selectedTaxCategory.vatPercentage * 100).toFixed(0)}%</strong>
                    </span>
                    <span className="text-text-muted">
                      הכרה למס הכנסה: <strong>{(selectedTaxCategory.incomeTaxRecognition * 100).toFixed(0)}%</strong>
                    </span>
                    <a
                      href={selectedTaxCategory.legalRefUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      מקור חוקי (נבו)
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Total Amount */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              סכום כולל (כולל מע״מ)
            </label>
            <input
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
              placeholder="0.00"
              className="ui-input text-lg font-semibold"
            />
          </div>

          {/* Auto-calculated values */}
          {vatAmount !== null && netAmount !== null && (
            <div className="ui-notice ui-notice-info p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-muted">סכום נטו:</span>
                  <span className="mr-2 font-bold tabular-nums text-text">
                    ₪{formatMoney(netAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">מע״מ מלא (18%):</span>
                  <span className="mr-2 font-bold tabular-nums text-text">
                    ₪{formatMoney(vatAmount)}
                  </span>
                </div>
                {deductibleVatAmount !== null && selectedTaxCategory && (
                  <>
                    <div className="col-span-2 mt-2 border-t border-border pt-2">
                      <span className="font-medium text-text">
                        מע״מ מותר לקיזוז ({(selectedTaxCategory.vatPercentage * 100).toFixed(0)}%):
                      </span>
                      <span className="mr-2 text-base font-bold tabular-nums text-success">
                        ₪{formatMoney(deductibleVatAmount)}
                      </span>
                      {selectedTaxCategory.vatPercentage < 1.0 && (
                        <p className="mt-1 text-xs text-text-muted">
                          💡 חישבתי לך את המע״מ המותר לפי החוק. אתה יכול לשנות ידנית אם צריך.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* VAT Deductible Checkbox (for expenses only) */}
          {activeTab === "expense" && (
            <>
              {/* Show warning box only for special rule categories (0% VAT or partial VAT) */}
              {selectedTaxCategory && selectedTaxCategory.vatPercentage < 1.0 && (
                <div className={`ui-notice p-4 ${
                  selectedTaxCategory.vatPercentage === 0
                    ? "ui-notice-danger"
                    : "ui-notice-warning"
                }`}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      selectedTaxCategory.vatPercentage === 0 ? "text-red-600" : "text-yellow-600"
                    }`} />
                    <div className="flex-1">
                      <p className={`mb-1 text-sm font-medium ${
                        selectedTaxCategory.vatPercentage === 0 ? "text-red-800" : "text-yellow-800"
                      }`}>
                        {selectedTaxCategory.vatPercentage === 0
                          ? "⚠️ אין קיזוז מע״מ לקטגוריה זו"
                          : "⚠️ קיזוז מע״מ חלקי בלבד"}
                      </p>
                      <p className="text-xs text-text">
                        {selectedTaxCategory.vatPercentage === 0
                          ? `${selectedTaxCategory.label} אינה מאפשרת קיזוז מע״מ לפי החוק.`
                          : `לפי החוק, ניתן לקזז רק ${(selectedTaxCategory.vatPercentage * 100).toFixed(0)}% מהמע״מ.`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Clean checkbox row - always visible */}
              <div className="ui-card p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVatDeductible}
                    onChange={(e) => {
                      // Validation: Warn if trying to claim VAT on 0% category
                      if (e.target.checked && selectedTaxCategory && selectedTaxCategory.vatPercentage === 0) {
                        alert(`⚠️ אזהרה: ${selectedTaxCategory.label} אינה מאפשרת קיזוז מע״מ לפי החוק.\n\n${selectedTaxCategory.warning}`);
                        return;
                      }
                      setIsVatDeductible(e.target.checked);
                    }}
                    disabled={selectedTaxCategory?.vatPercentage === 0 || false}
                    className="h-5 w-5 rounded border-border text-primary focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span className="flex items-center gap-1 text-sm font-medium text-text">
                    <span>האם המע״מ מוכר לקיזוז?</span>
                    <HelpTooltip text="אם ההוצאה מוכרת, המע״מ שלה יופיע לקיזוז." label="מה זה קיזוז מע״מ" />
                  </span>
                </label>
                <p className="mr-8 mt-1 text-xs text-text-muted">
                  {!selectedTaxCategory
                    ? "בחר קטגוריה כדי לקבל המלצה אוטומטית"
                    : selectedTaxCategory.vatPercentage === 0
                    ? "קטגוריה זו לא מאפשרת קיזוז"
                    : "המערכת סימנה אוטומטית לפי הקטגוריה"}
                </p>
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-md font-medium text-white transition-colors ${
              activeTab === "income"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Plus className="w-5 h-5" />
            {loading ? "שומר..." : "הוסף עסקה"}
          </button>
        </form>

        {/* Transactions List */}
        <div>
          <h3 className="mb-4 text-lg font-semibold text-text">
            עסקאות לתקופה ({displayedTransactions.length})
          </h3>
          {displayedTransactions.length === 0 ? (
            <p className="py-8 text-center text-text-muted">
              אין עסקאות להצגה. הוסף את העסקה הראשונה שלך!
            </p>
          ) : (
            <>
            {/* Mobile: stacked cards */}
            <div className="space-y-3 md:hidden">
              {displayedTransactions.map((transaction) => {
                const taxCategory = transaction.category ? getCategoryById(transaction.category) : null;
                return (
                  <div
                    key={`m-${transaction.id}`}
                    className="ui-card rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-text-muted tabular-nums">
                          {new Date(transaction.date).toLocaleDateString("he-IL")}
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-base font-semibold leading-snug text-text">
                          {transaction.description}
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                          {taxCategory ? taxCategory.label : (transaction.category || "-")}
                        </p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-lg font-bold tabular-nums text-text">
                          ₪{formatMoney(transaction.amount)}
                        </p>
                        {transaction.type === "income" ? (
                          <span className="mt-1 inline-flex items-center justify-end gap-1 text-xs font-medium text-green-700">
                            <TrendingUp className="w-3.5 h-3.5 shrink-0" /> הכנסה
                          </span>
                        ) : (
                          <span className="mt-1 inline-flex items-center justify-end gap-1 text-xs font-medium text-red-700">
                            <TrendingDown className="w-3.5 h-3.5 shrink-0" /> הוצאה
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
                      <div className="min-w-0">
                        <span className="block text-text-muted">מע״מ בקבלה</span>
                        <p className="mt-0.5 font-semibold tabular-nums text-text">
                          ₪{formatMoney(transaction.vat_amount)}
                        </p>
                      </div>
                      <div className="min-w-0 text-end">
                        <span className="block text-text-muted">מע״מ מוכר</span>
                        {transaction.type === "expense" ? (
                          transaction.recognized_vat_amount !== undefined ? (
                            <p className="mt-0.5 font-semibold tabular-nums text-green-700">
                              ₪{formatMoney(transaction.recognized_vat_amount)}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-text-muted">טרם חושב</p>
                          )
                        ) : (
                          <p className="mt-0.5 font-semibold tabular-nums text-green-700">
                            ₪{formatMoney(transaction.vat_amount)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                      <div className="min-w-0 flex-1">
                        <FileUpload
                          transactionId={transaction.id}
                          initialPath={transaction.document_path}
                          onSuccess={triggerRefresh}
                        />
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEdit(transaction)}
                          className="ui-button ui-button-ghost h-9 w-9 p-0 text-primary"
                          title="ערוך עסקה"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(transaction.id, transaction.description)}
                          className="ui-button ui-button-ghost h-9 w-9 p-0 text-danger"
                          title="מחק עסקה"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="relative -mx-1 hidden max-h-[min(70vh,560px)] overflow-x-auto overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent md:block">
              <table className="ui-table min-w-[720px]">
                <thead className="sticky top-0 z-10 border-b-2 border-border bg-card shadow-sm">
                  <tr>
                    <th>תאריך</th>
                    <th>סוג</th>
                    <th>תיאור</th>
                    <th>קטגוריה</th>
                    <th>סכום כולל</th>
                    <th>מע״מ בקבלה</th>
                    <th>
                      <span className="inline-flex items-center gap-1">
                        <span>מע״מ מוכר</span>
                        <HelpTooltip
                          text="זה המע״מ על הוצאות שהמדינה מאפשרת לך לקזז."
                          label="מה זה מע״מ מוכר בטבלה"
                        />
                      </span>
                    </th>
                    <th className="text-center">מסמך</th>
                    <th className="text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedTransactions.map((transaction) => {
                    // Get Hebrew category label
                    const taxCategory = transaction.category ? getCategoryById(transaction.category) : null;

                    return (
                    <tr
                      key={transaction.id}
                      className="transition-colors hover:bg-card-muted/50"
                    >
                      <td>
                        {new Date(transaction.date).toLocaleDateString("he-IL")}
                      </td>
                      <td className="px-4 py-3">
                        {transaction.type === "income" ? (
                          <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                            <TrendingUp className="w-4 h-4" />
                            הכנסה
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                            <TrendingDown className="w-4 h-4" />
                            הוצאה
                          </span>
                        )}
                      </td>
                      <td>{transaction.description}</td>
                      <td>
                        {taxCategory ? taxCategory.label : (transaction.category || "-")}
                      </td>
                      <td className="font-bold tabular-nums">
                        ₪{formatMoney(transaction.amount)}
                      </td>
                      <td className="text-text-muted tabular-nums">
                        ₪{formatMoney(transaction.vat_amount)}
                      </td>
                      <td className="px-4 py-3">
                        {transaction.type === "expense" ? (
                          transaction.recognized_vat_amount !== undefined ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-green-700 tabular-nums">
                                ₪{formatMoney(transaction.recognized_vat_amount)}
                              </span>
                              {transaction.recognized_vat_amount < transaction.vat_amount && (
                                <span className="text-xs text-orange-600">
                                  ({((transaction.recognized_vat_amount / transaction.vat_amount) * 100).toFixed(0)}% מוכר)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-text-muted">טרם חושב</span>
                          )
                        ) : (
                          <span className="text-green-700 font-bold tabular-nums">₪{formatMoney(transaction.vat_amount)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <FileUpload
                          transactionId={transaction.id}
                          initialPath={transaction.document_path}
                          onSuccess={triggerRefresh}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(transaction)}
                            className="ui-button ui-button-ghost h-9 w-9 rounded p-0 text-primary"
                            title="ערוך עסקה"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(transaction.id, transaction.description)}
                            className="ui-button ui-button-ghost h-9 w-9 rounded p-0 text-danger"
                            title="מחק עסקה"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {transactionToEdit && (
        <EditTransactionModal
          transaction={transactionToEdit}
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setTransactionToEdit(null);
          }}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
