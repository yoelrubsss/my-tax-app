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

// MUST match scan-receipt/route.ts CATEGORY_IDS exactly
const CATEGORY_IDS = [
  "office-equipment",
  "software",
  "software-foreign",
  "software-local",
  "professional-services",
  "vehicle-fuel",
  "vehicle-maintenance",
  "vehicle-insurance",
  "communication",
  "meals-entertainment",
  "travel",
  "home-office",
  "rent",
  "utilities",
  "education",
  "marketing",
  "legal-accounting",
  "insurance",
  "health-safety",
  "gifts",
  "other",
];

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
    console.log(`📤 [UPLOAD] Starting upload for user ${userId}, file: ${fileName}, size: ${buffer.length} bytes`);

    // Generate storage path: userId/timestamp-filename
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${userId}/${timestamp}-${sanitizedFileName}`;

    console.log(`📤 [UPLOAD] Storage path: ${storagePath}`);

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

    console.log(`✅ [UPLOAD] Receipt uploaded successfully: ${publicUrl}`);
    return { success: true, publicUrl };
  } catch (error) {
    console.error("❌ [UPLOAD] Error uploading receipt:", error);
    return { success: false, error: "Upload failed" };
  }
}

/**
 * Process receipt image with Gemini AI
 * MUST match scan-receipt/route.ts prompt exactly
 */
export async function processReceiptWithGemini(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ReceiptScanResult | null> {
  try {
    console.log(`🤖 [GEMINI] Starting Gemini processing, buffer size: ${imageBuffer.length}, mimeType: ${mimeType}`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ [GEMINI] GEMINI_API_KEY not configured");
      return null;
    }

    console.log("🤖 [GEMINI] API key found, initializing GoogleGenerativeAI");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.log("🤖 [GEMINI] Model initialized: gemini-2.5-flash");

    // EXACT prompt from scan-receipt/route.ts
    const prompt = `You are a strict Israeli VAT receipt scanner for an Authorized Dealer (עוסק מורשה).

CRITICAL ACCURACY RULES — READ BEFORE ANALYZING:
- NEVER guess, invent, or hallucinate any data. Do not invent numbers that are not present in the document.
- If the text is blurry, faded, or partially visible for merchant name or date, return null for those fields.
- Do not infer the merchant name from logos, colors, or context — only from clearly legible text.
- For amounts: look for keywords like "סה"כ לתשלום", "סה"כ", "Total", or "מע"מ". Confidently extract the numeric values associated with them. Extract the numeric amount but also DETECT the currency symbol. Do your best to find the final total and VAT — only return null for amounts if no numeric value can be found at all.

Return ONLY a valid JSON object — no markdown, no explanation, just raw JSON:

{
  "merchant": "business name exactly as printed (string or null if not clearly legible)",
  "date": "YYYY-MM-DD format (string or null if not clearly legible)",
  "totalAmount": total including VAT as number (or null if no numeric value found),
  "vatAmount": VAT amount shown on receipt as number, or calculate as totalAmount * 0.18 / 1.18 (or null if not found),
  "detectedCurrency": "ILS" | "USD" | "EUR" | "GBP" | null (detect from symbols like ₪, $, €, £ or text like "USD", "EUR", "ILS", "NIS"),
  "suggestedCategory": one of exactly: ${CATEGORY_IDS.join(", ")} (or null),
  "confidence": "high" | "medium" | "low"
}

Additional rules:
- totalAmount includes VAT (18% Israeli VAT rate for ILS receipts)
- If the receipt shows net + VAT separately, sum them for totalAmount
- For category, pick the best match from the list or null if unsure
- ALWAYS detect the currency: look for ₪ or "ILS" or "NIS" = "ILS", $ or "USD" = "USD", € or "EUR" = "EUR", £ or "GBP" = "GBP"
- If no clear currency symbol, return null for detectedCurrency`;

    console.log("🤖 [GEMINI] Converting buffer to base64...");
    const base64Data = imageBuffer.toString("base64");
    console.log(`🤖 [GEMINI] Base64 length: ${base64Data.length} characters`);

    console.log("🤖 [GEMINI] Sending request to Gemini API...");

    const result = await Promise.race([
      model.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data: base64Data } },
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout")), SCAN_TIMEOUT_MS)
      ),
    ]);

    console.log("🤖 [GEMINI] Response received from Gemini API");

    const content = result.response.text().trim();
    console.log(`🤖 [GEMINI] Full response (first 500 chars): ${content.slice(0, 500)}`);
    console.log(`🤖 [GEMINI] Full response length: ${content.length} characters`);

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("❌ [GEMINI] No JSON found in Gemini response");
      console.error("❌ [GEMINI] Full content:", content);
      return null;
    }

    console.log(`🤖 [GEMINI] JSON extracted: ${jsonMatch[0]}`);

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
      console.log("🤖 [GEMINI] JSON parsed successfully:", JSON.stringify(parsed, null, 2));
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
    const category =
      typeof parsed.suggestedCategory === "string" &&
      CATEGORY_IDS.includes(parsed.suggestedCategory)
        ? parsed.suggestedCategory
        : null;
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

    console.log("✅ [GEMINI] Extracted and validated scan result:", JSON.stringify(scanResult, null, 2));

    // Log warnings for null values
    if (!merchant) console.warn("⚠️ [GEMINI] Merchant is null");
    if (!date) console.warn("⚠️ [GEMINI] Date is null");
    if (!totalAmount) console.warn("⚠️ [GEMINI] TotalAmount is null");
    if (!vatAmount) console.warn("⚠️ [GEMINI] VatAmount is null");
    if (!category) console.warn("⚠️ [GEMINI] Category is null or invalid");

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
    console.log(`\n========================================`);
    console.log(`📄 [PROCESS] Starting receipt processing`);
    console.log(`📄 [PROCESS] File: ${fileName}`);
    console.log(`📄 [PROCESS] User: ${userId}`);
    console.log(`📄 [PROCESS] MIME: ${mimeType}`);
    console.log(`📄 [PROCESS] Size: ${imageBuffer.length} bytes`);
    console.log(`========================================\n`);

    // Step 1: Upload to Supabase Storage
    console.log("📄 [PROCESS] Step 1/2: Uploading to Supabase Storage...");
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

    console.log(`✅ [PROCESS] Upload complete: ${uploadResult.publicUrl}`);

    // Step 2: Process with Gemini AI
    console.log("\n📄 [PROCESS] Step 2/2: Processing with Gemini AI...");
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

    console.log("\n========================================");
    console.log("✅ [PROCESS] Receipt processing complete!");
    console.log("✅ [PROCESS] Receipt URL:", uploadResult.publicUrl);
    console.log("✅ [PROCESS] Scan result:", JSON.stringify(scanResult, null, 2));
    console.log("========================================\n");

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
