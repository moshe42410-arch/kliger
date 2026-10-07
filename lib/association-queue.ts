export type AssociationHandlingQueue = "done" | "unpaid";

export function parseHandlingQueue(value: unknown): AssociationHandlingQueue {
  return value === "unpaid" ? "unpaid" : "done";
}

export function handlingQueueLabel(queue: AssociationHandlingQueue): string {
  return queue === "unpaid"
    ? "גם מה שממתין לסימון שולם"
    : "רק מה שסומן בוצע";
}

export function associationQueueHint(queue: AssociationHandlingQueue): string {
  return queue === "unpaid"
    ? "נשלח גם מה שעדיין לא סומן כשולם"
    : "נשלח רק מה שסומן בוצע ועדיין לא שולם";
}
