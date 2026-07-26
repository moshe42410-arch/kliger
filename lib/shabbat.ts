import { HDate, HebrewCalendar, flags } from "@hebcal/core";

/**
 * האם היום (לפי שעון ישראל) הוא שבת או חג מרכזי שבו אסור לשלוח תזכורות
 * ללקוחות. כולל: שבת (יום שבת), 3 רגלים, ראש השנה, יום כיפור, וחול־המועד
 * (אופציונלי דרך הפלאג includeMinor).
 *
 * מדוע זה חשוב: תזכורות שיוצאות בשבת/חג ללקוחות דתיים גורמות לתלונות
 * ולפגיעה ביחסים — masiim פתרה את זה דרך shabbatGuard לפני שליחת מיילים.
 */
export interface ShabbatCheck {
  blocked: boolean;
  reason: string | null;
}

const HOLIDAY_BLOCKING_FLAGS =
  flags.CHAG | flags.LIGHT_CANDLES_TZEIS | flags.YOM_TOV_ENDS;

export function isShabbatOrHoliday(d: Date = new Date()): ShabbatCheck {
  if (d.getDay() === 6) {
    return { blocked: true, reason: "שבת" };
  }

  if (d.getDay() === 5 && d.getHours() >= 14) {
    return { blocked: true, reason: "ערב שבת אחר הצהריים" };
  }

  try {
    const hd = new HDate(d);
    const events = HebrewCalendar.getHolidaysOnDate(hd, true) ?? [];
    for (const ev of events) {
      const f = ev.getFlags();
      if (f & HOLIDAY_BLOCKING_FLAGS) {
        return { blocked: true, reason: ev.render("he") };
      }
    }
  } catch {
    // hebcal failed — fail open (don't block)
  }

  return { blocked: false, reason: null };
}

/**
 * ערב חג: אם היום ערב חג גדול אחה"צ, נחסום גם.
 * משמש את ה-sweep היומי שרץ ב-09:00 — ביום של ערב חג נדלג גם.
 */
export function isErevChag(d: Date = new Date()): ShabbatCheck {
  try {
    const tomorrow = new Date(d);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const hd = new HDate(tomorrow);
    const events = HebrewCalendar.getHolidaysOnDate(hd, true) ?? [];
    for (const ev of events) {
      const f = ev.getFlags();
      if (f & flags.CHAG) {
        return { blocked: true, reason: `ערב ${ev.render("he")}` };
      }
    }
  } catch {}
  return { blocked: false, reason: null };
}
