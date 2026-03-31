"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, AlertCircle, Eye, Clock, CheckCircle, Trash2 } from "lucide-react";

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
  status: "DRAFT" | "COMPLETED";
  created_at?: string;
}

interface DraftsInboxProps {
  onReviewDraft: (transaction: Transaction) => void;
  onRefreshNeeded: () => void;
  /** Parent-owned list from one /api/transactions fetch (null = dashboard still loading). */
  sharedTransactions: Transaction[] | null;
  onAllDraftsResolved?: () => void;
}

export default function DraftsInbox({
  onReviewDraft,
  onRefreshNeeded,
  sharedTransactions,
  onAllDraftsResolved,
}: DraftsInboxProps) {
  const [drafts, setDrafts] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const prevDraftCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (sharedTransactions === null) {
      setLoading(true);
      return;
    }
    setLoading(false);
    const draftTransactions = sharedTransactions.filter(
      (t: Transaction) => String(t.status).toUpperCase() === "DRAFT"
    );
    setDrafts(draftTransactions);
  }, [sharedTransactions]);

  useEffect(() => {
    if (loading) return;
    const prev = prevDraftCountRef.current;
    if (prev !== null && prev > 0 && drafts.length === 0) {
      onAllDraftsResolved?.();
    }
    prevDraftCountRef.current = drafts.length;
  }, [drafts, loading, onAllDraftsResolved]);

  const handleDelete = async (id: string | number) => {
    // Confirmation dialog
    if (!window.confirm("האם אתה בטוח שברצונך למחוק קבלה זו?")) {
      return;
    }

    try {
      console.log(`🗑️ Deleting draft transaction: ${id}`);
      const response = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete transaction");
      }

      const result = await response.json();

      if (result.success) {
        console.log("✅ Draft deleted successfully");
        onRefreshNeeded(); // Trigger parent to refresh
      } else {
        throw new Error(result.error || "Failed to delete");
      }
    } catch (error) {
      console.error("❌ Error deleting draft:", error);
      alert("שגיאה במחיקת הקבלה. נסה שוב.");
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-900">
        <div className="flex animate-pulse space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div className="space-y-2">
              <div className="h-4 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (drafts.length === 0) {
    return (
      <div className="rounded-lg border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-8 dark:border-green-800 dark:from-green-950/40 dark:to-emerald-950/40">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-green-100 p-4 dark:bg-green-900/50">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            כל הקבלות עובדו! 🎉
          </h3>
          <p className="max-w-md text-gray-600 dark:text-gray-400">
            אין קבלות ממתינות. כל הקבלות שהעלית מלאות ומוכנות לדיווח.
          </p>
        </div>
      </div>
    );
  }

  // Get missing info summary
  const getMissingInfo = (draft: Transaction) => {
    const missing: string[] = [];
    if (!draft.description?.trim()) missing.push("ספק");
    if (draft.amount == null || Number.isNaN(Number(draft.amount))) missing.push("סכום");
    if (!draft.type) missing.push("סוג");
    if (!draft.category) missing.push("קטגוריה");
    return missing;
  };

  return (
    <div className="rounded-lg bg-white shadow-md dark:bg-gray-900">
      {/* Header */}
      <div className="border-b-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50 p-6 dark:border-yellow-800 dark:from-yellow-950/50 dark:to-amber-950/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-yellow-100 p-3 dark:bg-yellow-900/50">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">קבלות ממתינות</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {drafts.length} {drafts.length === 1 ? "קבלה ממתינה" : "קבלות ממתינות"} למילוי פרטים
              </p>
            </div>
          </div>
          <div className="bg-yellow-500 text-white px-4 py-2 rounded-full font-bold text-lg">
            {drafts.length}
          </div>
        </div>
      </div>

      {/* Drafts Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drafts.map((draft) => {
            const missingInfo = getMissingInfo(draft);
            const uploadDate = draft.created_at
              ? new Date(draft.created_at).toLocaleDateString("he-IL")
              : "לא ידוע";

            const documentUrl = draft.document_path || null;

            return (
              <div
                key={draft.id}
                className="group overflow-hidden rounded-lg border-2 border-gray-200 transition-all duration-200 hover:border-yellow-400 hover:shadow-lg dark:border-gray-700 dark:hover:border-yellow-600"
              >
                {/* Receipt Thumbnail */}
                <div className="relative flex h-48 items-center justify-center overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {documentUrl ? (
                    <div className="relative w-full h-full">
                      {/* Check if image or PDF */}
                      {draft.document_path?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img
                          src={documentUrl}
                          alt="Receipt"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center bg-gray-50 dark:bg-gray-800">
                          <FileText className="mb-2 h-16 w-16 text-gray-400" />
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {draft.document_path?.split(".").pop()?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
                        <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="w-16 h-16 text-gray-300 mb-2" />
                      <span className="text-sm text-gray-400">אין קובץ</span>
                    </div>
                  )}

                  {/* Missing Info Badge */}
                  <div className="absolute top-2 left-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    חסר פרטים
                  </div>

                  {/* Upload Date Badge */}
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {uploadDate}
                  </div>
                </div>

                {/* Card Content */}
                <div className="border-t border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  {/* Missing Info List */}
                  <div className="mb-3">
                    <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">חסר:</p>
                    <div className="flex flex-wrap gap-1">
                      {missingInfo.map((info) => (
                        <span
                          key={info}
                          className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300"
                        >
                          {info}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Partial Info Display */}
                  {draft.description && (
                    <p className="mb-2 truncate text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">ספק:</span> {draft.description}
                    </p>
                  )}
                  {typeof draft.amount === "number" && !Number.isNaN(draft.amount) && (
                    <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">סכום:</span> ₪{draft.amount.toFixed(2)}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-[1fr_auto] gap-2 mt-3">
                    <button
                      onClick={() => onReviewDraft(draft)}
                      className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      מלא פרטים
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(draft.id);
                      }}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center"
                      title="מחק קבלה"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
