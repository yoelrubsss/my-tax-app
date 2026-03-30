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
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-[max(1.25rem,env(safe-area-inset-left))] z-40 flex items-center gap-2 rounded-full bg-slate-800 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-slate-700 md:bottom-8 md:left-8"
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
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="report-issue-title" className="text-lg font-bold text-gray-900">
                דיווח על תקלה
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                aria-label="סגור"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-gray-600">
              נשלחים אוטומטית: כתובת העמוד הנוכחי ומזהה המשתמש שלך.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="תאר מה קרה..."
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                disabled={sending}
              />
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  disabled={sending}
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
