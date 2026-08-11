import type { DepositType, Reminder, ReminderStatus } from "@/lib/db";
import { depositRequiresPayment } from "@/lib/types";

/** תיעוד הושלם: בוצע (+ שולם אם נדרש) */
export function isReminderDocComplete(
  reminder: Pick<Reminder, "actionDoneAt" | "paymentDoneAt" | "paidAt">,
  depositType: DepositType | null | undefined
): boolean {
  const actionDone = !!reminder.actionDoneAt;
  if (!actionDone) return false;
  if (!depositType || !depositRequiresPayment(depositType)) return true;
  return !!(reminder.paymentDoneAt || reminder.paidAt);
}

/**
 * סטטוס נגזר מתיעוד (בוצע / שולם):
 * - טופל: בוצע וגם שולם (או בוצע בלבד כשאין תשלום)
 * - ממתין ליועץ: לא בוצע
 * - ממתין ללקוח: בוצע אך לא שולם (רק בסוגים עם תשלום)
 *
 * כשלא בוצע ולא שולם — הסטטוס הנשמר הוא waiting_advisor,
 * אבל בלשוניות ה-UI הפריט יופיע גם ב«ממתין ללקוח» (סינון לפי דגלים).
 */
export function deriveReminderStatusFromDocs(
  reminder: Pick<
    Reminder,
    "actionDoneAt" | "paymentDoneAt" | "paidAt" | "status"
  >,
  depositType: DepositType | null | undefined
): ReminderStatus {
  // אל תשנה מצבי תהליך מיוחדים עד שהתיעוד הושלם
  if (
    reminder.status === "snoozed" ||
    reminder.status === "waiting_association"
  ) {
    if (isReminderDocComplete(reminder, depositType)) return "resolved";
    return reminder.status;
  }

  if (isReminderDocComplete(reminder, depositType)) return "resolved";

  const actionDone = !!reminder.actionDoneAt;
  const paid = !!(reminder.paymentDoneAt || reminder.paidAt);
  const needsPay = !!depositType && depositRequiresPayment(depositType);

  if (!actionDone) return "waiting_advisor";
  if (needsPay && !paid) return "waiting_client";
  return "waiting_advisor";
}

/**
 * האם תזכורת שייכת ללשונית — לפי תיעוד, לא רק לפי עמודת status.
 * ממתין ללקוח = לא שולם (גם אם לא בוצע)
 * ממתין ליועץ = לא בוצע
 * טופל = תיעוד מלא
 * אותו פריט יכול להופיע גם בלקוח וגם ביועץ כששני הדגלים פתוחים.
 */
export function reminderMatchesInboxTab(
  reminder: Reminder,
  depositType: DepositType | null | undefined,
  tab: ReminderStatus
): boolean {
  const actionDone = !!reminder.actionDoneAt;
  const paid = !!(reminder.paymentDoneAt || reminder.paidAt);
  const needsPay = !!depositType && depositRequiresPayment(depositType);
  const complete = isReminderDocComplete(reminder, depositType);

  if (tab === "resolved") {
    return complete || reminder.status === "resolved";
  }

  if (tab === "snoozed") return reminder.status === "snoozed" && !complete;
  if (tab === "waiting_association") {
    return reminder.status === "waiting_association" && !complete;
  }
  if (tab === "carried_over") {
    return reminder.status === "carried_over" && !complete;
  }

  if (complete) return false;

  // מצבי תהליך מיוחדים — לא נספרים בלשוניות ההמתנה הרגילות
  if (
    reminder.status === "snoozed" ||
    reminder.status === "waiting_association"
  ) {
    return false;
  }

  if (tab === "waiting_client") {
    // רק כשנדרש תשלום ועדיין לא שולם
    if (!needsPay) return false;
    return !paid;
  }

  if (tab === "waiting_advisor") {
    return !actionDone;
  }

  return reminder.status === tab;
}
