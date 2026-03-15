/**
 * Israeli Tax Law Knowledge Base
 *
 * This file contains the official legal rules for VAT deductions and Income Tax recognition
 * based on Israeli Tax Authority regulations and court rulings.
 *
 * Sources:
 * - Value Added Tax Law (חוק מס ערך מוסף)
 * - Income Tax Ordinance (פקודת מס הכנסה)
 * - Tax Authority circulars and rulings
 * - Nevo Legal Database (www.nevo.co.il)
 *
 * Last Updated: 2026-02-02
 */

export interface TaxCategory {
  id: string;
  label: string; // Hebrew name for UI display
  vatPercentage: number; // 0 to 1.0 (percentage of VAT that can be deducted)
  incomeTaxRecognition: number; // 0 to 1.0 (percentage recognized for income tax)
  warning: string; // Legal disclaimer/explanation in Hebrew
  legalRefUrl: string; // Official reference on Nevo
  matchKeywords: string[]; // Keywords for auto-detection (Hebrew + English)
}

/**
 * Tax Categories - Ground Truth for AI Accountant
 *
 * Each category represents an official tax treatment rule.
 * The AI will use these as the "source of truth" for recommendations.
 */
export const TAX_CATEGORIES: TaxCategory[] = [
  {
    id: "office-equipment",
    label: "ציוד משרדי",
    vatPercentage: 1.0, // 100% VAT deductible
    incomeTaxRecognition: 1.0, // 100% recognized
    warning: "הוצאה מוכרת מלאה. כולל מחשבים, ריהוט משרדי, ציוד כתיבה ומכשירי משרד.",
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: [
      "מחשב",
      "מדפסת",
      "סורק",
      "דפים",
      "ציוד משרדי",
      "עט",
      "נייר",
      "מחברת",
      "ריהוט",
      "שולחן",
      "כסא",
      "מקלדת",
      "עכבר",
      "מסך",
      "computer",
      "printer",
      "desk",
      "chair",
      "office",
    ],
  },
  {
    id: "vehicle-fuel",
    label: "רכב ודלק",
    vatPercentage: 0.6667, // 2/3 rule (66.67%)
    incomeTaxRecognition: 0.45, // 45% rule
    warning:
      'לפי תקנות מס הכנסה (הוצאות רכב), מוכר 45% למס הכנסה ו-2/3 למע"מ ברכב פרטי/מסחרי עד 3.5 טון. החלק שאינו מוכר נחשב לשימוש פרטי.',
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/255_179.htm",
    matchKeywords: [
      "דלק",
      "סולר",
      "בנזין",
      "תדלוק",
      "פז",
      "דלק",
      "סונול",
      "דור אלון",
      "מוסך",
      "טיפול רכב",
      "שירות",
      "טסט",
      "ביטוח רכב",
      "ביטוח חובה",
      "ביטוח מקיף",
      "רישוי",
      "צמיגים",
      "fuel",
      "gas",
      "garage",
      "car",
      "vehicle",
    ],
  },
  {
    id: "business-meals",
    label: "אירוח עסקי וארוחות",
    vatPercentage: 1.0, // 100% if documented properly
    incomeTaxRecognition: 1.0, // 100% if business-related
    warning:
      'הוצאות אירוח עסקי מוכרות במלואן אם מתועדות כראוי (מי נפגש, מטרה עסקית). יש לשמור פירוט של המטרה העסקית. ארוחות עם לקוחות/ספקים מוכרות. ארוחות "סתם" במסעדה - לא מוכרות.',
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: [
      "מסעדה",
      "ארוחת עבודה",
      "פגישת לקוח",
      "אירוח",
      "קפה",
      "בית קפה",
      "ארוחה עסקית",
      "דיון עסקי",
      "restaurant",
      "coffee",
      "meeting",
      "lunch",
      "dinner",
      "cafe",
    ],
  },
  {
    id: "professional-services",
    label: "שירותים מקצועיים",
    vatPercentage: 1.0, // 100% VAT deductible
    incomeTaxRecognition: 1.0, // 100% recognized
    warning:
      "הוצאות עבור שירותים מקצועיים (עו״ד, רו״ח, יועצים) מוכרות במלואן. יש לוודא שהחשבונית כוללת מע״מ ושם הנותן השירות.",
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: [
      "עורך דין",
      "רואה חשבון",
      "ייעוץ משפטי",
      "ייעוץ עסקי",
      "יועץ",
      "רו״ח",
      "עו״ד",
      "משפטן",
      "בוקר",
      "lawyer",
      "accountant",
      "consultant",
      "legal",
      "advisory",
    ],
  },
  {
    id: "gifts",
    label: "מתנות עסקיות",
    vatPercentage: 0, // No VAT deduction for gifts
    incomeTaxRecognition: 1.0, // Recognized up to 210 NIS per recipient per year
    warning:
      "מתנות עסקיות: מע״מ אינו ניתן לקיזוז כלל. למס הכנסה מוכרת הוצאה עד 210 ₪ לנמען בשנה. מעל סכום זה ההוצאה לא תוכר.",
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/255_208.htm",
    matchKeywords: [
      "מתנה",
      "שי",
      "חג",
      "מארז",
      "מתנות",
      "שי ללקוח",
      "מתנה עסקית",
      "דורון",
      "gift",
      "present",
      "hamper",
    ],
  },
  {
    id: "communication",
    label: "תקשורת וטלפון",
    vatPercentage: 0.6667, // 2/3 rule
    incomeTaxRecognition: 1.0, // Usually 100% if reasonable
    warning:
      'נהוג לקזז 2/3 מע"מ על הוצאות סלולר (בהתאם להלכה הפסוקה). למס הכנסה ההוצאה מוכרת במלואה אם סבירה. יש לשמור חשבוניות.',
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: [
      "סלולר",
      "פלאפון",
      "פרטנר",
      "סלקום",
      "בזק",
      "אינטרנט",
      "חשבונית חודשית",
      "נייד",
      "טלפון",
      "hot mobile",
      "019",
      "phone",
      "cellular",
      "mobile",
      "internet",
      "telecom",
    ],
  },
  {
    id: "marketing",
    label: "שיווק ופרסום",
    vatPercentage: 1.0, // 100% if VAT invoice received
    incomeTaxRecognition: 1.0, // 100% recognized
    warning:
      'מוכר במלואן למס הכנסה. לגבי מע"מ - שים לב: חשבוניות פייסבוק/גוגל מחו"ל מגיעות לרוב ללא מע"מ ישראלי, ולכן אין לקזז בגינן מע"מ. פרסום מקומי (ישראל) כן כולל מע"מ.',
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: [
      "פייסבוק",
      "גוגל",
      "פרסום",
      "מודעה",
      "קידום",
      "שיווק דיגיטלי",
      "שיווק",
      "קמפיין",
      "facebook",
      "google",
      "ads",
      "advertising",
      "marketing",
      "campaign",
      "instagram",
      "tiktok",
      "linkedin",
    ],
  },
  {
    id: "rent",
    label: "שכר דירה משרדי",
    vatPercentage: 1.0, // 100% if commercial lease with VAT
    incomeTaxRecognition: 1.0, // 100% recognized
    warning:
      "שכר דירה משרדי מוכר במלואו. יש לוודא שהחוזה הוא לצורכי עסק (לא דירת מגורים). שכירות מסחרית לרוב כוללת מע״מ.",
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: [
      "שכר דירה",
      "שכירות",
      "משרד",
      "דמי שכירות",
      "חנות",
      "מסחרי",
      "rent",
      "lease",
      "office",
      "commercial",
    ],
  },
  {
    id: "software",
    label: "תוכנות ומנויים דיגיטליים (כללי)",
    vatPercentage: 1.0, // Usually no VAT (foreign services)
    incomeTaxRecognition: 1.0, // 100% recognized
    warning:
      'קטגוריה כללית לתוכנות ומנויים. למס הכנסה ההוצאה מוכרת במלואה. בחר קטגוריה ספציפית (מקומי/זר) לניכוי מע"מ מדויק.',
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: [
      "תוכנה",
      "מנוי",
      "subscription",
      "saas",
      "software",
      "cloud",
      "אפליקציה",
    ],
  },
  {
    id: "software-foreign",
    label: "תוכנות ומנויים דיגיטליים (זר)",
    vatPercentage: 0, // 0% VAT - Foreign/Eilat rule
    incomeTaxRecognition: 1.0, // 100% recognized
    warning:
      'מנויים זרים (SaaS מחו"ל) ללא מע"מ ישראלי לפי חוק. למס הכנסה ההוצאה מוכרת במלואה. דוגמאות: Adobe, Microsoft 365, Zoom, Slack, Dropbox, AWS.',
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: [
      "adobe",
      "microsoft",
      "zoom",
      "slack",
      "dropbox",
      "canva",
      "aws",
      "google cloud",
      "github",
      "netflix",
      "spotify",
      "stripe",
      "paypal",
      "foreign",
      "חו״ל",
      "זר",
    ],
  },
  {
    id: "software-local",
    label: "תוכנות ומנויים דיגיטליים (מקומי)",
    vatPercentage: 1.0, // 100% VAT deductible
    incomeTaxRecognition: 1.0, // 100% recognized
    warning:
      'מוצרי תוכנה מקומיים (ישראל) כוללים מע"מ 18% ולכן ניתן לנכות את המע"מ במלואו. למס הכנסה ההוצאה מוכרת במלואה.',
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: [
      "ישראלי",
      "מקומי",
      "ישראל",
      "local",
      "israel",
      "israeli",
    ],
  },
  {
    id: "insurance",
    label: "ביטוח עסקי",
    vatPercentage: 0, // Insurance is VAT-exempt
    incomeTaxRecognition: 1.0, // 100% recognized for business insurance
    warning:
      "ביטוח עסקי (אחריות מקצועית, ציוד, משרד) מוכר במלואו. ביטוחים פטורים ממע״מ לפי החוק. יש להבדיל מביטוח אישי (בריאות, חיים) שאינו מוכר.",
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: [
      "ביטוח",
      "אחריות מקצועית",
      "ביטוח עסקי",
      "ביטוח ציוד",
      "כלל ביטוח",
      "מגדל",
      "הראל",
      "insurance",
      "liability",
    ],
  },
  {
    id: "travel",
    label: "נסיעות עסקיות",
    vatPercentage: 1.0, // 100% if documented
    incomeTaxRecognition: 1.0, // 100% if business purpose
    warning:
      "נסיעות עסקיות מוכרות במלואן אם מתועדות (מטרה, מיקום, תאריכים). כולל: טיסות, מלונות, הסעות. יש לשמור אישורים על המטרה העסקית.",
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: [
      "טיסה",
      "מלון",
      "נסיעת עבודה",
      "כנס",
      "נסיעה",
      "לינה",
      "אירוח",
      "flight",
      "hotel",
      "travel",
      "conference",
      "airbnb",
      "booking",
    ],
  },
  {
    id: "education",
    label: "השתלמויות והכשרה",
    vatPercentage: 1.0, // 100% if invoiced with VAT
    incomeTaxRecognition: 1.0, // 100% if job-related
    warning:
      "קורסים והשתלמויות מקצועיות הקשורות לעסק מוכרים במלואן. יש לוודא שהקורס רלוונטי לתחום העיסוק.",
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: [
      "קורס",
      "השתלמות",
      "הכשרה",
      "לימודים",
      "סדנה",
      "הדרכה",
      "אקדמי",
      "course",
      "training",
      "workshop",
      "education",
      "seminar",
    ],
  },
  {
    id: "utilities",
    label: "חשמל ומים (משרד)",
    vatPercentage: 1.0, // 100% for business premises
    incomeTaxRecognition: 1.0, // 100% recognized
    warning:
      "הוצאות חשמל ומים למשרד עסקי מוכרות במלואן. אם המשרד בבית - יש לחלק לפי שטח יחסי.",
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: [
      "חשמל",
      "מים",
      "חברת חשמל",
      "מי ירושלים",
      "חשבון חשמל",
      "חשבון מים",
      "electricity",
      "water",
      "utilities",
    ],
  },
  {
    id: "other",
    label: "אחר",
    vatPercentage: 1.0, // Default: assume fully deductible
    incomeTaxRecognition: 1.0, // Default: assume fully recognized
    warning:
      "קטגוריה כללית להוצאות שאינן מוגדרות. מומלץ לתעד את המטרה העסקית ולהתייעץ עם רואה חשבון.",
    legalRefUrl: "https://www.nevo.co.il/law_html/law01/271_005.htm#med0",
    matchKeywords: ["אחר", "שונות", "כללי", "other", "misc", "general"],
  },
];

/**
 * Helper function to find category by ID
 */
export function getCategoryById(id: string): TaxCategory | undefined {
  return TAX_CATEGORIES.find((cat) => cat.id === id);
}

/**
 * Helper function to suggest category based on keywords
 * Returns the best matching category or null
 */
export function suggestCategory(description: string): TaxCategory | null {
  const descLower = description.toLowerCase();

  // Score each category by keyword matches
  const scores = TAX_CATEGORIES.map((category) => {
    const matchCount = category.matchKeywords.filter((keyword) =>
      descLower.includes(keyword.toLowerCase())
    ).length;
    return { category, score: matchCount };
  });

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Return best match if score > 0, otherwise null
  return scores[0].score > 0 ? scores[0].category : null;
}

/**
 * Helper function to get all category labels for dropdown
 */
export function getAllCategoryLabels(): Array<{ id: string; label: string }> {
  return TAX_CATEGORIES.map((cat) => ({ id: cat.id, label: cat.label }));
}
