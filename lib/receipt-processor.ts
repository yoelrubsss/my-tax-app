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
    // Generate storage path: userId/timestamp-filename
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${userId}/${timestamp}-${sanitizedFileName}`;

    // Upload to Supabase Storage bucket "receipts"
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ Supabase upload error:", uploadError);
      return {
        success: false,
        error: "Failed to upload to storage",
      };
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("receipts").getPublicUrl(storagePath);

    console.log(`✅ Receipt uploaded to Supabase: ${publicUrl}`);
    return { success: true, publicUrl };
  } catch (error) {
    console.error("❌ Error uploading receipt:", error);
    return { success: false, error: "Upload failed" };
  }
}

/**
 * Process receipt image with Gemini AI
 */
export async function processReceiptWithGemini(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ReceiptScanResult | null> {
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

    const result = await Promise.race([
      model.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data: base64Data } },
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout")), SCAN_TIMEOUT_MS)
      ),
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
      merchant:
        typeof parsed.merchant === "string" ? parsed.merchant.trim() : null,
      date:
        typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
          ? parsed.date
          : null,
      totalAmount:
        typeof parsed.totalAmount === "number" && parsed.totalAmount > 0
          ? Math.round(parsed.totalAmount * 100) / 100
          : null,
      vatAmount:
        typeof parsed.vatAmount === "number" && parsed.vatAmount > 0
          ? Math.round(parsed.vatAmount * 100) / 100
          : null,
      category:
        typeof parsed.suggestedCategory === "string" &&
        CATEGORY_IDS.includes(parsed.suggestedCategory)
          ? parsed.suggestedCategory
          : null,
      confidence: ["high", "medium", "low"].includes(parsed.confidence as string)
        ? (parsed.confidence as string)
        : "low",
    };
  } catch (error) {
    console.error("❌ Gemini processing error:", error);
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
    console.log(`📄 Processing receipt: ${fileName} for user ${userId}`);

    // Step 1: Upload to Supabase Storage
    const uploadResult = await uploadReceiptToStorage(
      imageBuffer,
      userId,
      fileName,
      mimeType
    );

    if (!uploadResult.success || !uploadResult.publicUrl) {
      return {
        success: false,
        receiptUrl: null,
        scanResult: null,
        error: uploadResult.error || "Upload failed",
      };
    }

    console.log(`📥 Receipt uploaded: ${uploadResult.publicUrl}`);

    // Step 2: Process with Gemini AI
    const scanResult = await processReceiptWithGemini(imageBuffer, mimeType);

    if (!scanResult) {
      console.log("⚠️ Gemini processing failed, but upload succeeded");
      // Return success with upload URL even if Gemini fails
      return {
        success: true,
        receiptUrl: uploadResult.publicUrl,
        scanResult: null,
      };
    }

    console.log("✅ Receipt processing complete:", scanResult);

    return {
      success: true,
      receiptUrl: uploadResult.publicUrl,
      scanResult,
    };
  } catch (error) {
    console.error("❌ Error processing receipt:", error);
    return {
      success: false,
      receiptUrl: null,
      scanResult: null,
      error: error instanceof Error ? error.message : "Processing failed",
    };
  }
}
