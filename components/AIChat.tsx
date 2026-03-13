"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, ArrowLeft, Bot } from "lucide-react";
import { FAQ_QUICK_ANSWERS } from "@/lib/ai-knowledge";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(0);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const findFAQAnswer = (userQuestion: string): string | null => {
    const normalizedQuestion = userQuestion.trim().toLowerCase();

    // Check for exact or partial matches in FAQ
    for (const [question, answer] of Object.entries(FAQ_QUICK_ANSWERS)) {
      const normalizedFAQ = question.toLowerCase();

      // Check if user question contains key phrases from FAQ
      if (normalizedQuestion.includes(normalizedFAQ) || normalizedFAQ.includes(normalizedQuestion)) {
        return answer;
      }

      // Check for key terms
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
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: messageIdCounter.current++,
      text: inputText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = inputText;
    setInputText("");
    setIsTyping(true);

    try {
      // Level 1: Check FAQ first (Local cache)
      const faqAnswer = findFAQAnswer(userInput);

      let botReply = "";

      if (faqAnswer) {
        // FAQ match found - use quick answer
        botReply = faqAnswer;
      } else {
        // Level 2: No FAQ match - Call OpenAI API
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: userInput,
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get AI response");
        }

        const data = await response.json();
        botReply = data.content || "מצטער, לא הצלחתי לעבד את השאלה.";
      }

      const botMessage: Message = {
        id: messageIdCounter.current++,
        text: botReply,
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);

      // Error handling - show friendly error message
      const errorMessage: Message = {
        id: messageIdCounter.current++,
        text: "מצטער, נתקלתי בבעיה. נסה שוב בעוד רגע. 🔧\n\nאם הבעיה נמשכת, נסה לשאול:\n• מה ניתן לקזז על רכב?\n• האם מסעדות מוכרות?\n• כמה מע״מ על מתנות?",
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleExampleQuestion = (question: string) => {
    setInputText(question);
  };

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="fixed inset-x-4 bottom-20 md:inset-auto md:bottom-24 md:right-6 md:w-[480px] max-h-[min(700px,80vh)] bg-white rounded-2xl shadow-2xl border border-purple-200 flex flex-col z-[60] overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          {/* Header with Gradient */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">רואה חשבון דיגיטלי</h3>
                <p className="text-xs text-purple-100">מופעל על ידי AI</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 p-2 rounded-lg transition-colors backdrop-blur-sm"
              aria-label="סגור צ'אט"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4 bg-gradient-to-b from-purple-50/30 to-white">
            {messages.length === 0 && (
              <div className="text-center text-gray-600 mt-12">
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h4 className="font-semibold text-lg mb-2">שלום! אני הרואה חשבון הדיגיטלי שלך</h4>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                  שאל אותי כל שאלה על מע״מ, מיסים, ודיווחים 💼
                </p>
                <div className="mt-6 space-y-2">
                  <div className="text-xs text-gray-400">שאלות לדוגמה:</div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleExampleQuestion("מה אני יכול לקזז במע״מ על רכב?")}
                      className="text-xs bg-white border border-purple-200 rounded-lg px-4 py-2 hover:border-purple-400 transition-colors text-right"
                    >
                      "מה אני יכול לקזז במע״מ על רכב?"
                    </button>
                    <button
                      onClick={() => handleExampleQuestion("האם מסעדות מוכרות?")}
                      className="text-xs bg-white border border-purple-200 rounded-lg px-4 py-2 hover:border-purple-400 transition-colors text-right"
                    >
                      "האם מסעדות מוכרות?"
                    </button>
                    <button
                      onClick={() => handleExampleQuestion("כמה מע״מ על מתנות?")}
                      className="text-xs bg-white border border-purple-200 rounded-lg px-4 py-2 hover:border-purple-400 transition-colors text-right"
                    >
                      "כמה מע״מ על מתנות?"
                    </button>
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.sender === "bot" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center mr-3">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                    message.sender === "user"
                      ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                      : "bg-white text-gray-900 border-2 border-purple-100 shadow-md shadow-purple-500/10"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                  <p className={`text-xs mt-2 ${
                    message.sender === "user" ? "text-purple-100" : "text-gray-400"
                  }`}>
                    {message.timestamp.toLocaleTimeString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {message.sender === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center ml-3">
                    <span className="text-white text-sm font-semibold">א</span>
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center mr-3">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white border-2 border-purple-100 rounded-2xl px-5 py-3 shadow-md shadow-purple-500/10">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-purple-100 bg-white rounded-b-2xl">
            <div className="flex gap-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="שאל את ה-AI שלך..."
                className="flex-1 px-5 py-3 border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                dir="rtl"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isTyping}
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-5 py-3 rounded-xl hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all disabled:hover:shadow-none"
                aria-label="שלח הודעה"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating "Magic Pill" Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-6 py-4 rounded-full shadow-2xl hover:shadow-purple-500/50 transition-all hover:scale-105 z-[60] flex items-center gap-3 animate-pulse"
        style={{ animationDuration: "3s" }}
        aria-label="פתח צ'אט עם רואה חשבון דיגיטלי"
      >
        <Sparkles className="w-6 h-6" />
        <span className="font-semibold text-base">התייעץ עם ה-AI</span>
      </button>
    </>
  );
}
