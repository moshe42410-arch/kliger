/**
 * Choose which monthly primary reminder is "תיעוד החודש" for a deposit.
 * After the deposit day has passed, that month stays the active doc month
 * until it is fully archived — we must not drop it on refresh.
 */
import { parseISO, startOfDay } from "date-fns";
import type { Deposit, Reminder } from "./db";
import { monthBucketOf } from "./db";
import { isDepositDocComplete } from "./deposit-doc-buckets";

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function occInMonth(dayOfMonth: number, year: number, monthIndex: number): Date {
  const dim = daysInMonth(year, monthIndex + 1);
  return startOfDay(new Date(year, monthIndex, Math.min(dayOfMonth, dim)));
}

/** Latest deposit occurrence on/before today, else the next upcoming one. */
export function documentationOccurrenceDate(
  deposit: Deposit,
  now: Date = new Date()
): Date | null {
  const startDay = startOfDay(
    deposit.startDate ? parseISO(deposit.startDate) : now
  );
  const endDay = deposit.endDate ? startOfDay(parseISO(deposit.endDate)) : null;
  const nowDay = startOfDay(now);

  let bestPast: Date | null = null;
  let bestFuture: Date | null = null;

  for (let i = -3; i <= 3; i++) {
    const m = now.getMonth() + i;
    const y = now.getFullYear() + Math.floor(m / 12);
    const monthIndex = ((m % 12) + 12) % 12;
    const occ = occInMonth(deposit.dayOfMonth, y, monthIndex);
    if (occ < startDay) continue;
    if (endDay && occ > endDay) continue;
    if (occ.getTime() <= nowDay.getTime()) bestPast = occ;
    else if (!bestFuture) bestFuture = occ;
  }

  return bestPast ?? bestFuture;
}

export function documentationMonthBucket(
  deposit: Deposit,
  now: Date = new Date()
): string | null {
  const occ = documentationOccurrenceDate(deposit, now);
  return occ ? monthBucketOf(occ) : null;
}

function shiftBucket(bucket: string, deltaMonths: number): string {
  const [ys, ms] = bucket.split("-");
  const y0 = Number(ys);
  const m0 = Number(ms);
  if (!Number.isFinite(y0) || !Number.isFinite(m0)) return bucket;
  const idx = y0 * 12 + (m0 - 1) + deltaMonths;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${m.toString().padStart(2, "0")}`;
}

export function nearbyMonthBuckets(now: Date = new Date()): {
  prev: string;
  current: string;
  next: string;
} {
  const current = monthBucketOf(now);
  return {
    prev: shiftBucket(current, -1),
    current,
    next: shiftBucket(current, 1),
  };
}

function progressScore(r: Reminder): number {
  return (
    (r.actionDoneAt ? 2 : 0) + (r.paymentDoneAt || r.paidAt ? 2 : 0)
  );
}

/**
 * Among primary reminders for one deposit, pick the one that should drive
 * the deposits tabs / dashboard counts.
 */
export function pickOpenDocReminder(
  candidates: Reminder[],
  deposit: Deposit,
  now: Date = new Date()
): Reminder | undefined {
  if (candidates.length === 0) return undefined;
  const docBucket = documentationMonthBucket(deposit, now);
  const { prev, current, next } = nearbyMonthBuckets(now);

  const ranked = [...candidates].sort((a, b) => {
    const bucketRank = (r: Reminder) => {
      if (docBucket && r.monthBucket === docBucket) return 0;
      if (r.monthBucket === current) return 1;
      if (r.monthBucket === prev) return 2;
      if (r.monthBucket === next) return 3;
      return 4;
    };
    const br = bucketRank(a) - bucketRank(b);
    if (br !== 0) return br;

    const aComplete = isDepositDocComplete(deposit.depositType, a);
    const bComplete = isDepositDocComplete(deposit.depositType, b);
    // Prefer an in-progress / pending cycle over a fully archived one
    if (aComplete !== bComplete) return aComplete ? 1 : -1;

    const ps = progressScore(b) - progressScore(a);
    if (ps !== 0) return ps;

    return (
      new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime()
    );
  });

  return ranked[0];
}

/** Merge client + server maps without losing a freshly marked בוצע/שולם. */
export function mergeOpenDocMaps(
  prev: Record<string, Reminder>,
  incoming: Record<string, Reminder>
): Record<string, Reminder> {
  const out: Record<string, Reminder> = { ...incoming };
  for (const [depositId, p] of Object.entries(prev)) {
    const i = out[depositId];
    if (!i) {
      if (progressScore(p) > 0) out[depositId] = p;
      continue;
    }
    if (i.id === p.id) {
      out[depositId] = {
        ...i,
        actionDoneAt: i.actionDoneAt || p.actionDoneAt,
        paymentDoneAt: i.paymentDoneAt || p.paymentDoneAt,
        paidAt: i.paidAt || p.paidAt,
      };
      continue;
    }
    if (progressScore(p) > progressScore(i)) out[depositId] = p;
  }
  return out;
}
