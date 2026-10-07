import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import {
  ensureSchemaExtras,
  getSql,
  nowIso,
  parseReminder,
  type ReminderRow,
} from "@/lib/db";
import {
  logMessage,
  notifyAdvisorOfClientUpdate,
  setReminderStatus,
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
    await ensureSchemaExtras();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM reminders WHERE upload_token = ${params.token}
    `;
    const reminderRow = (rows as ReminderRow[])[0];
    if (!reminderRow) {
      return NextResponse.json({ error: "קישור לא תקין" }, { status: 404 });
    }
    const reminder = parseReminder(reminderRow);

    const form = await req.formData();
    const file = form.get("file");
    const hasFile = file instanceof File && file.size > 0;
    const payerField = form.get("payerName");
    const hasPayer = typeof payerField === "string";
    const payerName = hasPayer ? payerField.trim() : "";
    const messageField = form.get("message");
    const message =
      typeof messageField === "string" ? messageField.trim() : "";

    if (!hasFile && !hasPayer && !message) {
      return NextResponse.json(
        { error: "יש להעלות קובץ, למלא שם מעביר או לכתוב הודעה" },
        { status: 400 }
      );
    }

    let storedRef: string | null = null;
    let originalName: string | null = null;

    if (hasFile && file instanceof File) {
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "קובץ גדול מדי (מעל 10MB)" },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const extMatch = file.name.match(/(\.[a-zA-Z0-9]{1,10})$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : "";
      const base =
        file.name
          .replace(/\.[a-zA-Z0-9]{1,10}$/, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "") || "file";
      const id = uuid();
      const filename = `${id}__${base}${ext}`;

      let contentType = file.type || undefined;
      if (!contentType || contentType === "application/octet-stream") {
        if (ext === ".pdf") contentType = "application/pdf";
        else if (ext === ".png") contentType = "image/png";
        else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
        else if (ext === ".webp") contentType = "image/webp";
        else if (ext === ".heic") contentType = "image/heic";
      }

      const stored = await putUpload(filename, buffer, contentType);
      storedRef = stored.key;
      originalName = file.name;

      await sql`
        INSERT INTO uploads (id, owner_id, reminder_id, filename, original_name, mime_type, size)
        VALUES (${id}, ${reminder.ownerId}, ${reminder.id}, ${storedRef}, ${file.name}, ${contentType || file.type || null}, ${file.size})
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
          mimeType: contentType || file.type,
          size: file.size,
        },
      });
    }

    const payerChanged = hasPayer && payerName !== (reminder.payerName || "");
    if (payerChanged) {
      const now = nowIso();
      if (payerName) {
        await sql`
          UPDATE reminders
          SET payer_name = ${payerName}, updated_at = ${now}
          WHERE id = ${reminder.id}
        `;
      } else {
        await sql`
          UPDATE reminders
          SET payer_name = NULL, updated_at = ${now}
          WHERE id = ${reminder.id}
        `;
      }
      await logMessage({
        reminderId: reminder.id,
        direction: "in",
        subject: "שם מעביר",
        body: payerName
          ? `הלקוח עדכן את שם המעביר: ${payerName}`
          : "הלקוח מחק את שם המעביר",
        metadata: { kind: "payer_name", payerName: payerName || null },
      });
    }

    if (message) {
      const now = nowIso();
      await sql`
        UPDATE reminders
        SET client_response = ${message},
            client_response_at = ${now},
            updated_at = ${now}
        WHERE id = ${reminder.id}
      `;
      await logMessage({
        reminderId: reminder.id,
        direction: "in",
        subject: "הודעה מהלקוח",
        body: message,
        metadata: { kind: "client_message" },
      });
    }

    if (hasFile || message) {
      await setReminderStatus(reminder.id, "waiting_advisor");
    }

    if (!hasFile && !message && !payerChanged) {
      return NextResponse.json({ ok: true });
    }

    try {
      await notifyAdvisorOfClientUpdate({
        reminderId: reminder.id,
        file:
          storedRef && originalName
            ? { storedRef, originalName }
            : null,
        message: message || null,
      });
    } catch (err) {
      console.error("[upload] advisor notify failed", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
