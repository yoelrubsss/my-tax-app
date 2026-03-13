"use client";

import { useState, useEffect } from "react";
import { X, Save, ExternalLink, FileText, Tag, Calendar, DollarSign } from "lucide-react";
import { TAX_CATEGORIES, getCategoryById } from "@/lib/tax-knowledge";

interface Transaction {
  id: string | number; // Support both CUID and legacy numeric IDs
  type: "income" | "expense";
  amount: number;
  vat_amount: number;
  date: string;
  description: string;
  category?: string;
  is_vat_deductible: boolean;
  document_path?: string;
}

interface EditTransactionModalProps {
  transaction: Transaction;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function EditTransactionModal({
  transaction,
  isOpen,
  onClose,
  onSave,
}: EditTransactionModalProps) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Initialize form fields when transaction changes
  // FIX #3: Auto-clear draft placeholders and zero amounts
  useEffect(() => {
    if (transaction) {
      // Check for draft placeholders
      const isDraftMerchant = transaction.description === 'Draft Transaction';
      const isPendingReview = transaction.description === 'Pending review';
      const isZeroAmount = transaction.amount === 0;

      // Clear merchant if it's a placeholder
      setMerchant(isDraftMerchant || isPendingReview ? "" : transaction.description || "");

      // Clear amount if it's zero
      setAmount(isZeroAmount ? "" : transaction.amount.toString());

      setDate(transaction.date);
      setCategory(transaction.category || "");

      // Clear description if it's a placeholder
      setDescription(isDraftMerchant || isPendingReview ? "" : transaction.description || "");
    }
  }, [transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: transaction.id,
          merchant,
          amount: parseFloat(amount),
          date,
          category: category || undefined,
          description: merchant, // Use merchant as description
        }),
      });

      const result = await response.json();
      if (result.success) {
        onSave(); // Refresh parent component
        onClose(); // Close modal
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

  if (!isOpen) return null;

  // Calculate VAT preview
  const totalAmount = parseFloat(amount) || 0;
  const vatAmount = totalAmount * 0.18 / 1.18;
  const netAmount = totalAmount - vatAmount;

  const taxCategory = category ? getCategoryById(category) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">ערוך עסקה</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="סגור"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* FIX #2: Receipt Preview with Image Thumbnail or PDF Link */}
        {transaction.document_path && (
          <div className="px-6 pt-4 pb-2">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              {/* Check if it's an image or PDF */}
              {transaction.document_path.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i) ? (
                // Image Preview
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    קבלה מצורפת
                  </p>
                  <a
                    href={transaction.document_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={transaction.document_path}
                      alt="Receipt preview"
                      className="w-full max-w-md mx-auto rounded border border-gray-300 hover:border-blue-500 transition-colors cursor-pointer"
                    />
                  </a>
                  <p className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 justify-center">
                    <ExternalLink className="w-3 h-3" />
                    לחץ לפתיחה בחלון חדש
                  </p>
                </div>
              ) : (
                // PDF or other file - show link only
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">קובץ מצורף</p>
                    <a
                      href={transaction.document_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      PDF - פתח בחלון חדש
                    </a>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 הקובץ המצורף יישמר אוטומטית ולא יימחק בעדכון
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          {/* Merchant/Description */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              {transaction.type === "income" ? "לקוח / תיאור" : "ספק / תיאור"}
            </label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              required
              placeholder={
                transaction.type === "income"
                  ? "לדוגמה: תשלום מלקוח ABC"
                  : "לדוגמה: קניית ציוד משרדי"
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Category (for expenses only) */}
          {transaction.type === "expense" && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Tag className="w-4 h-4" />
                קטגוריה מס
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                <option value="">בחר קטגוריה...</option>
                {TAX_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
              {taxCategory && (
                <p className="text-xs text-gray-600 mt-1">
                  ניכוי מע״מ: {(taxCategory.vatPercentage * 100).toFixed(0)}% |
                  הכרה למס הכנסה: {(taxCategory.incomeTaxRecognition * 100).toFixed(0)}%
                </p>
              )}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              <span className="text-lg font-bold">₪</span>
              סכום כולל (כולל מע״מ)
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* VAT Preview */}
          {amount && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">סכום נטו:</span>
                  <span className="font-bold text-gray-900 mr-2">
                    ₪{netAmount.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">מע״מ (18%):</span>
                  <span className="font-bold text-gray-900 mr-2">
                    ₪{vatAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {loading ? "שומר..." : "שמור שינויים"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md font-medium transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
