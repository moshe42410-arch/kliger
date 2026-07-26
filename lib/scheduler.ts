/**
 * Scheduler — no-op on serverless (Vercel).
 *
 * In serverless environments (Vercel, Netlify), there's no persistent process
 * to run node-cron. We use Vercel Cron (see vercel.json + /api/cron/reminders)
 * instead — Vercel invokes our endpoint on the configured schedule.
 *
 * For local dev: if you want cron running (e.g. testing daily sweeps), set
 * ENABLE_LOCAL_CRON=1 in .env.local — otherwise it's disabled to keep dev
 * consistent with prod behavior.
 */

declare global {
  // eslint-disable-next-line no-var
  var __kligerSchedulerStarted: boolean | undefined;
}

export function startScheduler(): void {
  if (global.__kligerSchedulerStarted) return;
  global.__kligerSchedulerStarted = true;

  const isServerless =
    process.env.VERCEL === "1" ||
    process.env.NEXT_RUNTIME === "edge" ||
    process.env.NETLIFY === "true";

  const enableLocal = process.env.ENABLE_LOCAL_CRON === "1";

  if (isServerless || !enableLocal) {
    console.log(
      "[KLIGER] In-process scheduler DISABLED. " +
        "Reminders run via Vercel Cron (see vercel.json → /api/cron/reminders)."
    );
    return;
  }

  // Local dev opt-in: node-cron is still available as an optional dep.
  (async () => {
    try {
      const cron = (await import("node-cron")).default;
      const { runDailyReminderSweep, rolloverAtMonthStart } = await import(
        "./reminders"
      );
      const hour = Number(process.env.REMINDERS_HOUR ?? 9);
      const safeHour =
        Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : 9;

      cron.schedule(
        `0 ${safeHour} * * *`,
        async () => {
          try {
            const res = await runDailyReminderSweep();
            if (res.skipped) {
              console.log(`[KLIGER] Daily sweep skipped: ${res.skipped}`);
            } else {
              console.log(
                `[KLIGER] Daily sweep: created=${res.created} sent=${res.sent} errors=${res.errors}`
              );
            }
          } catch (err) {
            console.error("[KLIGER] Daily sweep error:", err);
          }
        },
        { timezone: "Asia/Jerusalem" }
      );

      cron.schedule(
        "5 0 1 * *",
        async () => {
          try {
            const res = await rolloverAtMonthStart();
            console.log(
              `[KLIGER] Month rollover: carried=${res.carried} deleted=${res.deleted}`
            );
          } catch (err) {
            console.error("[KLIGER] Rollover error:", err);
          }
        },
        { timezone: "Asia/Jerusalem" }
      );

      console.log(
        `[KLIGER] Local scheduler started (daily at ${safeHour}:00 Asia/Jerusalem)`
      );
    } catch (err) {
      console.warn(
        "[KLIGER] Could not start local scheduler (node-cron missing?)",
        err
      );
    }
  })();
}
