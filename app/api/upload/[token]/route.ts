import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSql, nowIso, parseReminder, type ReminderRow } from "@/lib/db";
import {
  logMessage,
  setReminderStatus,
  notifyAdvisorFileUploaded,
} from "@/lib/reminders";
import { putUpload } from "@/lib/blob-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM reminders WHERE upload_token = ${params.token}
    `;
    const reminder = (rows as ReminderRow[])[0];
    if (!reminder) {
      return NextResponse.json({ error: "קישור לא תקין" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "קובץ גדול מדי (מעל 10MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const id = uuid();
    const filename = `${id}__${safeName}`;

    const stored = await putUpload(filename, buffer, file.type || undefined);
    // Store the raw key: filename in dev (readable by getBlobBytes → local fs),
    // full URL in prod (fetched by getBlobBytes → HTTPS).
    const storedRef = stored.key;

    const parsedReminder = parseReminder(reminder);
    await sql`
      INSERT INTO uploads (id, owner_id, reminder_id, filename, original_name, mime_type, size)
      VALUES (${id}, ${parsedReminder.ownerId}, ${reminder.id}, ${storedRef}, ${file.name}, ${file.type}, ${file.size})
    `;

    await setReminderStatus(reminder.id, "waiting_advisor");
    await sql`
      UPDATE reminders
      SET client_response = ${"הועלתה אסמכתא: " + file.name},
          client_response_at = ${nowIso()},
          updated_at = ${nowIso()}
      WHERE id = ${reminder.id}
    `;

    await logMessage({
      reminderId: reminder.id,
      direction: "in",
      subject: "הועלתה אסמכתא",
      body: `הלקוח העלה קובץ: ${file.name}${
        file.size ? ` (${(file.size / 1024 / 1024).toFixed(2)} MB)` : ""
      }`,
      metadata: {
        type: "upload",
        uploadId: id,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      },
    });

    try {
      await notifyAdvisorFileUploaded(reminder.id, storedRef, file.name);
    } catch {
      /* ignore */
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
