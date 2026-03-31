"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ArrowLeft, Bot, Square } from "lucide-react";
import { FAQ_QUICK_ANSWERS } from "@/lib/ai-knowledge";

function textFromMessage(m: UIMessage): string {
  if (!m.parts?.length) return "";
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && "text" in p && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

/** Remove Markdown bold markers so assistant replies render as plain text */
function stripBoldAsterisks(content: string): string {
  return content.replaceAll("**", "");
}

function findFAQAnswer(userQuestion: string): string | null {
  const normalizedQuestion = userQuestion.trim().toLowerCase();

  for (const [question, answer] of Object.entries(FAQ_QUICK_ANSWERS)) {
    const normalizedFAQ = question.toLowerCase();

    if (normalizedQuestion.includes(normalizedFAQ) || normalizedFAQ.includes(normalizedQuestion)) {
      return answer;
    }

    if (normalizedQuestion.includes("רכב") && normalizedFAQ.includes("רכב")) {
      return answer;
    }
    if (normalizedQuestion.includes("מסעדה") && normalizedFAQ.includes("מסעדה")) {
      return answer;
    }
    if (normalizedQuestion.includes("מתנה") && normalizedFAQ.includes("מתנה")) {
      return answer;
    }
  }

  return null;
}

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, setMessages, status, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      credentials: "include",
    }),
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, status, scrollToBottom]);

  const isBusy = status === "submitted" || status === "streaming";
  const showThinking = status === "submitted";

  const handleSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;

    const faq = findFAQAnswer(trimmed);
    if (faq) {
      const uid = crypto.randomUUID();
      const aid = crypto.randomUUID();
      const userMsg: UIMessage = {
        id: uid,
        role: "user",
        parts: [{ type: "text", text: trimmed }],
      };
      const assistantMsg: UIMessage = {
        id: aid,
        role: "assistant",
        parts: [{ type: "text", text: faq }],
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      return;
    }

    setInput("");
    await sendMessage({ text: trimmed });
  };

  const handleExampleQuestion = (question: string) => {
    setInput(question);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-2 z-[60] flex h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-50/95 shadow-2xl shadow-zinc-900/10 backdrop-blur-xl dark:border-zinc-700/80 dark:bg-zinc-950/95 dark:shadow-black/40 md:inset-auto md:bottom-24 md:right-6 md:h-[min(700px,80vh)] md:max-h-[min(700px,80vh)] md:w-[min(100vw-2rem,520px)]"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200/80 bg-white/70 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                <Bot className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">רואה חשבון דיגיטלי</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">מענה מקצועי על מע״מ ומיסים</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="סגור צ'אט"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {messages.length === 0 && (
              <div className="mt-8 px-2 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h4 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">שלום</h4>
                <p className="mx-auto max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
                  שאל כל שאלה על מע״מ, מיסים ודיווחים — התשובה תופיע כאן בזמן אמת.
                </p>
                <div className="mt-6 space-y-2 text-right">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-500">שאלות לדוגמה</p>
                  <div className="flex flex-col gap-2">
                    {[
                      "מה אני יכול לקזז במע״מ על רכב?",
                      "האם מסעדות מוכרות?",
                      "כמה מע״מ על מתנות?",
                    ].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleExampleQuestion(q)}
                        className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-right text-xs text-zinc-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/40"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m, i) => {
                const rawText = textFromMessage(m);
                const isUser = m.role === "user";
                const text = isUser ? rawText : stripBoldAsterisks(rawText);
                const isLastAssistant =
                  !isUser && i === messages.length - 1 && status === "streaming";
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="mb-1 border-b border-zinc-100/80 pb-3 last:border-b-0 dark:border-zinc-800/80"
                  >
                    <div
                      className={
                        isUser
                          ? "rounded-xl bg-zinc-100/95 px-4 py-3 dark:bg-zinc-800/70"
                          : "rounded-xl border-r-4 border-indigo-500/70 bg-white/90 px-4 py-3 dark:border-indigo-400/60 dark:bg-zinc-900/70"
                      }
                    >
                      <div
                        className={`mb-1.5 text-[11px] font-semibold uppercase tracking-wide ${
                          isUser ? "text-zinc-500 dark:text-zinc-400" : "text-indigo-600 dark:text-indigo-400"
                        }`}
                      >
                        {isUser ? "אתה" : "עוזר מס"}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-900 dark:text-zinc-100">
                        {text}
                        {isLastAssistant ? (
                          <span className="mr-0.5 inline-block h-4 w-0.5 animate-pulse bg-indigo-500 align-middle dark:bg-indigo-400" />
                        ) : null}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {showThinking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-3 flex justify-start"
              >
                <div className="w-full max-w-[92%] overflow-hidden rounded-2xl border border-zinc-200/80 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/90">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    <Bot className="h-3.5 w-3.5" />
                    חושב…
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-indigo-400/80 to-transparent animate-chat-shimmer dark:via-indigo-500/70" />
                  </div>
                  <div className="mt-2 flex gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:300ms]" />
                  </div>
                </div>
              </motion.div>
            )}

            {error && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
                {error.message || "שגיאה בחיבור לשרת"}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Floating input bar */}
          <div className="flex-shrink-0 p-3 pt-1">
            <form
              onSubmit={handleSubmit}
              className="flex items-end gap-2 rounded-2xl border border-zinc-200/90 bg-white/90 p-2 shadow-lg shadow-zinc-900/5 backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/90"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    void handleSubmit(e);
                  }
                }}
                placeholder="הקלד שאלה…"
                rows={1}
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border-0 bg-transparent px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                dir="rtl"
                disabled={isBusy}
              />
              {status === "streaming" ? (
                <button
                  type="button"
                  onClick={() => void stop()}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                  aria-label="עצור"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || isBusy}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="שלח"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
            </form>
            <p className="mt-1.5 px-1 text-center text-[10px] text-zinc-400 dark:text-zinc-600">Enter לשליחה · Shift+Enter לשורה חדשה</p>
          </div>

        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-5 right-4 z-[60] flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-3.5 text-white shadow-2xl transition-all hover:scale-[1.02] hover:shadow-purple-500/30 md:bottom-6 md:right-6 md:px-6 md:py-4"
        aria-label="פתח צ'אט עם רואה חשבון דיגיטלי"
      >
        <Sparkles className="h-6 w-6" />
        <span className="hidden text-base font-semibold md:inline">התייעץ עם ה-AI</span>
      </button>
    </>
  );
}
