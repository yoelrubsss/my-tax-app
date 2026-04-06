"use client";

import { useState, useRef, useCallback } from "react";
import {
  CloudUpload,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  FileImage,
  X,
} from "lucide-react";
import HelpTooltip from "@/components/HelpTooltip";

// "done"         = draft created + AI extracted data successfully
// "done-partial"  = draft created but AI scan failed (reason stored in statusText)
// "failed"        = draft could NOT be created at all
type FileStatus = "uploading" | "scanning" | "creating" | "done" | "done-partial" | "failed";

interface FileItem {
  id: string;
  name: string;
  status: FileStatus;
  statusText: string;
  error?: string;
}

interface AiSuggestions {
  merchant?: string | null;
  date?: string | null;
  totalAmount?: number | null;
  vatAmount?: number | null;
  category?: string | null;
}

interface BulkUploadAreaProps {
  onUploadComplete: (newSuggestions: Record<string, number>, currencyWarnings: Record<string, string>) => void;
  onRefreshNeeded: () => void;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];

export default function BulkUploadArea({
  onUploadComplete,
  onRefreshNeeded,
}: BulkUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateItem = useCallback(
    (id: string, status: FileStatus, statusText: string, error?: string) => {
      setFileItems((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status, statusText, error } : f))
      );
    },
    []
  );

  const removeItem = (id: string) => {
    setFileItems((prev) => prev.filter((f) => f.id !== id));
  };

  const clearDone = () => {
    setFileItems((prev) =>
      prev.filter((f) => f.status !== "done" && f.status !== "done-partial")
    );
  };

  async function processOnefile(
    file: File,
    id: string,
    newSuggestions: Record<string, number>,
    currencyWarnings: Record<string, string>
  ): Promise<boolean> {
    // ── Step 1: Upload ──────────────────────────────────────────
    updateItem(id, "uploading", "מעלה לענן...");

    let publicUrl: string;
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        updateItem(
          id,
          "failed",
          "שגיאה בהעלאה",
          uploadData.error ?? "שגיאה לא ידועה"
        );
        return false;
      }

      publicUrl = uploadData.path as string;
    } catch (err: unknown) {
      updateItem(
        id,
        "failed",
        "שגיאה בהעלאה",
        err instanceof Error ? err.message : "שגיאת רשת"
      );
      return false;
    }

    // ── Step 2: AI Scan ─────────────────────────────────────────
    updateItem(id, "scanning", "סורק עם AI...");

    let aiSuggestions: AiSuggestions | null = null;
    let scanNote = "";
    let currencyWarningText: string | null = null;

    try {
      const scanRes = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: publicUrl }),
      });
      const scanData = await scanRes.json();

      if (scanData.success && scanData.suggestions) {
        aiSuggestions = scanData.suggestions as AiSuggestions;
        currencyWarningText = scanData.currencyWarning || null;
      } else if (scanData.reason) {
        scanNote = scanData.reason as string;
      } else if (!scanData.success && scanData.error) {
        scanNote = scanData.error as string;
      }
    } catch {
      scanNote = "AI לא זמין כרגע";
    }

    // ── Step 3: Create Draft ────────────────────────────────────
    updateItem(id, "creating", "יוצר טיוטה...");

    const payload: Record<string, unknown> = {
      receiptUrl: publicUrl,
      status: "DRAFT",
    };
    if (aiSuggestions?.merchant) payload.merchant = aiSuggestions.merchant;
    if (aiSuggestions?.date) payload.date = aiSuggestions.date;
    if (aiSuggestions?.category) payload.category = aiSuggestions.category;
    if (aiSuggestions?.totalAmount) payload.amount = aiSuggestions.totalAmount;
    if (aiSuggestions?.vatAmount) payload.vatAmount = aiSuggestions.vatAmount;

    try {
      const createRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const createData = await createRes.json();

      if (!createData.success) {
        updateItem(
          id,
          "failed",
          "שגיאה ביצירת טיוטה",
          createData.error ?? "שגיאה לא ידועה"
        );
        return false;
      }

      // Store AI-suggested amount and currency warning for the TransactionEditor
      if (aiSuggestions?.totalAmount && createData.data?.id) {
        newSuggestions[String(createData.data.id)] = aiSuggestions.totalAmount;
      }
      if (currencyWarningText && createData.data?.id) {
        currencyWarnings[String(createData.data.id)] = currencyWarningText;
      }

      if (aiSuggestions) {
        // AI worked — full success
        updateItem(id, "done", "טיוטה נוצרה עם פרטי AI ✓");
      } else if (scanNote) {
        // Draft created but AI failed — show the exact reason, never use green "done"
        updateItem(id, "done-partial", `טיוטה נוצרה, אך AI נכשל: ${scanNote}`);
      } else {
        // Draft created, AI returned nothing but no specific reason
        updateItem(id, "done", "טיוטה נוצרה ✓");
      }
      return true;
    } catch (err: unknown) {
      updateItem(
        id,
        "failed",
        "שגיאה ביצירת טיוטה",
        err instanceof Error ? err.message : "שגיאת רשת"
      );
      return false;
    }
  }

  const processFiles = useCallback(
    async (files: File[]) => {
      const valid = files.filter((f) => ACCEPTED_TYPES.includes(f.type));
      if (valid.length === 0) return;

      const batchTs = Date.now();
      const newItems: FileItem[] = valid.map((file, i) => ({
        id: `${batchTs}-${i}-${file.name}`,
        name: file.name,
        status: "uploading" as FileStatus,
        statusText: "ממתין...",
      }));

      setFileItems((prev) => [...prev, ...newItems]);

      // Process all files in parallel
      const newSuggestions: Record<string, number> = {};
      const currencyWarnings: Record<string, string> = {};
      const results = await Promise.all(
        valid.map((file, i) => processOnefile(file, newItems[i].id, newSuggestions, currencyWarnings))
      );

      const successCount = results.filter(Boolean).length;

      if (Object.keys(newSuggestions).length > 0 || Object.keys(currencyWarnings).length > 0) {
        onUploadComplete(newSuggestions, currencyWarnings);
      }
      if (successCount > 0) {
        onRefreshNeeded();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onUploadComplete, onRefreshNeeded]
  );

  // ── Drag & Drop handlers ──────────────────────────────────────
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length > 0) processFiles(dropped);
    },
    [processFiles]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear when leaving the zone itself, not a child element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    processFiles(Array.from(selected));
    e.target.value = "";
  };

  // ── Derived state ─────────────────────────────────────────────
  const hasItems = fileItems.length > 0;
  const hasDone = fileItems.some(
    (f) => f.status === "done" || f.status === "done-partial"
  );
  const activeCount = fileItems.filter((f) =>
    ["uploading", "scanning", "creating"].includes(f.status)
  ).length;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div id="bulk-upload" className="mx-auto mb-8 max-w-6xl scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
        <h2 className="text-lg font-bold text-text md:text-xl">העלאת קבלות ואחסון</h2>
        <HelpTooltip
          wide
          label="אחסון קבלות"
          text="כל קבלה נשמרת בענן שלנו באופן מאובטח. המלצת זהב: למרות שהכל מגובה אצלנו, תמיד כדאי לשמור עותק נוסף (פיזי או דיגיטלי) ליתר ביטחון."
        />
      </div>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative cursor-pointer select-none rounded-xl border border-dashed p-6 text-center
          transition-all duration-200
          ${
            isDragging
              ? "scale-[1.005] border-primary bg-card-muted shadow-md"
              : "border-border bg-card hover:border-primary/50 hover:bg-card-muted"
          }
        `}
      >
        <div className="flex flex-col items-center gap-3 pointer-events-none">
          <div
            className={`rounded-full p-3 transition-colors ${
              isDragging ? "bg-card-muted" : "bg-card-muted"
            }`}
          >
            <CloudUpload
              className={`w-10 h-10 transition-colors ${
                isDragging ? "text-primary" : "text-text-muted"
              }`}
            />
          </div>

          <div>
            <p className="text-lg font-semibold text-text">
              {isDragging ? "שחרר קבלות כאן 📂" : "גרור קבלות לכאן"}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {activeCount > 0
                ? `מעבד ${activeCount} קבצים...`
                : "או לחץ לבחירת קבצים • JPG, PNG, PDF • עד 5MB לקובץ"}
            </p>
          </div>

          <div className="ui-chip flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
            <span>🤖</span>
            <span>AI יזהה ספק, תאריך וסכום אוטומטית</span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Per-file Progress List */}
      {hasItems && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* List header */}
          <div className="flex items-center justify-between border-b border-border bg-card-muted px-4 py-2.5">
            <span className="text-sm font-semibold text-text">
              {fileItems.length} {fileItems.length === 1 ? "קובץ" : "קבצים"}
              {activeCount > 0 && (
                <span className="mr-2 font-normal text-primary">
                  ({activeCount} בעיבוד)
                </span>
              )}
            </span>
            {hasDone && activeCount === 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearDone();
                }}
                className="text-xs text-text-muted transition-colors hover:text-text"
              >
                נקה שהסתיימו
              </button>
            )}
          </div>

          {/* File rows */}
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {fileItems.map((item) => (
              <li
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  item.status === "done"
                    ? "bg-green-50/40 dark:bg-green-950/30"
                    : item.status === "done-partial"
                    ? "bg-amber-50/60 dark:bg-amber-950/30"
                    : item.status === "failed"
                    ? "bg-red-50/40 dark:bg-red-950/30"
                    : ""
                }`}
              >
                {/* File type icon */}
                <div className="flex-shrink-0 text-text-muted">
                  {/\.(jpg|jpeg|png|gif|webp)$/i.test(item.name) ? (
                    <FileImage className="h-5 w-5 text-primary" />
                  ) : (
                    <FileText className="h-5 w-5 text-text-muted" />
                  )}
                </div>

                {/* Filename + status text */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-text">
                    {item.name}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${
                      item.status === "done"
                        ? "text-green-600"
                        : item.status === "done-partial"
                        ? "text-amber-700"
                        : item.status === "failed"
                        ? "text-red-600"
                        : "text-primary"
                    }`}
                  >
                    {item.statusText}
                    {item.error && (
                      <span className="text-red-500"> — {item.error}</span>
                    )}
                  </p>
                </div>

                {/* Right side: status icon or dismiss button */}
                <div className="flex-shrink-0 flex items-center gap-1">
                  {item.status === "done" && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {item.status === "done-partial" && (
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  )}
                  {item.status === "failed" && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  {["uploading", "scanning", "creating"].includes(
                    item.status
                  ) && (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  )}

                  {/* Dismiss button for terminal states */}
                  {(item.status === "done" ||
                    item.status === "done-partial" ||
                    item.status === "failed") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="ml-1 text-text-muted transition-colors hover:text-text"
                      title="הסר"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
