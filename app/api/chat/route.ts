import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { AI_KNOWLEDGE_BASE } from "@/lib/ai-knowledge";
import { requireAuth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { devLog } from "@/lib/dev-log";

/**
 * Fetch user context for personalized AI responses
 */
async function getUserContext(userId: string) {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: userId },
    });

    const transactions = await prisma.transaction.findMany({
      where: { userId: userId },
      orderBy: { date: "desc" },
      take: 20,
    });

    devLog(`📊 Fetched ${transactions.length} transactions for AI context`);

    const chatHistory = await prisma.chatMessage.findMany({
      where: { userId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      profile,
      transactions,
      chatHistory,
    };
  } catch (error) {
    console.error("Error fetching user context:", error);
    return {
      profile: null,
      transactions: [],
      chatHistory: [],
    };
  }
}

/**
 * Format user context into a string for AI consumption
 */
function formatUserContext(context: Awaited<ReturnType<typeof getUserContext>>) {
  const { profile, transactions, chatHistory } = context;

  let contextString = "\n\n=== USER CONTEXT ===\n";

  if (profile) {
    contextString += "\nUSER PROFILE:\n";
    if (profile.businessName) contextString += `- Business Name: ${profile.businessName}\n`;
    if (profile.businessType) {
      const typeLabels: Record<string, string> = {
        OSEK_PATUR: "Osek Patur (Cannot reclaim VAT)",
        OSEK_MURSHE: "Osek Murshe (Can reclaim VAT)",
        LTD: "Limited Company",
      };
      contextString += `- Business Type: ${typeLabels[profile.businessType] || profile.businessType}\n`;
    }
    if (profile.isHomeOffice)
      contextString += `- Works from Home Office: Yes (Can deduct home expenses per Regulation 15)\n`;
    if (profile.hasChildren)
      contextString += `- Has Children: Yes (${profile.childrenCount || 0} children - eligible for tax credits)\n`;
  } else {
    contextString += "\nUSER PROFILE: No profile data available. Recommend user to complete settings.\n";
  }

  if (transactions.length > 0) {
    contextString += "\nRECENT TRANSACTIONS (Last 20):\n";
    contextString += "Format: Date | Merchant | Amount | Category | Type\n";
    contextString += "─────────────────────────────────────────────────\n";
    transactions.forEach((tx, index) => {
      const date = new Date(tx.date).toLocaleDateString("he-IL");
      const merchant = tx.merchant || tx.description || "Unknown";
      const amount = tx.amount ? `₪${tx.amount.toFixed(2)}` : "₪0.00";
      const category = tx.category || "Uncategorized";
      const type = tx.type.toUpperCase();
      contextString += `${index + 1}. ${date} | ${merchant} | ${amount} | ${category} | ${type}\n`;
    });
    contextString += "─────────────────────────────────────────────────\n";
  } else {
    contextString += "\nRECENT TRANSACTIONS: No transaction history found.\n";
  }

  if (chatHistory.length > 0) {
    contextString += "\nCONVERSATION HISTORY (Last 10 messages):\n";
    chatHistory.reverse().forEach((msg, index) => {
      const role = msg.role === "user" ? "User" : "Assistant";
      contextString += `${index + 1}. [${role}]: ${msg.content}\n`;
    });
  } else {
    contextString += "\nCONVERSATION HISTORY: This is the first conversation.\n";
  }

  contextString += "\n=== END OF USER CONTEXT ===\n\n";

  devLog("✅ AI Context prepared with transaction data");
  return contextString;
}

async function saveChatMessage(userId: string, role: string, content: string) {
  try {
    await prisma.chatMessage.create({
      data: {
        userId: userId,
        role,
        content,
      },
    });
  } catch (error) {
    console.error("Error saving chat message:", error);
  }
}

function textFromUIMessage(m: UIMessage): string {
  if (!m.parts?.length) return "";
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && "text" in p && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const userIdStr = String(userId);

    const body = (await request.json()) as {
      messages?: UIMessage[];
      id?: string;
    };

    const messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid messages format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Gemini API key is not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userContext = await getUserContext(userIdStr);
    const formattedContext = formatUserContext(userContext);

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      const userText = textFromUIMessage(lastUser);
      if (userText.trim()) {
        await saveChatMessage(userIdStr, "user", userText);
      }
    }

    const systemPrompt = `${AI_KNOWLEDGE_BASE}

${formattedContext}`;

    const google = createGoogleGenerativeAI({ apiKey: apiKey });

    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages: modelMessages,
      temperature: 0.2,
      onFinish: async ({ text }) => {
        const trimmed = text?.trim();
        if (trimmed) {
          await saveChatMessage(userIdStr, "assistant", trimmed);
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    console.error("Error in chat API:", error);

    const message = error instanceof Error ? error.message : String(error);

    if (message === "Authentication required" || message.toLowerCase().includes("authentication")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (error instanceof Error) {
      console.error("chat API error details:", error.constructor.name, error.message);
      if (error.message.includes("API_KEY_INVALID") || error.message.includes("API key")) {
        return new Response(JSON.stringify({ error: "Gemini API key is not configured or invalid" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (error.message.includes("RESOURCE_EXHAUSTED") || error.message.includes("quota")) {
        return new Response(JSON.stringify({ error: "הגעת למגבלת Gemini — נסה שוב מאוחר יותר" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "שגיאה בעיבוד הבקשה. נסה שוב מאוחר יותר." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
