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
}

export default function TransactionEditor({
  transaction,
  isOpen,
  onClose,
  onSave,
  aiSuggestedAmount,
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-7 h-7" />
              מלא פרטי העסקה
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              עיין בקבלה ומלא את הפרטים החסרים
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full transition-colors"
            aria-label="סגור"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Split View Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* LEFT SIDE: Receipt Document */}
          <div className="w-full md:w-1/2 bg-gray-900 flex flex-col min-h-0">
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
                    <div className="bg-white p-12 rounded-lg shadow-2xl">
                      <FileText className="w-32 h-32 text-gray-400 mx-auto mb-4" />
                      <p className="text-center text-gray-600 font-medium">
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
                <div className="text-center text-gray-400">
                  <FileText className="w-24 h-24 mx-auto mb-4 opacity-50" />
                  <p>אין קובץ מצורף</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: Form */}
          <div className="w-full md:w-1/2 bg-gray-50 flex flex-col overflow-hidden min-h-0">
            <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
              {/* AI Pre-fill Notice */}
              {aiSuggestedAmount && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-purple-800">
                  <span>🤖</span>
                  <span>הפרטים מולאו אוטומטית על ידי AI — אנא בדוק ואשר</span>
                </div>
              )}
              {/* Transaction Type Selector */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  סוג העסקה
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType("expense")}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 font-medium text-base transition-all ${
                      type === "expense"
                        ? "bg-red-50 border-red-500 text-red-700 shadow-md"
                        : "bg-white border-gray-300 text-gray-600 hover:border-red-300 hover:bg-red-50"
                    }`}
                  >
                    <TrendingDown className="w-5 h-5" />
                    הוצאה
                  </button>

                  <button
                    type="button"
                    onClick={() => setType("income")}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 font-medium text-base transition-all ${
                      type === "income"
                        ? "bg-green-50 border-green-500 text-green-700 shadow-md"
                        : "bg-white border-gray-300 text-gray-600 hover:border-green-300 hover:bg-green-50"
                    }`}
                  >
                    <TrendingUp className="w-5 h-5" />
                    הכנסה
                  </button>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4" />
                  תאריך *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-all"
                />
              </div>

              {/* Merchant/Description */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 transition-all"
                />
              </div>

              {/* Category (for expenses only) */}
              {type === "expense" && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    <Tag className="w-4 h-4" />
                    קטגוריה מס
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 transition-all"
                  >
                    <option value="">בחר קטגוריה...</option>
                    {TAX_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  {taxCategory && (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-gray-700 flex items-center gap-2">
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
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <span className="text-lg font-bold">₪</span>
                  סכום כולל (כולל מע״מ) *
                </label>
                {/* AI Suggested Amount Banner */}
                {aiSuggestedAmount && !amount && (
                  <div className="mb-2 flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-purple-700 font-medium">🤖 AI זיהה:</span>
                    <span className="text-sm font-bold text-purple-900">₪{aiSuggestedAmount.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => setAmount(aiSuggestedAmount.toFixed(2))}
                      className="mr-auto text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded font-medium transition-colors"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xl font-bold text-gray-900 placeholder:text-gray-400 transition-all"
                />
              </div>

              {/* VAT Preview */}
              {amount && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">סכום נטו:</span>
                      <div className="font-bold text-gray-900 text-lg">
                        ₪{netAmount.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">מע״מ (18%):</span>
                      <div className="font-bold text-gray-900 text-lg">
                        ₪{vatAmount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Action Buttons */}
            <div className="bg-white border-t-2 border-gray-200 p-6 flex gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !isFormValid}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
              >
                <Save className="w-5 h-5" />
                {loading ? "שומר..." : "שמור וסיים"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
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
