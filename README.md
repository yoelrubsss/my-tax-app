# Israeli VAT Management (SaaS)

ניהול מע״מ דו-חודשי לעוסק מורשה בישראל — אפליקציית ווב מלאה (עברית, RTL) לרישום הכנסות והוצאות, קליטת קבלות מוואטסאפ, וייצוא לרואה חשבון.

## Core features

| Feature | Description |
|--------|-------------|
| **WhatsApp receipt processing** | קישור מספר(ים) בהגדרות, קבלת תמונות/PDF בוואטסאפ, יצירת טיוטות לבדיקה |
| **AI agent for tax classification** | צ'אט עוזר מס (מע״מ / הוצאות מוכרות) עם הקשר מהמערכת |
| **1-click export to accountant** | ייצוא CSV/Excel לפי תקופת מע״מ נבחרת מתוך ניהול העסקאות |
| **Mobile-first dashboard** | ממשק מותאם מובייל (ללא zoom מעצבן ב־iOS), תאריכי יעד ממורכזים, תפריט "עוד" |

## What’s new — v1.0 Alpha

- **100% mobile UI polish** — שדות קלט בגודל טקסט נוח, אזורי לחיצה ברורים, תאריכי dead-line ממורכזים בטלפון
- **Video tutorial modal** — "סרטון הדרכה" בכותרת (במקום דף מדריך נפרד), הטמעת וידאו + הסבר קצר
- **Integrated tooltips** — מונחי מס והסברים הקשריים (`HelpTooltip`) ליד שדות וסיכומים
- **Forced light mode on auth** — מסכי כניסה והרשמה תמיד במראה בהיר, ללא תלות בערכת נושא כהה

## Tech stack

- **Next.js 15** (App Router, React 19)
- **Prisma** + **PostgreSQL**
- **WhatsApp Cloud API** (webhook + Vercel; פיתוח מקומי עם ngrok לפי הצורך)
- **Tailwind CSS** + **Lucide** icons
- **AI**: Google Gemini (סריקת קבלות / צ'אט — לפי הגדרות הסביבה)

## Prerequisites

- Node.js 20+
- PostgreSQL (או `DATABASE_URL` מנוהל, למשל Vercel Postgres / Neon)

## Setup

```bash
npm install
cp .env.example .env   # והגדר DATABASE_URL, מפתחות AI, WhatsApp וכו'
npx prisma generate
npx prisma db push     # או migrate לפי הסביבה
npm run dev
```

פתח [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | שרת פיתוח |
| `npm run build` | בניית production |
| `npm run start` | הרצה אחרי build |
| `npm run lint` | ESLint |
| `npm run setup-db` | עזר לאתחול DB (אם קיים בפרויקט) |

## Documentation

- **`ARCHITECTURE.md`** — זרימות נתונים, AI, מבנה API
- **`.env.example`** — משתני סביבה נדרשים

## Alpha testing notes

- בודקים יכולים לאפס את בלוק "מתחילים" עם query: `/?resetOnboarding=1` (או להסיר `mytax_onboarding_dismissed` מ-localStorage)
- ייצוא לרואה חשבון: כפתור ב**ניהול עסקאות** לפי התקופה הנבחרת

## License / usage

פרויקט פרטי — שימוש לפי מדיניות הצוות.
