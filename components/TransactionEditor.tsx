"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Calendar,
  Tag,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from "lucide-react";
import { TAX_CATEGORIES, getCategoryById } from "@/lib/tax-knowledge";

interface Transaction {
  id: string | number; // Support both CUID and legacy numeric IDs
  type?: "income" | "expense";
  amount?: number;
  vat_amount?: number;
  date?: string;
  description?: string;
  category?: string;
  is_vat_deductible?: boolean;
  document_path?: string;
  status?: "DRAFT" | "COMPLETED";
  created_at?: string;
}

interface TransactionEditorProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  aiSuggestedAmount?: number;
  currencyWarning?: string;
}

export default function TransactionEditor({
  transaction,
  isOpen,
  onClose,
  onSave,
  aiSuggestedAmount,
  currencyWarning,
}: TransactionEditorProps) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  const merchantInputRef = useRef<HTMLInputElement>(null);
  const formPaneRef = useRef<HTMLDivElement>(null);

  // Initialize form fields when transaction changes
  useEffect(() => {
    if (transaction) {
      setMerchant(transaction.description || "");
      setAmount(transaction.amount?.toString() || "");
      setDate(transaction.date || new Date().toISOString().split("T")[0]);
      setType(transaction.type || "expense");
      setCategory(transaction.category || "");
      setZoom(100);
      setRotation(0);
    }
  }, [transaction]);

  // Auto-focus first input when modal opens
  useEffect(() => {
    if (isOpen && merchantInputRef.current) {
      setTimeout(() => {
        merchantInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Prevent background page scrolling while editor modal is open.
  useEffect(() => {
    if (!isOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [isOpen]);


  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Basic validation for required fields only
    if (!merchant || !amount || !date) {
      alert("נא למלא את כל השדות הנדרשים");
      return;
    }

    setLoading(true);

    try {
      // Default type silently if somehow missing (no error)
      const finalType = type || "expense";

      const response = await fetch("/api/transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: transaction?.id,
          merchant,
          amount: parseFloat(amount),
          date,
          type: finalType,
          category: category || undefined,
          description: merchant,
          status: "COMPLETED", // Mark as completed
        }),
      });

      const result = await response.json();

      if (result.success) {
        onSave();
        onClose();
      } else {
        alert("שגיאה בעדכון העסקה: " + result.error);
      }
    } catch (error) {
      console.error("Error updating transaction:", error);
      alert("שגיאה בעדכון העסקה");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;

    const confirmed = window.confirm(
      "האם אתה בטוח שברצונך למחוק את הטיוטה? פעולה זו לא ניתנת לביטול."
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "DELETE",
      });

      const result = await response.json();
      if (result.success) {
        onSave();
        onClose();
      } else {
        alert("שגיאה במחיקת הטיוטה: " + result.error);
      }
    } catch (error) {
      console.error("Error deleting draft:", error);
      alert("שגיאה במחיקת הטיוטה");
    }
  };

  if (!isOpen || !transaction) return null;

  // Calculate VAT preview
  const totalAmount = parseFloat(amount) || 0;
  const vatAmount = totalAmount * 0.18 / 1.18;
  const netAmount = totalAmount - vatAmount;

  const taxCategory = category ? getCategoryById(category) : null;

  // Simple validation - only required fields, NOT type
  const isFormValid = merchant && amount && date;

  // Check if document is PDF or image
  const isPDF = transaction.document_path?.toLowerCase().endsWith('.pdf');
  const isImage = transaction.document_path?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  const documentUrl = transaction.document_path || null;

  const routeWheelToFormPane = (deltaY: number) => {
    const pane = formPaneRef.current;
    if (!pane) return false;
    if (pane.scrollHeight <= pane.clientHeight) return false;
    const prevScrollTop = pane.scrollTop;
    pane.scrollTop += deltaY;
    return pane.scrollTop !== prevScrollTop;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="ui-modal flex h-[100dvh] w-full max-w-7xl flex-col overflow-hidden overscroll-contain rounded-none md:h-[90vh] md:rounded-xl">
        {/* Header */}
        <div className="ui-toolbar flex flex-shrink-0 items-center justify-between p-4 md:p-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold text-text md:text-2xl">
              <FileText className="h-5 w-5 flex-shrink-0 text-primary md:h-7 md:w-7" />
              מלא פרטי העסקה
            </h2>
            <p className="mt-0.5 text-xs text-text-muted md:mt-1 md:text-sm">
              עיין בקבלה ומלא את הפרטים החסרים
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 flex-shrink-0 rounded-full p-2 text-text-muted transition-colors hover:bg-card-muted hover:text-text"
            aria-label="סגור"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Split View Content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          {/* LEFT SIDE: Receipt Document */}
          <div
            className="flex max-h-[30vh] w-full flex-col bg-gray-900 md:max-h-none md:min-h-0 md:w-1/2"
            onWheel={(e) => {
              // When cursor is over the receipt pane, scroll the form pane instead.
              if (e.deltaY === 0) return;
              const forwarded = routeWheelToFormPane(e.deltaY);
              if (forwarded) {
                e.preventDefault();
              }
            }}
          >
            {/* Document Controls - Only show for images */}
            {!isPDF && isImage && (
              <div className="bg-gray-800 p-3 flex items-center justify-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setZoom(Math.max(50, zoom - 10))}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
                  title="הקטן"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-white text-sm font-medium min-w-[60px] text-center">
                  {zoom}%
                </span>
                <button
                  onClick={() => setZoom(Math.min(200, zoom + 10))}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
                  title="הגדל"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-600 mx-2"></div>
                <button
                  onClick={() => setRotation((rotation + 90) % 360)}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
                  title="סובב"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setZoom(100);
                    setRotation(0);
                  }}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs transition-colors"
                >
                  איפוס
                </button>
              </div>
            )}

            {/* Document Container */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
              {documentUrl ? (
                <>
                  {isPDF ? (
                    <iframe
                      src={documentUrl}
                      className="w-full h-full border-0 rounded-lg shadow-2xl"
                      title="Receipt PDF"
                    />
                  ) : isImage ? (
                    <div
                      style={{
                        transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                        transition: "transform 0.2s ease-out",
                      }}
                      className="max-w-full max-h-full"
                    >
                      <img
                        src={documentUrl}
                        alt="Receipt"
                        className="max-w-full max-h-full object-contain shadow-2xl rounded"
                      />
                    </div>
                  ) : (
                    <div className="ui-card p-12 shadow-2xl">
                      <FileText className="w-32 h-32 text-gray-400 mx-auto mb-4" />
                      <p className="text-center font-medium text-text-muted">
                        {transaction.document_path?.split(".").pop()?.toUpperCase()} קובץ
                      </p>
                      <a
                        href={documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-blue-500 hover:text-blue-700 mt-4 underline"
                      >
                        פתח קובץ
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-text-muted">
                  <FileText className="w-24 h-24 mx-auto mb-4 opacity-50" />
                  <p>אין קובץ מצורף</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: Form */}
          <div
            ref={formPaneRef}
            className="ui-surface relative flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain md:w-1/2"
          >
            <form
              onSubmit={handleSubmit}
              className="flex-1 space-y-4 p-6 pb-28 [touch-action:pan-y] md:pb-6"
            >
              {/* AI Pre-fill Notice */}
              {aiSuggestedAmount && (
                <div className="ui-notice ui-notice-info flex items-center gap-2">
                  <span>🤖</span>
                  <span>הפרטים מולאו אוטומטית על ידי AI — אנא בדוק ואשר</span>
                </div>
              )}

              {/* Currency Warning */}
              {currencyWarning && (
                <div className="ui-notice ui-notice-warning flex items-center gap-3 border-2 px-4 py-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <span className="font-semibold text-text">{currencyWarning}</span>
                </div>
              )}

              {/* Transaction Type Selector */}
              <div className="ui-card p-4">
                <label className="mb-2 block text-sm font-medium text-text">
                  סוג העסקה
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType("expense")}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-base font-medium transition-all ${
                      type === "expense"
                        ? "border-primary bg-card-muted text-primary shadow-sm"
                        : "border-border bg-input-bg text-text-muted hover:border-primary/40 hover:bg-card-muted"
                    }`}
                  >
                    <TrendingDown className="w-5 h-5" />
                    הוצאה
                  </button>

                  <button
                    type="button"
                    onClick={() => setType("income")}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-base font-medium transition-all ${
                      type === "income"
                        ? "border-primary bg-card-muted text-primary shadow-sm"
                        : "border-border bg-input-bg text-text-muted hover:border-primary/40 hover:bg-card-muted"
                    }`}
                  >
                    <TrendingUp className="w-5 h-5" />
                    הכנסה
                  </button>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-text">
                  <Calendar className="w-4 h-4" />
                  תאריך *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="ui-input border-2 px-4 py-3 transition-all"
                />
              </div>

              {/* Merchant/Description */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text">
                  {type === "income" ? "לקוח / תיאור *" : "ספק / תיאור *"}
                </label>
                <input
                  ref={merchantInputRef}
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  required
                  placeholder={
                    type === "income"
                      ? "לדוגמה: תשלום מלקוח ABC"
                      : "לדוגמה: סופר פארם"
                  }
                  className="ui-input border-2 px-4 py-3 transition-all"
                />
              </div>

              {/* Category (for expenses only) */}
              {type === "expense" && (
                <div>
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium text-text">
                    <Tag className="w-4 h-4" />
                    קטגוריה מס
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="ui-input border-2 px-4 py-3 transition-all"
                  >
                    <option value="">בחר קטגוריה...</option>
                    {TAX_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  {taxCategory && (
                    <div className="ui-notice ui-notice-info mt-2 p-3">
                      <p className="flex items-center gap-2 text-xs text-text">
                        <AlertCircle className="w-4 h-4 text-blue-600" />
                        <span>
                          ניכוי מע״מ: <strong>{(taxCategory.vatPercentage * 100).toFixed(0)}%</strong> |
                          הכרה למס הכנסה: <strong>{(taxCategory.incomeTaxRecognition * 100).toFixed(0)}%</strong>
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-text">
                  <span className="text-lg font-bold">₪</span>
                  סכום כולל (כולל מע״מ) *
                </label>
                {/* AI Suggested Amount Banner */}
                {aiSuggestedAmount && !amount && (
                  <div className="ui-notice ui-notice-info mb-2 flex items-center gap-2">
                    <span className="text-xs font-medium text-primary">🤖 AI זיהה:</span>
                    <span className="text-sm font-bold text-text">₪{aiSuggestedAmount.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => setAmount(aiSuggestedAmount.toFixed(2))}
                      className="ui-button ui-button-primary mr-auto px-2 py-1 text-xs"
                    >
                      השתמש בסכום זה
                    </button>
                  </div>
                )}
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder={aiSuggestedAmount ? `AI: ₪${aiSuggestedAmount.toFixed(2)}` : "0.00"}
                  className="ui-input border-2 px-4 py-3 text-xl font-bold transition-all"
                />
              </div>

              {/* VAT Preview */}
              {amount && (
                <div className="ui-card-muted border-2 border-blue-200 p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-text-muted">סכום נטו:</span>
                      <div className="text-lg font-bold text-text">
                        ₪{netAmount.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span className="text-text-muted">מע״מ (18%):</span>
                      <div className="text-lg font-bold text-text">
                        ₪{vatAmount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Action Buttons */}
            <div className="sticky bottom-0 z-10 flex flex-shrink-0 gap-3 border-t-2 border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:static md:p-6">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !isFormValid}
                className="ui-button ui-button-primary flex-1 px-6 py-3.5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {loading ? "שומר..." : "שמור וסיים"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="ui-button ui-button-danger px-6 py-3.5 font-semibold"
                title="מחק טיוטה"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
