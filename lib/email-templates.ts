/**
 * KLIGER Email Templates
 *
 * מקום מרכזי לניסוח כל המיילים שנשלחים מהמערכת.
 * משתנים בפורמט {clientName} / {fileList} וכו' — מוחלפים בזמן שליחה.
 */

export type TemplateCategory = "documents" | "reminders" | "ops";

export type TemplateId =
  | "documents_send"
  | "client_salary_cash"
  | "client_salary_transfer"
  | "client_scholarship_cash"
  | "client_scholarship_transfer"
  | "client_cash_check"
  | "advisor_reminder"
  | "client_primary"
  | "client_verify"
  | "advisor_primary_advisor_flow"
  | "advisor_verify"
  | "advisor_primary_client_flow"
  | "client_primary_advisor_flow"
  | "association_transfer"
  | "association_pending_digest"
  | "waiting_digest"
  | "advisor_file_uploaded"
  | "advisor_client_reply"
  | "advisor_snooze_due";

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
    label: "רשימת ההפקדות בטקסט",
    example: "אוקטובר 2026 — יוסי כהן — ₪1,000",
  },
  {
    key: "digestTable",
    label: "טבלת ההפקדות במייל",
    example: "כרטיס לכל הפקדה ממתינה",
  },
  {
    key: "queueLabel",
    label: "כלל ההמתנה של העמותה",
    example: "רק מה שסומן שולם וממתין לבוצע",
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
  {
    key: "payerPrompt",
    label: "בקשה לשם מעביר (רק כשיש עמותה)",
    example: "נא למלא בקישור את שם המעביר…",
  },
  {
    key: "payerName",
    label: "שם המעביר",
    example: "אברהם כהן",
  },
  {
    key: "clientMessage",
    label: "הודעת הלקוח",
    example: "העברתי היום מהחשבון של אבא",
  },
  {
    key: "followUpLine",
    label: "שורת תזכורת נוספת (ריקה בשליחה הראשונה)",
    example: "",
  },
  {
    key: "situationLabel",
    label: "תיאור המקרה ליועץ",
    example: "מילגה בהעברה לחשבון העמותה",
  },
  {
    key: "depositsLink",
    label: "קישור למסך הפקדות",
    example: "https://kliger.vercel.app/deposits",
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
    id: "client_salary_cash",
    label: "תלוש — לדאוג למזומן",
    description: "נשלח ללקוח כשההפקדה היא תלוש משכורת והוא צריך להכין מזומן",
    category: "reminders",
    audience: "client",
    variableKeys: V(
      "clientName",
      "amount",
      "targetDate",
      "uploadUrl",
      "followUpLine",
      "companyName",
      "advisorName",
      "advisorPhone"
    ),
  },
  {
    id: "client_salary_transfer",
    label: "תלוש — הפקדה לחשבון כמשכורת",
    description: "נשלח ללקוח כשההפקדה היא העברה מאמצעי פרטי, כפעולת משכורת",
    category: "reminders",
    audience: "client",
    variableKeys: V(
      "clientName",
      "amount",
      "targetDate",
      "uploadUrl",
      "followUpLine",
      "companyName",
      "advisorName",
      "advisorPhone"
    ),
  },
  {
    id: "client_scholarship_cash",
    label: "מילגה — להביא מזומן",
    description: "נשלח ללקוח כשמילגה מהכולל נמסרת במזומן, והוא צריך להביא אותו מראש",
    category: "reminders",
    audience: "client",
    variableKeys: V(
      "clientName",
      "amount",
      "targetDate",
      "uploadUrl",
      "followUpLine",
      "companyName",
      "advisorName",
      "advisorPhone"
    ),
  },
  {
    id: "client_scholarship_transfer",
    label: "מילגה — העברה לחשבון העמותה",
    description:
      "נשלח ללקוח כשהמילגה מועברת לחשבון העמותה, כולל שם מעביר אם הכסף יוצא מחשבון אחר",
    category: "reminders",
    audience: "client",
    variableKeys: V(
      "clientName",
      "amount",
      "targetDate",
      "associationName",
      "accountBlock",
      "payerPrompt",
      "uploadUrl",
      "followUpLine",
      "companyName",
      "advisorName",
      "advisorPhone"
    ),
  },
  {
    id: "client_cash_check",
    label: "הפקדה — מזומן או צ׳ק",
    description: "נשלח ללקוח כשהוא צריך לוודא שהפקיד מזומן או צ׳ק לחשבון",
    category: "reminders",
    audience: "client",
    variableKeys: V(
      "clientName",
      "amount",
      "targetDate",
      "uploadUrl",
      "followUpLine",
      "companyName",
      "advisorName",
      "advisorPhone"
    ),
  },
  {
    id: "advisor_reminder",
    label: "תזכורת ליועץ",
    description:
      "נשלח אליך לפני היעד, לכל סוגי ההפקדה. תזכורת נוספת אחרי היעד משתמשת באותו מכתב",
    category: "reminders",
    audience: "advisor",
    variableKeys: V(
      "advisorName",
      "clientName",
      "depositType",
      "situationLabel",
      "amount",
      "targetDate",
      "followUpLine",
      "depositsLink",
      "companyName"
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
    id: "association_pending_digest",
    label: "התראה מרוכזת לעמותה",
    description:
      "הטקסט שנשמר כאן הוא בדיוק המייל לעמותה. {digestTable} הוא כרטיס לכל הפקדה ממתינה.",
    category: "ops",
    audience: "association",
    variableKeys: V(
      "associationName",
      "itemCount",
      "queueLabel",
      "digestTable",
      "digestBody",
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
      "payerName",
      "clientMessage",
      "depositsLink",
      "remindersLink",
      "companyName"
    ),
  },
  {
    id: "advisor_client_reply",
    label: "התראה — תגובת לקוח",
    description:
      "נשלח אליך כשלקוח שולח הודעה או ממלא שם מעביר בקישור",
    category: "ops",
    audience: "advisor",
    variableKeys: V(
      "advisorName",
      "clientName",
      "depositType",
      "amount",
      "targetDate",
      "payerName",
      "clientMessage",
      "depositsLink",
      "companyName"
    ),
  },
  {
    id: "advisor_snooze_due",
    label: "התראה — תזכורת חזרה לטיפול",
    description: "נשלח אליך כשנגמר זמן ההמתנה שקבעת",
    category: "ops",
    audience: "advisor",
    variableKeys: V(
      "advisorName",
      "clientName",
      "depositType",
      "amount",
      "targetDate",
      "depositsLink",
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

  client_salary_cash: {
    subject: "תלוש משכורת — מזומן בסך {amount}",
    body: `לכבוד {clientName},

שלום,
עד {targetDate} יש לדאוג למזומן בסך {amount} עבור תלוש המשכורת.

אחרי שהמזומן הוכן, אפשר להעלות אסמכתא בקישור:
{uploadUrl}

{followUpLine}

אפשר גם להשיב ישירות למייל הזה.

בברכה,
{companyName}
{advisorName}
{advisorPhone}`,
  },

  client_salary_transfer: {
    subject: "הפקדה לחשבון כמשכורת — {amount}",
    body: `לכבוד {clientName},

שלום,
עד {targetDate} יש לדאוג להפקדה לחשבון בסך {amount}, כשהפעולה מסומנת כמשכורת.

אחרי ההפקדה, נא להעלות אסמכתא בקישור:
{uploadUrl}

{followUpLine}

אפשר גם להשיב ישירות למייל הזה.

בברכה,
{companyName}
{advisorName}
{advisorPhone}`,
  },

  client_scholarship_cash: {
    subject: "מילגה — מזומן בסך {amount}",
    body: `לכבוד {clientName},

שלום,
מילגה בסך {amount} אמורה להיכנס עד {targetDate}.
יש להביא את המזומן מראש.

אחרי שהמזומן הוכן, אפשר להעלות אסמכתא בקישור:
{uploadUrl}

{followUpLine}

אפשר גם להשיב ישירות למייל הזה.

בברכה,
{companyName}
{advisorName}
{advisorPhone}`,
  },

  client_scholarship_transfer: {
    subject: "מילגה — העברה לחשבון העמותה בסך {amount}",
    body: `לכבוד {clientName},

שלום,
עד {targetDate} יש להעביר מילגה בסך {amount} לחשבון העמותה {associationName}.
ההעברה יוצאת מחשבון אחר. אחרי שהיא בוצעה, נא למלא בקישור את שם המעביר — בעל החשבון שממנו יצא הכסף.

{accountBlock}

אחרי ההעברה, נא להעלות אסמכתא בקישור:
{uploadUrl}

{followUpLine}

אפשר גם להשיב ישירות למייל הזה.

בברכה,
{companyName}
{advisorName}
{advisorPhone}`,
  },

  client_cash_check: {
    subject: "הפקדה — מזומן או צ׳ק בסך {amount}",
    body: `לכבוד {clientName},

שלום,
נא לוודא שהופקד מזומן או צ׳ק בסך {amount} עד {targetDate}.

אחרי ההפקדה, אפשר להעלות אסמכתא בקישור:
{uploadUrl}

{followUpLine}

אפשר גם להשיב ישירות למייל הזה.

בברכה,
{companyName}
{advisorName}
{advisorPhone}`,
  },

  advisor_reminder: {
    subject: "תזכורת: {clientName} · {depositType} · {amount}",
    body: `לכבוד {advisorName},

תזכורת עבור {clientName}.
סוג: {depositType}
מה נדרש: {situationLabel}
סכום: {amount}
תאריך יעד: {targetDate}

{followUpLine}

למסך ההפקדות: {depositsLink}

בברכה,
{companyName}`,
  },

  client_primary: {
    subject: "תזכורת: {depositType} — {amount}",
    body: `לכבוד {clientName},

שלום,
נא להסדיר {depositType} בסך {amount} עד {targetDate}.
{accountBlock}

{payerPrompt}

בקישור אפשר להעלות אסמכתא (PDF, תמונה או כל קובץ אחר) ולשלוח הודעה:
{uploadUrl}

אפשר גם להשיב ישירות למייל הזה.

בברכה,
{companyName}
{advisorName}
{advisorPhone}`,
  },

  client_primary_advisor_flow: {
    subject: "תזכורת: {depositType} — {amount}",
    body: `לכבוד {clientName},

שלום,
לידיעתך, בתאריך {targetDate} יש יעד עבור {depositType} בסך {amount}.
{accountBlock}

{payerPrompt}

בקישור אפשר להעלות אסמכתא ולשלוח הודעה:
{uploadUrl}

אפשר גם להשיב ישירות למייל הזה.

בברכה,
{companyName}
{advisorName}
{advisorPhone}`,
  },

  client_verify: {
    subject: "תזכורת דחופה: {depositType} — {amount}",
    body: `לכבוד {clientName},

שלום,
טרם סומן שהוסדר {depositType} בסך {amount} (יעד {targetDate}).
{accountBlock}

{payerPrompt}

נא להעלות אסמכתא או לעדכן בקישור:
{uploadUrl}

אפשר גם להשיב ישירות למייל הזה.

בברכה,
{companyName}
{advisorName}
{advisorPhone}`,
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

  association_pending_digest: {
    subject: "הפקדות ממתינות לטיפול — {associationName} ({itemCount})",
    body: `לכבוד {associationName},

להלן {itemCount} הפקדות שממתינות לטיפולכם:

{digestTable}

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
    subject: "אסמכתא מהלקוח {clientName}",
    body: `לכבוד {advisorName},

הלקוח {clientName} העלה קובץ עבור {depositType} בסך {amount}.
תאריך יעד: {targetDate}
שם הקובץ: {fileName}
שם המעביר: {payerName}

הודעת הלקוח:
{clientMessage}

הקובץ מצורף למייל זה.
למסך ההפקדות: {depositsLink}

בברכה,
מערכת KLIGER`,
  },

  advisor_client_reply: {
    subject: "תגובה מהלקוח {clientName}",
    body: `לכבוד {advisorName},

התקבלה תגובה מהלקוח {clientName} עבור {depositType} בסך {amount}.
תאריך יעד: {targetDate}
שם המעביר: {payerName}

הודעת הלקוח:
{clientMessage}

למסך ההפקדות: {depositsLink}

בברכה,
מערכת KLIGER`,
  },

  advisor_snooze_due: {
    subject: "תזכורת חזרה לטיפול — {clientName}",
    body: `לכבוד {advisorName},

תזכורת עבור {clientName} חזרה לטיפול.
סוג: {depositType}
סכום: {amount}
תאריך יעד: {targetDate}

למסך ההפקדות: {depositsLink}

בברכה,
מערכת KLIGER`,
  },
};

/**
 * מיזוג תבניות של משתמש עם ברירות המחדל.
 */
/** נוסחים ישנים שנשמרו כמו שהיו מהמערכת — מוחלפים בברירת המחדל החדשה. */
const LEGACY_TEMPLATES: Partial<Record<TemplateId, Template[]>> = {
  association_pending_digest: [
    {
      subject: "הפקדות ממתינות לטיפול — {associationName} ({itemCount})",
      body: `לכבוד {associationName},

להלן {itemCount} הפקדות שממתינות לטיפולכם.
כלל השליחה: {queueLabel}.

חודש | מקבל | מעביר | סכום | סוג | תאריך יעד | בוצע | שולם
{digestBody}

בברכה,
{companyName}`,
    },
  ],
  client_primary: [
    {
      subject: "תזכורת: {depositType} — {amount}",
      body: `לכבוד {clientName},

{clientActionLine}.{accountBlock}

קישור להעלאת אסמכתא:
{uploadUrl}

בברכה,
{companyName}`,
    },
    {
      subject: "תזכורת: {depositType} — {amount}",
      body: `לכבוד {clientName},

שלום,
נא להסדיר {depositType} בסך {amount} עד {targetDate}.
{accountBlock}

{payerPrompt}

בקישור אפשר להעלות אסמכתא (PDF, תמונה או כל קובץ אחר), למלא שם מעביר ולשלוח הודעה:
{uploadUrl}

אפשר גם להשיב ישירות למייל הזה.

בברכה,
{companyName}
{advisorName}
{advisorPhone}`,
    },
  ],
  client_primary_advisor_flow: [
    {
      subject: "תזכורת: {depositType} — {amount}",
      body: `לכבוד {clientName},

{clientActionLine}.{accountBlock}

קישור להעלאת אסמכתא:
{uploadUrl}

בברכה,
{companyName}`,
    },
    {
      subject: "תזכורת: {depositType} — {amount}",
      body: `לכבוד {clientName},

שלום,
לידיעתך, בתאריך {targetDate} יש יעד עבור {depositType} בסך {amount}.
{accountBlock}

{payerPrompt}

בקישור אפשר להעלות אסמכתא, למלא שם מעביר ולשלוח הודעה:
{uploadUrl}

אפשר גם להשיב ישירות למייל הזה.

בברכה,
{companyName}
{advisorName}
{advisorPhone}`,
    },
  ],
  client_verify: [
    {
      subject: "תזכורת דחופה: {depositType} — {amount}",
      body: `לכבוד {clientName},

{clientActionLine}.{accountBlock}

נא להסדיר בהקדם. אם כבר בוצע — נא להעלות אסמכתא כאן:
{uploadUrl}

בברכה,
{companyName}`,
    },
  ],
  advisor_file_uploaded: [
    {
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
  ],
};

function sameTemplate(a: Template, b: Template): boolean {
  return a.subject.trim() === b.subject.trim() && a.body.trim() === b.body.trim();
}

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
      const legacy = LEGACY_TEMPLATES[meta.id];
      if (legacy?.some((item) => sameTemplate(override, item))) continue;
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
