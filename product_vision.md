# Product Vision – AI VAT Accountant (Israel)

## Core Philosophy

This app is a conservative, accountant-grade VAT management system for Israeli authorized dealers ('Osek Morshe'). Its goal is to replace day-to-day VAT accounting with clarity, legal safety, and guided decision-making — not automation at all costs.

## Key Principles

1. **Conservative Approach**: If in doubt → Do NOT deduct VAT. Legal accuracy > Convenience.

2. **User != Accountant**: The user does not need to know tax laws. The app manages the complexity.

3. **App in Control**: The app ensures no missing data or illegal deductions before reporting.

## Feature Roadmap

### Phase 1: Core VAT (Current)

- Manual entry of Income/Expenses.
- Auto-calculation of VAT (18%).
- 'Vat Deductible' toggle for safety.
- Bi-monthly VAT reporting.
- Delete transactions with auto-refresh.
- Copy-paste friendly summary for tax authority website.

### Phase 2: User Management (Next Priority)

- **Login/Register**: Email/Password authentication.
- **Business Profile**: Store dealer number, business type, family status.
- **Multi-tenancy**: Strict data isolation between users.

### Phase 3: Document Management

- Upload receipts (Image/PDF) for every transaction.
- View attached documents directly in the list.
- Backup data to Excel/CSV.

### Phase 4: AI Accountant

- Chat interface connected to user data + Israeli tax rules.
- Advises on deductibility (e.g., "Can I deduct lunch with a client?").
- **Principles**: The AI explains decisions but never takes action without approval.

## Technical Constraints

- **No expensive OCR by default** (cost optimization).
- **AI only on demand** (Chat).
- **Hebrew UI** (RTL).
- **Next.js + SQLite** (for now).
- **Conservative by default**: Legal accuracy over convenience.
- **User-friendly**: Non-technical users should feel confident.
