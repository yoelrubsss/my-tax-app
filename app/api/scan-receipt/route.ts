import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  getReceiptScanCategoryInstructions,
  normalizeReceiptCategoryId,
} from "@/lib/tax-knowledge";

const SCAN_TIMEOUT_MS = 45_000; // PDFs can take longer than images

/** Race a promise against a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AbortError: scan timeout")), ms)
  );
  return Promise.race([promise, timeout]);
}

function getGemini(): GoogleGenerativeAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

function classifyGeminiError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes("AbortError") || msg.includes("timeout")) {
      return "AI timeout — הסריקה ארכה יותר מדי";
    }
    if (msg.includes("API_KEY_INVALID") || msg.includes("API key")) {
      return "מפתח Gemini לא תקין";
    }
    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      return "הגעת למגבלת Gemini — נסה שוב מאוחר יותר";
    }
    if (msg.includes("SAFETY") || msg.includes("blocked")) {
      return "AI חסם את הבקשה — נא למלא ידנית";
    }
    if (
      msg.includes("fetch") ||
      msg.includes("network") ||
      msg.includes("ECONNREFUSED")
    ) {
      return "לא ניתן להתחבר ל-AI — בדוק חיבור אינטרנט";
    }
    return `שגיאת AI: ${msg.slice(0, 100)}`;
  }
  return "שגיאת AI לא ידועה";
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const userIdStr = String(userId);

    const { filePath } = await request.json();

    if (!filePath || typeof filePath !== "string") {
      return NextResponse.json(
        { success: false, error: "No file path provided" },
        { status: 400 }
      );
    }

    // SECURITY: Prevent cross-user receipt scanning by validating ownership
    // Supabase public URLs embed the storage path, which we store as `${userId}/...`.
    const filePathNoQuery = filePath.split("?")[0];
    const receiptsMarker = "/receipts/";
    const markerIndex = filePathNoQuery.lastIndexOf(receiptsMarker);

    if (markerIndex === -1) {
      return NextResponse.json(
        { success: false, error: "Forbidden: invalid receipt path" },
        { status: 403 }
      );
    }

    const storagePath = filePathNoQuery.substring(
      markerIndex + receiptsMarker.length
    );
    let decodedStoragePath: string;
    try {
      decodedStoragePath = decodeURIComponent(storagePath);
    } catch {
      return NextResponse.json(
        { success: false, error: "Forbidden: invalid receipt path" },
        { status: 403 }
      );
    }

    // Basic sanity checks
    if (
      !decodedStoragePath ||
      decodedStoragePath.startsWith("/") ||
      decodedStoragePath.includes("..") ||
      !decodedStoragePath.startsWith(`${userIdStr}/`)
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden: receipt does not belong to user" },
        { status: 403 }
      );
    }

    // Also verify Supabase origin (defense-in-depth)
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      if (!supabaseUrl) {
        return NextResponse.json(
          { success: false, error: "Server misconfiguration" },
          { status: 500 }
        );
      }

      const expectedOrigin = new URL(supabaseUrl).origin;
      const incomingUrl = new URL(filePathNoQuery);
      if (incomingUrl.origin !== expectedOrigin) {
        return NextResponse.json(
          { success: false, error: "Forbidden: invalid storage origin" },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Forbidden: invalid file URL" },
        { status: 403 }
      );
    }

    // Resolve MIME type from URL — Gemini handles both images AND PDFs natively
    const url = filePath.split("?")[0]; // strip query params for extension check
    const ext = url.split(".").pop()?.toLowerCase();
    const mimeType =
      ext === "pdf"
        ? "application/pdf"
        : ext === "png"
        ? "image/png"
        : "image/jpeg"; // default for .jpg / .jpeg

    // Check API key before any network call
    let genAI: GoogleGenerativeAI;
    try {
      genAI = getGemini();
    } catch {
      return NextResponse.json({
        success: true,
        suggestions: null,
        reason: "Gemini API key לא מוגדר בסביבה",
      });
    }

    // Fetch file from Supabase public URL → buffer (reused for both PDF and image paths)
    let fileBuffer: Buffer;
    let base64Data: string;
    try {
      const fileRes = await fetch(filePath);
      if (!fileRes.ok) {
        return NextResponse.json({
          success: true,
          suggestions: null,
          reason: `לא ניתן לטעון את הקובץ מהענן (HTTP ${fileRes.status})`,
        });
      }
      fileBuffer = Buffer.from(await fileRes.arrayBuffer());
      base64Data = fileBuffer.toString("base64");
    } catch (err) {
      console.error("scan-receipt: failed to fetch file from Supabase:", err);
      return NextResponse.json({
        success: true,
        suggestions: null,
        reason: "שגיאה בטעינת הקובץ מהענן",
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a strict Israeli VAT receipt scanner for an Authorized Dealer (עוסק מורשה).

CRITICAL ACCURACY RULES — READ BEFORE ANALYZING:
- NEVER guess, invent, or hallucinate any data. Do not invent numbers that are not present in the document.
- If the text is blurry, faded, or partially visible for merchant name or date, return null for those fields.
- Do not infer the merchant name from logos, colors, or context — only from clearly legible text.
- For amounts: look for keywords like "סה"כ לתשלום", "סה"כ", "Total", or "מע"מ". Confidently extract the numeric values associated with them. Extract the numeric amount but also DETECT the currency symbol. Do your best to find the final total and VAT — only return null for amounts if no numeric value can be found at all.

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

    let content = "";

    if (mimeType === "application/pdf") {
      // ── PDF path: use Gemini File API ───────────────────────────────────
      const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);
      const origName = filePath.split("/").pop()?.split("?")[0] ?? "receipt.pdf";
      const tempPath = path.join(os.tmpdir(), `scan-${Date.now()}-${origName}`);

      let uploadedFileName: string | null = null;
      try {
        // Write buffer to temp file
        fs.writeFileSync(tempPath, fileBuffer);

        // Upload to Google File API
        const uploadResponse = await fileManager.uploadFile(tempPath, {
          mimeType: "application/pdf",
          displayName: origName,
        });
        uploadedFileName = uploadResponse.file.name;
        const fileUri = uploadResponse.file.uri;
        console.log(`📄 scan-receipt: PDF uploaded to Gemini File API: ${fileUri}`);

        // Generate with file URI
        const result = await withTimeout(
          model.generateContent([
            { text: prompt },
            { fileData: { mimeType: "application/pdf", fileUri } },
          ]),
          SCAN_TIMEOUT_MS
        );

        try {
          content = result.response.text().trim();
        } catch {
          const blockReason =
            result.response.promptFeedback?.blockReason ?? "unknown";
          console.warn("scan-receipt: Gemini safety block:", blockReason);
          return NextResponse.json({
            success: true,
            suggestions: null,
            reason: `AI חסם את הבקשה (${blockReason})`,
          });
        }
      } catch (err) {
        // ── Verbose raw error logging ────────────────────────────────────
        console.error("=== scan-receipt: Gemini PDF call failed ===");
        if (err instanceof Error) {
          console.error("  Error type   :", err.constructor.name);
          console.error("  Message      :", err.message);
          if ("status" in err)
            console.error("  HTTP status  :", (err as { status: unknown }).status);
          if ("statusText" in err)
            console.error("  Status text  :", (err as { statusText: unknown }).statusText);
          console.error("  Stack        :", err.stack);
        } else {
          console.error("  Raw error    :", err);
        }
        console.error("=============================================");

        const reason = classifyGeminiError(err);
        return NextResponse.json({ success: true, suggestions: null, reason });
      } finally {
        // Clean up temp file
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
        // Clean up Google-hosted file
        if (uploadedFileName) {
          try { await fileManager.deleteFile(uploadedFileName); } catch { /* ignore */ }
        }
      }
    } else {
      // ── Image path: use inlineData base64 (unchanged) ───────────────────
      try {
        const result = await withTimeout(
          model.generateContent([
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } },
          ]),
          SCAN_TIMEOUT_MS
        );

        try {
          content = result.response.text().trim();
        } catch {
          const blockReason =
            result.response.promptFeedback?.blockReason ?? "unknown";
          console.warn("scan-receipt: Gemini safety block:", blockReason);
          return NextResponse.json({
            success: true,
            suggestions: null,
            reason: `AI חסם את הבקשה (${blockReason})`,
          });
        }
      } catch (err) {
        // ── Verbose raw error logging ──────────────────────────────────────
        console.error("=== scan-receipt: Gemini call failed ===");
        if (err instanceof Error) {
          console.error("  Error type   :", err.constructor.name);
          console.error("  Message      :", err.message);
          if ("status" in err)
            console.error("  HTTP status  :", (err as { status: unknown }).status);
          if ("statusText" in err)
            console.error(
              "  Status text  :",
              (err as { statusText: unknown }).statusText
            );
          console.error("  Stack        :", err.stack);
        } else {
          console.error("  Raw error    :", err);
        }
        console.error("=========================================");

        const reason = classifyGeminiError(err);
        return NextResponse.json({ success: true, suggestions: null, reason });
      }
    }

    console.log(`🤖 scan-receipt Gemini response: ${content.slice(0, 200)}`);

    // Extract JSON block from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        success: true,
        suggestions: null,
        reason: "AI לא החזיר נתונים מובנים",
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({
        success: true,
        suggestions: null,
        reason: "תגובת AI לא תקינה (JSON parse error)",
      });
    }

    const detectedCurrency =
      typeof parsed.detectedCurrency === "string"
        ? parsed.detectedCurrency.toUpperCase()
        : null;

    const suggestions = {
      merchant:
        typeof parsed.merchant === "string" ? parsed.merchant.trim() : null,
      date:
        typeof parsed.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
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
      detectedCurrency,
      category: normalizeReceiptCategoryId(parsed.suggestedCategory),
      confidence: ["high", "medium", "low"].includes(
        parsed.confidence as string
      )
        ? (parsed.confidence as string)
        : "low",
    };

    // Add currency warning if foreign currency detected
    const currencyWarning =
      detectedCurrency && detectedCurrency !== "ILS"
        ? `מטבע זר זוהה: ${detectedCurrency}. יש להמיר לשקלים לפני השמירה.`
        : null;

    console.log("✅ scan-receipt suggestions:", suggestions);
    return NextResponse.json({ success: true, suggestions, currencyWarning });
  } catch (err: unknown) {
    console.error("scan-receipt unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "שגיאה פנימית בשרת" },
      { status: 500 }
    );
  }
}
