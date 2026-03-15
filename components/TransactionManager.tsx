"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, TrendingUp, TrendingDown, Calendar, Tag, Trash2, AlertCircle, ExternalLink, Sparkles, ChevronLeft, ChevronRight, Clock, Pencil, Download } from "lucide-react";
import FileUpload from "./FileUpload";
import EditTransactionModal from "./EditTransactionModal";
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
  VATperiod
} from "@/lib/fiscal-utils";

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
}

interface TransactionManagerProps {
  triggerRefresh: () => void;
}

export default function TransactionManager({ triggerRefresh }: TransactionManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"income" | "expense">("income");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Period management
  const [currentPeriod, setCurrentPeriod] = useState<VATperiod>(getCurrentPeriod());

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

  // Fetch transactions on mount
  useEffect(() => {
    fetchTransactions();
  }, []);

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

  const fetchTransactions = async () => {
    try {
      // IMPORTANT: Only fetch COMPLETED transactions (ignore DRAFT)
      const response = await fetch("/api/transactions?status=COMPLETED");
      const result = await response.json();
      if (result.success) {
        setAllTransactions(result.data);
        // Filter by current period
        const periodFiltered = filterTransactionsByPeriod<Transaction>(result.data, currentPeriod);
        setTransactions(periodFiltered);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  // Re-filter transactions when period changes
  useEffect(() => {
    if (allTransactions.length > 0) {
      const periodFiltered = filterTransactionsByPeriod<Transaction>(allTransactions, currentPeriod);
      setTransactions(periodFiltered);
    }
  }, [currentPeriod, allTransactions]);

  const handlePreviousPeriod = () => {
    const newPeriod = getPreviousPeriod(currentPeriod);
    setCurrentPeriod(newPeriod);

    // CRITICAL FIX: Calculate startMonth from periodIndex (not a property of VATperiod)
    // Period 1 = Jan-Feb (months 1-2), Period 2 = Mar-Apr (months 3-4), etc.
    const startMonth = (newPeriod.periodIndex - 1) * 2 + 1;
    const monthStr = `${newPeriod.year}-${String(startMonth).padStart(2, '0')}`;
    router.push(`/?month=${monthStr}`);

    triggerRefresh(); // Refresh VAT report
  };

  const handleNextPeriod = () => {
    const newPeriod = getNextPeriod(currentPeriod);
    setCurrentPeriod(newPeriod);

    // CRITICAL FIX: Calculate startMonth from periodIndex (not a property of VATperiod)
    // Period 1 = Jan-Feb (months 1-2), Period 2 = Mar-Apr (months 3-4), etc.
    const startMonth = (newPeriod.periodIndex - 1) * 2 + 1;
    const monthStr = `${newPeriod.year}-${String(startMonth).padStart(2, '0')}`;
    router.push(`/?month=${monthStr}`);

    triggerRefresh(); // Refresh VAT report
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
        // Refresh transactions list
        await fetchTransactions();
        // Trigger VAT report refresh
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
    await fetchTransactions();
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
        // Refresh transactions list
        await fetchTransactions();
        // Trigger VAT report refresh
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
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6">ניהול עסקאות</h2>

        {/* Period Management Toolbar */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-y-3">
            {/* Left Side: Period Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousPeriod}
                className="p-2 hover:bg-white rounded-md transition-colors"
                aria-label="תקופה קודמת"
              >
                <ChevronRight className="w-5 h-5 text-blue-600" />
              </button>

              <div className="text-sm md:text-lg font-semibold text-gray-900 text-center">
                {getPeriodLabel(currentPeriod)}
              </div>

              <button
                onClick={handleNextPeriod}
                className="p-2 hover:bg-white rounded-md transition-colors"
                aria-label="תקופה הבאה"
              >
                <ChevronLeft className="w-5 h-5 text-blue-600" />
              </button>

              {/* Download Bi-Monthly VAT Report Button */}
              <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 rounded-md transition-colors text-sm font-medium mr-2"
                title="הורד דוח מע״מ דו-חודשי מקיף (הכנסות, הוצאות וסיכום)"
              >
                <Download className="w-4 h-4" />
                <span className="hidden md:inline">הורד דוח דו-חודשי</span>
              </button>
            </div>

            {/* Right Side: Deadline Badge & Countdown */}
            <div className="flex items-center flex-wrap gap-2">
              {/* Deadline Badge */}
              <div className="text-xs md:text-sm text-gray-700">
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
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab("income")}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === "income"
                ? "border-b-2 border-green-600 text-green-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            הכנסה
          </button>
          <button
            onClick={() => setActiveTab("expense")}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === "expense"
                ? "border-b-2 border-red-600 text-red-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <TrendingDown className="w-5 h-5" />
            הוצאה
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          {/* Date */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4" />
              תאריך
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Tax Category - Smart Selection (appears below description for better UX) */}
          {activeTab === "expense" && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Tag className="w-4 h-4" />
                קטגוריה מס
                {autoDetected && (
                  <span className="text-xs text-blue-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    זוהה אוטומטית
                  </span>
                )}
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
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
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>הנחיה משפטית:</strong> {selectedTaxCategory.warning}
                  </p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-600">
                      ניכוי מע״מ: <strong>{(selectedTaxCategory.vatPercentage * 100).toFixed(0)}%</strong>
                    </span>
                    <span className="text-gray-600">
                      הכרה למס הכנסה: <strong>{(selectedTaxCategory.incomeTaxRecognition * 100).toFixed(0)}%</strong>
                    </span>
                    <a
                      href={selectedTaxCategory.legalRefUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
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
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              סכום כולל (כולל מע״מ)
            </label>
            <input
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Auto-calculated values */}
          {vatAmount !== null && netAmount !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">סכום נטו:</span>
                  <span className="font-bold text-gray-900 mr-2">
                    ₪{netAmount.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">מע״מ מלא (18%):</span>
                  <span className="font-bold text-gray-900 mr-2">
                    ₪{vatAmount.toFixed(2)}
                  </span>
                </div>
                {deductibleVatAmount !== null && selectedTaxCategory && (
                  <>
                    <div className="col-span-2 border-t border-blue-300 pt-2 mt-2">
                      <span className="text-gray-700 font-medium">
                        מע״מ מותר לקיזוז ({(selectedTaxCategory.vatPercentage * 100).toFixed(0)}%):
                      </span>
                      <span className="font-bold text-green-700 text-base mr-2">
                        ₪{deductibleVatAmount.toFixed(2)}
                      </span>
                      {selectedTaxCategory.vatPercentage < 1.0 && (
                        <p className="text-xs text-gray-600 mt-1">
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
                <div className={`border rounded-md p-4 ${
                  selectedTaxCategory.vatPercentage === 0
                    ? "bg-red-50 border-red-200"
                    : "bg-yellow-50 border-yellow-200"
                }`}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      selectedTaxCategory.vatPercentage === 0 ? "text-red-600" : "text-yellow-600"
                    }`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium mb-1 ${
                        selectedTaxCategory.vatPercentage === 0 ? "text-red-800" : "text-yellow-800"
                      }`}>
                        {selectedTaxCategory.vatPercentage === 0
                          ? "⚠️ אין קיזוז מע״מ לקטגוריה זו"
                          : "⚠️ קיזוז מע״מ חלקי בלבד"}
                      </p>
                      <p className="text-xs text-gray-700">
                        {selectedTaxCategory.vatPercentage === 0
                          ? `${selectedTaxCategory.label} אינה מאפשרת קיזוז מע״מ לפי החוק.`
                          : `לפי החוק, ניתן לקזז רק ${(selectedTaxCategory.vatPercentage * 100).toFixed(0)}% מהמע״מ.`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Clean checkbox row - always visible */}
              <div className="border border-gray-200 rounded-md p-4 bg-white">
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
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    האם המע״מ מוכר לקיזוז?
                  </span>
                </label>
                <p className="text-xs text-gray-500 mr-8 mt-1">
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
          <h3 className="text-lg font-semibold mb-4">
            עסקאות לתקופה ({displayedTransactions.length})
          </h3>
          {displayedTransactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              אין עסקאות להצגה. הוסף את העסקה הראשונה שלך!
            </p>
          ) : (
            <div className="max-h-[500px] overflow-x-auto overflow-y-auto relative scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white shadow-sm border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 bg-gray-50">תאריך</th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 bg-gray-50">סוג</th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 bg-gray-50">תיאור</th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 bg-gray-50">קטגוריה</th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 bg-gray-50">סכום כולל</th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 bg-gray-50">מע״מ בקבלה</th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 bg-gray-50">מע״מ מוכר</th>
                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 bg-gray-50">מסמך</th>
                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 bg-gray-50">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {displayedTransactions.map((transaction) => {
                    // Get Hebrew category label
                    const taxCategory = transaction.category ? getCategoryById(transaction.category) : null;

                    return (
                    <tr
                      key={transaction.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-900">
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
                      <td className="px-4 py-3 text-gray-900">{transaction.description}</td>
                      <td className="px-4 py-3 text-gray-900">
                        {taxCategory ? taxCategory.label : (transaction.category || "-")}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        ₪{transaction.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        ₪{transaction.vat_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {transaction.type === "expense" ? (
                          transaction.recognized_vat_amount !== undefined ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-green-700">
                                ₪{transaction.recognized_vat_amount.toFixed(2)}
                              </span>
                              {transaction.recognized_vat_amount < transaction.vat_amount && (
                                <span className="text-xs text-orange-600">
                                  ({((transaction.recognized_vat_amount / transaction.vat_amount) * 100).toFixed(0)}% מוכר)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">טרם חושב</span>
                          )
                        ) : (
                          <span className="text-green-700 font-bold">₪{transaction.vat_amount.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <FileUpload
                          transactionId={transaction.id}
                          initialPath={transaction.document_path}
                          onSuccess={fetchTransactions}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(transaction)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded transition-colors"
                            title="ערוך עסקה"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(transaction.id, transaction.description)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded transition-colors"
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
