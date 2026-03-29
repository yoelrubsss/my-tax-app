# Gemini Processing Debug Guide

## 🐛 Issues Fixed

### 1. **CATEGORY_IDS Mismatch**
**Problem:** The shared `receipt-processor.ts` had only 13 categories, but `scan-receipt/route.ts` has 21 categories.

**Fixed:** Updated to match exactly:
```typescript
// BEFORE (receipt-processor.ts) - Missing 8 categories
const CATEGORY_IDS = [
  "office-equipment",
  "software",
  "professional-services",
  // ... only 13 total
];

// AFTER - Now matches scan-receipt exactly
const CATEGORY_IDS = [
  "office-equipment",
  "software",
  "software-foreign",      // ← Added
  "software-local",        // ← Added
  "professional-services",
  "vehicle-fuel",
  "vehicle-maintenance",   // ← Added
  "vehicle-insurance",     // ← Added
  "communication",
  "meals-entertainment",
  "travel",
  "home-office",           // ← Added
  "rent",
  "utilities",
  "education",
  "marketing",
  "legal-accounting",      // ← Added
  "insurance",
  "health-safety",         // ← Added
  "gifts",
  "other",
];
```

**Impact:** If Gemini suggested a category that wasn't in the old list (e.g., "software-foreign"), it would be rejected and set to `null`.

---

### 2. **Simplified Gemini Prompt**
**Problem:** The receipt-processor prompt was missing currency detection instructions.

**Fixed:** Now uses the **exact same prompt** as `scan-receipt/route.ts`:

Added:
- ✅ Currency detection instructions
- ✅ "DETECT the currency symbol" language
- ✅ `detectedCurrency` field in JSON response

---

### 3. **Insufficient Logging**
**Problem:** No way to track where Gemini data was being lost.

**Fixed:** Added comprehensive logging with prefixes:

| Prefix | Purpose |
|--------|---------|
| `[UPLOAD]` | Supabase Storage operations |
| `[GEMINI]` | AI processing steps |
| `[PROCESS]` | Overall pipeline coordination |
| `[WEBHOOK]` | WhatsApp-specific logic |
| `[CREATE_DRAFT]` | Transaction creation |

---

## 📊 How to Read Vercel Logs

After sending a WhatsApp image, check Vercel logs for this sequence:

### 1. WhatsApp Message Received
```
📲 WhatsApp webhook received
📱 Processing message from 972524589771, type: image
✅ Found user: yoelrubs@gmail.com (cmmo4hksg0000x93gjg074fa0)
```

### 2. Image Download
```
📡 Downloading from: https://...
📥 Downloaded image: 45231 bytes
```

### 3. Receipt Processing Pipeline
```
========================================
📄 [PROCESS] Starting receipt processing
📄 [PROCESS] File: whatsapp-xxx.jpg
📄 [PROCESS] User: cmmo4hksg0000x93gjg074fa0
📄 [PROCESS] MIME: image/jpeg
📄 [PROCESS] Size: 45231 bytes
========================================
```

### 4. Supabase Upload
```
📤 [UPLOAD] Starting upload for user...
📤 [UPLOAD] Storage path: cmmo4hksg0000x93gjg074fa0/1711724567890-whatsapp-xxx.jpg
✅ [UPLOAD] Receipt uploaded successfully: https://supabase.co/...
```

### 5. Gemini Processing (CRITICAL SECTION)
```
🤖 [GEMINI] Starting Gemini processing, buffer size: 45231
🤖 [GEMINI] API key found, initializing GoogleGenerativeAI
🤖 [GEMINI] Model initialized: gemini-2.5-flash
🤖 [GEMINI] Converting buffer to base64...
🤖 [GEMINI] Base64 length: 62345 characters
🤖 [GEMINI] Sending request to Gemini API...
🤖 [GEMINI] Response received from Gemini API
🤖 [GEMINI] Full response (first 500 chars): {
  "merchant": "קופיקס",
  "date": "2026-03-29",
  "totalAmount": 47.50,
  "vatAmount": 7.21,
  "detectedCurrency": "ILS",
  "suggestedCategory": "meals-entertainment",
  "confidence": "high"
}
🤖 [GEMINI] JSON parsed successfully: {...}
✅ [GEMINI] Extracted and validated scan result: {
  merchant: "קופיקס",
  date: "2026-03-29",
  totalAmount: 47.5,
  vatAmount: 7.21,
  category: "meals-entertainment",
  confidence: "high"
}
```

### 6. Transaction Creation
```
💾 [CREATE_DRAFT] Starting transaction creation
💾 [CREATE_DRAFT] Input parameters:
  - userId: cmmo4hksg0000x93gjg074fa0
  - receiptUrl: https://supabase.co/...
  - scanResult: {
    merchant: "קופיקס",
    date: "2026-03-29",
    totalAmount: 47.5,
    vatAmount: 7.21,
    category: "meals-entertainment"
  }
💾 [CREATE_DRAFT] Calculated amounts:
  - totalAmount: 47.5
  - vatAmount: 7.21
  - netAmount: 40.29
💾 [CREATE_DRAFT] Transaction data to be created: {...}
✅ [CREATE_DRAFT] Transaction created successfully!
✅ [CREATE_DRAFT] Transaction ID: clxxxxxx
✅ [CREATE_DRAFT] Merchant: קופיקס
✅ [CREATE_DRAFT] Amount: 47.5
✅ [CREATE_DRAFT] Date: 2026-03-29
```

---

## 🔍 Debugging Scenarios

### Scenario 1: Gemini Returns Null Values

**Logs to check:**
```
⚠️ [GEMINI] Merchant is null
⚠️ [GEMINI] Date is null
⚠️ [GEMINI] TotalAmount is null
```

**Possible causes:**
- Receipt image is blurry/unclear
- Gemini can't read the text
- Receipt format is unusual

**Result:** Transaction created with defaults:
- Merchant: "Draft Transaction"
- Amount: 0
- Date: Current date

---

### Scenario 2: JSON Parse Error

**Logs to check:**
```
❌ [GEMINI] No JSON found in Gemini response
❌ [GEMINI] Full content: [shows what Gemini returned]
```

**Possible causes:**
- Gemini returned text instead of JSON
- Safety filters blocked the response
- API error

---

### Scenario 3: Invalid Category

**Logs to check:**
```
⚠️ [GEMINI] Category is null or invalid
```

**Cause:** Gemini suggested a category not in CATEGORY_IDS list

**Result:** Category set to "other" (default)

---

### Scenario 4: Gemini Timeout

**Logs to check:**
```
❌ [GEMINI] Processing error: Gemini timeout
```

**Cause:** API took longer than 45 seconds

**Result:** Transaction created with null scanResult

---

## 🧪 Testing

### Test 1: Send Clear Receipt
1. Send a clear, well-lit receipt photo
2. Check Vercel logs for all fields populated
3. Verify transaction in web app has all data

### Test 2: Send Blurry Receipt
1. Send a blurry or dark receipt
2. Check logs for null value warnings
3. Verify transaction has defaults

### Test 3: Check Category Matching
1. Send receipts from different merchants
2. Check if category is detected correctly
3. Look for "Category is null or invalid" warnings

---

## 📝 Log Prefix Reference

| Prefix | File | Purpose |
|--------|------|---------|
| `📤 [UPLOAD]` | `lib/receipt-processor.ts` | Supabase Storage upload |
| `🤖 [GEMINI]` | `lib/receipt-processor.ts` | Gemini AI processing |
| `📄 [PROCESS]` | `lib/receipt-processor.ts` | Overall pipeline |
| `📱 [WEBHOOK]` | `app/api/webhook/whatsapp/route.ts` | WhatsApp message handling |
| `💾 [CREATE_DRAFT]` | `app/api/webhook/whatsapp/route.ts` | Transaction creation |

---

## 🚀 Next Steps

1. **Wait for Vercel deployment** (~2-3 minutes)
2. **Send test WhatsApp image** from +972-52-458-9771
3. **Check Vercel logs** immediately:
   - Go to Vercel Dashboard → Your Project → Logs
   - Filter by function: `/api/webhook/whatsapp`
4. **Look for the logging sections** above
5. **Verify transaction** in web app DraftsInbox

---

## 💡 Expected Behavior

### ✅ Success Case
- All Gemini fields populated
- Transaction has merchant name, amount, date
- Category is valid (from CATEGORY_IDS list)
- Receipt URL points to Supabase

### ⚠️ Partial Success (Gemini Fails)
- Transaction created with defaults
- Receipt URL still valid
- User can manually fill data
- Description says "מ-WhatsApp - נדרש מילוי פרטים"

### ❌ Complete Failure
- Transaction not created at all
- Error logged in [CREATE_DRAFT] section
- WhatsApp message not acknowledged

---

## 🔗 Related Files

- `lib/receipt-processor.ts` - Core service with logging
- `app/api/webhook/whatsapp/route.ts` - WhatsApp webhook
- `app/api/scan-receipt/route.ts` - Reference implementation

---

**Last Updated:** 2026-03-29
**Status:** ✅ Comprehensive logging added
**Ready for testing**
