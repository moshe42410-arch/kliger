/**
 * Bucketing deposits by monthly documentation — shared by dashboard + deposits tab.
 */
import type { Deposit, Reminder } from "./db";
import { depositRequiresPayment } from "./types";

export type DepositDocBucket = "pending" | "done" | "paid" | "archive";

export function depositDocBucket(
  depositType: Deposit["depositType"],
  rem: Reminder | null | undefined
): DepositDocBucket {
  if (!rem) return "pending";
  const action = !!rem.actionDoneAt;
  const paid = !!(rem.paymentDoneAt || rem.paidAt);
  const needsPay = depositRequiresPayment(depositType);
  if (!needsPay) {
    return action ? "archive" : "pending";
  }
  if (action && paid) return "archive";
  if (action && !paid) return "done";
  if (!action && paid) return "paid";
  return "pending";
}

export function isDepositDocComplete(
  depositType: Deposit["depositType"],
  rem: Reminder | null | undefined
): boolean {
  return depositDocBucket(depositType, rem) === "archive";
}
