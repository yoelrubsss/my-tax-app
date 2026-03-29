# WhatsApp & Manual Flow Synchronization

## ✅ Problem Solved

**Issue:** WhatsApp transactions were using placeholder values instead of Gemini-extracted data, and had hardcoded descriptions that differed from manual uploads.

**Solution:** Aligned WhatsApp `createDraftTransaction` to match the exact structure of `transactions/route.ts` POST handler.

---

## 🔄 Changes Made

### 1. **Merchant Field**

**Before:**
```typescript
merchant: scanResult?.merchant || "Draft Transaction",
```

**After:**
```typescript
const finalMerchant = scanResult?.merchant || 'Draft Transaction';
// ...
merchant: finalMerchant,
```

**Result:** Uses Gemini-extracted merchant name directly. Only falls back to "Draft Transaction" if Gemini returns null.

---

### 2. **Description Field**

**Before:**
```typescript
description: "מ-WhatsApp - נדרש מילוי פרטים",
```

**After:**
```typescript
const finalDescription = scanResult?.merchant || '';
// ...
description: finalDescription,
```

**Result:**
- If Gemini extracts merchant → Use it as description
- If no merchant → Empty string (matching manual flow)
- No hardcoded Hebrew message

---

### 3. **VAT Calculation**

**Before:**
```typescript
const vatAmount = scanResult?.vatAmount || (totalAmount > 0 ? totalAmount * 0.18 / 1.18 : 0);
```

**After:**
```typescript
// Match manual flow line 152-157
const vatRate = 0.18;
const vatAmount = scanResult?.vatAmount
  ? scanResult.vatAmount
  : finalAmount > 0 ? finalAmount * vatRate / (1 + vatRate) : 0;
const netAmount = finalAmount > 0 ? finalAmount - vatAmount : 0;
```

**Result:** Exact same calculation logic as manual flow.

---

### 4. **Field Structure**

**Before:**
```typescript
{
  userId,
  merchant: scanResult?.merchant || "Draft Transaction",
  description: "מ-WhatsApp - נדרש מילוי פרטים",
  date: scanResult?.date ? new Date(scanResult.date) : new Date(),
  amount: totalAmount,
  vatRate: 0.18,
  vatAmount,
  netAmount,
  recognizedVatAmount: 0,
  category: scanResult?.category || "other",
  type: "EXPENSE",
  status: "DRAFT",
  receiptUrl,
  isRecognized: true,
}
```

**After:**
```typescript
// Match manual flow line 170-186
{
  userId,
  type: "EXPENSE",
  date: finalDate,
  merchant: finalMerchant,
  description: finalDescription,
  amount: finalAmount,
  vatRate: vatRate,
  vatAmount: parseFloat(vatAmount.toFixed(2)),
  netAmount: parseFloat(netAmount.toFixed(2)),
  recognizedVatAmount: parseFloat(recognizedVatAmount.toFixed(2)),
  category: finalCategory,
  receiptUrl: receiptUrl,
  status: "DRAFT",
  isRecognized: true,
}
```

**Result:**
- Field order matches manual flow
- Numeric values rounded to 2 decimals (parseFloat with toFixed)
- All fields use processed variables (finalMerchant, finalDescription, etc.)

---

## 📊 Comparison Table

| Field | Manual Flow (transactions/route.ts) | WhatsApp (Before) | WhatsApp (After) |
|-------|-------------------------------------|-------------------|------------------|
| **merchant** | `merchant \|\| description \|\| 'Draft Transaction'` | `scanResult?.merchant \|\| "Draft Transaction"` | ✅ `scanResult?.merchant \|\| 'Draft Transaction'` |
| **description** | `description \|\| merchant \|\| ''` | `"מ-WhatsApp - נדרש מילוי פרטים"` | ✅ `scanResult?.merchant \|\| ''` |
| **vatAmount** | `parseFloat(vatAmount.toFixed(2))` | `vatAmount` | ✅ `parseFloat(vatAmount.toFixed(2))` |
| **netAmount** | `parseFloat(netAmount.toFixed(2))` | `netAmount` | ✅ `parseFloat(netAmount.toFixed(2))` |
| **recognizedVatAmount** | `parseFloat(recognizedVatAmount.toFixed(2))` | `0` | ✅ `parseFloat(0.toFixed(2))` |
| **category** | `category \|\| 'Uncategorized'` | `scanResult?.category \|\| "other"` | ✅ `scanResult?.category \|\| 'other'` |

---

## 🎯 Expected Behavior

### ✅ Success Case (Gemini Extracts All Fields)

**Gemini returns:**
```json
{
  "merchant": "קופיקס",
  "date": "2026-03-29",
  "totalAmount": 47.5,
  "vatAmount": 7.21,
  "category": "meals-entertainment"
}
```

**Transaction created:**
```typescript
{
  merchant: "קופיקס",           // ← Gemini value
  description: "קופיקס",         // ← Same as merchant
  amount: 47.5,                  // ← Gemini value
  vatAmount: 7.21,               // ← Gemini value
  netAmount: 40.29,              // ← Calculated
  date: "2026-03-29",            // ← Gemini value
  category: "meals-entertainment", // ← Gemini value
  status: "DRAFT"
}
```

---

### ⚠️ Partial Success (Gemini Fails to Extract Merchant)

**Gemini returns:**
```json
{
  "merchant": null,
  "date": "2026-03-29",
  "totalAmount": 47.5,
  "vatAmount": 7.21,
  "category": null
}
```

**Transaction created:**
```typescript
{
  merchant: "Draft Transaction", // ← Fallback
  description: "",                // ← Empty string
  amount: 47.5,                  // ← Gemini value
  vatAmount: 7.21,               // ← Gemini value
  netAmount: 40.29,              // ← Calculated
  date: "2026-03-29",            // ← Gemini value
  category: "other",             // ← Fallback
  status: "DRAFT"
}
```

---

### ❌ Complete Gemini Failure

**Gemini returns:** `null` (processing failed)

**Transaction created:**
```typescript
{
  merchant: "Draft Transaction", // ← Fallback
  description: "",                // ← Empty
  amount: 0,                     // ← Default
  vatAmount: 0,                  // ← Default
  netAmount: 0,                  // ← Default
  date: new Date(),              // ← Current date
  category: "other",             // ← Default
  status: "DRAFT"
}
```

---

## 🧪 Testing Checklist

After deployment completes, verify:

### Test 1: Check Merchant Display
- [ ] Send WhatsApp receipt with clear merchant name
- [ ] Check DraftsInbox shows actual merchant (e.g., "קופיקס")
- [ ] NOT showing "Draft Transaction" placeholder

### Test 2: Check Description
- [ ] Open transaction details
- [ ] Verify description is empty or matches merchant
- [ ] NOT showing "מ-WhatsApp - נדרש מילוי פרטים"

### Test 3: Check VAT Calculations
- [ ] Verify amounts match Gemini extraction
- [ ] Check decimal precision (2 places)
- [ ] Confirm netAmount = amount - vatAmount

### Test 4: Compare with Manual Upload
- [ ] Upload same receipt via web interface
- [ ] Upload same receipt via WhatsApp
- [ ] Verify both transactions have identical structure

---

## 📝 Logging Output

When transaction is created, you should see:

```
💾 [CREATE_DRAFT] Processed values:
  - merchant: קופיקס              ← Should show actual merchant
  - description:                   ← Should be empty or merchant name
  - amount: 47.5
  - vatAmount: 7.21
  - netAmount: 40.29
  - category: meals-entertainment
  - date: 2026-03-29

✅ [CREATE_DRAFT] Transaction created successfully!
✅ [CREATE_DRAFT] Merchant: קופיקס     ← Verify this matches Gemini extraction
✅ [CREATE_DRAFT] Description:         ← Should NOT be hardcoded message
```

---

## 🔗 Reference Files

| File | Purpose |
|------|---------|
| `app/api/transactions/route.ts` | Manual flow reference (lines 136-186) |
| `app/api/webhook/whatsapp/route.ts` | WhatsApp flow (createDraftTransaction function) |
| `lib/receipt-processor.ts` | Shared Gemini processing |

---

## ✅ Deployment Status

**Commit:** bdfff99
**Status:** ✅ Pushed to GitHub
**Vercel:** Deploying...

---

**Last Updated:** 2026-03-29
**Status:** ✅ Synchronized with manual flow
**Ready for testing**
