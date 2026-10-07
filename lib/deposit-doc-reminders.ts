/**
 * שורות תיעוד חודשיות לטאב הפקדות.
 * כל חודש הוא שורה נפרדת, מה-1 לחודש, גם אם החודש הקודם עוד פתוח.
 *
 * Client-safe: no Node/DB runtime imports (used from DepositsTab).
 */
import { parseISO, startOfDay } from "date-fns";
import type { Deposit, Reminder } from "./db";

function monthBucketOf(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function occInMonth(dayOfMonth: number, year: number, monthIndex: number): Date {
  const dim = daysInMonth(year, monthIndex + 1);
  return startOfDay(new Date(year, monthIndex, Math.min(dayOfMonth, dim)));
}

/**
 * יום ההפקדה בתוך החודש הקלנדרי הנוכחי.
 * השורה נפתחת מה-1 לחודש, גם אם יום ההפקדה עצמו עוד לא הגיע.
 */
export function occurrenceForCalendarMonth(
  deposit: Deposit,
  now: Date = new Date()
): Date | null {
  const startDay = startOfDay(
    deposit.startDate ? parseISO(deposit.startDate) : now
  );
  const endDay = deposit.endDate ? startOfDay(parseISO(deposit.endDate)) : null;
  const occ = occInMonth(deposit.dayOfMonth, now.getFullYear(), now.getMonth());
  if (occ < startDay) return null;
  if (endDay && occ > endDay) return null;
  return occ;
}

/**
 * שורת תיעוד אחת לכל חודש בטאב הפקדות.
 * חודש נוכחי תמיד מוצג (מה-1), גם אם חודש קודם עדיין פתוח.
 * חודשים עתידיים נשארים מוסתרים עד ה-1 שלהם.
 */
export function listMonthDocReminders(
  candidates: Reminder[],
  now: Date = new Date()
): Reminder[] {
  const current = monthBucketOf(now);
  const best = new Map<string, Reminder>();
  for (const r of candidates) {
    if (r.phase !== "primary") continue;
    if (!r.monthBucket || r.monthBucket > current) continue;
    const prev = best.get(r.monthBucket);
    if (!prev || r.targetDate > prev.targetDate) best.set(r.monthBucket, r);
  }
  return [...best.values()].sort((a, b) =>
    a.targetDate < b.targetDate ? 1 : a.targetDate > b.targetDate ? -1 : 0
  );
}
