/**
 * KLIGER Email Templates
 *
 * מקום מרכזי לניסוח כל המיילים שנשלחים מהמערכת.
 * משתנים בפורמט {clientName} / {fileList} וכו' — מוחלפים בזמן שליחה.
 */

export type TemplateCategory = "documents" | "reminders" | "ops";

export type TemplateId =
  | "documents_send"
  | "client_primary"
  | "client_verify"
  | "advisor_primary_advisor_flow"
  | "advisor_verify"
  | "advisor_primary_client_flow"
  | "client_primary_advisor_flow"
  | "association_transfer"
  | "waiting_digest"
  | "advisor_file_uploaded";

export interface Template {
  subject: string;
  body: string;
}

export interface TemplateMeta {
  id: TemplateId;
  label: string;
  description: string;
  category: TemplateCategory;
  audience: "client" | "advisor" | "association" | "other";
  variableKeys: string[];
}

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  documents: "מסמכי לקוח",
  reminders: "תזכורות הפקדות",
  ops: "התראות מערכת",
};

export interface TemplateVar {
  key: string;
  label: string;
  example: string;
}

export const TEMPLATE_VARIABLES: TemplateVar[] = [
  { key: "recipientName", label: "שם הנמען", example: "רות קליין" },
  { key: "clientName", label: "שם הלקוח", example: "יוסי כהן" },
  { key: "nationalId", label: "מ.ז לקוח", example: "012345678" },
  { key: "advisorName", label: "שם היועץ", example: "משה קליגר" },
  { key: "companyName", label: "שם החברה", example: "קליגר ייעוץ" },
  { key: "amount", label: "סכום", example: "₪12,500" },
  { key: "targetDate", label: "תאריך יעד", example: "15/09/2026" },
  { key: "depositType", label: "סוג ההפקדה", example: "תלוש שכר" },
  {
    key: "clientActionLine",
    label: "משפט פעולה ללקוח",
    example: "יש לדאוג בהקדם למזומן בסך ₪1,000…",
  },
  {
    key: "deliveryMethod",
    label: "אופן מילגה",
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
    label: "פרטי חשבון",
    example: "מס' חשבון: 12345…",
  },
  { key: "advisorPhone", label: "טלפון היועץ", example: "052-7144445" },
  { key: "daysLate", label: "ימי איחור", example: "3" },
  {
    key: "fileList",
    label: "רשימת קבצים (שורה לכל קובץ)",
    example: "מצורף דוח תוצאות עיון.pdf",
  },
  {
    key: "fileNames",
    label: "שמות קבצים (מופרדים בפסיק)",
    example: "דוח עיון.pdf, חוזה.pdf",
  },
  { key: "fileCount", label: "מספר קבצים", example: "1" },
  { key: "fileName", label: "שם קובץ בודד", example: "עובר ושב.pdf" },
  { key: "itemCount", label: "מספר פריטים בסיכום", example: "5" },
  {
    key: "digestBody",
    label: "גוף סיכום ממתינים",
    example: "ממתינים לביצוע פעולה (2):\n• …",
  },
  {
    key: "remindersLink",
    label: "קישור לתזכורות",
    example: "https://kliger.vercel.app/reminders",
  },
  {
    key: "clientEmail",
    label: "מייל הלקוח",
    example: "client@example.com",
  },
  {
    key: "clientPhone",
    label: "טלפון הלקוח",
    example: "050-0000000",
  },
];

const V = (...keys: string[]) => keys;

/**
 * מטא־מידע עבור מסך ניסוח המיילים.
 */
export const TEMPLATE_META: TemplateMeta[] = [
  {
    id: "documents_send",
    label: "שליחת מסמכים ללקוח / אנשי קשר",
    description:
      "נשלח מדף תיק הלקוח כשבוחרים קבצים ולוחצים «שלח במייל»",
    category: "documents",
    audience: "client",
    variableKeys: V(
      "recipientName",
      "clientName",
      "nationalId",
      "fileList",
      "fileNames",
      "fileCount",
      "companyName",
      "advisorName"
    ),
  },
  {
    id: "client_primary",
    label: "תזכורת ראשונית ללקוח",
    description:
      "נשלח ללקוח לפני תאריך יעד כשהאחריות עליו (מזומן / צ׳ק / העברה)",
    category: "reminders",
    audience: "client",
    variableKeys: V(
      "clientName",
      "clientActionLine",
      "accountBlock",
      "uploadUrl",
      "companyName",
      "amount",
      "depositType",
      "targetDate"
    ),
  },
  {
    id: "client_primary_advisor_flow",
    label: "עדכון ללקוח על יעד מתקרב",
    description: "נשלח ללקוח כשהאחריות היא של היועץ (תלוש / מלגה / העברה)",
    category: "reminders",
    audience: "client",
    variableKeys: V(
      "clientName",
      "clientActionLine",
      "accountBlock",
      "uploadUrl",
      "companyName",
      "amount",
      "depositType",
      "targetDate"
    ),
  },
  {
    id: "client_verify",
    label: "תזכורת דחופה ללקוח (איחור)",
    description: "אסקלציה — כשהיועץ לא סימן ׳שולם׳ אחרי X ימים",
    category: "reminders",
    audience: "client",
    variableKeys: V(
      "clientName",
      "clientActionLine",
      "accountBlock",
      "uploadUrl",
      "companyName",
      "amount",
      "depositType"
    ),
  },
  {
    id: "advisor_primary_advisor_flow",
    label: "התראה ליועץ — פעולה נדרשת",
    description: "מזכיר לך שיש לבצע פעולה (תלוש / מלגה) לפני היעד",
    category: "reminders",
    audience: "advisor",
    variableKeys: V(
      "advisorName",
      "clientName",
      "depositType",
      "amount",
      "targetDate"
    ),
  },
  {
    id: "advisor_primary_client_flow",
    label: "עדכון ליועץ — מעקב לקוח",
    description: "מודיע לך שהלקוח אמור להפקיד עד היעד",
    category: "reminders",
    audience: "advisor",
    variableKeys: V(
      "advisorName",
      "clientName",
      "depositType",
      "amount",
      "targetDate"
    ),
  },
  {
    id: "advisor_verify",
    label: "התראה ליועץ — לאמת תשלום",
    description: "מזכיר לך לוודא שהלקוח שילם עבור פעולה שביצעת",
    category: "reminders",
    audience: "advisor",
    variableKeys: V(
      "advisorName",
      "clientName",
      "depositType",
      "amount",
      "targetDate"
    ),
  },
  {
    id: "association_transfer",
    label: "העברת אסמכתה לעמותה",
    description: "נשלח לעמותה עם קבצים שהלקוח העלה",
    category: "ops",
    audience: "association",
    variableKeys: V(
      "associationName",
      "clientName",
      "depositType",
      "amount",
      "targetDate",
      "fileCount",
      "clientEmail",
      "clientPhone",
      "companyName"
    ),
  },
  {
    id: "waiting_digest",
    label: "סיכום יומי — ממתינים",
    description: "מייל סיכום יומי ליועץ עם רשימת תזכורות ממתינות",
    category: "ops",
    audience: "advisor",
    variableKeys: V(
      "advisorName",
      "itemCount",
      "digestBody",
      "remindersLink",
      "companyName"
    ),
  },
  {
    id: "advisor_file_uploaded",
    label: "התראה — לקוח העלה קובץ",
    description: "נשלח ליועץ כשלקוח מעלה עובר־ושב / אסמכתא",
    category: "ops",
    audience: "advisor",
    variableKeys: V(
      "advisorName",
      "clientName",
      "depositType",
      "amount",
      "targetDate",
      "fileName",
      "remindersLink",
      "companyName"
    ),
  },
];

/* -------- ברירות מחדל -------- */

export const DEFAULT_TEMPLATES: Record<TemplateId, Template> = {
  documents_send: {
    subject: "מסמכים עבור {clientName} · מ.ז {nationalId}",
    body: `לכבוד {recipientName},

מ.ז {nationalId}

מצורף:
{fileList}

בברכה,
{companyName}`,
  },

  client_primary: {
    subject: "תזכורת: {depositType} — {amount}",
    body: `לכבוד {clientName},

{clientActionLine}.{accountBlock}

קישור להעלאת אסמכתא:
{uploadUrl}

בברכה,
{companyName}`,
  },

  client_primary_advisor_flow: {
    subject: "תזכורת: {depositType} — {amount}",
    body: `לכבוד {clientName},

{clientActionLine}.{accountBlock}

קישור להעלאת אסמכתא:
{uploadUrl}

בברכה,
{companyName}`,
  },

  client_verify: {
    subject: "תזכורת דחופה: {depositType} — {amount}",
    body: `לכבוד {clientName},

{clientActionLine}.{accountBlock}

נא להסדיר בהקדם. אם כבר בוצע — נא להעלות אסמכתא כאן:
{uploadUrl}

בברכה,
{companyName}`,
  },

  advisor_primary_advisor_flow: {
    subject: "{depositType} מתקרב — {clientName} · {amount} · {targetDate}",
    body: `לכבוד {advisorName},

בתאריך {targetDate} מתקרב יעד ל-{depositType} עבור {clientName} בסכום {amount}.
נא לבצע את הפעולה הנדרשת (הפקת תלוש / העברת מילגה / ביצוע העברה) בזמן.
לאחר תאריך היעד, המערכת תזכיר לך לוודא שהלקוח שילם עבור זה.

בברכה,
מערכת KLIGER`,
  },

  advisor_primary_client_flow: {
    subject: "מעקב: {clientName} · {depositType} עד {targetDate}",
    body: `לכבוד {advisorName},

הלקוח {clientName} אמור להסדיר {depositType} בסך {amount} עד לתאריך {targetDate}.
ניתן לשלוח לו תזכורת ידנית ממסך התזכורות.

בברכה,
מערכת KLIGER`,
  },

  advisor_verify: {
    subject: "אימות תשלום — {clientName} · {depositType} · {amount}",
    body: `לכבוד {advisorName},

בתאריך {targetDate} היה יעד של {depositType} עבור {clientName} בסכום {amount}.
נא לסמן במערכת אם הפעולה בוצעה ואם התשלום התקבל.

בברכה,
מערכת KLIGER`,
  },

  association_transfer: {
    subject: "העברת אסמכתה לטיפול עמותה - {clientName}",
    body: `לכבוד {associationName},

מצורפת אסמכתה שהתקבלה מהלקוח {clientName} עבור הפקדה מסוג {depositType}.
סכום: {amount}
תאריך יעד: {targetDate}
{clientEmail}
{clientPhone}

מצורפים {fileCount} קבצים שהלקוח העלה.

בברכה,
{companyName}`,
  },

  waiting_digest: {
    subject: "סיכום ממתינים — {itemCount} פריטים",
    body: `לכבוד {advisorName},

סיכום יומי של תזכורות ממתינות ({itemCount}):

{digestBody}

למעבר ללשונית תזכורות: {remindersLink}

בברכה,
מערכת KLIGER`,
  },

  advisor_file_uploaded: {
    subject: "עובר-ושב מהלקוח {clientName}",
    body: `לכבוד {advisorName},

הלקוח {clientName} העלה קובץ עבור {depositType}.
תאריך יעד: {targetDate}
סכום: {amount}
שם הקובץ: {fileName}

למעבר לתזכורות: {remindersLink}

בברכה,
מערכת KLIGER`,
  },
};

/**
 * מיזוג תבניות של משתמש עם ברירות המחדל.
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

export function renderTemplate(tpl: Template, vars: TemplateVars): Template {
  return {
    subject: renderString(tpl.subject, vars),
    body: renderString(tpl.body, vars),
  };
}

export function renderString(str: string, vars: TemplateVars): string {
  let out = str.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === null || v === undefined) return "";
    return String(v);
  });
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

/** בונה שורות «מצורף שם-קובץ» לרשימת מסמכים */
export function buildAttachedFileList(filenames: string[]): string {
  if (filenames.length === 0) return "";
  return filenames.map((n) => `מצורף ${n}`).join("\n");
}

export type DocumentsSendOptions = {
  includeLogo: boolean;
  /** אם מוגדר — משמש כברירת מחדל לשם הנמען (אחרת שם הלקוח) */
  recipientNameDefault: string;
};

export const DEFAULT_DOCUMENTS_SEND_OPTIONS: DocumentsSendOptions = {
  includeLogo: true,
  recipientNameDefault: "",
};

export function getDocumentsSendOptions(
  userTemplates: Record<string, unknown> | null | undefined
): DocumentsSendOptions {
  const raw = userTemplates?.documents_send_options as
    | Partial<DocumentsSendOptions>
    | undefined;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_DOCUMENTS_SEND_OPTIONS };
  return {
    includeLogo:
      typeof raw.includeLogo === "boolean"
        ? raw.includeLogo
        : DEFAULT_DOCUMENTS_SEND_OPTIONS.includeLogo,
    recipientNameDefault:
      typeof raw.recipientNameDefault === "string"
        ? raw.recipientNameDefault
        : "",
  };
}

export function variablesForTemplate(id: TemplateId): TemplateVar[] {
  const meta = TEMPLATE_META.find((m) => m.id === id);
  if (!meta) return TEMPLATE_VARIABLES;
  const set = new Set(meta.variableKeys);
  return TEMPLATE_VARIABLES.filter((v) => set.has(v.key));
}
