# Receipt Processing Architecture - Unified Flow

## 📋 Overview

The receipt processing system has been refactored to use a **shared service** that handles both manual web uploads and WhatsApp webhook uploads. This ensures consistency, reduces code duplication, and maintains a single source of truth for receipt processing logic.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RECEIPT SOURCES                          │
├─────────────────────────────────────────────────────────────┤
│  1. Web Upload (FileUpload component)                       │
│  2. WhatsApp Message (Webhook)                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│           SHARED RECEIPT PROCESSOR SERVICE                  │
│              lib/receipt-processor.ts                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  processReceipt(buffer, userId, fileName, mimeType)         │
│  ├─► uploadReceiptToStorage()                               │
│  │   └─► Supabase Storage (bucket: "receipts")             │
│  │       └─► Returns: publicUrl                             │
│  │                                                           │
│  └─► processReceiptWithGemini()                             │
│      └─► Gemini AI 2.5-flash                                │
│          └─► Returns: ReceiptScanResult                      │
│              {merchant, date, totalAmount, vatAmount,        │
│               category, confidence}                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│               DRAFT TRANSACTION CREATION                    │
│                  Prisma Database                             │
├─────────────────────────────────────────────────────────────┤
│  Transaction {                                               │
│    status: "DRAFT"                                           │
│    receiptUrl: "https://supabase.co/receipts/..."          │
│    merchant: from Gemini or "Draft Transaction"             │
│    amount: from Gemini or 0                                  │
│    vatAmount: from Gemini or calculated                      │
│    category: from Gemini or "other"                          │
│    description: source identifier                            │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 File Structure

### Core Service
```
lib/
├── receipt-processor.ts    ✅ NEW - Shared receipt processing service
├── supabase.ts            ✅ Supabase client
├── prisma.ts              ✅ Prisma client
└── ...other utilities
```

### API Routes
```
app/api/
├── upload/route.ts              ✅ Web file upload endpoint
├── scan-receipt/route.ts        ✅ Gemini scanning endpoint (legacy)
└── webhook/whatsapp/route.ts    ✅ WhatsApp webhook (uses shared service)
```

---

## 🔄 Flow Comparison

### Before (Duplicated Logic)

**Web Upload Flow:**
1. `/api/upload` → Upload to Supabase
2. Frontend calls `/api/scan-receipt` → Gemini processing
3. Frontend creates draft transaction

**WhatsApp Flow:**
1. Webhook downloads from WhatsApp
2. Webhook uploads to Supabase (duplicated)
3. Webhook calls Gemini (duplicated)
4. Webhook creates draft transaction

### After (Unified Flow)

**Web Upload Flow:**
1. `/api/upload` → Calls `processReceipt()`
2. `processReceipt()` → Supabase + Gemini
3. Frontend receives result → Creates draft transaction

**WhatsApp Flow:**
1. Webhook downloads from WhatsApp
2. Calls `processReceipt()` → Supabase + Gemini
3. Webhook creates draft transaction

Both flows now use the **same service** for:
- ✅ Supabase Storage upload
- ✅ Gemini AI processing
- ✅ Receipt URL generation
- ✅ Error handling

---

## 🎯 Key Benefits

### 1. **Single Source of Truth**
All receipt processing logic is in one place: `lib/receipt-processor.ts`

### 2. **Consistent Behavior**
Both manual and WhatsApp uploads:
- Use the same Supabase bucket (`receipts`)
- Use the same Gemini prompt and extraction logic
- Generate the same URL format
- Follow the same error handling patterns

### 3. **Easy Maintenance**
To change receipt processing logic, update only one file:
- Update Gemini prompt → Edit `processReceiptWithGemini()`
- Change storage bucket → Edit `uploadReceiptToStorage()`
- Modify extraction rules → Edit parsing logic once

### 4. **No Duplication**
- ❌ Removed duplicate Gemini processing code
- ❌ Removed duplicate upload logic
- ❌ Removed duplicate error handling
- ✅ Single `processReceipt()` function

---

## 📝 API Reference

### `processReceipt()`

**Purpose:** Complete receipt processing pipeline

**Signature:**
```typescript
async function processReceipt(
  imageBuffer: Buffer,
  userId: string,
  fileName: string,
  mimeType: string
): Promise<ReceiptProcessingResult>
```

**Parameters:**
- `imageBuffer`: Raw image data (Buffer)
- `userId`: User ID for storage path organization
- `fileName`: Original filename (sanitized automatically)
- `mimeType`: MIME type (e.g., "image/jpeg", "image/png")

**Returns:**
```typescript
{
  success: boolean;
  receiptUrl: string | null;      // Supabase public URL
  scanResult: ReceiptScanResult | null;
  error?: string;
}
```

**ReceiptScanResult:**
```typescript
{
  merchant: string | null;
  date: string | null;             // Format: "YYYY-MM-DD"
  totalAmount: number | null;      // Including VAT
  vatAmount: number | null;        // 18% Israeli VAT
  category: string | null;         // From CATEGORY_IDS list
  confidence?: "high" | "medium" | "low";
}
```

---

### `uploadReceiptToStorage()`

**Purpose:** Upload receipt to Supabase Storage

**Signature:**
```typescript
async function uploadReceiptToStorage(
  buffer: Buffer,
  userId: string,
  fileName: string,
  mimeType: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }>
```

**Storage Path Format:** `{userId}/{timestamp}-{sanitizedFileName}`

**Example:** `cmmo4hksg0000x93gjg074fa0/1711724567890-receipt.jpg`

---

### `processReceiptWithGemini()`

**Purpose:** Extract receipt data using Gemini AI

**Signature:**
```typescript
async function processReceiptWithGemini(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ReceiptScanResult | null>
```

**Model:** `gemini-2.5-flash`

**Timeout:** 45 seconds

**Supported Formats:** JPEG, PNG, PDF

---

## 🔐 Draft Transaction Consistency

Both flows create transactions with **identical structure**:

```typescript
{
  userId: string,
  merchant: scanResult?.merchant || "Draft Transaction",
  description: "מ-WhatsApp" | "מהמערכת",
  date: scanResult?.date ? new Date(scanResult.date) : new Date(),
  amount: totalAmount,
  vatRate: 0.18,
  vatAmount: calculated,
  netAmount: calculated,
  recognizedVatAmount: 0,
  category: scanResult?.category || "other",
  type: "EXPENSE",
  status: "DRAFT",              // ← Appears in DraftsInbox
  receiptUrl: publicUrl,        // ← Supabase Storage URL
  isRecognized: true,
}
```

---

## 🧪 Testing

### Test Web Upload
1. Go to web app
2. Upload a receipt image
3. Check transaction appears in Drafts
4. Verify `receiptUrl` points to Supabase

### Test WhatsApp Upload
1. Send image from linked phone (972524589771)
2. Check Vercel logs for processing
3. Verify transaction appears in Drafts
4. Confirm same `receiptUrl` format

### Verify Consistency
```sql
SELECT
  id,
  merchant,
  amount,
  status,
  receiptUrl,
  description
FROM Transaction
WHERE status = 'DRAFT'
ORDER BY createdAt DESC;
```

Both sources should produce identical record structure!

---

## 📊 Error Handling

### Upload Failures
- **Supabase down:** Returns error, no draft created
- **Invalid file type:** Rejected before processing
- **File too large:** Rejected (5MB limit)

### Gemini Failures
- **Timeout (45s):** Draft created with empty values
- **API key invalid:** Draft created with empty values
- **Quota exceeded:** Draft created with empty values

**Important:** Draft is **always created** even if Gemini fails, so users can manually fill the data.

---

## 🚀 Future Enhancements

Possible improvements to the shared service:

- [ ] Support batch processing (multiple receipts)
- [ ] Add receipt OCR fallback (if Gemini fails)
- [ ] Implement caching for duplicate receipts
- [ ] Add receipt validation rules (suspicious amounts)
- [ ] Support multi-page PDFs (currently single page)
- [ ] Add automatic currency conversion
- [ ] Implement receipt categorization training

---

## 📚 Related Files

- `lib/receipt-processor.ts` - Core service
- `app/api/webhook/whatsapp/route.ts` - WhatsApp integration
- `app/api/upload/route.ts` - Web upload endpoint
- `app/api/scan-receipt/route.ts` - Legacy Gemini endpoint
- `lib/supabase.ts` - Storage client
- `ARCHITECTURE.md` - System overview

---

**Last Updated:** 2026-03-29
**Status:** ✅ Production Ready
**Unified Flow:** Complete
