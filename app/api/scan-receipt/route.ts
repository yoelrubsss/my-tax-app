import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import OpenAI from "openai";
import { readFile } from "fs/promises";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy-key-for-build"
});

const CATEGORY_IDS = [
  "office-equipment",
  "software",
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

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: "No file path provided" },
        { status: 400 }
      );
    }

    // Only images are supported for Vision (not PDF)
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".pdf") {
      return NextResponse.json({
        success: true,
        suggestions: null,
        reason: "PDF files require manual entry — please fill the form",
      });
    }

    // Read file from disk (filePath is a public URL like /uploads/userId/filename.jpg)
    const absolutePath = path.join(process.cwd(), "public", filePath);
    const fileBuffer = await readFile(absolutePath);
    const base64 = fileBuffer.toString("base64");

    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

    // Call OpenAI Vision
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an Israeli VAT receipt scanner for an Authorized Dealer (עוסק מורשה).

Analyze this receipt image and return ONLY a valid JSON object — no markdown, no explanation, just raw JSON:

{
  "merchant": "business name (string or null)",
  "date": "YYYY-MM-DD format (string or null)",
  "totalAmount": total including VAT as number (or null),
  "vatAmount": VAT amount shown on receipt as number, or calculate as totalAmount * 0.18 / 1.18 (or null),
  "suggestedCategory": one of exactly: ${CATEGORY_IDS.join(", ")} (or null),
  "confidence": "high" | "medium" | "low"
}

Rules:
- totalAmount includes VAT (18% Israeli VAT rate)
- If the receipt shows net + VAT separately, sum them for totalAmount
- For category, pick the best match from the list or null if unsure
- Return null for any field you cannot read clearly`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "auto",
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    console.log(`🤖 scan-receipt: AI response: ${content.substring(0, 200)}`);

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("scan-receipt: Could not find JSON in AI response");
      return NextResponse.json({
        success: true,
        suggestions: null,
        reason: "AI could not read the receipt",
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.warn("scan-receipt: Failed to parse AI JSON:", jsonMatch[0]);
      return NextResponse.json({
        success: true,
        suggestions: null,
        reason: "AI response was not valid JSON",
      });
    }

    // Validate and sanitize
    const suggestions = {
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
      confidence: ["high", "medium", "low"].includes(parsed.confidence as string)
        ? (parsed.confidence as string)
        : "low",
    };

    console.log(`✅ scan-receipt: Extracted suggestions:`, suggestions);

    return NextResponse.json({ success: true, suggestions });
  } catch (error: any) {
    console.error("scan-receipt error:", error);
    // Return graceful failure — caller will create the draft without AI suggestions
    return NextResponse.json({
      success: true,
      suggestions: null,
      reason: "Scan failed — please fill manually",
    });
  }
}
