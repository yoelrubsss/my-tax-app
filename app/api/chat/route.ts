import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { AI_KNOWLEDGE_BASE } from "@/lib/ai-knowledge";
import { ISRAELI_TAX_LAW_CONTEXT } from "@/lib/tax-regulations";
import { requireAuth } from "@/lib/auth-server";
import { getUserProfile } from "@/lib/db-operations";
import { prisma } from "@/lib/prisma";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Fetch user context for personalized AI responses
 */
async function getUserContext(userId: string) {
  try {
    // Fetch user profile using Prisma
    const profile = await prisma.userProfile.findUnique({
      where: { userId: userId },
    });

    // Fetch last 20 transactions using Prisma (CORRECTED: use camelCase fields)
    const transactions = await prisma.transaction.findMany({
      where: { userId: userId },
      orderBy: { date: 'desc' },
      take: 20,
    });

    console.log(`📊 Fetched ${transactions.length} transactions for AI context`);

    // Fetch last 10 chat messages for conversation history
    const chatHistory = await prisma.chatMessage.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
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

  // Add profile information
  if (profile) {
    contextString += "\n**USER PROFILE:**\n";
    if (profile.businessName) contextString += `- Business Name: ${profile.businessName}\n`;
    if (profile.businessType) {
      const typeLabels: Record<string, string> = {
        "OSEK_PATUR": "Osek Patur (Cannot reclaim VAT)",
        "OSEK_MURSHE": "Osek Murshe (Can reclaim VAT)",
        "LTD": "Limited Company"
      };
      contextString += `- Business Type: ${typeLabels[profile.businessType] || profile.businessType}\n`;
    }
    if (profile.isHomeOffice) contextString += `- Works from Home Office: Yes (Can deduct home expenses per Regulation 15)\n`;
    if (profile.hasChildren) contextString += `- Has Children: Yes (${profile.childrenCount || 0} children - eligible for tax credits)\n`;
  } else {
    contextString += "\n**USER PROFILE:** No profile data available. Recommend user to complete settings.\n";
  }

  // Add transaction history - CRITICAL: This is where we feed transaction data to the AI
  if (transactions.length > 0) {
    contextString += "\n**RECENT TRANSACTIONS (Last 20):**\n";
    contextString += "Format: Date | Merchant | Amount | Category | Type\n";
    contextString += "─────────────────────────────────────────────────\n";
    transactions.forEach((tx, index) => {
      const date = new Date(tx.date).toLocaleDateString('he-IL');
      const merchant = tx.merchant || tx.description || 'Unknown';
      const amount = tx.amount ? `₪${tx.amount.toFixed(2)}` : '₪0.00';
      const category = tx.category || 'Uncategorized';
      const type = tx.type.toUpperCase();
      contextString += `${index + 1}. ${date} | ${merchant} | ${amount} | ${category} | ${type}\n`;
    });
    contextString += "─────────────────────────────────────────────────\n";
  } else {
    contextString += "\n**RECENT TRANSACTIONS:** No transaction history found.\n";
  }

  // Add conversation history
  if (chatHistory.length > 0) {
    contextString += "\n**CONVERSATION HISTORY (Last 10 messages):**\n";
    chatHistory.reverse().forEach((msg, index) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const preview = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
      contextString += `${index + 1}. [${role}]: ${preview}\n`;
    });
  } else {
    contextString += "\n**CONVERSATION HISTORY:** This is the first conversation.\n";
  }

  contextString += "\n=== END OF USER CONTEXT ===\n\n";

  console.log("✅ AI Context prepared with transaction data");
  return contextString;
}

/**
 * Save chat message to database
 */
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

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user ID
    const userId = await requireAuth();

    // CRITICAL FIX: Convert userId to String for Prisma
    const userIdStr = String(userId);

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // Fetch user context for personalization
    const userContext = await getUserContext(userIdStr);
    const formattedContext = formatUserContext(userContext);

    // Get the latest user message
    const latestUserMessage = messages[messages.length - 1];
    if (latestUserMessage && latestUserMessage.role === 'user') {
      await saveChatMessage(userIdStr, 'user', latestUserMessage.content);
    }

    // Build the enhanced system prompt with RAG context
    const enhancedSystemPrompt = `${AI_KNOWLEDGE_BASE}

${ISRAELI_TAX_LAW_CONTEXT}

${formattedContext}

**INSTRUCTIONS:**
- Use the user's profile, transaction history, and conversation history to provide personalized advice.
- Reference specific transactions when relevant (e.g., "I see you had a ₪500 expense at X merchant...").
- Apply the official Israeli tax rules strictly from the TAX LAW CONTEXT above.
- If the user is an "Osek Patur", remind them they CANNOT reclaim VAT.
- If the user has a home office, consider Regulation 15 for home expense deductions.
- If the user has children, mention potential tax credits.
- Be conversational, professional, and empathetic in Hebrew.
`;

    // Create chat completion with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: enhancedSystemPrompt,
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    // Extract the assistant's response
    const assistantMessage = completion.choices[0]?.message?.content || "מצטער, לא הצלחתי לעבד את השאלה. נסה שוב.";

    // Save assistant's response to database (use userIdStr from scope)
    await saveChatMessage(userIdStr, 'assistant', assistantMessage);

    return NextResponse.json({
      role: "assistant",
      content: assistantMessage,
    });
  } catch (error: any) {
    console.error("Error in chat API:", error);

    // Handle authentication errors
    if (error.message === "Authentication required" || error.message.includes("authentication")) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "OpenAI API key is not configured" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "שגיאה בעיבוד הבקשה. נסה שוב מאוחר יותר." },
      { status: 500 }
    );
  }
}
