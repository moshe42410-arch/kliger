import { ensureSchemaExtras, getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AssociationActionPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { choice?: string; saved?: string };
}) {
  await ensureSchemaExtras();
  const sql = getSql();
  const rows = await sql`
    SELECT r.action_done_at, r.target_date, c.name AS client_name, d.amount
    FROM reminders r
    JOIN clients c ON c.id = r.client_id
    JOIN deposits d ON d.id = r.deposit_id
    WHERE r.association_action_token = ${params.token}
    LIMIT 1
  `;
  const row = rows[0] as
    | {
        action_done_at: string | null;
        target_date: string;
        client_name: string;
        amount: number;
      }
    | undefined;

  if (!row) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-navy-950">קישור לא תקין</h1>
        <p className="mt-2 text-sm text-slate-600">הקישור אינו קיים או שפג תוקפו.</p>
      </main>
    );
  }

  const amount = new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(Number(row.amount) || 0);
  const saved = searchParams.saved;
  const choice = searchParams.choice === "not" ? "not" : "done";

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-navy-950">עדכון מהעמותה</h1>
        <p className="mt-2 text-sm text-slate-600">
          {row.client_name} · {amount}
        </p>
        {saved === "done" ? (
          <p className="mt-4 rounded-xl bg-teal-50 px-3 py-3 text-sm font-bold text-teal-800">
            סומן כבוצע. הסטטוס באתר עודכן.
          </p>
        ) : saved === "not" ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-3 text-sm font-bold text-amber-800">
            סומן כלא בוצע. הסטטוס באתר נשאר כפי שהיה.
          </p>
        ) : (
          <form
            className="mt-5"
            method="post"
            action={`/api/association-action/${params.token}`}
          >
            <input type="hidden" name="choice" value={choice} />
            <button
              className={`w-full rounded-xl px-4 py-3 text-sm font-bold text-white ${
                choice === "done" ? "bg-teal-700" : "bg-red-700"
              }`}
              type="submit"
            >
              {choice === "done" ? "אישור: בוצע" : "אישור: לא בוצע"}
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">
              {row.action_done_at
                ? "ההפקדה כבר מסומנת כבוצע."
                : "הלחיצה תעדכן את הסטטוס רק אחרי האישור כאן."}
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
