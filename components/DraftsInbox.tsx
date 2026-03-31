"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, AlertCircle, Eye, Clock, CheckCircle, Trash2 } from "lucide-react";
import HelpTooltip from "./HelpTooltip";

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
      <div className="ui-card p-6">
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
      <div className="ui-notice ui-notice-success p-5 md:p-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 rounded-full bg-card-muted p-3">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-text">
            כל הקבלות עובדו! 🎉
          </h3>
          <p className="max-w-md text-text-muted">
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
    <div className="ui-card">
      {/* Header */}
      <div className="ui-toolbar rounded-none border-x-0 border-t-0 border-b p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-card-muted p-3">
              <AlertCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="flex items-center gap-1 text-2xl font-bold text-text">
                <span>קבלות ממתינות</span>
                <HelpTooltip
                  text="קבלה שנשמרה אבל עדיין חסרים בה פרטים לפני דיווח."
                  label="מה זה טיוטה"
                />
              </h2>
              <p className="text-sm text-text-muted">
                {drafts.length} {drafts.length === 1 ? "קבלה ממתינה" : "קבלות ממתינות"} למילוי פרטים
              </p>
            </div>
          </div>
          <div className="ui-badge px-4 py-2 text-lg font-bold text-primary">
            {drafts.length}
          </div>
        </div>
      </div>

      {/* Drafts Grid */}
      <div className="p-5 md:p-6">
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
                className="group overflow-hidden rounded-lg border border-border transition-all duration-200 hover:shadow-sm"
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
                <div className="border-t border-border bg-card p-4">
                  {/* Missing Info List */}
                  <div className="mb-3">
                    <p className="mb-1 text-xs font-medium text-text-muted">חסר:</p>
                    <div className="flex flex-wrap gap-1">
                      {missingInfo.map((info) => (
                        <span
                          key={info}
                          className="ui-chip border-danger/40 bg-danger/10 text-danger"
                        >
                          {info}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Partial Info Display */}
                  {draft.description && (
                    <p className="mb-2 truncate text-sm text-text">
                      <span className="font-medium">ספק:</span> {draft.description}
                    </p>
                  )}
                  {typeof draft.amount === "number" && !Number.isNaN(draft.amount) && (
                    <p className="mb-2 text-sm text-text">
                      <span className="font-medium">סכום:</span> ₪{draft.amount.toFixed(2)}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-[1fr_auto] gap-2 mt-3">
                    <button
                      onClick={() => onReviewDraft(draft)}
                      className="ui-button ui-button-primary px-4 py-2 font-bold"
                    >
                      <Eye className="w-4 h-4" />
                      מלא פרטים
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(draft.id);
                      }}
                      className="ui-button ui-button-danger px-3 py-2 font-bold"
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
