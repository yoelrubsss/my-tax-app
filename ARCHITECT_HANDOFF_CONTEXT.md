# Architect Handoff Context Packet

## Goal

Provide an external architect model with enough codebase and business-rule context to make safe implementation decisions, especially around VAT logic, draft/completed lifecycle, and multi-tenant protections.

## Product Context

- Project purpose: Israeli VAT workflow app (`עוסק מורשה`) with Hebrew/RTL UX, transaction capture, receipt ingestion, VAT tracking, bi-monthly reporting, and AI-assisted chat/receipt extraction.
- Scope guardrail: primary runtime is the app root; `ruflo/` is non-primary scope unless a task explicitly targets it.
- Canonical architecture snapshot is in `ARCHITECTURE.md`.

## Canonical Sources (Read First)

- Architecture snapshot: `ARCHITECTURE.md`
- Data model source of truth: `prisma/schema.prisma`
- Main UI orchestration: `app/HomeContent.tsx`
- Transaction API (GET/POST/PUT): `app/api/transactions/route.ts`
- Export API (bi-monthly CSV): `app/api/export/route.ts`
- Chat API: `app/api/chat/route.ts`
- WhatsApp webhook ingestion: `app/api/webhook/whatsapp/route.ts`
- Tax/category law matrix + normalization: `lib/tax-knowledge.ts`
- Fiscal period math helpers: `lib/fiscal-utils.ts`
- Shared receipt processing: `lib/receipt-processor.ts`
- Auth + user isolation utility: `lib/auth-server.ts`

## Runtime Facts That Must Not Regress

- Framework/runtime: Next.js App Router (`app/`) + API routes.
- Database: Prisma + PostgreSQL (`provider = "postgresql"` in `prisma/schema.prisma`).
- User IDs are `String` CUIDs in Prisma models; avoid numeric ID assumptions in DB access paths.
- Transaction status is explicit and persisted (`DRAFT`/`COMPLETED`) and is used by UI, API filters, and export flow.

## Logic Invariants (Non-Negotiable)

### 1) VAT math and recognition

- VAT statutory rate is 18% (2026 baseline in active logic/docs).
- Canonical gross-to-VAT extraction path: `vatAmount = amount * 0.18 / 1.18` (or equivalent `(amount * rate) / (1 + rate)` with `rate=0.18`).
- `recognizedVatAmount` is not always equal to `vatAmount` for expenses; it must use category-adjusted recognition percentages from tax knowledge helpers.
- Income and expense semantics differ; changes must preserve current treatment in APIs and summaries.

### 2) Draft/completed lifecycle

- `Transaction.status` drives behavior, not heuristics.
- Dashboard totals and VAT reporting are based on completed transactions; drafts are surfaced for editing/inbox workflows.
- Webhook/receipt ingestion creates drafts that are later completed through edit/update flows.

### 3) Category normalization and consistency

- Category IDs must be normalized through tax knowledge helpers before persistence/critical calculations.
- Unknown or missing categories must follow existing safe fallback behavior without corrupting VAT recognition math.

### 4) Bi-monthly VAT period alignment

- Period logic must stay aligned across:
  - UI period selection/state
  - API transaction filtering
  - Export generation (`/api/export`)
- Any change to period boundaries must be applied consistently across these surfaces.

### 5) Multi-tenant and security protections

- Every read/write path must enforce per-user ownership constraints.
- Webhook flow must resolve sender phone to a specific linked user before creating/updating records.
- Admin elevation remains env-driven utility logic, not a DB role column.

## Operational Commands

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Prisma generate: `npm run prisma:generate`
- Prisma sync: `npm run prisma:push`

## External Architect Prompt (Copy/Paste)

Use this exact instruction block in the external architect chat:

> Treat `prisma/schema.prisma`, `ARCHITECTURE.md`, and active API handlers as canonical over stale comments/docs. Preserve `DRAFT|COMPLETED` semantics, recognized-VAT expense accounting, category normalization, bi-month period behavior, and user-isolation checks in all changes. Before proposing changes, list which of these invariants are impacted and how they are preserved.

