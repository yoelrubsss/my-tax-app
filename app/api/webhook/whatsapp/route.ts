/**
 * ✅ WHATSAPP WEBHOOK INTEGRATION
 *
 * Handles incoming WhatsApp messages with receipt images.
 * Uses shared receipt-processor service for unified flow with web uploads.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processReceipt } from "@/lib/receipt-processor";
import { devLog } from "@/lib/dev-log";

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

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
  document?: {
    caption?: string;
    mime_type: string;
    sha256: string;
    id: string;
    filename?: string;
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
  devLog("🚀 Webhook trigger received!");
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  devLog("📲 WhatsApp webhook verification request:", {
    mode,
    token,
    challenge,
    expectedToken: WHATSAPP_VERIFY_TOKEN,
    tokenMatches: token === WHATSAPP_VERIFY_TOKEN,
  });

  // Check if verification token matches
  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    devLog("✅ WhatsApp webhook verified - returning challenge:", challenge);
    // Return challenge as plain text with explicit content-type
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  devLog("❌ WhatsApp webhook verification failed - mode or token mismatch");
  return new NextResponse("Forbidden", { status: 403 });
}

// POST: Handle incoming WhatsApp messages
export async function POST(request: NextRequest) {
  devLog(
    "[WhatsApp POST] hit server",
    new Date().toISOString(),
    request.nextUrl?.pathname ?? ""
  );
  try {
    const body = await request.json();
    devLog("📲 WhatsApp webhook received:", JSON.stringify(body, null, 2));

    // Validate webhook structure
    if (!body.object || body.object !== "whatsapp_business_account") {
      devLog("⚠️ Not a WhatsApp business webhook");
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    const entry = body.entry?.[0] as WhatsAppWebhookEntry | undefined;
    if (!entry) {
      devLog("⚠️ No entry in webhook");
      return NextResponse.json({ status: "no_entry" }, { status: 200 });
    }

    const changes = entry.changes?.[0];
    if (!changes) {
      devLog("⚠️ No changes in webhook");
      return NextResponse.json({ status: "no_changes" }, { status: 200 });
    }

    const value = changes.value;
    const messages = value?.messages;
    if (!messages || messages.length === 0) {
      devLog("⚠️ No messages in webhook");
      return NextResponse.json({ status: "no_messages" }, { status: 200 });
    }

    const firstMsg = messages[0];
    devLog("[WhatsApp POST] first message id (wamid for reactions):", firstMsg?.id);
    devLog("[WhatsApp POST] first message keys:", firstMsg ? Object.keys(firstMsg) : []);

    const metadata = value?.metadata;

    // Process each message (reaction + receipt handling stay in this request — no separate session)
    for (const message of messages) {
      try {
        await processWhatsAppMessage(message, metadata);
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

interface WhatsAppWebhookMetadata {
  display_phone_number?: string;
  phone_number_id?: string;
}

/**
 * Send ✅ reaction on the user's incoming message.
 * Uses the **incoming** webhook message `id` (wamid) as `reaction.message_id` — required by Meta.
 * If this fails, check Meta App Dashboard: WhatsApp → API Setup → permissions (whatsapp_business_messaging).
 */
async function sendWhatsAppReaction(
  phoneNumberId: string,
  toWaId: string,
  incomingMessageId: string
): Promise<void> {
  devLog("\n========== [REACTION] sendWhatsAppReaction ==========");
  devLog("[REACTION] phone_number_id (path):", phoneNumberId);
  devLog("[REACTION] to (recipient WA id, must match message sender):", toWaId);
  devLog(
    "[REACTION] message_id (incoming message wamid — must be exact from webhook):",
    incomingMessageId
  );

  if (!WHATSAPP_TOKEN) {
    console.warn("⚠️ [REACTION] WHATSAPP_TOKEN missing — skipping reaction");
    devLog("========================================\n");
    return;
  }

  if (!incomingMessageId?.trim()) {
    console.error("❌ [REACTION] incomingMessageId is empty — cannot react");
    devLog("========================================\n");
    return;
  }

  const url = `${WHATSAPP_API_URL}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual" as const,
    to: toWaId,
    type: "reaction" as const,
    reaction: {
      message_id: incomingMessageId,
      emoji: "✅",
    },
  };

  devLog("[REACTION] POST URL:", url);
  devLog("[REACTION] Request body:", JSON.stringify(payload, null, 2));

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("❌ [REACTION] Network/fetch error:", err);
    devLog("========================================\n");
    return;
  }

  const responseText = await res.text();
  devLog("[REACTION] HTTP status:", res.status, res.statusText);

  let parsedBody: unknown = null;
  try {
    parsedBody = responseText ? JSON.parse(responseText) : null;
    devLog("[REACTION] Response JSON:", JSON.stringify(parsedBody, null, 2));
  } catch {
    devLog("[REACTION] Response raw (non-JSON):", responseText.slice(0, 2000));
  }

  if (!res.ok) {
    console.error("❌ [REACTION] Meta API error — check token, phone_number_id, and app permissions.");
    if (parsedBody && typeof parsedBody === "object" && parsedBody !== null && "error" in parsedBody) {
      const errObj = (parsedBody as {
        error?: {
          message?: string;
          code?: number;
          error_subcode?: number;
          type?: string;
          fbtrace_id?: string;
          error_data?: unknown;
        };
      }).error;
      console.error("[REACTION] Meta error.message:", errObj?.message);
      console.error(
        "[REACTION] Meta error.code:",
        errObj?.code,
        "| error_subcode:",
        errObj?.error_subcode,
        "| type:",
        errObj?.type,
        "| fbtrace_id:",
        errObj?.fbtrace_id
      );
      console.error("[REACTION] Meta error (full JSON):", JSON.stringify(parsedBody, null, 2));
      console.error("[REACTION] Hint: Meta App Dashboard → WhatsApp → API Setup — token, Phone number ID, and whatsapp_business_messaging.");
    } else {
      console.error("[REACTION] Non-JSON or unexpected body:", responseText.slice(0, 2000));
    }
    devLog("========================================\n");
    return;
  }

  const messages = parsedBody && typeof parsedBody === "object" && parsedBody !== null && "messages" in parsedBody
    ? (parsedBody as { messages?: Array<{ id?: string }> }).messages
    : undefined;
  devLog("✅ [REACTION] Meta accepted reaction. messages:", messages);
  devLog("========================================\n");
}

async function processWhatsAppMessage(
  message: WhatsAppMessage,
  metadata?: WhatsAppWebhookMetadata
) {
  devLog(
    `[WhatsApp POST] processWhatsAppMessage — from=${message.from} type=${message.type} id=${message.id} (reaction.message_id must match this wamid)`
  );

  // Determine if this is a receipt we can process
  let mediaId: string | null = null;
  let mimeType: string | null = null;
  let fileName: string | null = null;

  if (message.type === "image" && message.image) {
    mediaId = message.image.id;
    mimeType = message.image.mime_type;
    fileName = `whatsapp-${message.id}.jpg`;
    devLog(`📷 Image message detected: ${mimeType}`);
  } else if (message.type === "document" && message.document) {
    // Only process PDF documents
    if (message.document.mime_type === "application/pdf") {
      mediaId = message.document.id;
      mimeType = message.document.mime_type;
      fileName = message.document.filename || `whatsapp-${message.id}.pdf`;
      devLog(`📄 PDF document detected: ${fileName}`);
    } else {
      devLog(
        `⚠️ Document type not supported: ${message.document.mime_type}, ignoring`
      );
      devLog(
        "[REACTION] Skipped — early exit: unsupported document MIME (no receipt processing, no reaction)"
      );
      return;
    }
  } else {
    devLog(
      `⚠️ Message type not supported: ${message.type}, ignoring`
    );
    devLog(
      "[REACTION] Skipped — early exit: message type is not image/document (reaction only runs after successful draft)"
    );
    return;
  }

  if (!mediaId || !mimeType) {
    devLog("⚠️ No valid media found in message");
    devLog("[REACTION] Skipped — early exit: no mediaId/mimeType");
    return;
  }

  // Find user by primary or secondary WhatsApp number (same format as webhook "from")
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { whatsappPhone: message.from },
        { whatsappPhone2: message.from },
      ],
    },
  });

  if (!user) {
    devLog(`⚠️ No user found with WhatsApp phone: ${message.from}`);
    devLog(
      "[REACTION] Skipped — early exit: no linked user for this sender (cannot create draft; reaction not sent)"
    );
    // TODO: Send WhatsApp message to user explaining they need to link their account
    return;
  }

  devLog(`✅ Found user: ${user.email} (${user.id})`);

  // Download media from WhatsApp
  devLog(`📥 Downloading media ID: ${mediaId}`);
  const downloadResult = await downloadWhatsAppMedia(mediaId);
  if (!downloadResult.success || !downloadResult.buffer) {
    console.error("❌ Failed to download media from WhatsApp");
    devLog(
      "[REACTION] Skipped — early exit: media download failed (no draft; reaction not sent)"
    );
    return;
  }

  devLog(
    `📥 Downloaded ${mimeType === "application/pdf" ? "PDF" : "image"}: ${downloadResult.buffer.length} bytes`
  );

  // Process receipt using shared service (upload + Gemini)
  const processingResult = await processReceipt(
    downloadResult.buffer,
    user.id,
    fileName,
    mimeType
  );

  if (!processingResult.success) {
    console.error("❌ Receipt processing failed:", processingResult.error);
    devLog(
      "[REACTION] Skipped — early exit: processReceipt failed (no draft; reaction not sent)"
    );
    return;
  }

  devLog("\n========================================");
  devLog("✅ [WEBHOOK] Receipt processed successfully!");
  devLog("✅ [WEBHOOK] Receipt URL:", processingResult.receiptUrl);
  devLog("✅ [WEBHOOK] Scan result:", JSON.stringify(processingResult.scanResult, null, 2));
  devLog("========================================\n");

  // Create draft transaction with processed data
  devLog("💾 [WEBHOOK] Creating draft transaction...");
  const transaction = await createDraftTransaction(
    user.id,
    processingResult.receiptUrl,
    processingResult.scanResult
  );

  devLog(`✅ [WEBHOOK] Draft transaction created for user ${user.email}`);
  devLog(`✅ [WEBHOOK] Transaction ID: ${transaction.id}`);
  devLog(`✅ [WEBHOOK] Merchant: ${transaction.merchant}`);
  devLog(`✅ [WEBHOOK] Amount: ${transaction.amount}`);
  devLog(`✅ [WEBHOOK] Date: ${transaction.date}`);

  // Immediate ✅ reaction on the incoming receipt message (same request — no extra session)
  const phoneNumberId = metadata?.phone_number_id;
  devLog("[REACTION] Pre-check — metadata:", JSON.stringify(metadata ?? null));
  devLog("[REACTION] Pre-check — message.id (wamid for reaction):", message.id);
  devLog("[REACTION] Pre-check — message.from (to field):", message.from);

  if (!phoneNumberId) {
    console.warn(
      "⚠️ [REACTION] Skipped: metadata.phone_number_id missing from webhook (cannot build /messages URL)"
    );
  } else if (!message.id) {
    console.warn("⚠️ [REACTION] Skipped: message.id missing on webhook payload");
  } else {
    try {
      await sendWhatsAppReaction(phoneNumberId, message.from, message.id);
    } catch (reactionErr) {
      console.error("❌ [REACTION] Non-fatal:", reactionErr);
    }
  }
}

async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
    if (!WHATSAPP_TOKEN) {
      console.error("❌ WHATSAPP_TOKEN not configured");
      return { success: false, error: "Token not configured" };
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
      console.error(
        `❌ Failed to get media info: ${mediaInfoResponse.status}`
      );
      return {
        success: false,
        error: `Failed to get media info: ${mediaInfoResponse.status}`,
      };
    }

    const mediaInfo = await mediaInfoResponse.json();
    const mediaUrl = mediaInfo.url;

    if (!mediaUrl) {
      console.error("❌ No media URL in response");
      return { success: false, error: "No media URL" };
    }

    devLog(`📡 Downloading from: ${mediaUrl}`);

    // Step 2: Download media file
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
    });

    if (!mediaResponse.ok) {
      console.error(`❌ Failed to download media: ${mediaResponse.status}`);
      return {
        success: false,
        error: `Failed to download: ${mediaResponse.status}`,
      };
    }

    const arrayBuffer = await mediaResponse.arrayBuffer();
    return { success: true, buffer: Buffer.from(arrayBuffer) };
  } catch (error) {
    console.error("❌ Error downloading WhatsApp media:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

async function createDraftTransaction(
  userId: string,
  receiptUrl: string | null,
  scanResult: {
    merchant: string | null;
    date: string | null;
    totalAmount: number | null;
    vatAmount: number | null;
    category: string | null;
  } | null
) {
  try {
    devLog("\n========================================");
    devLog("💾 [CREATE_DRAFT] Starting transaction creation");
    devLog("💾 [CREATE_DRAFT] Input parameters:");
    devLog("  - userId:", userId);
    devLog("  - receiptUrl:", receiptUrl);
    devLog("  - scanResult:", JSON.stringify(scanResult, null, 2));
    devLog("========================================\n");

    // Match manual flow logic exactly (from transactions/route.ts line 136-140)
    const finalAmount = scanResult?.totalAmount || 0;
    const finalMerchant = scanResult?.merchant || 'Draft Transaction';
    const finalDescription = scanResult?.merchant || ''; // Empty string, or use merchant as description
    const finalCategory = scanResult?.category || 'other';
    const finalDate = scanResult?.date ? new Date(scanResult.date) : new Date();

    // Calculate VAT amounts (match manual flow line 152-157)
    const vatRate = 0.18;
    const vatAmount = scanResult?.vatAmount
      ? scanResult.vatAmount
      : finalAmount > 0 ? finalAmount * vatRate / (1 + vatRate) : 0;
    const netAmount = finalAmount > 0 ? finalAmount - vatAmount : 0;

    // Calculate RECOGNIZED VAT based on category rules (match manual flow line 159-167)
    // For now, default to 0 since category might not be confirmed yet
    const recognizedVatAmount = 0;

    devLog("💾 [CREATE_DRAFT] Processed values:");
    devLog("  - merchant:", finalMerchant);
    devLog("  - description:", finalDescription);
    devLog("  - amount:", finalAmount);
    devLog("  - vatAmount:", vatAmount);
    devLog("  - netAmount:", netAmount);
    devLog("  - category:", finalCategory);
    devLog("  - date:", finalDate);

    // Match manual flow transaction structure exactly (line 170-186)
    const transactionData = {
      userId,
      type: "EXPENSE" as const,
      date: finalDate,
      merchant: finalMerchant,
      description: finalDescription, // Empty string or merchant name
      amount: finalAmount,
      vatRate: vatRate,
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      netAmount: parseFloat(netAmount.toFixed(2)),
      recognizedVatAmount: parseFloat(recognizedVatAmount.toFixed(2)),
      category: finalCategory,
      receiptUrl: receiptUrl,
      status: "DRAFT", // Explicitly set to DRAFT
      isRecognized: true,
    };

    devLog("\n💾 [CREATE_DRAFT] Transaction data to be created:");
    devLog(JSON.stringify(transactionData, null, 2));

    // Create draft transaction (same structure as manual upload flow)
    const transaction = await prisma.transaction.create({
      data: transactionData,
    });

    devLog("\n========================================");
    devLog("✅ [CREATE_DRAFT] Transaction created successfully!");
    devLog("✅ [CREATE_DRAFT] Transaction ID:", transaction.id);
    devLog("✅ [CREATE_DRAFT] Merchant:", transaction.merchant);
    devLog("✅ [CREATE_DRAFT] Description:", transaction.description);
    devLog("✅ [CREATE_DRAFT] Amount:", transaction.amount);
    devLog("✅ [CREATE_DRAFT] VAT Amount:", transaction.vatAmount);
    devLog("✅ [CREATE_DRAFT] Date:", transaction.date);
    devLog("✅ [CREATE_DRAFT] Category:", transaction.category);
    devLog("✅ [CREATE_DRAFT] Status:", transaction.status);
    devLog("✅ [CREATE_DRAFT] Receipt URL:", transaction.receiptUrl);
    devLog("========================================\n");

    return transaction;
  } catch (error) {
    console.error("\n========================================");
    console.error("❌ [CREATE_DRAFT] Error creating draft transaction:", error);
    if (error instanceof Error) {
      console.error("❌ [CREATE_DRAFT] Error message:", error.message);
      console.error("❌ [CREATE_DRAFT] Error stack:", error.stack);
    }
    console.error("========================================\n");
    throw error;
  }
}
