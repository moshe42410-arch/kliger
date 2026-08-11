/**
 * KLIGER Email Templates
 *
 * מנוע תבניות פשוט לניסוח מיילים אישי:
 * — מכיל 6 תבניות ברירת־מחדל (client_primary, client_verify, advisor_primary,
 *   advisor_verify, client_primary_advisor_flow, advisor_primary_advisor_flow).
 * — כל תבנית מכילה subject + body עם משתנים בפורמט {clientName} / {amount} וכו'.
 * — המשתמש יכול לדרוס כל תבנית בהגדרות. אם לא — משתמשים בברירת המחדל.
 * — הרינדור נעשה בזמן שליחה (`renderTemplate`).
 */

export type TemplateId =
  | "client_primary" // תזכורת ראשונית ללקוח (responsibility=client, לפני יעד)
  | "client_verify" // תזכורת דחופה ללקוח אחרי איחור (responsibility=advisor, אחרי יעד)
  | "advisor_primary_advisor_flow" // ליועץ, כשהאחריות שלו: "בצע פעולה"
  | "advisor_verify" // ליועץ, לוודא שהלקוח שילם (responsibility=advisor, אחרי יעד)
  | "advisor_primary_client_flow" // ליועץ, מעקב: "הלקוח אמור להפקיד"
  | "client_primary_advisor_flow"; // ללקוח, כשהאחריות של היועץ להפיק: "יעד מתקרב"

export interface Template {
  subject: string;
  body: string;
}

export interface TemplateMeta {
  id: TemplateId;
  label: string;
  description: string;
  audience: "client" | "advisor";
  hasUploadUrl: boolean;
}

/**
 * מטא־מידע עבור המסך של המשתמש.
 */
export const TEMPLATE_META: TemplateMeta[] = [
  {
    id: "client_primary",
    label: "תזכורת ראשונית ללקוח",
    description:
      "נשלח ללקוח לפני תאריך יעד כשהאחריות עליו (מזומן / צ׳ק / העברה)",
    audience: "client",
    hasUploadUrl: true,
  },
  {
    id: "client_primary_advisor_flow",
    label: "עדכון ללקוח על יעד מתקרב",
    description: "נשלח ללקוח כשהאחריות היא של היועץ (תלוש / מלגה / העברה)",
    audience: "client",
    hasUploadUrl: true,
  },
  {
    id: "client_verify",
    label: "תזכורת דחופה ללקוח (איחור)",
    description: "אסקלציה — כשהיועץ לא סימן ׳שולם׳ אחרי X ימים",
    audience: "client",
    hasUploadUrl: true,
  },
  {
    id: "advisor_primary_advisor_flow",
    label: "התראה ליועץ — פעולה נדרשת",
    description: "מזכיר לך שיש לבצע פעולה (תלוש / מלגה) לפני היעד",
    audience: "advisor",
    hasUploadUrl: false,
  },
  {
    id: "advisor_primary_client_flow",
    label: "עדכון ליועץ — מעקב לקוח",
    description: "מודיע לך שהלקוח אמור להפקיד עד היעד",
    audience: "advisor",
    hasUploadUrl: false,
  },
  {
    id: "advisor_verify",
    label: "התראה ליועץ — לאמת תשלום",
    description: "מזכיר לך לוודא שהלקוח שילם עבור פעולה שביצעת",
    audience: "advisor",
    hasUploadUrl: false,
  },
];

/**
 * המשתנים הזמינים לשימוש בתבניות (יופיעו ב-UI כ-chips).
 */
export interface TemplateVar {
  key: string;
  label: string;
  example: string;
}

export const TEMPLATE_VARIABLES: TemplateVar[] = [
  { key: "clientName", label: "שם הלקוח", example: "יוסי כהן" },
  { key: "advisorName", label: "שם היועץ", example: "משה קליגר" },
  { key: "companyName", label: "שם החברה", example: "קליגר ייעוץ" },
  { key: "amount", label: "סכום", example: "₪12,500" },
  { key: "targetDate", label: "תאריך יעד", example: "15/09/2026" },
  { key: "depositType", label: "סוג ההפקדה", example: "תלוש שכר" },
  {
    key: "clientActionLine",
    label: "משפט פעולה ללקוח",
    example: "יש לדאוג בהקדם למזומן בסך ₪1,000 עבור תלוש…",
  },
  {
    key: "deliveryMethod",
    label: "אופן מילגה (מזומן/העברה)",
    example: "מזומן",
  },
  {
    key: "timingPhrase",
    label: "שנכנס / שעתיד להיכנס",
    example: "שעתיד להיכנס",
  },
  {
    key: "uploadUrl",
    label: "קישור להעלאת אסמכתא",
    example: "https://kliger.co.il/upload/…",
  },
  { key: "associationName", label: "שם העמותה", example: "עמותה לדוגמה" },
  {
    key: "accountBlock",
    label: "פרטי חשבון (אם עמותה)",
    example: "מס' חשבון: 12345…",
  },
  { key: "advisorPhone", label: "טלפון היועץ", example: "052-7144445" },
  { key: "daysLate", label: "ימי איחור", example: "3" },
];

/* -------- ברירות מחדל -------- */

export const DEFAULT_TEMPLATES: Record<TemplateId, Template> = {
  client_primary: {
    subject: "תזכורת: {depositType} — {amount}",
    body: `לקוח יקר {clientName},

{clientActionLine}.{accountBlock}

קישור להעלאת אסמכתא:
{uploadUrl}

בברכה,
{companyName}`,
  },

  client_primary_advisor_flow: {
    subject: "תזכורת: {depositType} — {amount}",
    body: `לקוח יקר {clientName},

{clientActionLine}.{accountBlock}

קישור להעלאת אסמכתא:
{uploadUrl}

בברכה,
{companyName}`,
  },

  client_verify: {
    subject: "תזכורת דחופה: {depositType} — {amount}",
    body: `לקוח יקר {clientName},

{clientActionLine}.{accountBlock}

נא להסדיר בהקדם. אם כבר בוצע — נא להעלות אסמכתא כאן:
{uploadUrl}

בברכה,
{companyName}`,
  },

  advisor_primary_advisor_flow: {
    subject: "{depositType} מתקרב — {clientName} · {amount} · {targetDate}",
    body: `שלום {advisorName},

בתאריך {targetDate} מתקרב יעד ל-{depositType} עבור {clientName} בסכום {amount}.
נא לבצע את הפעולה הנדרשת (הפקת תלוש / העברת מילגה / ביצוע העברה) בזמן.
לאחר תאריך היעד, המערכת תזכיר לך לוודא שהלקוח שילם עבור זה.

בברכה,
מערכת KLIGER`,
  },

  advisor_primary_client_flow: {
    subject: "מעקב: {clientName} · {depositType} עד {targetDate}",
    body: `שלום {advisorName},

הלקוח {clientName} אמור להסדיר {depositType} בסך {amount} עד לתאריך {targetDate}.
ניתן לשלוח לו תזכורת ידנית ממסך התזכורות.

בברכה,
מערכת KLIGER`,
  },

  advisor_verify: {
    subject: "אימות תשלום — {clientName} · {depositType} · {amount}",
    body: `שלום {advisorName},

בתאריך {targetDate} היה יעד של {depositType} עבור {clientName} בסכום {amount}.
נא לסמן במערכת אם הפעולה בוצעה ואם התשלום התקבל.

בברכה,
מערכת KLIGER`,
  },
};

/**
 * מיזוג תבניות של משתמש עם ברירות המחדל: כל מפתח שהמשתמש
 * לא הגדיר — נופל לברירת המחדל.
 */
export function mergeTemplates(
  userTemplates: Record<string, { subject: string; body: string }> | null
): Record<TemplateId, Template> {
  const result = { ...DEFAULT_TEMPLATES };
  if (!userTemplates) return result;
  for (const meta of TEMPLATE_META) {
    const override = userTemplates[meta.id];
    if (
      override &&
      typeof override.subject === "string" &&
      typeof override.body === "string"
    ) {
      result[meta.id] = {
        subject: override.subject,
        body: override.body,
      };
    }
  }
  return result;
}

export type TemplateVars = Partial<Record<string, string | number | null>>;

/**
 * מרנדר תבנית — מחליף {key} בערך של vars[key]. אם המשתנה ריק/חסר,
 * הוא פשוט מוחלף במחרוזת ריקה (או ב-fallback אם ניתן).
 * "accountBlock" מיוחד — אם ריק, גם השורה הקודמת (רווח לפניו) מקוצצת.
 */
export function renderTemplate(tpl: Template, vars: TemplateVars): Template {
  return {
    subject: renderString(tpl.subject, vars),
    body: renderString(tpl.body, vars),
  };
}

function renderString(str: string, vars: TemplateVars): string {
  let out = str.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === null || v === undefined) return "";
    return String(v);
  });
  // ניקוי שורות ריקות מרובות שנוצרו ממשתנים ריקים
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}
