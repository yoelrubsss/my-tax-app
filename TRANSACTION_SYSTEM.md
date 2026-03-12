# Transaction Management System - Floor 1: Data Entry

## Implementation Summary

### 1. Backend API (`app/api/transactions/route.ts`)

#### GET `/api/transactions`
- Fetches all transactions for user_id=1 (hardcoded)
- Returns transactions sorted by date (newest first)
- Response format:
  ```json
  {
    "success": true,
    "data": [...]
  }
  ```

#### POST `/api/transactions`
- Creates new transaction for user_id=1
- Automatically calculates VAT amount (18% extraction from total)
- Request body:
  ```json
  {
    "type": "income" | "expense",
    "amount": 1180,
    "date": "2026-01-27",
    "description": "Payment from client",
    "category": "Services",
    "is_vat_deductible": false
  }
  ```

### 2. Frontend Component (`components/TransactionManager.tsx`)

#### Features Implemented:

1. **Tabs**
   - הכנסה (Income) - Green theme
   - הוצאה (Expense) - Red theme

2. **Form Fields**
   - תאריך (Date) - Calendar picker
   - תיאור (Description) - Customer/Supplier name
   - סכום כולל (Total Amount) - Including VAT
   - קטגוריה (Category) - Optional field

3. **Auto-Calculation**
   - When total amount is entered, automatically displays:
     - סכום נטו (Net Amount)
     - מע״מ 18% (VAT Amount)
   - Formula: VAT = Total × 0.18 / 1.18
   - Net = Total - VAT

4. **VAT Deductibility Check**
   - Appears only for expenses
   - Checkbox: "האם המע״מ מוכר לקיזוז?"
   - Default: Unchecked (False)
   - Note: Private cars are not deductible by default

5. **Transaction List**
   - Shows last 10 transactions
   - Sorted by date (newest first)
   - Columns:
     - תאריך (Date)
     - סוג (Type - Income/Expense)
     - תיאור (Description)
     - קטגוריה (Category)
     - סכום כולל (Total Amount)
     - מע״מ (VAT Amount)
     - ניכוי (Deductible - Yes/No for expenses)

### 3. Integration

- Updated `app/page.tsx` with:
  - Header with app branding
  - VAT rate and reporting frequency display
  - TransactionManager component

### 4. Database

- Default user created (ID: 1)
  - Name: משתמש ברירת מחדל
  - Dealer Number: 000000000

## Testing the System

1. **Start the dev server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Open browser**:
   - Visit: http://localhost:3000

3. **Add a test income transaction**:
   - Switch to "הכנסה" tab
   - Enter date, description, amount (e.g., 1180)
   - See auto-calculated: Net: ₪1000, VAT: ₪180
   - Click "הוסף עסקה"

4. **Add a test expense transaction**:
   - Switch to "הוצאה" tab
   - Enter details
   - Check/uncheck "האם המע״מ מוכר לקיזוז?"
   - Submit

5. **View transactions**:
   - Scroll down to see the list of transactions
   - Verify calculations are correct

## Next Steps (Future Floors)

- Floor 2: VAT Reports & Bi-monthly Summaries
- Floor 3: User Authentication & Multi-user Support
- Floor 4: Export/Copy functionality for Tax Authority website

## Technical Notes

- All amounts are stored with 2 decimal precision
- VAT calculations use the formula: VAT = Amount × 0.18 / 1.18
- Database includes proper indexes for performance
- RTL (Right-to-Left) support for Hebrew interface
- Responsive design for mobile and desktop
