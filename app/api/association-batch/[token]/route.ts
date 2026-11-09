import { NextRequest, NextResponse } from "next/server";
import { loadAssociationBatch } from "@/lib/association-pending";
import { logMessage, markReminderActionDone } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const items = await loadAssociationBatch(params.token);
  if (!items) {
    return NextResponse.json({ error: "קישור לא תקין" }, { status: 404 });
  }

  const form = await req.formData();
  const choice = String(form.get("choice") || "");
  const url = req.nextUrl.clone();
  url.pathname = `/association-batch/${params.token}`;

  if (choice === "all") {
    for (const item of items) {
      if (item.actionDone) continue;
      await markReminderActionDone(item.id, true);
      await logMessage({
        reminderId: item.id,
        direction: "system",
        subject: "העמותה סימנה בוצע",
        body: "העמותה סימנה את כל הרשימה במייל כבוצע.",
        metadata: { kind: "association_done", batch: params.token },
      });
    }
    url.search = "saved=all";
    return NextResponse.redirect(url, 303);
  }

  if (choice === "partial") {
    const notDone = new Set(form.getAll("notDone").map((value) => String(value)));
    let done = 0;
    let open = 0;
    for (const item of items) {
      if (item.actionDone) {
        done += 1;
        continue;
      }
      if (notDone.has(item.id)) {
        open += 1;
        await logMessage({
          reminderId: item.id,
          direction: "system",
          subject: "העמותה סימנה לא בוצע",
          body: "העמותה סימנה את ההפקדה הזו כלא בוצע מתוך הרשימה.",
          metadata: { kind: "association_not_done", batch: params.token },
        });
        continue;
      }
      done += 1;
      await markReminderActionDone(item.id, true);
      await logMessage({
        reminderId: item.id,
        direction: "system",
        subject: "העמותה סימנה בוצע",
        body: "העמותה סימנה את ההפקדה הזו כבוצע מתוך הרשימה.",
        metadata: { kind: "association_done", batch: params.token },
      });
    }
    url.search = `saved=partial&done=${done}&open=${open}`;
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.json({ error: "בחירה לא תקינה" }, { status: 400 });
}
