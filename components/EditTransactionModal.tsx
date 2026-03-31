"use client";

import { useState, useEffect } from "react";
import { X, Save, ExternalLink, FileText, Tag, Calendar, DollarSign } from "lucide-react";
import { TAX_CATEGORIES, getCategoryById } from "@/lib/tax-knowledge";
import { formatMoney } from "@/lib/utils";

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
      <div className="ui-modal max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6">
          <h2 className="text-2xl font-bold text-text">ערוך עסקה</h2>
          <button
            onClick={onClose}
            className="text-text-muted transition-colors hover:text-text"
            aria-label="סגור"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* FIX #2: Receipt Preview with Image Thumbnail or PDF Link */}
        {transaction.document_path && (
          <div className="px-6 pt-4 pb-2">
            <div className="ui-card-muted border border-blue-200 p-3">
              {/* Check if it's an image or PDF */}
              {transaction.document_path.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i) ? (
                // Image Preview
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-text">
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
                      className="mx-auto w-full max-w-md cursor-pointer rounded border border-border transition-colors hover:border-blue-500"
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
                    <p className="text-sm font-medium text-text">קובץ מצורף</p>
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
            <p className="mt-2 text-xs text-text-muted">
              💡 הקובץ המצורף יישמר אוטומטית ולא יימחק בעדכון
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          {/* Merchant/Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
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
              className="ui-input"
            />
          </div>

          {/* Category (for expenses only) */}
          {transaction.type === "expense" && (
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-text">
                <Tag className="w-4 h-4" />
                קטגוריה מס
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="ui-input"
              >
                <option value="">בחר קטגוריה...</option>
                {TAX_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
              {taxCategory && (
                <p className="mt-1 text-xs text-text-muted">
                  ניכוי מע״מ: {(taxCategory.vatPercentage * 100).toFixed(0)}% |
                  הכרה למס הכנסה: {(taxCategory.incomeTaxRecognition * 100).toFixed(0)}%
                </p>
              )}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-text">
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
              className="ui-input text-lg font-semibold"
            />
          </div>

          {/* VAT Preview */}
          {amount && (
            <div className="ui-card-muted border border-blue-200 p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-muted">סכום נטו:</span>
                  <span className="mr-2 font-bold tabular-nums text-text">
                    ₪{formatMoney(netAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">מע״מ (18%):</span>
                  <span className="mr-2 font-bold tabular-nums text-text">
                    ₪{formatMoney(vatAmount)}
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
              className="rounded-md bg-card-muted px-6 py-3 font-medium text-text transition-colors hover:opacity-90"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
