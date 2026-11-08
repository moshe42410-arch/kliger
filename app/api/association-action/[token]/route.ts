import { NextRequest, NextResponse } from "next/server";
import { ensureSchemaExtras, getSql } from "@/lib/db";
import { logMessage, markReminderActionDone } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  await ensureSchemaExtras();
  const form = await req.formData();
  const choice = String(form.get("choice") || "");
  const sql = getSql();
  const rows = await sql`
    SELECT id, action_done_at FROM reminders
    WHERE association_action_token = ${params.token}
    LIMIT 1
  `;
  const row = rows[0] as { id: string; action_done_at: string | null } | undefined;
  if (!row) {
    return NextResponse.json({ error: "קישור לא תקין" }, { status: 404 });
  }

  if (choice === "done") {
    await markReminderActionDone(row.id, true);
    await logMessage({
      reminderId: row.id,
      direction: "system",
      subject: "העמותה סימנה בוצע",
      body: "העמותה לחצה על בוצע. ההפקדה עברה לסטטוס בוצע.",
      metadata: { kind: "association_done" },
    });
  } else if (choice === "not") {
    await logMessage({
      reminderId: row.id,
      direction: "system",
      subject: "העמותה סימנה לא בוצע",
      body: "העמותה לחצה על לא בוצע. הסטטוס באתר לא השתנה.",
      metadata: { kind: "association_not_done" },
    });
  } else {
    return NextResponse.json({ error: "בחירה לא תקינה" }, { status: 400 });
  }

  const url = req.nextUrl.clone();
  url.pathname = `/association-action/${params.token}`;
  url.search = `saved=${choice === "done" ? "done" : "not"}`;
  return NextResponse.redirect(url, 303);
}
