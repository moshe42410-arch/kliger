export type AssociationHandlingQueue = "paid" | "both";

/** ערכים ישנים נשמרים במסד: done → paid, unpaid → both. */
export function parseHandlingQueue(value: unknown): AssociationHandlingQueue {
  if (value === "both" || value === "unpaid") return "both";
  return "paid";
}

export function handlingQueueLabel(queue: AssociationHandlingQueue): string {
  return queue === "both"
    ? "ממתינים גם לשולם וגם לבוצע"
    : "רק מה שסומן שולם וממתין לבוצע";
}

export function associationQueueHint(queue: AssociationHandlingQueue): string {
  return queue === "both"
    ? "נשלח מה שעדיין לא סומן שולם ולא בוצע"
    : "נשלח רק מה שסומן שולם ועדיין לא בוצע";
}
