"use client";

import { useState } from "react";
import { MessageSquarePlus, X, Loader2 } from "lucide-react";

export default function ReportIssueFAB() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = message.trim();
    if (!trimmed) {
      setError("נא לתאר את הבעיה");
      return;
    }
    setSending(true);
    try {
      const pageUrl =
        typeof window !== "undefined"
          ? window.location.href
          : "";
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, pageUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "שגיאה בשליחה");
        return;
      }
      setMessage("");
      setOpen(false);
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-28 left-[max(1rem,env(safe-area-inset-left))] z-40 flex items-center gap-2 rounded-full bg-slate-800 px-4 py-3 text-sm font-medium text-white shadow-lg transition-transform hover:bg-slate-700 active:scale-95 md:bottom-8 md:left-8"
        aria-label="דיווח על תקלה"
      >
        <MessageSquarePlus className="h-5 w-5 shrink-0" />
        <span className="hidden sm:inline">דיווח על תקלה</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-issue-title"
        >
          <div className="ui-modal w-full max-w-md rounded-xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="report-issue-title" className="text-lg font-bold text-text">
                דיווח על תקלה
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-text-muted transition-colors hover:bg-card-muted hover:text-text"
                aria-label="סגור"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-text-muted">
              נשלחים אוטומטית: כתובת העמוד הנוכחי ומזהה המשתמש שלך.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="תאר מה קרה..."
                className="ui-input min-h-[7.5rem] resize-y text-sm"
                disabled={sending}
              />
              {error && (
                <p className="text-sm text-danger dark:text-red-400" role="alert">
                  {error}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ui-button ui-button-ghost px-4 py-2 text-sm"
                  disabled={sending}
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="ui-button ui-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      שולח...
                    </>
                  ) : (
                    "שלח דיווח"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
