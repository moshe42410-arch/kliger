import { loadAssociationBatch } from "@/lib/association-pending";

export const dynamic = "force-dynamic";

function money(value: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateLabel(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("he-IL");
}

export default async function AssociationBatchPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { choice?: string; saved?: string; done?: string; open?: string };
}) {
  const items = await loadAssociationBatch(params.token);
  if (!items) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-navy-950">קישור לא תקין</h1>
        <p className="mt-2 text-sm text-slate-600">הקישור אינו קיים או שפג תוקפו.</p>
      </main>
    );
  }

  const saved = searchParams.saved;
  const all = searchParams.choice === "all";
  const doneCount = Number(searchParams.done || 0);
  const openCount = Number(searchParams.open || 0);

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-navy-950">עדכון מהעמותה</h1>
        <p className="mt-2 text-sm text-slate-600">
          {items.length} הפקדות במייל הזה
        </p>
        {saved === "all" ? (
          <p className="mt-4 rounded-xl bg-teal-50 px-3 py-3 text-sm font-bold text-teal-800">
            כל ההפקדות במייל סומנו כבוצע.
          </p>
        ) : saved === "partial" ? (
          <p className="mt-4 rounded-xl bg-teal-50 px-3 py-3 text-sm font-bold text-teal-800">
            {doneCount} סומנו כבוצע. {openCount} נשארו פתוחות.
          </p>
        ) : all ? (
          <form
            className="mt-5"
            method="post"
            action={`/api/association-batch/${params.token}`}
          >
            <input type="hidden" name="choice" value="all" />
            <ul className="mb-4 space-y-2 text-sm text-navy-950">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl bg-slate-50 px-3 py-2">
                  {item.clientName} · {money(item.amount)} · {dateLabel(item.targetDate)}
                </li>
              ))}
            </ul>
            <button
              className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white"
              type="submit"
            >
              אישור: הכל בוצע
            </button>
          </form>
        ) : (
          <form
            className="mt-5"
            method="post"
            action={`/api/association-batch/${params.token}`}
          >
            <input type="hidden" name="choice" value="partial" />
            <p className="mb-3 text-sm text-slate-600">
              סמנו רק את מה שלא בוצע. השאר יסומנו כבוצע.
            </p>
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
                >
                  <span className="text-sm text-navy-950">
                    {item.clientName} · {money(item.amount)} · {dateLabel(item.targetDate)}
                  </span>
                  {item.actionDone ? (
                    <span className="text-xs font-bold text-teal-700">כבר בוצע</span>
                  ) : (
                    <label className="flex items-center gap-2 text-sm font-bold text-red-800">
                      <input type="checkbox" name="notDone" value={item.id} />
                      לא בוצע
                    </label>
                  )}
                </li>
              ))}
            </ul>
            <button
              className="mt-4 w-full rounded-xl bg-navy-950 px-4 py-3 text-sm font-bold text-white"
              type="submit"
            >
              שמירה
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
