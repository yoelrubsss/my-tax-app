/**
 * ✅ WHATSAPP WEBHOOK INTEGRATION
 *
 * Handles incoming WhatsApp messages with receipt images.
 * Processes images with Gemini AI and creates draft transactions.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

const CATEGORY_IDS = [
  "office-equipment",
  "software",
  "professional-services",
  "vehicle-fuel",
  "communication",
  "meals-entertainment",
  "travel",
  "rent",
  "utilities",
  "education",
  "marketing",
  "insurance",
  "gifts",
  "other",
];

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  image?: {
    caption?: string;
    mime_type: string;
    sha256: string;
    id: string;
  };
}

interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      messages?: WhatsAppMessage[];
    };
    field: string;
  }>;
}

// GET: Webhook verification (required by WhatsApp)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("📲 WhatsApp webhook verification request:", {
    mode,
    token,
    challenge,
    expectedToken: WHATSAPP_VERIFY_TOKEN,
    tokenMatches: token === WHATSAPP_VERIFY_TOKEN
  });

  // Check if verification token matches
  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    console.log("✅ WhatsApp webhook verified - returning challenge:", challenge);
    // Return challenge as plain text with explicit content-type
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      }
    });
  }

  console.log("❌ WhatsApp webhook verification failed - mode or token mismatch");
  return new NextResponse("Forbidden", { status: 403 });
}

// POST: Handle incoming WhatsApp messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("📲 WhatsApp webhook received:", JSON.stringify(body, null, 2));

    // Validate webhook structure
    if (!body.object || body.object !== "whatsapp_business_account") {
      console.log("⚠️ Not a WhatsApp business webhook");
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    const entry = body.entry?.[0] as WhatsAppWebhookEntry | undefined;
    if (!entry) {
      console.log("⚠️ No entry in webhook");
      return NextResponse.json({ status: "no_entry" }, { status: 200 });
    }

    const changes = entry.changes?.[0];
    if (!changes) {
      console.log("⚠️ No changes in webhook");
      return NextResponse.json({ status: "no_changes" }, { status: 200 });
    }

    const messages = changes.value?.messages;
    if (!messages || messages.length === 0) {
      console.log("⚠️ No messages in webhook");
      return NextResponse.json({ status: "no_messages" }, { status: 200 });
    }

    // Process each message
    for (const message of messages) {
      try {
        await processWhatsAppMessage(message);
      } catch (error) {
        console.error("❌ Error processing message:", error);
        // Continue processing other messages even if one fails
      }
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ status: "ok" }, { status: 200 });

  } catch (error) {
    console.error("❌ WhatsApp webhook error:", error);
    // Always return 200 to prevent WhatsApp from retrying
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}

async function processWhatsAppMessage(message: WhatsAppMessage) {
  console.log(`📱 Processing message from ${message.from}, type: ${message.type}`);

  // Only process image messages
  if (message.type !== "image" || !message.image) {
    console.log("⚠️ Not an image message, ignoring");
    return;
  }

  // Find user by WhatsApp phone number
  const user = await prisma.user.findFirst({
    where: { whatsappPhone: message.from },
  });

  if (!user) {
    console.log(`⚠️ No user found with WhatsApp phone: ${message.from}`);
    // TODO: Send WhatsApp message to user explaining they need to link their account
    return;
  }

  console.log(`✅ Found user: ${user.email} (${user.id})`);

  // Download image from WhatsApp
  const imageBuffer = await downloadWhatsAppMedia(message.image.id);
  if (!imageBuffer) {
    console.error("❌ Failed to download image from WhatsApp");
    return;
  }

  console.log(`📥 Downloaded image: ${imageBuffer.length} bytes`);

  // Process with Gemini
  const scanResult = await processImageWithGemini(imageBuffer, message.image.mime_type);

  if (!scanResult) {
    console.log("⚠️ Gemini processing failed or returned no results");
    // Create a basic draft even if Gemini fails
    await createDraftTransaction(user.id, null, null);
    return;
  }

  console.log("🤖 Gemini scan result:", scanResult);

  // Create draft transaction with Gemini suggestions
  await createDraftTransaction(user.id, scanResult, null);

  console.log(`✅ Draft transaction created for user ${user.email}`);
}

async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer | null> {
  try {
    if (!WHATSAPP_TOKEN) {
      console.error("❌ WHATSAPP_TOKEN not configured");
      return null;
    }

    // Step 1: Get media URL
    const mediaInfoResponse = await fetch(
      `${WHATSAPP_API_URL}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      }
    );

    if (!mediaInfoResponse.ok) {
      console.error(`❌ Failed to get media info: ${mediaInfoResponse.status}`);
      return null;
    }

    const mediaInfo = await mediaInfoResponse.json();
    const mediaUrl = mediaInfo.url;

    if (!mediaUrl) {
      console.error("❌ No media URL in response");
      return null;
    }

    console.log(`📡 Downloading from: ${mediaUrl}`);

    // Step 2: Download media file
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
    });

    if (!mediaResponse.ok) {
      console.error(`❌ Failed to download media: ${mediaResponse.status}`);
      return null;
    }

    const arrayBuffer = await mediaResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);

  } catch (error) {
    console.error("❌ Error downloading WhatsApp media:", error);
    return null;
  }
}

async function processImageWithGemini(
  imageBuffer: Buffer,
  mimeType: string
): Promise<{
  merchant: string | null;
  date: string | null;
  totalAmount: number | null;
  vatAmount: number | null;
  category: string | null;
} | null> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ GEMINI_API_KEY not configured");
      return null;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a strict Israeli VAT receipt scanner for an Authorized Dealer (עוסק מורשה).

CRITICAL ACCURACY RULES — READ BEFORE ANALYZING:
- NEVER guess, invent, or hallucinate any data. Do not invent numbers that are not present in the document.
- If the text is blurry, faded, or partially visible for merchant name or date, return null for those fields.
- Do not infer the merchant name from logos, colors, or context — only from clearly legible text.
- For amounts: look for keywords like "סה"כ לתשלום", "סה"כ", "Total", or "מע"מ". Confidently extract the numeric values associated with them.

Return ONLY a valid JSON object — no markdown, no explanation, just raw JSON:

{
  "merchant": "business name exactly as printed (string or null if not clearly legible)",
  "date": "YYYY-MM-DD format (string or null if not clearly legible)",
  "totalAmount": total including VAT as number (or null if no numeric value found),
  "vatAmount": VAT amount shown on receipt as number, or calculate as totalAmount * 0.18 / 1.18 (or null if not found),
  "suggestedCategory": one of exactly: ${CATEGORY_IDS.join(", ")} (or null),
  "confidence": "high" | "medium" | "low"
}

Additional rules:
- totalAmount includes VAT (18% Israeli VAT rate)
- If the receipt shows net + VAT separately, sum them for totalAmount
- For category, pick the best match from the list or null if unsure`;

    const base64Data = imageBuffer.toString("base64");

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType, data: base64Data } },
    ]);

    const content = result.response.text().trim();
    console.log(`🤖 Gemini response: ${content.slice(0, 200)}`);

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("❌ No JSON found in Gemini response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      merchant: typeof parsed.merchant === "string" ? parsed.merchant.trim() : null,
      date: typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
        ? parsed.date
        : null,
      totalAmount: typeof parsed.totalAmount === "number" && parsed.totalAmount > 0
        ? Math.round(parsed.totalAmount * 100) / 100
        : null,
      vatAmount: typeof parsed.vatAmount === "number" && parsed.vatAmount > 0
        ? Math.round(parsed.vatAmount * 100) / 100
        : null,
      category: typeof parsed.suggestedCategory === "string" &&
        CATEGORY_IDS.includes(parsed.suggestedCategory)
        ? parsed.suggestedCategory
        : null,
    };

  } catch (error) {
    console.error("❌ Gemini processing error:", error);
    return null;
  }
}

async function createDraftTransaction(
  userId: string,
  scanResult: {
    merchant: string | null;
    date: string | null;
    totalAmount: number | null;
    vatAmount: number | null;
    category: string | null;
  } | null,
  receiptUrl: string | null
) {
  try {
    // Calculate amounts based on scan result
    const totalAmount = scanResult?.totalAmount || 0;
    const vatAmount = scanResult?.vatAmount || (totalAmount * 0.18 / 1.18);
    const netAmount = totalAmount - vatAmount;

    // Create draft transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        merchant: scanResult?.merchant || "Draft Transaction",
        description: "מ-WhatsApp - נדרש מילוי פרטים",
        date: scanResult?.date ? new Date(scanResult.date) : new Date(),
        amount: totalAmount,
        vatRate: 0.18,
        vatAmount,
        netAmount,
        recognizedVatAmount: 0, // Will be calculated when category is selected
        category: scanResult?.category || "other",
        type: "EXPENSE",
        status: "DRAFT", // Mark as draft
        receiptUrl,
        isRecognized: true,
      },
    });

    console.log(`✅ Draft transaction created: ${transaction.id}`);
    return transaction;

  } catch (error) {
    console.error("❌ Error creating draft transaction:", error);
    throw error;
  }
}
