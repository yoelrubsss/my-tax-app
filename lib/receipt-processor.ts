/**
 * ✅ SHARED RECEIPT PROCESSING SERVICE
 *
 * Unified service for processing receipt images:
 * 1. Upload to Supabase Storage
 * 2. Process with Gemini AI
 * 3. Return structured data
 *
 * Used by:
 * - Manual web upload flow
 * - WhatsApp webhook integration
 */

import { supabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getReceiptScanCategoryInstructions,
  normalizeReceiptCategoryId,
} from "@/lib/tax-knowledge";
import { devLog } from "@/lib/dev-log";

const SCAN_TIMEOUT_MS = 45_000;

export interface ReceiptScanResult {
  merchant: string | null;
  date: string | null;
  totalAmount: number | null;
  vatAmount: number | null;
  category: string | null;
  confidence?: string;
}

export interface ReceiptProcessingResult {
  success: boolean;
  receiptUrl: string | null;
  scanResult: ReceiptScanResult | null;
  error?: string;
}

/**
 * Upload receipt image to Supabase Storage
 */
export async function uploadReceiptToStorage(
  buffer: Buffer,
  userId: string,
  fileName: string,
  mimeType: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    devLog(`📤 [UPLOAD] Starting upload for user ${userId}, file: ${fileName}, size: ${buffer.length} bytes`);

    // Generate storage path: userId/timestamp-filename
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${userId}/${timestamp}-${sanitizedFileName}`;

    devLog(`📤 [UPLOAD] Storage path: ${storagePath}`);

    // Upload to Supabase Storage bucket "receipts"
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ [UPLOAD] Supabase upload error:", uploadError);
      return {
        success: false,
        error: "Failed to upload to storage",
      };
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("receipts").getPublicUrl(storagePath);

    devLog(`✅ [UPLOAD] Receipt uploaded successfully: ${publicUrl}`);
    return { success: true, publicUrl };
  } catch (error) {
    console.error("❌ [UPLOAD] Error uploading receipt:", error);
    return { success: false, error: "Upload failed" };
  }
}

/**
 * Process receipt image or PDF with Gemini AI
 * Supports: image/jpeg, image/png, image/webp, application/pdf
 * MUST match scan-receipt/route.ts prompt exactly
 */
export async function processReceiptWithGemini(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ReceiptScanResult | null> {
  try {
    devLog(`🤖 [GEMINI] Starting Gemini processing, buffer size: ${imageBuffer.length}, mimeType: ${mimeType}`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ [GEMINI] GEMINI_API_KEY not configured");
      return null;
    }

    devLog("🤖 [GEMINI] API key found, initializing GoogleGenerativeAI");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    devLog("🤖 [GEMINI] Model initialized: gemini-2.5-flash");

    const prompt = `You are a strict Israeli VAT receipt scanner for an Authorized Dealer (עוסק מורשה).

You will receive either an image (JPEG, PNG, WebP) or a PDF document containing a receipt. Extract the data accurately.

CRITICAL ACCURACY RULES — READ BEFORE ANALYZING:
- NEVER guess, invent, or hallucinate any data. Do not invent numbers that are not present in the document.
- If the text is blurry, faded, or partially visible for merchant name or date, return null for those fields.
- Do not infer the merchant name from logos, colors, or context — only from clearly legible text.
- For amounts: look for keywords like "סה"כ לתשלום", "סה"כ", "Total", or "מע"מ". Confidently extract the numeric values associated with them. Extract the numeric amount but also DETECT the currency symbol. Do your best to find the final total and VAT — only return null for amounts if no numeric value can be found at all.
- For PDFs: Extract text and numbers from all pages. Focus on the first page for receipt data.

${getReceiptScanCategoryInstructions()}

Return ONLY a valid JSON object — no markdown, no explanation, just raw JSON:

{
  "merchant": "business name exactly as printed (string or null if not clearly legible)",
  "date": "YYYY-MM-DD format (string or null if not clearly legible)",
  "totalAmount": total including VAT as number (or null if no numeric value found),
  "vatAmount": VAT amount shown on receipt as number, or calculate as totalAmount * 0.18 / 1.18 (or null if not found),
  "detectedCurrency": "ILS" | "USD" | "EUR" | "GBP" | null (detect from symbols like ₪, $, €, £ or text like "USD", "EUR", "ILS", "NIS"),
  "suggestedCategory": "exact id string from ALLOWED CATEGORY IDS above (use other if unsure)",
  "confidence": "high" | "medium" | "low"
}

Additional rules:
- totalAmount includes VAT (18% Israeli VAT rate for ILS receipts)
- If the receipt shows net + VAT separately, sum them for totalAmount
- ALWAYS detect the currency: look for ₪ or "ILS" or "NIS" = "ILS", $ or "USD" = "USD", € or "EUR" = "EUR", £ or "GBP" = "GBP"
- If no clear currency symbol, return null for detectedCurrency`;

    devLog("🤖 [GEMINI] Converting buffer to base64...");
    const base64Data = imageBuffer.toString("base64");
    devLog(`🤖 [GEMINI] Base64 length: ${base64Data.length} characters`);

    devLog("🤖 [GEMINI] Sending request to Gemini API...");

    const result = await Promise.race([
      model.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data: base64Data } },
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout")), SCAN_TIMEOUT_MS)
      ),
    ]);

    devLog("🤖 [GEMINI] Response received from Gemini API");

    const content = result.response.text().trim();
    devLog(`🤖 [GEMINI] Full response (first 500 chars): ${content.slice(0, 500)}`);
    devLog(`🤖 [GEMINI] Full response length: ${content.length} characters`);

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("❌ [GEMINI] No JSON found in Gemini response");
      console.error("❌ [GEMINI] Full content:", content);
      return null;
    }

    devLog(`🤖 [GEMINI] JSON extracted: ${jsonMatch[0]}`);

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
      devLog("🤖 [GEMINI] JSON parsed successfully:", JSON.stringify(parsed, null, 2));
    } catch (parseError) {
      console.error("❌ [GEMINI] JSON parse error:", parseError);
      console.error("❌ [GEMINI] Failed to parse:", jsonMatch[0]);
      return null;
    }

    // Extract and validate fields
    const merchant =
      typeof parsed.merchant === "string" ? parsed.merchant.trim() : null;
    const date =
      typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
        ? parsed.date
        : null;
    const totalAmount =
      typeof parsed.totalAmount === "number" && parsed.totalAmount > 0
        ? Math.round(parsed.totalAmount * 100) / 100
        : null;
    const vatAmount =
      typeof parsed.vatAmount === "number" && parsed.vatAmount > 0
        ? Math.round(parsed.vatAmount * 100) / 100
        : null;
    const category = normalizeReceiptCategoryId(parsed.suggestedCategory);
    const confidence = ["high", "medium", "low"].includes(
      parsed.confidence as string
    )
      ? (parsed.confidence as string)
      : "low";

    const scanResult = {
      merchant,
      date,
      totalAmount,
      vatAmount,
      category,
      confidence,
    };

    devLog("✅ [GEMINI] Extracted and validated scan result:", JSON.stringify(scanResult, null, 2));

    // Log warnings for null values
    if (!merchant) console.warn("⚠️ [GEMINI] Merchant is null");
    if (!date) console.warn("⚠️ [GEMINI] Date is null");
    if (!totalAmount) console.warn("⚠️ [GEMINI] TotalAmount is null");
    if (!vatAmount) console.warn("⚠️ [GEMINI] VatAmount is null");
    if (category === "other" && parsed.suggestedCategory && String(parsed.suggestedCategory).trim())
      console.warn("⚠️ [GEMINI] Category normalized to other (was:", parsed.suggestedCategory, ")");

    return scanResult;
  } catch (error) {
    console.error("❌ [GEMINI] Processing error:", error);
    if (error instanceof Error) {
      console.error("❌ [GEMINI] Error message:", error.message);
      console.error("❌ [GEMINI] Error stack:", error.stack);
    }
    return null;
  }
}

/**
 * Complete receipt processing pipeline:
 * 1. Upload to Supabase Storage
 * 2. Process with Gemini AI
 * 3. Return combined result
 */
export async function processReceipt(
  imageBuffer: Buffer,
  userId: string,
  fileName: string,
  mimeType: string
): Promise<ReceiptProcessingResult> {
  try {
    devLog(`\n========================================`);
    devLog(`📄 [PROCESS] Starting receipt processing`);
    devLog(`📄 [PROCESS] File: ${fileName}`);
    devLog(`📄 [PROCESS] User: ${userId}`);
    devLog(`📄 [PROCESS] MIME: ${mimeType}`);
    devLog(`📄 [PROCESS] Size: ${imageBuffer.length} bytes`);
    devLog(`========================================\n`);

    // Step 1: Upload to Supabase Storage
    devLog("📄 [PROCESS] Step 1/2: Uploading to Supabase Storage...");
    const uploadResult = await uploadReceiptToStorage(
      imageBuffer,
      userId,
      fileName,
      mimeType
    );

    if (!uploadResult.success || !uploadResult.publicUrl) {
      console.error("❌ [PROCESS] Upload failed:", uploadResult.error);
      return {
        success: false,
        receiptUrl: null,
        scanResult: null,
        error: uploadResult.error || "Upload failed",
      };
    }

    devLog(`✅ [PROCESS] Upload complete: ${uploadResult.publicUrl}`);

    // Step 2: Process with Gemini AI
    devLog("\n📄 [PROCESS] Step 2/2: Processing with Gemini AI...");
    const scanResult = await processReceiptWithGemini(imageBuffer, mimeType);

    if (!scanResult) {
      console.warn("⚠️ [PROCESS] Gemini processing failed, but upload succeeded");
      console.warn("⚠️ [PROCESS] Returning success with null scanResult - user must fill manually");
      // Return success with upload URL even if Gemini fails
      return {
        success: true,
        receiptUrl: uploadResult.publicUrl,
        scanResult: null,
      };
    }

    devLog("\n========================================");
    devLog("✅ [PROCESS] Receipt processing complete!");
    devLog("✅ [PROCESS] Receipt URL:", uploadResult.publicUrl);
    devLog("✅ [PROCESS] Scan result:", JSON.stringify(scanResult, null, 2));
    devLog("========================================\n");

    return {
      success: true,
      receiptUrl: uploadResult.publicUrl,
      scanResult,
    };
  } catch (error) {
    console.error("\n========================================");
    console.error("❌ [PROCESS] Fatal error processing receipt:", error);
    if (error instanceof Error) {
      console.error("❌ [PROCESS] Error message:", error.message);
      console.error("❌ [PROCESS] Error stack:", error.stack);
    }
    console.error("========================================\n");
    return {
      success: false,
      receiptUrl: null,
      scanResult: null,
      error: error instanceof Error ? error.message : "Processing failed",
    };
  }
}
