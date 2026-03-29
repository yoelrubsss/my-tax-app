# 🏗️ My Tax App - Architecture Documentation

**Last Updated:** 2026-03-30
**Purpose:** Complete system architecture including WhatsApp integration, AI receipt processing, and production deployment setup.

---

## 📂 1. Project Structure Tree

```
my-tax-app/
│
├── 📁 app/                          # Next.js App Router (Frontend & API)
│   ├── 📁 api/                      # API Routes (Backend)
│   │   ├── 📁 auth/                 # Authentication endpoints
│   │   │   ├── login/route.ts       # ✅ [ACTIVE] Login endpoint
│   │   │   ├── logout/route.ts      # ✅ [ACTIVE] Logout endpoint
│   │   │   ├── register/route.ts    # ✅ [ACTIVE] Registration endpoint
│   │   │   └── session/route.ts     # ✅ [ACTIVE] Session validation
│   │   │
│   │   ├── 📁 transactions/         # Transaction CRUD
│   │   │   ├── route.ts             # ✅ [ACTIVE] GET/POST/PUT - Migrated to Prisma
│   │   │   └── [id]/
│   │   │       ├── route.ts         # ✅ [ACTIVE] DELETE - Migrated to Prisma
│   │   │       └── attach-doc/route.ts  # ⚠️ [NEEDS REVIEW] Document attachment
│   │   │
│   │   ├── 📁 webhook/              # WhatsApp Integration
│   │   │   └── whatsapp/route.ts    # ✅ [ACTIVE] WhatsApp Business webhook
│   │   │
│   │   ├── chat/route.ts            # ✅ [ACTIVE] AI Chat (uses Prisma)
│   │   ├── settings/route.ts        # ✅ [ACTIVE] User Profile + WhatsApp phone (uses Prisma)
│   │   ├── upload/route.ts          # ✅ [ACTIVE] File upload handler
│   │   ├── scan-receipt/route.ts    # ✅ [ACTIVE] Gemini receipt OCR
│   │   └── uploads/[...path]/route.ts   # ✅ [ACTIVE] File serving ("Hunter" system)
│   │
│   ├── page.tsx                     # ✅ [ACTIVE] Main Dashboard
│   ├── login/page.tsx               # ✅ [ACTIVE] Login page
│   ├── register/page.tsx            # ✅ [ACTIVE] Registration page
│   ├── settings/page.tsx            # ✅ [ACTIVE] Settings page
│   └── layout.tsx                   # ✅ [ACTIVE] Root layout
│
├── 📁 components/                   # React Components
│   ├── AIChat.tsx                   # ✅ [ACTIVE] AI Chat widget
│   ├── DraftsInbox.tsx              # ⚠️ [NEEDS FIX] Draft system (broken)
│   ├── EditTransactionModal.tsx    # ✅ [ACTIVE] Transaction editor
│   ├── FileUpload.tsx               # ✅ [ACTIVE] File upload component
│   ├── TransactionEditor.tsx        # ✅ [ACTIVE] Transaction form
│   ├── TransactionManager.tsx       # ✅ [ACTIVE] Transaction list & form
│   └── VATReport.tsx                # ✅ [ACTIVE] VAT report display
│
├── 📁 lib/                          # Utilities & Database Connections
│   ├── prisma.ts                    # ✅ [ACTIVE] **PRIMARY DB CONNECTION** (Prisma)
│   ├── supabase.ts                  # ✅ [ACTIVE] Supabase Storage client
│   ├── receipt-processor.ts         # ✅ [ACTIVE] **SHARED RECEIPT PIPELINE** (Upload + Gemini)
│   ├── phone-utils.ts               # ✅ [ACTIVE] Israeli phone normalization (972 logic)
│   ├── db-operations.ts             # ❌ [DEPRECATED] Old better-sqlite3 logic
│   ├── db.ts                        # ❌ [DEPRECATED] Old better-sqlite3 connection
│   ├── init-db.ts                   # ❌ [DEPRECATED] Old database initialization
│   ├── db-migration-draft-status.ts # ❌ [DEPRECATED] Old migration script
│   ├── auth-server.ts               # ✅ [ACTIVE] JWT authentication (server-side)
│   ├── ai-knowledge.ts              # ✅ [ACTIVE] AI knowledge base
│   ├── tax-knowledge.ts             # ✅ [ACTIVE] Tax category definitions
│   ├── tax-regulations.ts           # ✅ [ACTIVE] Israeli tax law context
│   └── fiscal-utils.ts              # ✅ [ACTIVE] VAT period calculations
│
├── 📁 prisma/                       # **THE NEW SOURCE OF TRUTH**
│   ├── schema.prisma                # ✅ [ACTIVE] **DATABASE SCHEMA** (Single Source of Truth)
│   └── prisma.config.ts             # ✅ [ACTIVE] Prisma configuration
│
├── 📁 scripts/                      # Maintenance & Migration Tools
│   ├── seed-user.ts                 # ✅ [ACTIVE] Create default users
│   ├── link-whatsapp.ts             # ✅ [ACTIVE] Link WhatsApp phone to user (manual)
│   ├── fix-ownership.ts             # ✅ [ACTIVE] Transfer transactions to correct user
│   ├── fix-status.ts                # ✅ [ACTIVE] Verify transaction integrity
│   ├── debug-data.ts                # ✅ [ACTIVE] **DIAGNOSTIC TOOL** - Dump DB contents
│   ├── clean-db.ts                  # ⚠️ [USE WITH CAUTION] Database cleanup
│   ├── seed-test-data.ts            # ✅ [ACTIVE] Populate test data
│   ├── setup-db.ts                  # ❌ [DEPRECATED] Old database setup
│   ├── create-default-user.ts       # ❌ [DEPRECATED] Use seed-user.ts instead
│   ├── migrate-users.ts             # ❌ [DEPRECATED] Old migration
│   ├── migrate-documents.ts         # ❌ [DEPRECATED] Old migration
│   ├── test-auth.ts                 # ✅ [ACTIVE] Auth testing utility
│   ├── test-fiscal-utils.ts         # ✅ [ACTIVE] Test fiscal calculations
│   ├── test-tax-knowledge.ts        # ✅ [ACTIVE] Test tax categories
│   └── test-upload.ts               # ✅ [ACTIVE] Test file uploads
│
├── 📁 context/                      # React Context (not shown above)
│   └── AuthContext.tsx              # ✅ [ACTIVE] Client-side auth context
│
├── 📁 public/                       # Static files
│   └── uploads/                     # ✅ [ACTIVE] Uploaded receipts/documents
│
├── vat_management.db                # ❌ STALE — do not use (active DB is prisma/vat_management.db)
├── package.json                     # ✅ [ACTIVE] Dependencies & scripts
├── prisma/                          # Prisma migrations (auto-generated)
└── ARCHITECTURE.md                  # 📖 THIS FILE
```

---

## 🧠 2. File Responsibilities & Status

### ✅ **[ACTIVE]** - Primary Files (USE THESE)

#### Database Layer
| File | Purpose | Status |
|------|---------|--------|
| `lib/prisma.ts` | **PRIMARY DATABASE CONNECTION** - Prisma Client singleton | ✅ Required |
| `prisma/schema.prisma` | **DATABASE SCHEMA** - Single source of truth for data models | ✅ Required |

#### API Routes (All Migrated to Prisma)
| File | Purpose | Status |
|------|---------|--------|
| `app/api/transactions/route.ts` | Transaction CRUD (GET/POST/PUT) | ✅ Migrated to Prisma |
| `app/api/transactions/[id]/route.ts` | Transaction DELETE | ✅ Migrated to Prisma |
| `app/api/chat/route.ts` | AI Chat with RAG | ✅ Uses Prisma |
| `app/api/settings/route.ts` | User Profile management | ✅ Uses Prisma |
| `app/api/auth/login/route.ts` | User authentication | ✅ Active |
| `app/api/upload/route.ts` | File upload handler | ✅ Active |
| `app/api/uploads/[...path]/route.ts` | **"Hunter" file system** - Searches 5 directories | ✅ Active |

#### Frontend Pages
| File | Purpose | Status |
|------|---------|--------|
| `app/page.tsx` | Main Dashboard (Income/Expense summary) | ✅ Updated with Prisma logging |
| `app/settings/page.tsx` | User Settings (Profile editor) | ✅ Fixed camelCase/snake_case mapping |
| `app/login/page.tsx` | Login page | ✅ Active |
| `app/register/page.tsx` | Registration page | ✅ Active |

#### Components
| File | Purpose | Status |
|------|---------|--------|
| `components/TransactionManager.tsx` | Transaction list & creation form | ✅ Active |
| `components/TransactionEditor.tsx` | Draft transaction editor modal | ✅ Active (refreshes on save) |
| `components/AIChat.tsx` | AI Chat widget | ✅ Active |
| `components/DraftsInbox.tsx` | Draft transactions inbox | ✅ Active (Fixed: Drafts now supported) |
| `components/FileUpload.tsx` | File upload component | ✅ Active |
| `components/VATReport.tsx` | VAT report display | ✅ Active |

#### Utilities
| File | Purpose | Status |
|------|---------|--------|
| `lib/auth-server.ts` | JWT authentication (server-side) | ✅ Active |
| `lib/supabase.ts` | Supabase Storage client | ✅ Active |
| `lib/receipt-processor.ts` | **SHARED PIPELINE** - Upload to Supabase + Gemini processing | ✅ Active |
| `lib/phone-utils.ts` | Israeli phone normalization (972XXXXXXXXX format) | ✅ Active |
| `lib/fiscal-utils.ts` | VAT period calculations | ✅ Active |
| `lib/tax-knowledge.ts` | Tax category definitions | ✅ Active |
| `lib/tax-regulations.ts` | Israeli tax law context | ✅ Active |
| `lib/ai-knowledge.ts` | AI knowledge base for chat | ✅ Active |

#### Scripts (Maintenance Tools)
| File | Purpose | Status |
|------|---------|--------|
| `scripts/seed-user.ts` | Create default users (ID 1, 2, 3) | ✅ Active |
| `scripts/fix-ownership.ts` | Transfer transactions to correct user | ✅ Active |
| `scripts/fix-status.ts` | Verify transaction integrity | ✅ Active |
| `scripts/debug-data.ts` | **DIAGNOSTIC TOOL** - Dump all DB data | ✅ Active (Use this first!) |

---

### ❌ **[DEPRECATED]** - Old Files (DO NOT USE)

| File | Why Deprecated | Alternative |
|------|----------------|-------------|
| `lib/db-operations.ts` | Old better-sqlite3 logic, reads from WRONG database | Use `lib/prisma.ts` + Prisma queries |
| `lib/db.ts` | Old better-sqlite3 connection | Use `lib/prisma.ts` |
| `lib/init-db.ts` | Old database initialization | Use `npx prisma db push` |
| `lib/db-migration-draft-status.ts` | Old migration script | N/A (Prisma has no status field) |
| `scripts/setup-db.ts` | Old database setup | Use `npx prisma db push` |
| `scripts/create-default-user.ts` | Old user creation | Use `scripts/seed-user.ts` |
| `scripts/migrate-users.ts` | Old migration | Use `scripts/fix-ownership.ts` |
| `scripts/migrate-documents.ts` | Old migration | N/A |

**⚠️ WARNING:** Do NOT import or use any of these files. They interact with the OLD database which is now EMPTY and OUT OF SYNC with Prisma.

---

### ⚠️ **[NEEDS REVIEW]** - Active but Needs Testing

| File | Issue | Priority |
|------|-------|----------|
| `app/api/transactions/[id]/attach-doc/route.ts` | Needs review after Prisma migration | 🟡 Medium |

---

## 🛠️ 3. Data Flow Map

### Current Architecture (Post-Migration)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Browser)                       │
├─────────────────────────────────────────────────────────────────┤
│  Components:                                                     │
│  - TransactionManager    (List & Create)                        │
│  - TransactionEditor     (Edit Draft → Complete)                │
│  - DraftsInbox          (⚠️ BROKEN - Draft creation)            │
│  - AIChat               (AI Assistant)                           │
│  - Settings Page        (User Profile)                           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ HTTP Requests (fetch API)
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API ROUTES (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  ✅ /api/transactions       (GET/POST/PUT)                       │
│  ✅ /api/transactions/[id]  (DELETE)                             │
│  ✅ /api/chat               (AI with RAG)                        │
│  ✅ /api/settings           (Profile CRUD)                       │
│  ✅ /api/upload             (File uploads)                       │
│                                                                  │
│  All routes now use:                                             │
│  import { prisma } from '@/lib/prisma';                          │
│  const userIdStr = String(userId); // ← CRITICAL TYPE CONVERSION│
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Prisma Client Queries
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PRISMA ORM (lib/prisma.ts)                     │
├─────────────────────────────────────────────────────────────────┤
│  - Singleton PrismaClient instance                               │
│  - Auto-generates TypeScript types from schema                   │
│  - Handles query building & execution                            │
│  - Logs all queries in development                               │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ SQL Queries
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SQLite DATABASE                                │
│                   (vat_management.db)                            │
├─────────────────────────────────────────────────────────────────┤
│  Tables (defined in prisma/schema.prisma):                       │
│                                                                  │
│  📊 User                                                         │
│     - id: String (cuid)                                          │
│     - email, name, password                                      │
│                                                                  │
│  📊 UserProfile                                                  │
│     - userId: String (foreign key)                               │
│     - businessName, businessType, isHomeOffice, etc.             │
│                                                                  │
│  📊 Transaction                                                  │
│     - id: String (cuid)                                          │
│     - userId: String (foreign key)                               │
│     - type: String (INCOME/EXPENSE)                              │
│     - amount, vatAmount, netAmount                               │
│     - date, merchant, description, category                      │
│     - receiptUrl                                                 │
│     - ⚠️ NO STATUS FIELD (all transactions are complete)         │
│                                                                  │
│  📊 ChatMessage                                                  │
│     - id: String (cuid)                                          │
│     - userId: String (foreign key)                               │
│     - role: String (user/assistant)                              │
│     - content: String                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Notes

1. **Single Source of Truth:** `prisma/schema.prisma` defines ALL data models
2. **Type Safety:** Prisma auto-generates TypeScript types matching the schema
3. **No Status Field:** Unlike the old database, Prisma has no `DRAFT`/`COMPLETED` status
4. **String User IDs:** Prisma uses `String` (cuid), JWT uses `number` → Must convert!
5. **Field Naming:** Prisma uses `camelCase`, frontend expects `snake_case` → API maps between them

---

## 📲 4. WhatsApp Integration & AI Receipt Processing

### Overview

Complete production-ready WhatsApp integration allowing users to send receipt images or PDFs via WhatsApp and have them automatically processed and added to their account.

### Architecture Components

#### 1. Phone Number Normalization (`lib/phone-utils.ts`)

**Purpose:** Convert any Israeli phone format to WhatsApp API format (972XXXXXXXXX)

**Supported Input Formats:**
```typescript
normalizeIsraeliPhone("052-458-9771")   // → "972524589771"
normalizeIsraeliPhone("0524589771")     // → "972524589771"
normalizeIsraeliPhone("+972524589771")  // → "972524589771"
normalizeIsraeliPhone("52-458-9771")    // → "972524589771"
```

**Logic:**
1. Remove all non-digit characters (+, -, spaces)
2. If starts with '0', remove it and prepend '972'
3. If doesn't start with '972', prepend '972'
4. Validate: Must be 12-13 digits starting with '972'

**Display Formatting:**
```typescript
formatIsraeliPhoneForDisplay("972524589771")  // → "052-458-9771"
```

#### 2. WhatsApp Webhook (`app/api/webhook/whatsapp/route.ts`)

**Endpoint:** `POST /api/webhook/whatsapp`

**Webhook Verification (GET):**
```typescript
// Meta requires returning challenge token as plain text
if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
```

**Message Processing Flow:**

```
1. Receive webhook from WhatsApp
   ↓
2. Validate message type (image or document)
   ↓
3. Extract media ID and MIME type
   - Images: type === "image", mime_type: image/jpeg|png|webp
   - PDFs: type === "document", mime_type: application/pdf
   ↓
4. Look up user by whatsappPhone (normalized format)
   ↓
5. Download media from WhatsApp API
   ↓
6. Process receipt (shared pipeline)
   ↓
7. Create draft transaction
```

**Supported Formats:**
- ✅ **Images:** JPEG, PNG, WebP (sent as "photo")
- ✅ **PDFs:** application/pdf (sent as "document")
- ❌ **Rejected:** .docx, .xlsx, .txt, other formats

**User Lookup:**
```typescript
const user = await prisma.user.findFirst({
  where: { whatsappPhone: message.from },  // message.from is already normalized (972XXXXXXXXX)
});
```

#### 3. Shared Receipt Processing Pipeline (`lib/receipt-processor.ts`)

**Purpose:** Unified service used by both WhatsApp and manual web uploads

**Pipeline Steps:**

```
┌─────────────────────────────────────────┐
│ 1. Upload to Supabase Storage           │
│    - Bucket: "receipts"                 │
│    - Path: userId/timestamp-filename    │
│    - Returns: Public URL                │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 2. Process with Gemini 2.5 Flash        │
│    - Native PDF support                 │
│    - OCR for images & scanned PDFs      │
│    - Extracts: merchant, date, amount   │
│    - VAT calculation (18%)              │
│    - Category suggestion (21 categories)│
│    - Currency detection (ILS/USD/EUR/GBP)│
│    - Timeout: 45 seconds                │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 3. Return Structured Result             │
│    {                                    │
│      receiptUrl: string,                │
│      scanResult: {                      │
│        merchant: string | null,         │
│        date: string | null,             │
│        totalAmount: number | null,      │
│        vatAmount: number | null,        │
│        category: string | null          │
│      }                                  │
│    }                                    │
└─────────────────────────────────────────┘
```

**Functions:**
- `uploadReceiptToStorage()` - Uploads to Supabase
- `processReceiptWithGemini()` - AI extraction
- `processReceipt()` - Complete pipeline

**Gemini Prompt Highlights:**
```typescript
const prompt = `You are a strict Israeli VAT receipt scanner for an Authorized Dealer (עוסק מורשה).

You will receive either an image (JPEG, PNG, WebP) or a PDF document containing a receipt. Extract the data accurately.

CRITICAL ACCURACY RULES — READ BEFORE ANALYZING:
- NEVER guess, invent, or hallucinate any data
- For PDFs: Extract text from all pages, focus on first page for receipt data
- Detect currency: ₪ or ILS = "ILS", $ or USD = "USD", € = "EUR", £ = "GBP"
- VAT rate: 18% Israeli standard

Return ONLY a valid JSON object — no markdown, no explanation, just raw JSON:
{
  "merchant": "business name exactly as printed",
  "date": "YYYY-MM-DD format",
  "totalAmount": total including VAT as number,
  "vatAmount": VAT amount or calculate as totalAmount * 0.18 / 1.18,
  "detectedCurrency": "ILS" | "USD" | "EUR" | "GBP" | null,
  "suggestedCategory": one of 21 categories,
  "confidence": "high" | "medium" | "low"
}
```

**Category IDs (21 total):**
```typescript
const CATEGORY_IDS = [
  "office-equipment", "software", "software-foreign", "software-local",
  "professional-services", "vehicle-fuel", "vehicle-maintenance",
  "vehicle-insurance", "communication", "meals-entertainment", "travel",
  "home-office", "rent", "utilities", "education", "marketing",
  "legal-accounting", "insurance", "health-safety", "gifts", "other"
];
```

#### 4. Transaction Creation (Synced with Manual Flow)

**WhatsApp creates identical transactions to manual uploads:**

```typescript
// Match manual flow structure (transactions/route.ts lines 136-186)
const finalAmount = scanResult?.totalAmount || 0;
const finalMerchant = scanResult?.merchant || 'Draft Transaction';
const finalDescription = scanResult?.merchant || '';  // Empty or merchant name
const finalCategory = scanResult?.category || 'other';
const finalDate = scanResult?.date ? new Date(scanResult.date) : new Date();

// Calculate VAT amounts (same logic as manual)
const vatRate = 0.18;
const vatAmount = scanResult?.vatAmount
  ? scanResult.vatAmount
  : finalAmount > 0 ? finalAmount * vatRate / (1 + vatRate) : 0;
const netAmount = finalAmount > 0 ? finalAmount - vatAmount : 0;
const recognizedVatAmount = 0;  // Default to 0, category rules applied later

// Create transaction with exact same structure
const transaction = await prisma.transaction.create({
  data: {
    userId,
    type: "EXPENSE",
    date: finalDate,
    merchant: finalMerchant,
    description: finalDescription,  // NOT hardcoded Hebrew message
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
});
```

**Key Synchronization Points:**
- ✅ Same field order and structure
- ✅ Same VAT calculation formula
- ✅ Same decimal precision (2 places with parseFloat + toFixed)
- ✅ Same defaults for missing data
- ✅ description uses merchant name (not hardcoded Hebrew text)

#### 5. Settings Page Integration (`app/settings/page.tsx`)

**WhatsApp Phone Input Section:**

```tsx
<div className="bg-white rounded-lg shadow-md p-6">
  <div className="flex items-start gap-3 mb-4">
    <Phone className="w-5 h-5 text-green-600" />
    <div className="flex-1">
      <label>מספר טלפון לחיבור וואטסאפ</label>
      <p className="text-xs text-gray-500">
        הזן את המספר שממנו תשלח קבלות (לדוגמה: 052-1234567)
      </p>
      <input
        type="tel"
        value={form.whatsappPhone}
        onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })}
        placeholder="052-1234567"
        dir="ltr"
      />
    </div>
  </div>

  {/* Instructions with Click-to-Chat and QR Code */}
  {form.whatsappPhone && (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="grid md:grid-cols-[1fr_auto] gap-4">
        {/* Instructions */}
        <div>
          <ol>
            <li>
              לחץ על המספר או סרוק את הקוד:{" "}
              <a href="https://wa.me/15551426760" target="_blank">
                <Phone /> +1 (555) 142-6760
              </a>
            </li>
            <li>שלח הודעת WhatsApp עם תמונה של הקבלה</li>
            <li>הקבלה תעובד אוטומטית ותופיע בתיבת הטיוטות תוך שניות!</li>
          </ol>

          {/* Mobile: Quick Connect Button */}
          <a href="https://wa.me/15551426760" className="md:hidden">
            <MessageCircle /> פתח WhatsApp
          </a>
        </div>

        {/* Desktop: QR Code */}
        <div className="hidden md:flex">
          <QRCodeSVG
            value="https://wa.me/15551426760"
            size={120}
            level="M"
            includeMargin={true}
          />
          <span>סרוק עם המצלמה</span>
        </div>
      </div>
    </div>
  )}
</div>
```

**Features:**
- ✅ Click-to-chat link (mobile & desktop)
- ✅ QR code for desktop users (scan with phone camera)
- ✅ Real-time display of formatted phone
- ✅ Green WhatsApp branding
- ✅ Responsive layout (QR hidden on mobile)

**WhatsApp Bot Number:** +1 (555) 142-6760 (https://wa.me/15551426760)

#### 6. Settings API Update (`app/api/settings/route.ts`)

**GET Endpoint:**
```typescript
// Fetch whatsappPhone from User table
const user = await prisma.user.findUnique({
  where: { id: userIdStr },
  select: { whatsappPhone: true },
});

// Format for display
const formattedPhone = user?.whatsappPhone
  ? formatIsraeliPhoneForDisplay(user.whatsappPhone)
  : null;

return NextResponse.json({
  success: true,
  data: {
    ...profile,
    whatsapp_phone: formattedPhone,  // 972524589771 → "052-458-9771"
  },
});
```

**PUT Endpoint:**
```typescript
const { whatsapp_phone } = body;

// Normalize and validate
let normalizedPhone: string | null = null;
if (whatsapp_phone !== undefined) {
  if (whatsapp_phone === "" || whatsapp_phone === null) {
    normalizedPhone = null;  // Allow clearing
  } else {
    normalizedPhone = normalizeIsraeliPhone(whatsapp_phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number format" },
        { status: 400 }
      );
    }
  }
}

// Update User table
await prisma.user.update({
  where: { id: userIdStr },
  data: { whatsappPhone: normalizedPhone },
});
```

### Complete User Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. User Links Phone Number                                   │
│    - Goes to Settings page                                   │
│    - Enters phone: "052-1234567"                             │
│    - System normalizes: "972524589771"                       │
│    - Saves to User.whatsappPhone                             │
│    - Display shows: "052-458-9771"                           │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. User Sends Receipt via WhatsApp                           │
│    - Opens WhatsApp, navigates to bot: +1 (555) 142-6760    │
│    - Attaches receipt (image or PDF)                         │
│    - Sends message                                           │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Webhook Receives Message                                  │
│    - POST /api/webhook/whatsapp                              │
│    - message.from = "972524589771" (WhatsApp normalized)     │
│    - message.type = "image" or "document"                    │
│    - message.image.id or message.document.id                 │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. User Lookup                                               │
│    - Query: User.whatsappPhone = "972524589771"              │
│    - Found: yoelrubs@gmail.com                               │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Download Media                                            │
│    - GET /v18.0/{mediaId} (get URL)                          │
│    - GET {mediaUrl} (download file)                          │
│    - Result: Buffer (45KB - 2MB typical)                     │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. Shared Receipt Processing Pipeline                        │
│    - Upload to Supabase: receipts/userId/timestamp.jpg       │
│    - Process with Gemini 2.5 Flash:                          │
│      • merchant: "קופיקס"                                    │
│      • date: "2026-03-29"                                    │
│      • totalAmount: 47.5                                     │
│      • vatAmount: 7.21                                       │
│      • category: "meals-entertainment"                       │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. Create Draft Transaction                                  │
│    - userId: cmmo4hksg0000x93gjg074fa0                       │
│    - merchant: "קופיקס" (from Gemini)                        │
│    - description: "קופיקס" (same as merchant)                │
│    - amount: 47.5                                            │
│    - vatAmount: 7.21                                         │
│    - netAmount: 40.29 (calculated)                           │
│    - date: 2026-03-29                                        │
│    - category: "meals-entertainment"                         │
│    - receiptUrl: https://supabase.co/.../receipt.jpg         │
│    - status: "DRAFT"                                         │
│    - isRecognized: true                                      │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 8. User Sees Draft in DraftsInbox                            │
│    - Merchant: קופיקס                                        │
│    - Amount: ₪47.50                                          │
│    - Date: 29/03/2026                                        │
│    - Can edit or complete transaction                        │
│    - Receipt image/PDF viewable                              │
└──────────────────────────────────────────────────────────────┘

Total time: ~5-10 seconds from send to inbox
```

### Environment Variables

```env
# WhatsApp Business Cloud API
WHATSAPP_TOKEN=EAAVJsKDkz8kBR...  # Access token from Meta
WHATSAPP_VERIFY_TOKEN=yoel_tax_app_2026  # Webhook verification
WHATSAPP_PHONE_NUMBER_ID=996334873570957  # Phone number ID

# Supabase Storage
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key
```

### Logging & Debugging

**Log Prefixes:**
- `📲` - WhatsApp webhook events
- `📱` - Message processing
- `📄` - PDF documents
- `📷` - Image messages
- `📥` - Media downloads
- `📤 [UPLOAD]` - Supabase Storage uploads
- `🤖 [GEMINI]` - AI processing
- `📄 [PROCESS]` - Overall pipeline
- `💾 [CREATE_DRAFT]` - Transaction creation

**Example Success Log:**
```
📲 WhatsApp webhook received
📱 Processing message from 972524589771, type: image
📷 Image message detected: image/jpeg
✅ Found user: yoelrubs@gmail.com (cmmo4hksg0000x93gjg074fa0)
📥 Downloading media ID: 1234567890
📥 Downloaded image: 125847 bytes
📄 [PROCESS] Starting receipt processing
📤 [UPLOAD] Receipt uploaded successfully: https://supabase.co/...
🤖 [GEMINI] Starting Gemini processing
✅ [GEMINI] Extracted and validated scan result: {merchant: "קופיקס", amount: 47.5, ...}
💾 [CREATE_DRAFT] Transaction created successfully!
```

### Documentation Files

- **WHATSAPP_PRODUCTION_READY.md** - Complete production guide
- **WHATSAPP_PDF_SUPPORT.md** - PDF-specific documentation
- **WHATSAPP_MANUAL_FLOW_SYNC.md** - Flow synchronization details
- **GEMINI_DEBUG_GUIDE.md** - Debugging and troubleshooting

---

## 🔄 5. Critical Type Conversions

### User ID Conversion (CRITICAL!)

```typescript
// ❌ WRONG - Type mismatch error
const userId = await requireAuth(); // Returns: number (from JWT)
await prisma.user.findUnique({ where: { id: userId } }); // Expects: string

// ✅ CORRECT - Convert to string
const userId = await requireAuth();
const userIdStr = String(userId);
await prisma.user.findUnique({ where: { id: userIdStr } });
```

### Field Name Mapping (API → Frontend)

```typescript
// Prisma returns camelCase
const transaction = await prisma.transaction.findUnique({ where: { id } });
// transaction.userId, transaction.vatAmount, transaction.receiptUrl

// Frontend expects snake_case
const mapped = {
  id: transaction.id,
  user_id: transaction.userId,      // ← Map userId → user_id
  vat_amount: transaction.vatAmount, // ← Map vatAmount → vat_amount
  document_path: transaction.receiptUrl, // ← Map receiptUrl → document_path
  type: transaction.type.toLowerCase(), // ← INCOME → income
};
```

---

## 📜 5. Scripts Index

### Production Scripts (Run These)

| Script | Command | Purpose | When to Use |
|--------|---------|---------|-------------|
| **Seed Users** | `npm run seed-user` | Creates users with IDs 1, 2, 3 | After fresh DB setup |
| **Fix Ownership** | `npm run fix-ownership` | Transfers all transactions to user "2", updates dates 2024→2026 | After discovering wrong userId or dates |
| **Verify Status** | `npm run fix-status` | Verifies all transactions are accessible | After migration or suspecting data issues |
| **Debug Database** | `npm run debug-data` | **USE THIS FIRST!** Dumps all DB contents with analysis | When dashboard shows ₪0.00 or AI says "no data" |

### Database Management

| Script | Command | Purpose | When to Use |
|--------|---------|---------|-------------|
| **Push Schema** | `npx prisma db push` | Applies schema.prisma changes to database | After editing schema.prisma |
| **Generate Client** | `npx prisma generate` | Regenerates Prisma Client types | After editing schema.prisma |
| **Studio** | `npx prisma studio` | Opens GUI database browser | For manual data inspection |

### Development Scripts

| Script | Command | Purpose | When to Use |
|--------|---------|---------|-------------|
| **Dev Server** | `npm run dev` | Start Next.js dev server | Normal development |
| **Build** | `npm run build` | Build for production | Before deployment |
| **Test Auth** | `npm run test-auth` | Test authentication flow | Debug login issues |
| **Test Uploads** | `npm run test-upload` | Test file upload system | Debug receipt uploads |

---

## 🚨 6. Common Issues & Solutions

### Issue 1: Dashboard Shows ₪0.00

**Symptoms:**
- Dashboard displays zero for all totals
- Transaction list is empty
- AI chat says "I don't have access to transactions"

**Diagnosis:**
```bash
npm run debug-data
```

**Solutions:**
1. If "NO TRANSACTIONS FOUND" → Upload receipts or create transactions
2. If transactions belong to wrong user → `npm run fix-ownership`
3. If transactions dated 2024 → `npm run fix-ownership` (updates to 2026)

---

### Issue 2: "Foreign Key Constraint Violated"

**Symptoms:**
- Settings page fails to save
- Error: `P2003 Foreign key constraint violated`

**Cause:** UserProfile references a User.id that doesn't exist

**Solution:**
```bash
npm run seed-user
```

---

### Issue 3: Type Mismatch Errors

**Symptoms:**
- Error: `Invalid value provided. Expected String, provided Int`
- API returns 500 errors

**Cause:** Forgot to convert userId from number to string

**Solution:** Add this at the start of API routes:
```typescript
const userIdStr = String(userId);
```

---

### Issue 4: How Drafts Work (Fixed)

**Status:** ✅ Fixed

**How it works now:**
- Prisma schema has NO `status` field
- Instead, we use **heuristics** to identify drafts:
  - `amount === 0` → Draft
  - `merchant === 'Draft Transaction'` → Draft
  - Otherwise → Completed

**Quick Draft Flow:**
1. User uploads receipt → Creates transaction with defaults:
   - `amount: 0`
   - `type: 'EXPENSE'`
   - `merchant: 'Draft Transaction'`
   - `receiptUrl: (uploaded file path)`
2. Transaction appears in DraftsInbox
3. User fills in details → Updates transaction with real values
4. Transaction automatically becomes "completed" (amount > 0)

---

## 📊 7. Database Schema Summary

### User
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  password      String
  dealerNumber  String?   // Israeli tax ID (9 digits)
  whatsappPhone String?   // WhatsApp phone number (format: 972XXXXXXXXX)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  profile        UserProfile?
  transactions   Transaction[]
  chatMessages   ChatMessage[]
  passwordResets PasswordReset[]

  @@index([whatsappPhone], name: "idx_whatsapp_phone")
}
```

**New Field: whatsappPhone**
- **Format:** `972XXXXXXXXX` (normalized Israeli phone)
- **Purpose:** Links user to WhatsApp account for receipt processing
- **Normalization:** Applied via `normalizeIsraeliPhone()` before saving
- **Display:** Formatted as `052-458-9771` in UI
- **Lookup:** Webhook queries by `whatsappPhone = message.from`
- **Index:** `idx_whatsapp_phone` for fast webhook lookups

### UserProfile
```prisma
model UserProfile {
  id              String   @id @default(cuid())
  userId          String   @unique
  businessName    String?
  businessType    String?  // OSEK_PATUR, OSEK_MURSHE, LTD
  isHomeOffice    Boolean  @default(false)
  hasChildren     Boolean  @default(false)
  childrenCount   Int      @default(0)
  hasVehicle      Boolean  @default(false)
}
```

### Transaction
```prisma
model Transaction {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime @default(now())
  merchant    String
  description String?
  amount      Float
  vatRate     Float    @default(0.18)   // ✅ 18% — mandatory Israeli VAT rate
  vatAmount   Float
  netAmount   Float
  recognizedVatAmount Float @default(0) // ACTUAL claimable VAT after category rules
  category    String
  isRecognized Boolean @default(true)
  receiptUrl  String?
  type        String   // INCOME or EXPENSE
  status      String   @default("COMPLETED") // 'DRAFT' or 'COMPLETED'
  createdAt   DateTime @default(now())

  // Performance indexes
  @@index([userId, date, status], name: "idx_user_date_status")
  @@index([userId, status], name: "idx_user_status")
  @@index([userId, date], name: "idx_user_date")
}
```

**Status Field:**
- **Values:** `"DRAFT"` or `"COMPLETED"`
- **Draft Detection:** Transactions with `status = "DRAFT"` appear in DraftsInbox
- **WhatsApp Flow:** Creates transactions with `status: "DRAFT"`, allows user to edit/complete
- **Manual Flow:** Same - creates drafts, user completes them

**receiptUrl Field:**
- **Supabase Storage:** Points to uploaded image/PDF
- **Format:** `https://xxxxx.supabase.co/storage/v1/object/public/receipts/userId/timestamp-filename.jpg`
- **Supports:** JPEG, PNG, WebP, PDF

**Key Differences from Old Schema:**
- ❌ NO `status` field (DRAFT/COMPLETED)
- ❌ NO `is_vat_deductible` field
- ✅ Uses `receiptUrl` instead of `document_path`
- ✅ **Draft Detection:** Drafts identified by heuristics:
  - `amount === 0` OR
  - `merchant === 'Draft Transaction'`
  - API automatically marks these as `status: 'DRAFT'` in response

---

## 🎯 8. Next Steps & Known Issues

### ✅ Completed
- [x] Migrated API to Prisma
- [x] Fixed dashboard zero-data issue
- [x] Fixed Settings page camelCase/snake_case mapping
- [x] Fixed AI chat transaction visibility
- [x] Fixed month navigation
- [x] Added comprehensive logging
- [x] Fixed Draft creation system (relaxed validation, supports incomplete transactions)

### ⚠️ In Progress
- [ ] Review attach-doc endpoint after migration
- [ ] Test draft workflow end-to-end

### 🔮 Future Enhancements
- [ ] Add status field to Prisma schema if draft system is needed
- [ ] Migrate remaining old scripts to Prisma
- [ ] Remove deprecated files (lib/db-operations.ts, lib/db.ts, etc.)
- [ ] Add automated tests
- [ ] Add database backup system

---

## 📚 9. Quick Reference

### Where to Find Things

| Need to... | Look Here |
|-----------|-----------|
| Understand data model | `prisma/schema.prisma` |
| Check DB connection | `lib/prisma.ts` |
| Debug data issues | Run `npm run debug-data` |
| View API logs | Browser console + terminal |
| Add new table | Edit `prisma/schema.prisma`, then `npx prisma db push` |
| Fix user issues | `scripts/seed-user.ts` |
| Fix transaction issues | `scripts/fix-ownership.ts` |

### Emergency Commands

```bash
# See what's in the database
npm run debug-data

# Fix user/profile missing
npm run seed-user

# Fix wrong userId or dates
npm run fix-ownership

# Open database GUI
npx prisma studio

# Rebuild everything
npm run build
```

---

## ⚖️ 10. Israeli Tax Rules — Source of Truth (Tax Year 2026)

> These rules are mandatory. Never deviate from them.

### VAT Rate
```
VAT_RATE = 0.18  // 18% — DO NOT USE 0.17
```

### VAT Calculation Formula
```
vatAmount = totalAmount × 0.18 / 1.18   // Extract VAT from gross amount
netAmount = totalAmount - vatAmount
recognizedVatAmount = vatAmount × category.vatPercentage  // Claimable portion
```

### Category Recognition Rules

| Category ID | Label | VAT Recognition | Income Tax |
|---|---|---|---|
| `software` | תוכנות ומנויים דיגיטליים | **100% (1.0)** | 100% |
| `professional-services` | שירותים מקצועיים (רו"ח, עו"ד) | **100% (1.0)** | 100% |
| `office-equipment` | ציוד משרדי | 100% | 100% |
| `business-meals` | אירוח עסקי | 100% | 100% |
| `marketing` | שיווק ופרסום | 100% | 100% |
| `rent` | שכר דירה משרדי | 100% | 100% |
| `travel` | נסיעות עסקיות | 100% | 100% |
| `education` | השתלמויות | 100% | 100% |
| `utilities` | חשמל ומים | 100% | 100% |
| `vehicle-fuel` | רכב ודלק | **66.67% (0.6667)** | 45% |
| `communication` | תקשורת וטלפון (בזק) | **66.67% (0.6667)** | 100% |
| `gifts` | מתנות עסקיות | **0%** | up to ₪210/person/yr |
| `insurance` | ביטוח עסקי | **0%** | 100% |

> **Digital services rule:** Cardcom, Replit, Claude, SaaS → `software` → 100% VAT recognition.

### Active Database
- `.env`: `DATABASE_URL="file:./vat_management.db"` (resolves relative to `prisma/schema.prisma`)
- **Active DB:** `prisma/vat_management.db` ✅
- **Stale DB:** `vat_management.db` (root) ❌ — deleted on 2026-03-12

---

## 📝 11. Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-05 | Initial architecture documentation | Claude |
| 2026-02-05 | Migrated transactions API to Prisma | Claude |
| 2026-02-05 | Fixed dashboard zero-data issue | Claude |
| 2026-02-05 | Added comprehensive logging | Claude |
| 2026-03-12 | Fixed PUT vatRate bug (0.17 → 0.18) | Claude |
| 2026-03-12 | Fixed vatPercentage precision (0.6666 → 0.6667) | Claude |
| 2026-03-12 | Added Tax Rules section; deleted stale root DB | Claude |

---

**For questions or issues, check:**
1. This ARCHITECTURE.md file first
2. Run `npm run debug-data` to diagnose
3. Check browser console and terminal logs

**Remember:** `prisma/schema.prisma` is the SINGLE SOURCE OF TRUTH. All other database logic should be considered deprecated.

---

## 🚀 12. Next Steps / Roadmap

### Session Goals for Next Development Cycle

#### 1. **Accounting & Tax QA** (CRITICAL)

**Objective:** Verify all financial calculations perfectly align with Israeli Tax Laws

**Tasks:**
- [ ] **VAT Rate Verification**
  - Confirm all calculations use 18% (0.18) - no 17% anywhere
  - Check recognized VAT percentages match tax-knowledge.ts:
    - software: 100% (1.0)
    - vehicle-fuel: 66.67% (0.6667)
    - communication: 66.67% (0.6667)
    - gifts: 0%
    - insurance: 0%

- [ ] **Rounding & Precision**
  - Verify all monetary values use 2 decimal places
  - Check: `parseFloat(value.toFixed(2))`
  - Test edge cases: ₪0.01, ₪999999.99

- [ ] **VAT Calculation Formula**
  - Verify: `vatAmount = totalAmount × 0.18 / 1.18`
  - Verify: `netAmount = totalAmount - vatAmount`
  - Verify: `recognizedVatAmount = vatAmount × category.vatPercentage`

- [ ] **Category Rules Audit**
  - Review all 21 categories in tax-knowledge.ts
  - Confirm VAT recognition percentages
  - Confirm income tax deductibility percentages
  - Cross-reference with Israeli Tax Authority guidelines 2026

- [ ] **Dashboard Math Verification**
  - Test income totals calculation
  - Test expense totals calculation
  - Test recognized VAT calculation
  - Test net profit calculation
  - Verify all aggregations in app/page.tsx

- [ ] **Export Accuracy**
  - Verify bi-monthly reports (two-month periods)
  - Check Excel formulas
  - Verify totals match dashboard
  - Test date range filtering

**Success Criteria:**
- All calculations match Israeli Tax Authority formulas
- No rounding errors or precision issues
- Dashboard totals reconcile with individual transactions
- Export totals match dashboard exactly

---

#### 2. **Beta Launch Preparation**

**Objective:** Prepare system to onboard first real alpha/beta users with bulletproof multi-tenancy

**Tasks:**
- [ ] **Multi-Tenancy Audit**
  - Verify all database queries filter by userId
  - Check Transaction queries have userId filters
  - Check ChatMessage queries have userId filters
  - Verify WhatsApp webhook user isolation
  - Test cross-user data leakage scenarios

- [ ] **Data Isolation Testing**
  - Create multiple test users
  - Upload receipts for each user
  - Verify User A cannot see User B's data
  - Test WhatsApp phone conflicts (same phone → different users)
  - Test concurrent user operations

- [ ] **Authentication & Security**
  - Review JWT token expiration (currently set correctly?)
  - Test session timeout behavior
  - Verify password reset flow (already implemented)
  - Check API rate limiting (if needed)
  - Review environment variables (no secrets in code)

- [ ] **User Onboarding Flow**
  - Review registration process
  - Test email verification (if implemented)
  - Create onboarding checklist:
    1. Register account
    2. Link WhatsApp phone
    3. Upload first receipt (manual or WhatsApp)
    4. Complete draft transaction
    5. View dashboard with data

- [ ] **Error Handling & Recovery**
  - Test Gemini timeout scenarios
  - Test WhatsApp webhook failures
  - Test Supabase storage errors
  - Verify graceful degradation (receipt saves even if Gemini fails)
  - Add user-friendly error messages

- [ ] **Production Checklist**
  - [ ] Environment variables documented
  - [ ] Database backups configured
  - [ ] Error monitoring (Sentry/LogRocket?)
  - [ ] Performance monitoring (Vercel Analytics?)
  - [ ] User support email/channel ready
  - [ ] Privacy policy & terms of service
  - [ ] GDPR/data privacy compliance (if EU users)

- [ ] **Invite System (Optional)**
  - Implement invite codes for closed beta
  - Track which users invited whom
  - Limit registrations to invited users only

- [ ] **User Feedback Loop**
  - In-app feedback button
  - Bug report form
  - Feature request tracking
  - User analytics (privacy-respecting)

**Success Criteria:**
- Can confidently onboard 10 real users simultaneously
- Zero cross-user data leakage
- All error scenarios handled gracefully
- Users can self-serve from registration to first transaction
- Clear path for users to report issues and get help

---

#### 3. **Performance & Scalability** (Optional, if time permits)

- [ ] Database query optimization (check indexes)
- [ ] Supabase storage quota monitoring
- [ ] Gemini API usage monitoring
- [ ] WhatsApp webhook response time (<5s)
- [ ] Dashboard load time optimization

---

### Current Production Status

**What's Working:**
- ✅ Complete authentication system (login, register, password reset)
- ✅ Manual receipt upload with Gemini extraction
- ✅ WhatsApp integration (images + PDFs)
- ✅ Phone normalization (972 logic)
- ✅ Settings UI with click-to-chat & QR code
- ✅ Draft/Complete transaction workflow
- ✅ AI Chat with RAG (tax knowledge base)
- ✅ Dashboard with income/expense summaries
- ✅ VAT reporting and calculations
- ✅ Export to Excel (bi-monthly reports)
- ✅ Multi-user support (Prisma with userId isolation)

**What Needs Verification:**
- ⚠️ Tax law compliance (formulas, percentages, rounding)
- ⚠️ Multi-tenancy testing (cross-user isolation)
- ⚠️ Production error handling
- ⚠️ User onboarding experience

**Deployment:**
- **Platform:** Vercel
- **Database:** Supabase (PostgreSQL via Prisma)
- **Storage:** Supabase Storage (receipts bucket)
- **AI:** Google Gemini 2.5 Flash
- **WhatsApp:** Meta Business Cloud API

---

**Prepared for next session on:** 2026-03-30
**Ready to:** Verify tax compliance and prepare for beta launch

# Test Sync: 03/30/2026 - WhatsApp Integration Complete
