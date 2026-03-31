# 🏗️ My Tax App - Architecture Documentation

**Last Updated:** 2026-03-31  
**Purpose:** Complete system architecture including WhatsApp integration, AI receipt processing, and production deployment setup.

---

## 0. Canonical snapshot — handoff for AI (read first in a new session)

> This section is the **source of truth** for how the app behaves **today** in the repo. It is written so a new session can rely on it without guessing from stale comments elsewhere.

### A. VAT statutory rate (18% — tax year 2026)

| Layer | Where | What |
|--------|--------|------|
| **Database / API** | `Transaction.vatRate`, `app/api/transactions/route.ts`, `app/api/webhook/whatsapp/route.ts` | Default **`vatRate = 0.18`**. Gross → VAT: `amount * 0.18 / 1.18` (same pattern across routes). |
| **UI calculators** | `components/TransactionManager.tsx`, `TransactionEditor.tsx`, `EditTransactionModal.tsx` | Display and inline math use **18%** (e.g. `total * 0.18 / 1.18`). |
| **Receipt / Gemini prompts** | `lib/receipt-processor.ts`, `app/api/scan-receipt/route.ts` | Prompt text tells the model **18%** Israeli VAT for ILS. |
| **Export** | `app/api/export/route.ts` | Column labels reference **18%** where applicable. |
| **Chat AI (advisory only)** | `lib/ai-knowledge.ts` | Exports **`VAT_RATE = 0.18`**. The string **`AI_KNOWLEDGE_BASE`** embeds `${VAT_RATE}`, states **18% for 2026**, and instructs the model **not** to use **17%** for current-year calculations unless the user asks about another year. Includes gross→VAT formulas **18/118** and **100/118**. |
| **Chat route** | `app/api/chat/route.ts` | **Does not** inject an extra VAT number. `system` = `AI_KNOWLEDGE_BASE` + `formattedContext` only—no duplicate rate that could contradict §A. |

**Single consolidated chat rules file:** **`lib/ai-knowledge.ts`** only. There is **no** `lib/tax-regulations.ts` (removed; do not reintroduce without updating imports and this doc).

**Separate deterministic categories:** **`lib/tax-knowledge.ts`** holds per-category `vatPercentage`, labels, and receipt logic for **transactions and OCR**. It is **not** duplicated inside `AI_KNOWLEDGE_BASE` (different purpose: code-enforced vs. LLM advisory).

### B. AI chat pipeline (exact stack)

1. **Packages:** `ai` (Vercel AI SDK), `@ai-sdk/google`, `@ai-sdk/react`, `next-themes`, `framer-motion`.
2. **Server:** `app/api/chat/route.ts` — `requireAuth()` → load user context (Prisma: profile, last 20 transactions, last 10 messages) → `formatUserContext()` → `streamText({ model: google('gemini-2.5-flash'), system, messages: await convertToModelMessages(messages), temperature: 0.2, onFinish: save assistant })` → **`result.toUIMessageStreamResponse()`** (UI message stream/SSE for the client).
3. **Client:** `components/AIChat.tsx` — **`useChat`** from `@ai-sdk/react` with **`DefaultChatTransport`** (`api: '/api/chat'`, **`credentials: 'include'`** for cookie session). FAQ matches use **`FAQ_QUICK_ANSWERS`** and **`setMessages`** without calling the API.
4. **Display hygiene:** Assistant message text is passed through **`stripBoldAsterisks`** (`content.replaceAll('**', '')`) so stray Markdown bold does not render as asterisks.
5. **UX:** Structured rows (not speech bubbles), shimmer + “חושב…” while `status === 'submitted'`, floating input bar, stop button while streaming; **`animate-chat-shimmer`** in `app/globals.css`.

### C. Theme (dark mode)

- **`tailwind.config.ts`:** `darkMode: 'class'`.
- **`app/globals.css`:** `:root` / `.dark` CSS variables for background/foreground.
- **`app/layout.tsx`:** **`ThemeProvider`** (`components/theme-provider.tsx`, next-themes) wraps **`AuthProvider`**; `<html suppressHydrationWarning>`.
- **`components/ThemeToggle.tsx`:** Used on the main dashboard (`HomeContent`) and settings header.

### D. Transactions & drafts (schema reality)

- **`Transaction.status`** in **`prisma/schema.prisma`:** **`DRAFT` | `COMPLETED`** (default `COMPLETED`). Indexed with `userId`, `date`. The dashboard/API use this for drafts vs. completed reporting.
- **Drafts inbox / bulk upload** are **active** paths—not “broken” in the current design; treat older “BROKEN” comments in this file as obsolete where they conflict with the schema above.

### E. Other API surfaces (quick map)

| Area | Path / files |
|------|----------------|
| Admin | `app/admin/page.tsx`, `components/AdminUsersTable.tsx`, `app/api/admin/users/route.ts`, `app/api/admin/users/[id]/route.ts`, `lib/admin.ts` — **`is_admin` is not a DB column**; `isAdminUser` / `assertIsAdmin` use **`ADMIN_EMAIL`** (case-insensitive match) and/or comma-separated **`ADMIN_USER_IDS`** in env; session/login responses expose `is_admin` for UI. |
| Feedback | `app/api/feedback/route.ts`, `components/ReportIssueFAB.tsx` |
| Export | `app/api/export/route.ts` |
| Auth extras | `app/forgot-password`, `app/reset-password` pages + matching `app/api/auth/*` |

### F. `ruflo/` directory

Bundled **external / tooling** tree (not part of the Next app runtime). Unless a task explicitly concerns it, **scope changes to `app/`, `components/`, `lib/` (root), `prisma/`** for this product.

### G. Documentation siblings

- **`README.md`** — points here for architecture and AI knowledge layout.
- **`PHASE5_IMPLEMENTATION.md`**, **`TAX_KNOWLEDGE_BASE.md`** — historical / category focus; if they disagree with **§0** or **`prisma/schema.prisma`**, prefer **§0** + schema.

### H. Main dashboard loading (`app/HomeContent.tsx`)

- **Single list fetch:** `GET /api/transactions` with optional `startDate` / `endDate` derived from the `month` search param (bi-monthly VAT period via `getVatPeriodDateBoundsFromMonthParam` in `lib/fiscal-utils.ts`).
- **Stats:** Computed only from rows where **`status === 'COMPLETED'`** and **`amount > 0`** (income/expense totals, recognized VAT, etc.). **`DRAFT`** rows in the same response are kept for **`DraftsInbox`** / editing, not for period totals.
- **Meta:** Uses `meta.summary` (count + `latestCreatedAt`) as a fingerprint; `meta.hasAnyTransaction` drives onboarding empty-state.
- **Silent poll:** Every **10s** while the tab is visible, refetches without forcing the main loading spinner (picks up WhatsApp-created drafts).
- **UI shell:** `ThemeToggle`, `BulkUploadArea`, `DraftsInbox`, `TransactionManager`, `AIChat`, `ReportIssueFAB`, `TransactionEditor` modal for drafts.

### I. Recent git scope (last 24h — illustrative, verify with `git log`)

Commits in this window included: **VAT → 18%** and consolidation into **`lib/ai-knowledge.ts`** ( **`lib/tax-regulations.ts` removed** ), **streaming AI chat** (`app/api/chat/route.ts`, `components/AIChat.tsx`, `tailwind`/`globals` for dark + shimmer), **admin** routes/UI + **`lib/admin.ts`**, **draft filtering** (`HomeContent`, `DraftsInbox`, `app/api/transactions/route.ts`), **auth** `is_admin` in session/login, **feedback** API + **`ReportIssueFAB`**, **`ruflo/`** bulk import (separate product — see §F). Re-run `git log --since="24 hours ago"` before relying on exact hashes.

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
│   │   ├── export/route.ts          # ✅ [ACTIVE] CSV export (UTF-8 BOM)
│   │   ├── feedback/route.ts        # ✅ [ACTIVE] User feedback → FeedbackLog
│   │   ├── admin/users/             # ✅ [ACTIVE] Admin user list / delete
│   │   └── uploads/[...path]/route.ts   # ✅ [ACTIVE] File serving ("Hunter" system)
│   │
│   ├── page.tsx                     # ✅ [ACTIVE] Main Dashboard (HomeContent)
│   ├── login/page.tsx               # ✅ [ACTIVE] Login page
│   ├── register/page.tsx            # ✅ [ACTIVE] Registration page
│   ├── forgot-password/page.tsx     # ✅ [ACTIVE] Password reset request
│   ├── reset-password/page.tsx      # ✅ [ACTIVE] Password reset form
│   ├── admin/page.tsx               # ✅ [ACTIVE] Admin users (env-gated)
│   ├── settings/page.tsx            # ✅ [ACTIVE] Settings page
│   └── layout.tsx                   # ✅ [ACTIVE] Root layout (ThemeProvider + AuthProvider)
│
├── 📁 components/                   # React Components
│   ├── AIChat.tsx                   # ✅ [ACTIVE] AI Chat widget
│   ├── DraftsInbox.tsx              # ✅ [ACTIVE] Draft inbox (`status === DRAFT`)
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
│   ├── ai-knowledge.ts              # ✅ [ACTIVE] Consolidated chat prompt (AI_KNOWLEDGE_BASE) + FAQ cache
│   ├── tax-knowledge.ts             # ✅ [ACTIVE] Tax category definitions (deterministic UI / receipts)
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
├── vat_management.db                # ❌ Legacy SQLite artifact if present — active stack is PostgreSQL (see §10 Active database)
├── package.json                     # ✅ [ACTIVE] Dependencies & scripts
├── prisma/                          # Prisma migrations (auto-generated)
└── ARCHITECTURE.md                  # 📖 THIS FILE
```

**Structure note (not every file is drawn above):** The repo also includes `app/admin/page.tsx`, `app/api/admin/`, `app/api/feedback/`, `components/BulkUploadArea.tsx`, `EditTransactionModal.tsx`, `ReportIssueFAB.tsx`, `ThemeToggle.tsx`, `theme-provider.tsx`, `AdminUsersTable.tsx`, and helpers `lib/admin.ts`, `lib/utils.ts`. Chat tax logic is **only** in `lib/ai-knowledge.ts` (`AI_KNOWLEDGE_BASE`); category math remains in `lib/tax-knowledge.ts`.

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
| `app/api/chat/route.ts` | AI chat (Gemini + `AI_KNOWLEDGE_BASE` + user context) | ✅ Uses Prisma |
| `app/api/settings/route.ts` | User Profile management | ✅ Uses Prisma |
| `app/api/auth/login/route.ts` | User authentication | ✅ Active |
| `app/api/upload/route.ts` | File upload handler | ✅ Active |
| `app/api/uploads/[...path]/route.ts` | **"Hunter" file system** - Searches 5 directories | ✅ Active |
| `app/api/scan-receipt/route.ts` | Receipt OCR (Gemini); uses shared `receipt-processor` | ✅ Active |
| `app/api/export/route.ts` | Monthly **CSV** export (UTF-8 BOM) | ✅ Active |
| `app/api/feedback/route.ts` | Persists `FeedbackLog` (table `Logs`) | ✅ Active |
| `app/api/admin/users/route.ts` | List users (admin env check) | ✅ Active |
| `app/api/admin/users/[id]/route.ts` | Delete user (admin) | ✅ Active |

#### Frontend Pages
| File | Purpose | Status |
|------|---------|--------|
| `app/page.tsx` | Main Dashboard (Income/Expense summary) | ✅ Updated with Prisma logging |
| `app/settings/page.tsx` | User Settings (Profile editor) | ✅ Fixed camelCase/snake_case mapping |
| `app/login/page.tsx` | Login page | ✅ Active |
| `app/register/page.tsx` | Registration page | ✅ Active |
| `app/forgot-password/page.tsx` | Request password reset email | ✅ Active |
| `app/reset-password/page.tsx` | Submit new password with token | ✅ Active |
| `app/admin/page.tsx` | Admin user management UI | ✅ Active (env-gated) |

#### Components
| File | Purpose | Status |
|------|---------|--------|
| `components/TransactionManager.tsx` | Transaction list & creation form | ✅ Active |
| `components/TransactionEditor.tsx` | Draft transaction editor modal | ✅ Active (refreshes on save) |
| `components/AIChat.tsx` | AI Chat widget | ✅ Active |
| `components/DraftsInbox.tsx` | Draft transactions inbox | ✅ Active (Fixed: Drafts now supported) |
| `components/FileUpload.tsx` | File upload component | ✅ Active |
| `components/VATReport.tsx` | VAT report display | ✅ Active |
| `components/BulkUploadArea.tsx` | Multi-file upload → draft transactions | ✅ Active |
| `components/ReportIssueFAB.tsx` | Feedback FAB → `/api/feedback` | ✅ Active |
| `components/ThemeToggle.tsx` / `theme-provider.tsx` | Dark mode (`next-themes`) | ✅ Active |
| `components/AdminUsersTable.tsx` | Admin user table | ✅ Active |

#### Utilities
| File | Purpose | Status |
|------|---------|--------|
| `lib/auth-server.ts` | JWT authentication (server-side) | ✅ Active |
| `lib/supabase.ts` | Supabase Storage client | ✅ Active |
| `lib/receipt-processor.ts` | **SHARED PIPELINE** - Upload to Supabase + Gemini processing | ✅ Active |
| `lib/phone-utils.ts` | Israeli phone normalization (972XXXXXXXXX format) | ✅ Active |
| `lib/fiscal-utils.ts` | VAT period calculations | ✅ Active |
| `lib/tax-knowledge.ts` | Tax category definitions (deterministic rules for transactions & OCR) | ✅ Active |
| `lib/ai-knowledge.ts` | **Consolidated** chat tax/advisory rules (`AI_KNOWLEDGE_BASE`) + `FAQ_QUICK_ANSWERS` | ✅ Active |

### 🤖 AI & Logic (Advisory Chat & Tax Rules)

| Piece | Role |
|-------|------|
| **`lib/ai-knowledge.ts`** | **Single high-efficiency source** for the chat model: `AI_KNOWLEDGE_BASE` (compressed “Tachles” advisory rules aligned with the 2026 VAT framing), plus `FAQ_QUICK_ANSWERS` for instant client-side replies in `AIChat` before calling the API. |
| **`app/api/chat/route.ts`** | Builds `system` = `AI_KNOWLEDGE_BASE` + per-user `formattedContext` (profile, last 20 transactions, last 10 chat messages). Streams via Vercel AI SDK + Google Gemini. **No separate law file** — former `lib/tax-regulations.ts` was removed; advisory text lives only in `AI_KNOWLEDGE_BASE`. |
| **`lib/tax-knowledge.ts`** | **Separate** from chat: deterministic categories, VAT recognition %, and receipt/UI logic — not duplicated in `ai-knowledge.ts`. |

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
| `lib/db-migration-draft-status.ts` | Old migration script for legacy DB | N/A — use Prisma migrations / `status` on `Transaction` |
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
│  - DraftsInbox          (lists status=DRAFT)                     │
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
│  ✅ /api/chat               (Gemini + AI_KNOWLEDGE_BASE + user context) │
│  ✅ /api/settings           (Profile CRUD)                       │
│  ✅ /api/upload             (File uploads)                       │
│  ✅ /api/export             (CSV report)                         │
│  ✅ /api/feedback           (user feedback)                      │
│  ✅ /api/admin/users        (admin-only)                         │
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
│                   PostgreSQL (via DATABASE_URL)                  │
│                   See prisma/schema.prisma — not SQLite in prod    │
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
│     - amount, vatAmount, netAmount, vatRate (default 0.18)      │
│     - date, merchant, description, category                      │
│     - receiptUrl                                                 │
│     - status: String — 'DRAFT' | 'COMPLETED' (default COMPLETED)│
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
3. **Transaction status:** `Transaction.status` is **`DRAFT` | `COMPLETED`** (string column, default `COMPLETED`). Drafts use **`DraftsInbox`** + API filters; VAT stats use **COMPLETED** only (see §0.H).
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

### Issue 4: How drafts work (current behavior)

**Source of truth:** `Transaction.status` in **`prisma/schema.prisma`** — **`DRAFT`** or **`COMPLETED`**.

**Detection in UI:** `DraftsInbox` shows rows where `String(status).toUpperCase() === 'DRAFT'` (same idea in **`GET /api/transactions`** when filtering drafts).

**Creation paths:**
- **WhatsApp / receipt pipeline:** Creates **`status: 'DRAFT'`** with real amounts from Gemini when available; user completes via **`TransactionEditor`** (API sets **`COMPLETED`** when appropriate).
- **Bulk upload:** `BulkUploadArea` creates drafts with **`status: 'DRAFT'`** (see component).
- **API normalization:** `app/api/transactions/route.ts` maps DB rows to snake_case and preserves **`status`**; PUT/POST accept **`status`** to move between draft and completed.

**Stats vs. inbox:** Dashboard totals (**`HomeContent`**) intentionally exclude **`DRAFT`** rows (only **`COMPLETED`** + **`amount > 0`**); drafts still appear in the shared fetch for the inbox.

---

## 📊 7. Database Schema Summary

### User
```prisma
model User {
  id             String    @id @default(cuid())
  email          String    @unique
  name           String?
  password       String
  dealerNumber   String?   // Israeli tax ID (9 digits)
  whatsappPhone  String?   // Primary WhatsApp (format: 972XXXXXXXXX)
  whatsappPhone2 String?   // Optional second linked number
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  profile        UserProfile?
  transactions   Transaction[]
  chatMessages   ChatMessage[]
  passwordResets PasswordReset[]
  feedbackLogs   FeedbackLog[]

  @@index([whatsappPhone], name: "idx_whatsapp_phone")
  @@index([whatsappPhone2], name: "idx_whatsapp_phone2")
}
```

**WhatsApp fields (`whatsappPhone`, `whatsappPhone2`)**
- **Format:** `972XXXXXXXXX` (normalized Israeli phone)
- **Purpose:** Link one or two numbers to the same account for receipt processing
- **Normalization:** Applied via `normalizeIsraeliPhone()` before saving
- **Display:** Formatted as `052-458-9771` in UI
- **Lookup:** Webhook resolves user by matching `message.from` against either stored number
- **Indexes:** `idx_whatsapp_phone`, `idx_whatsapp_phone2`

**`FeedbackLog` (table `Logs`):** Stores in-app feedback from **`/api/feedback`** (`message`, `pageUrl`, `userId`).

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

**Key differences from legacy SQLite-era schema:**
- ✅ **`status`** column: explicit **`DRAFT` | `COMPLETED`** (no reliance on `amount === 0` alone for draft detection in current API/UI).
- ✅ Uses **`receiptUrl`** (and API may still expose legacy **`document_path`** alias in mapped responses where applicable).
- ❌ No separate `is_vat_deductible` column — deductibility is driven by **category** + **`lib/tax-knowledge.ts`** rules.

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
- [ ] Test draft workflow end-to-end (WhatsApp → DraftsInbox → complete)

### 🔮 Future Enhancements
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

### Active database
- **`prisma/schema.prisma`** uses **`provider = "postgresql"`** — production and typical dev use **`DATABASE_URL`** (and often **`DIRECT_URL`** for migrations) pointing at **PostgreSQL** (e.g. Supabase).
- Legacy **SQLite** `vat_management.db` paths may still appear in old notes; **do not** assume file-based DB unless your local `.env` explicitly uses `file:` (verify before debugging “wrong DB”).

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
| 2026-03-31 | Docs: consolidated chat rules in `lib/ai-knowledge.ts`; removed `lib/tax-regulations.ts` references | — |
| 2026-03-31 | **Full “sync with reality” pass:** added §0 handoff (VAT 18%, chat stack, theme, drafts/schema, admin env, `ruflo/` scope); fixed data-flow diagram + DB host (PostgreSQL); removed contradictory “no status field” / heuristic-only draft text; documented `HomeContent` fetch + admin `ADMIN_EMAIL` / `ADMIN_USER_IDS` | — |

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

- [ ] **Export accuracy**
  - Verify monthly CSV columns and Hebrew labels
  - Verify totals match dashboard for the same `month` param
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
- ✅ AI Chat (Gemini + consolidated `AI_KNOWLEDGE_BASE` in `lib/ai-knowledge.ts` + user context)
- ✅ Dashboard with income/expense summaries
- ✅ VAT reporting and calculations
- ✅ Export to **CSV** (UTF-8 BOM; opens in Excel) for monthly reports
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

**Prepared for next session on:** 2026-03-31  
**Ready to:** Verify tax compliance (§12 checklist) and prepare for beta launch; start from **§0** in this file for cold context.
