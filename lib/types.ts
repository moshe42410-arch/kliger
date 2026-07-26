import type {
  DepositType,
  DepositResponsibility,
  ReminderRecipient,
  ReminderChannel,
  ReminderStatus,
  ReminderPhase,
} from "./db";

export type {
  DepositType,
  DepositResponsibility,
  ReminderRecipient,
  ReminderChannel,
  ReminderStatus,
  ReminderPhase,
};

export const depositTypeLabel: Record<DepositType, string> = {
  salary_slip: "תלוש משכורת",
  kollel_scholarship: "מילגה מכולל",
  private_transfer: "העברה מאמצעי פרטי (משכורת)",
  cash_check: "מזומן / צ׳ק",
};

export const depositTypeShortLabel: Record<DepositType, string> = {
  salary_slip: "תלוש",
  kollel_scholarship: "מילגה",
  private_transfer: "העברה פרטית",
  cash_check: "מזומן/צ׳ק",
};

export const responsibilityLabel: Record<DepositResponsibility, string> = {
  advisor: "באחריות היועץ",
  client: "באחריות הלקוח",
};

export const reminderRecipientLabel: Record<ReminderRecipient, string> = {
  advisor: "יועץ",
  client: "לקוח",
  both: "יועץ ולקוח",
};

export const reminderPhaseLabel: Record<ReminderPhase, string> = {
  primary: "תזכורת לביצוע",
  verify_payment: "אימות תשלום",
};

export const reminderChannelLabel: Record<ReminderChannel, string> = {
  email: "מייל",
  phone: "טלפון",
  both: "טלפון ומייל",
};

export const reminderStatusLabel: Record<ReminderStatus, string> = {
  waiting_client: "ממתין ללקוח",
  waiting_advisor: "ממתין לטיפול יועץ",
  waiting_association: "ממתין לטיפול עמותה",
  snoozed: "בהמתנה",
  resolved: "טופל",
  carried_over: "ממתין מחודש קודם",
};

/**
 * טקסט הסבר קצר לכל סוג הפקדה — משמש ב-UI ובתבניות המייל.
 */
export const depositTypeDescription: Record<DepositType, string> = {
  salary_slip: "היועץ מפיק תלוש משכורת ללקוח והלקוח מעביר עבור זה תשלום.",
  kollel_scholarship:
    "הכולל / המוסד משלם מילגה. הלקוח צריך להעביר תשלום ליועץ / לעמותה עבור החזר או השלמה.",
  private_transfer:
    "משכורת מאמצעי פרטי שהלקוח מעביר אליך או ישירות לעמותה.",
  cash_check:
    "הלקוח מפקיד בעצמו מזומן / צ׳ק בחשבון ומעלה עובר-ושב כאסמכתא.",
};

/**
 * כברירת מחדל — לפי סוג ההפקדה מוצע responsibility מתאים.
 * הלקוח יכול לשנות בטופס.
 */
export const defaultResponsibilityFor: Record<
  DepositType,
  DepositResponsibility
> = {
  salary_slip: "advisor",
  kollel_scholarship: "advisor",
  private_transfer: "advisor",
  cash_check: "client",
};
