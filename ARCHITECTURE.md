# 🏗️ My Tax App - Architecture Documentation

**Last Updated:** 2026-02-05
**Purpose:** Lock in our understanding of the project structure to prevent confusion between Old DB (better-sqlite3) and New DB (Prisma).

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
│   │   ├── chat/route.ts            # ✅ [ACTIVE] AI Chat (uses Prisma)
│   │   ├── settings/route.ts        # ✅ [ACTIVE] User Profile (uses Prisma)
│   │   ├── upload/route.ts          # ✅ [ACTIVE] File upload handler
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

## 🔄 4. Critical Type Conversions

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
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

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

### Transaction (No Status Field!)
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
  receiptUrl  String?
  type        String   // INCOME or EXPENSE
  createdAt   DateTime @default(now())
}
```

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
