import { NextRequest, NextResponse } from "next/server";
import { getSql, parseClient, type ClientRow } from "@/lib/db";
import { getCurrentOwnerId, getCurrentUser } from "@/lib/auth";
import { getBlobBytes } from "@/lib/blob-storage";
import { sendEmail, type EmailAttachment } from "@/lib/email";
import {
  buildAttachedFileList,
  getDocumentsSendOptions,
  mergeTemplates,
  renderTemplate,
} from "@/lib/email-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TOTAL_ATTACH_BYTES = 20 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
    }

    const sql = getSql();
    const clientRows = await sql`
      SELECT * FROM clients WHERE id = ${params.id} AND owner_id = ${ownerId}
    `;
    const clientRow = (clientRows as ClientRow[])[0];
    if (!clientRow) {
      return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 404 });
    }
    const client = parseClient(clientRow);

    const body = (await req.json()) as {
      documentIds?: string[];
      to?: string[];
      subject?: string;
      message?: string;
      recipientName?: string;
      includeLogo?: boolean;
    };

    const documentIds = Array.isArray(body.documentIds)
      ? body.documentIds.map(String).filter(Boolean)
      : [];
    if (documentIds.length === 0) {
      return NextResponse.json(
        { error: "יש לבחור לפחות קובץ אחד" },
        { status: 400 }
      );
    }
    if (documentIds.length > 15) {
      return NextResponse.json(
        { error: "ניתן לשלוח עד 15 קבצים במייל אחד" },
        { status: 400 }
      );
    }

    const defaultTo = client.emails.filter((e) => e.includes("@"));
    const to = (
      Array.isArray(body.to) && body.to.length
        ? body.to.map(String)
        : defaultTo
    )
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    if (to.length === 0) {
      return NextResponse.json(
        { error: "אין כתובת מייל לנמען — הוסיפו מייל ללקוח או הזינו נמענים" },
        { status: 400 }
      );
    }

    if (!user.gmailConnected) {
      return NextResponse.json(
        {
          error:
            "יש לחבר Gmail בהגדרות לפני שליחת קבצים (הגדרות → חיבור למייל)",
        },
        { status: 400 }
      );
    }

    const allDocs = await sql`
      SELECT id, filename, original_name, mime_type, size, source, drive_file_id
      FROM client_documents
      WHERE client_id = ${params.id}
        AND owner_id = ${ownerId}
    `;
    const byId = new Map(
      (
        allDocs as Array<{
          id: string;
          filename: string;
          original_name: string;
          mime_type: string | null;
          size: number | null;
          source: string | null;
          drive_file_id: string | null;
        }>
      ).map((d) => [d.id, d])
    );
    const docRows = documentIds
      .map((id) => byId.get(id))
      .filter(
        (d): d is {
          id: string;
          filename: string;
          original_name: string;
          mime_type: string | null;
          size: number | null;
          source: string | null;
          drive_file_id: string | null;
        } => Boolean(d)
      );

    if (docRows.length !== documentIds.length) {
      return NextResponse.json(
        { error: "חלק מהקבצים לא נמצאו או לא שייכים ללקוח" },
        { status: 400 }
      );
    }

    const totalSize = docRows.reduce((s, d) => s + (d.size || 0), 0);
    if (totalSize > MAX_TOTAL_ATTACH_BYTES) {
      return NextResponse.json(
        { error: "סך הקבצים גדול מדי לשליחה במייל (מעל ~20MB)" },
        { status: 400 }
      );
    }

    const { getDriveAccessToken, downloadDriveFileBytes } = await import(
      "@/lib/google-drive"
    );
    let driveToken: string | null = null;
    const needsDrive = docRows.some((d) => d.source === "drive");
    if (needsDrive) {
      driveToken = await getDriveAccessToken(user.id);
    }

    const attachments: EmailAttachment[] = [];
    for (const d of docRows) {
      if (d.source === "drive" && d.drive_file_id && driveToken) {
        const downloaded = await downloadDriveFileBytes(driveToken, {
          id: d.drive_file_id,
          name: d.original_name,
          mimeType: d.mime_type || "application/octet-stream",
        });
        attachments.push({
          filename: downloaded.filename,
          content: downloaded.buffer,
          contentType: downloaded.contentType,
        });
      } else {
        const buf = await getBlobBytes(d.filename);
        if (!buf) {
          return NextResponse.json(
            { error: `לא ניתן לטעון את הקובץ: ${d.original_name}` },
            { status: 500 }
          );
        }
        attachments.push({
          filename: d.original_name,
          content: buf,
          contentType: d.mime_type || undefined,
        });
      }
    }

    const filenames = attachments.map((a) => a.filename);
    const recipientName =
      (body.recipientName || "").trim() || client.name || "לקוח יקר";
    const nationalId = (client.nationalId || "").trim();
    const templates = mergeTemplates(user.emailTemplates);
    const rendered = renderTemplate(templates.documents_send, {
      recipientName,
      clientName: client.name,
      nationalId,
      fileList: buildAttachedFileList(filenames),
      fileNames: filenames.join(", "),
      fileCount: String(filenames.length),
      companyName: user.companyName || user.name || "KLIGER",
      advisorName: user.name || "",
    });

    function withNationalId(text: string): string {
      if (!nationalId) {
        return text
          .replace(/\s*·\s*מ\.ז\s*$/g, "")
          .replace(/\n?מ\.ז\s*:?\s*$/gm, "")
          .replace(/מ\.ז\s*(?=\n|$)/g, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      }
      if (text.includes(nationalId)) return text;
      if (/מ\.ז(?!\s*\d)/.test(text)) {
        return text.replace(/מ\.ז(?!\s*\d)/g, `מ.ז ${nationalId}`);
      }
      return `${text} · מ.ז ${nationalId}`.trim();
    }

    const subject = withNationalId(
      (body.subject || "").trim() || rendered.subject
    );
    const bodyText = withNationalId(
      (body.message || "").trim() || rendered.body
    );
    const includeLogo =
      typeof body.includeLogo === "boolean"
        ? body.includeLogo
        : getDocumentsSendOptions(user.emailTemplates).includeLogo;

    const result = await sendEmail({
      to,
      subject,
      body: bodyText,
      clientId: client.id,
      attachments,
      fromUserId: user.id,
      includeLogo,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "שליחת המייל נכשלה" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sentTo: to,
      count: docRows.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
