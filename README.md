# Israeli VAT Management App - ניהול מע״מ לעוסק מורשה

אפליקציה לניהול דו״חות מע״מ עבור עוסק מורשה בישראל.

## Features - תכונות

- ניהול עסקאות הכנסה והוצאה
- חישוב אוטומטי של מע״מ (18%)
- דיווח דו-חודשי
- ממשק בעברית (RTL)
- מסכי סיכום לעדכון אתר רשות המיסים

## Getting Started - התחלה

### 1. Install Dependencies - התקנת תלויות

```bash
npm install
```

### 2. Initialize Database - אתחול מסד הנתונים

```bash
npm run setup-db
```

### 3. Run Development Server - הפעלת שרת פיתוח

```bash
npm run dev
```

פתח את הדפדפן בכתובת [http://localhost:3000](http://localhost:3000)

## Technology Stack - טכנולוגיות

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **SQLite (better-sqlite3)** - Database
- **Lucide React** - Icons

## Database Schema - מבנה מסד הנתונים

### users - משתמשים
- id (primary key)
- name - שם
- dealer_number - מספר עוסק מורשה
- created_at - תאריך יצירה

### transactions - עסקאות
- id (primary key)
- user_id (foreign key)
- type - סוג (income/expense)
- amount - סכום כולל מע״מ
- vat_amount - סכום מע״מ
- date - תאריך
- description - תיאור
- category - קטגוריה
- is_vat_deductible - ניתן לניכוי במע״מ
- created_at - תאריך יצירה

## Tax Rules - כללי מיסוי

- שיעור מע״מ: 18%
- תדירות דיווח: דו-חודשי
- ניכוי מע״מ על רכבים פרטיים: לא (אלא אם צוין אחרת)

## Development - פיתוח

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Project Structure - מבנה הפרויקט

```
my-tax-app/
├── app/                  # Next.js App Router
│   ├── layout.tsx       # Root layout with RTL support
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── lib/                 # Utilities and database
│   ├── db.ts           # Database connection and schema
│   ├── db-operations.ts # Database operations
│   └── init-db.ts      # Database initialization
├── components/          # React components
├── scripts/            # Setup scripts
│   └── setup-db.ts    # Database setup
└── system_rules.md    # System guidelines
```

## Notes - הערות

- האפליקציה מיועדת לעוסק מורשה בישראל
- כל הטבלאות כוללות user_id למדרגיות עתידית
- ללא יצירת PDFs - רק מסכי סיכום להעתקה לאתר רשות המיסים
