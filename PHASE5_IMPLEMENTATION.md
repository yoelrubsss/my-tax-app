# Phase 5: Deep Personalization & Legal Grounding (RAG) - Implementation Complete ✅

## Overview

Phase 5 introduces **Retrieval-Augmented Generation (RAG)** to the AI Accountant by:
1. **User Profiling**: Comprehensive business and personal context
2. **Transaction History**: Last 20 transactions for pattern recognition
3. **Conversation Memory**: Last 10 chat messages for context continuity
4. **Legal Grounding**: Official Israeli tax regulations as source of truth

---

## What Was Implemented

### 1. Prisma ORM Integration ✅

#### Installed Packages:
- `@prisma/client@5.22.0`
- `prisma@5.22.0` (dev dependency)

#### Database Schema (`prisma/schema.prisma`):

**Models:**
- `User` - User authentication and relationships
- `UserProfile` - Business type, home office, children, work hours
- `Transaction` - Full transaction history with VAT breakdown
- `ChatMessage` - Conversation history for context

**Key Features:**
- SQLite database (file-based, no server needed)
- Cascade deletes for data integrity
- CUID-based IDs for security

---

### 2. Legal Knowledge Base ✅

#### File: `lib/tax-regulations.ts`

**Contains:**
- VAT Regulations (Ma'am) - Regulations 13-16
- Income Tax Ordinance - Section 17, depreciation, mixed expenses
- Tax Credits (Nekudot Zikuy) - Resident, academic, children

**Key Rules:**
- Osek Patur CANNOT reclaim VAT
- Vehicle expenses: 2/3 VAT for business use >50%
- Home office: 20-25% proportional recognition
- Gifts: Max 210 ILS per person/year
- Restaurant meals: NOT recognized

---

### 3. RAG-Powered Chat API ✅

#### File: `app/api/chat/route.ts`

**New Functionality:**

1. **Context Fetching** (`getUserContext`):
   - Fetches user profile from `UserProfile` table
   - Retrieves last 20 transactions
   - Loads last 10 chat messages

2. **Context Formatting** (`formatUserContext`):
   - Formats profile, transactions, and chat history into readable text
   - Includes business type, home office status, children count
   - Shows recent transaction patterns

3. **Enhanced System Prompt**:
   - Combines existing AI knowledge base
   - Adds Israeli tax law context
   - Injects personalized user context
   - Provides specific instructions for personalization

4. **Message Persistence** (`saveChatMessage`):
   - Saves all user and assistant messages to database
   - Enables conversation continuity across sessions

**Example Context Injection:**
```
=== USER CONTEXT ===

**USER PROFILE:**
- Business Name: כהן ייעוץ ופיתוח
- Business Type: OSER_MURSHE
- Has Home Office: Yes
- Has Children: Yes (2 children)
- Standard Work Day: 9 hours

**RECENT TRANSACTIONS (Last 20):**
1. 01/02/2024 | דלק | ₪300.00 | vehicle-fuel | EXPENSE
2. 20/01/2024 | אופיס דיפו | ₪450.00 | office-equipment | EXPENSE
...

**CONVERSATION HISTORY (Last 10 messages):**
1. [User]: האם אני יכול לקזז מע"מ על הוצאות רכב?
2. [Assistant]: כן, כעוסק מורשה אתה יכול לקזז 66.67% (2/3)...
...

=== END OF USER CONTEXT ===
```

---

## File Structure

```
my-tax-app/
├── prisma/
│   └── schema.prisma          # Database schema (NEW)
├── lib/
│   ├── prisma.ts              # Prisma client singleton (NEW)
│   ├── tax-regulations.ts     # Israeli tax law context (NEW)
│   └── ai-knowledge.ts        # Existing AI knowledge base
├── app/
│   └── api/
│       └── chat/
│           └── route.ts       # RAG-powered chat API (UPGRADED)
├── scripts/
│   └── seed-test-data.ts      # Database seed script (NEW)
├── .env                       # Prisma DATABASE_URL (NEW)
└── vat_management.db          # SQLite database (AUTO-GENERATED)
```

---

## How to Use

### 1. Seed Test Data

Run this command to populate the database with test user and transactions:

```bash
npm run seed-test-data
```

This creates:
- Test user: `test@example.com` (ID: `mock-user-id`)
- User profile: Osek Murshe with home office and 2 children
- 5 sample transactions (fuel, office equipment, restaurant, electricity, income)
- 4 sample chat messages

### 2. Test the Chat API

The chat API now accepts an optional `userId` parameter:

```typescript
// Client-side request example
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'mock-user-id',  // Optional, defaults to 'mock-user-id'
    messages: [
      { role: 'user', content: 'האם אני יכול לקזז מע"מ על משרד ביתי?' }
    ]
  })
});
```

### 3. Prisma Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Push schema changes to database
npm run prisma:push

# Open Prisma Studio (visual database editor)
npx prisma studio
```

---

## AI Personalization Examples

### Example 1: Home Office Recognition

**User Profile:**
- `isHomeOffice: true`

**AI Response:**
> "אני רואה שיש לך משרד ביתי. לפי תקנה 15 של חוק מע"מ, אתה יכול לקזז באופן יחסי. אם החדר תופס 20% מהדירה, ניתן לקזז 20% מהמע"מ על חשמל, ארנונה ואינטרנט."

---

### Example 2: Transaction Pattern Analysis

**Recent Transactions:**
- 3 restaurant expenses in last month

**AI Response:**
> "שים לב: ראיתי שיש לך 3 הוצאות מסעדה בחודש האחרון. לצערי, הוצאות מסעדה אינן מוכרות לקיזוז מע"מ או למס הכנסה, אלא אם מדובר בארחת לקוחות זרים (בתיאום מראש)."

---

### Example 3: Tax Credits Based on Children

**User Profile:**
- `hasChildren: true`
- `childrenCount: 2`

**AI Response:**
> "כיוון שיש לך 2 ילדים, אתה זכאי לנקודות זיכוי נוספות במס הכנסה. אמהות מקבלות נקודות זיכוי על כל ילד, ואבות מקבלים נקודות זיכוי על ילדים מתחת לגיל 3."

---

## Technical Architecture

### RAG Flow Diagram

```
User Message
    ↓
[Fetch User Context]
    ├── UserProfile (business type, home office, children)
    ├── Last 20 Transactions (spending patterns)
    └── Last 10 Chat Messages (conversation continuity)
    ↓
[Format Context]
    ↓
[Inject into System Prompt]
    ├── AI Knowledge Base (existing rules)
    ├── Israeli Tax Law Context (official regulations)
    └── User Context (personalized data)
    ↓
[OpenAI GPT-4o-mini]
    ↓
[Save Response to DB]
    ↓
Return Personalized Answer
```

---

## Database Schema Details

### User Table
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

### UserProfile Table
```prisma
model UserProfile {
  id              String   @id @default(cuid())
  userId          String   @unique
  businessName    String?
  businessType    String?  // 'OSER_PATUR', 'OSER_MURSHE', 'LTD'
  isHomeOffice    Boolean  @default(false)
  hasChildren     Boolean  @default(false)
  childrenCount   Int      @default(0)
  standardWorkDay Int      @default(9)
}
```

### Transaction Table
```prisma
model Transaction {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime @default(now())
  merchant    String
  description String?
  amount      Float
  vatRate     Float    @default(0.17)
  vatAmount   Float
  netAmount   Float
  category    String
  isRecognized Boolean @default(true)
  receiptUrl  String?
  type        String   // 'INCOME' or 'EXPENSE'
  createdAt   DateTime @default(now())
}
```

### ChatMessage Table
```prisma
model ChatMessage {
  id        String   @id @default(cuid())
  userId    String
  role      String   // 'user' or 'assistant'
  content   String
  createdAt DateTime @default(now())
}
```

---

## Benefits of Phase 5

### 1. Personalization
- AI knows user's business type (Osek Patur vs. Osek Murshe)
- Considers home office status for expense recognition
- Factors in children for tax credit advice

### 2. Context Awareness
- References specific past transactions
- Maintains conversation history across sessions
- Detects spending patterns and anomalies

### 3. Legal Accuracy
- Grounded in official Israeli tax regulations
- Cites specific regulation numbers
- Conservative approach to compliance

### 4. Scalability
- Prisma ORM for type-safe database access
- SQLite for zero-config deployment
- Easy migration to PostgreSQL for production

---

## Next Steps

### Optional Enhancements:

1. **User Authentication Integration**:
   - Replace `mock-user-id` with real session management
   - Use JWT tokens or NextAuth.js

2. **Advanced RAG**:
   - Vector embeddings for semantic search
   - RAG over uploaded receipts and invoices
   - Long-term memory with Pinecone/Weaviate

3. **Analytics Dashboard**:
   - Show spending patterns by category
   - VAT reclaim forecasting
   - Tax savings recommendations

4. **Multi-Tenant Support**:
   - Support multiple users per business
   - Role-based access control (owner, accountant, employee)

5. **Receipt OCR Integration**:
   - Auto-extract merchant, amount, VAT from receipt images
   - Link receipts to transactions automatically

---

## Troubleshooting

### Database Not Found
```bash
npm run prisma:push
```

### Prisma Client Out of Sync
```bash
npm run prisma:generate
```

### View Database Contents
```bash
npx prisma studio
# Opens visual database editor at http://localhost:5555
```

### Reset Database
```bash
rm vat_management.db
npm run prisma:push
npm run seed-test-data
```

---

## Summary

Phase 5 successfully implements:
- ✅ Prisma ORM with comprehensive schema
- ✅ Israeli tax law knowledge base
- ✅ RAG-powered personalized chat API
- ✅ User profiling (business type, home office, children)
- ✅ Transaction history integration
- ✅ Conversation memory
- ✅ Test data seeding script

The AI Accountant now provides **personalized, legally-grounded tax advice** based on each user's unique business context and transaction history! 🎉
