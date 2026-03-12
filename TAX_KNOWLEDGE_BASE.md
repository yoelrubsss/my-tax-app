# Israeli Tax Knowledge Base

## Overview

This document describes the **Legal Knowledge Base** (`lib/tax-knowledge.ts`) that serves as the "Ground Truth" for the AI Accountant feature.

Instead of relying on AI hallucinations, the system uses **deterministic rules** based on official Israeli tax regulations.

---

## Purpose

The knowledge base provides:

1. **VAT Deduction Rules** - What percentage of VAT can be legally deducted for each expense type
2. **Income Tax Recognition** - What percentage of the expense is recognized for income tax purposes
3. **Legal Warnings** - Official disclaimers and explanations in Hebrew
4. **Legal References** - Direct links to the source laws on Nevo.co.il
5. **Auto-Detection Keywords** - For smart category suggestions

---

## Tax Categories

### 1. Office Equipment (ציוד משרדי)
- **VAT Deduction**: 100%
- **Income Tax**: 100%
- **Rule**: Fully recognized business expense
- **Examples**: Computers, printers, furniture, stationery

### 2. Vehicle & Fuel (רכב ודלק)
- **VAT Deduction**: 66.67% (2/3 rule)
- **Income Tax**: 45%
- **Rule**: Based on Income Tax Regulations (Vehicle Expenses)
- **Legal Basis**: Private/commercial vehicles up to 3.5 tons
- **Examples**: Fuel, garage services, car insurance, licensing

### 3. Business Meals (אירוח עסקי וארוחות)
- **VAT Deduction**: 100% (if documented)
- **Income Tax**: 100% (if documented)
- **Rule**: Must document who met, business purpose
- **Examples**: Client lunches, business meetings at restaurants

### 4. Professional Services (שירותים מקצועיים)
- **VAT Deduction**: 100%
- **Income Tax**: 100%
- **Rule**: Fully recognized
- **Examples**: Lawyers, accountants, consultants

### 5. Gifts (מתנות עסקיות)
- **VAT Deduction**: 0% (NOT deductible)
- **Income Tax**: 100% (up to 210 NIS per recipient per year)
- **Rule**: VAT cannot be deducted on gifts by law
- **Examples**: Holiday gifts, client presents

### 6. Communication (תקשורת וטלפון)
- **VAT Deduction**: 66.67% (2/3 rule)
- **Income Tax**: 100%
- **Rule**: Established case law practice
- **Examples**: Mobile phones, internet, landline

### 7. Marketing & Advertising (שיווק ופרסום)
- **VAT Deduction**: 100% (if Israeli invoice)
- **Income Tax**: 100%
- **Important**: Facebook/Google ads from abroad usually have NO Israeli VAT
- **Examples**: Facebook Ads, Google Ads, local advertising

### 8. Office Rent (שכר דירה משרדי)
- **VAT Deduction**: 100%
- **Income Tax**: 100%
- **Rule**: Must be commercial lease (not residential)
- **Examples**: Office space, commercial store rent

### 9. Software & Digital Subscriptions (תוכנות ומנויים)
- **VAT Deduction**: 0% (foreign SaaS usually no Israeli VAT)
- **Income Tax**: 100%
- **Rule**: Foreign services typically exempt from Israeli VAT
- **Examples**: Adobe, Microsoft 365, Zoom, Slack

### 10. Business Insurance (ביטוח עסקי)
- **VAT Deduction**: 0% (insurance is VAT-exempt)
- **Income Tax**: 100%
- **Rule**: Insurance exempt from VAT by law
- **Examples**: Professional liability, equipment insurance

### 11. Business Travel (נסיעות עסקיות)
- **VAT Deduction**: 100% (if documented)
- **Income Tax**: 100% (if documented)
- **Rule**: Must document purpose, dates, location
- **Examples**: Flights, hotels, conferences

### 12. Education & Training (השתלמויות והכשרה)
- **VAT Deduction**: 100%
- **Income Tax**: 100%
- **Rule**: Must be job-related
- **Examples**: Professional courses, seminars, workshops

### 13. Utilities (חשמל ומים)
- **VAT Deduction**: 100%
- **Income Tax**: 100%
- **Rule**: For business premises (if home office, prorate by area)
- **Examples**: Electricity, water bills

### 14. Other (אחר)
- **VAT Deduction**: 100% (default)
- **Income Tax**: 100% (default)
- **Rule**: Catch-all category, recommend consulting accountant

---

## Auto-Detection System

The knowledge base includes **Hebrew + English keywords** for each category.

### How It Works:

```typescript
import { suggestCategory } from "@/lib/tax-knowledge";

const description = "תדלוק בפז";
const category = suggestCategory(description);

// Returns: category.label = "רכב ודלק"
// VAT: 66.67%, Income Tax: 45%
```

### Keywords Example:

For **Vehicle & Fuel**:
- Hebrew: דלק, סולר, בנזין, מוסך, ביטוח רכב
- English: fuel, gas, garage, car

---

## Usage in the App

### Current Implementation:

The knowledge base is a **TypeScript module** that can be imported anywhere:

```typescript
import { TAX_CATEGORIES, getCategoryById, suggestCategory } from "@/lib/tax-knowledge";
```

### Future AI Integration:

When building the AI Accountant (Phase 4), the AI will:

1. **Receive user question** (e.g., "Can I deduct fuel expenses?")
2. **Load TAX_CATEGORIES** as context
3. **Answer based on rules** (not hallucination)
4. **Cite legal references** (Nevo URLs)

Example prompt:
```
You are an Israeli tax advisor. Use ONLY the following legal rules to answer questions:

[TAX_CATEGORIES data]

User: "Can I deduct 100% VAT on fuel?"
Assistant: "No. According to Israeli tax law, fuel expenses follow the 2/3 rule: only 66.67% of VAT is deductible for vehicles up to 3.5 tons. Reference: https://www.nevo.co.il/law_html/law01/255_179.htm"
```

---

## Legal References

All categories link to official sources:

- **Nevo Legal Database**: Official Israeli law repository
- **Income Tax Ordinance** (פקודת מס הכנסה)
- **VAT Law** (חוק מס ערך מוסף)
- **Tax Authority Circulars**

---

## Maintenance

### Updating Rules:

If tax law changes (e.g., VAT rate change from 18% to 17%):

1. Update `lib/tax-knowledge.ts`
2. Modify the relevant category
3. Add a note in the warning field
4. Update the legal reference URL if needed

### Adding New Categories:

```typescript
{
  id: "new-category",
  label: "קטגוריה חדשה",
  vatPercentage: 1.0,
  incomeTaxRecognition: 1.0,
  warning: "הסבר משפטי בעברית",
  legalRefUrl: "https://www.nevo.co.il/...",
  matchKeywords: ["מילה1", "מילה2", "word1", "word2"],
}
```

---

## Testing

Run the test script:

```bash
npm run test-tax-knowledge
```

This will:
- Display all 14 categories
- Test auto-detection on sample descriptions
- Show example VAT calculations
- Verify the knowledge base is correctly loaded

---

## Important Notes

### Conservative Approach

The knowledge base follows the **conservative principle**:

> "If in doubt, do NOT deduct VAT."

This matches the product vision of being legally safe over convenient.

### Not a Replacement for Accountant

The knowledge base provides **general rules**. Edge cases and complex situations should always be referred to a licensed Israeli accountant (רואה חשבון).

### Disclaimer

This knowledge base represents **general tax rules** as of February 2026. Tax law can change. Users should verify current regulations with the Israeli Tax Authority or a professional accountant.

---

## Next Steps

### Phase 4: AI Accountant Integration

1. **Smart Category Suggestions**: Use `suggestCategory()` when user creates transaction
2. **VAT Calculator**: Auto-calculate deductible VAT based on category
3. **Chat Interface**: AI advisor that uses knowledge base as source of truth
4. **Legal Tooltips**: Show warnings and references in the UI
5. **Expense Validator**: Flag potentially non-deductible expenses

---

## Summary

✅ **14 Tax Categories** covering all common business expenses
✅ **Official Legal References** (Nevo links)
✅ **Auto-Detection System** (Hebrew + English keywords)
✅ **Conservative Approach** (legal safety first)
✅ **Ready for AI Integration** (structured, deterministic data)

The knowledge base is the **foundation** for the AI Accountant feature, ensuring accurate, legal, and trustworthy tax advice.
