import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { assertReminderOwnership, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await assertReminderOwnership(params.id);
    const sql = getSql();
    const files = await sql`
      SELECT u.id, u.original_name, u.mime_type, u.size, u.uploaded_at
      FROM uploads u
      JOIN reminders src ON src.id = ${params.id}
      JOIN reminders r ON r.id = u.reminder_id
        AND r.owner_id = src.owner_id
        AND r.deposit_id = src.deposit_id
        AND COALESCE(NULLIF(r.month_bucket, ''), LEFT(r.target_date, 7))
          = COALESCE(NULLIF(src.month_bucket, ''), LEFT(src.target_date, 7))
      ORDER BY u.uploaded_at ASC
    `;
    const notes = await sql`
      SELECT r.client_response, r.client_response_at
      FROM reminders src
      JOIN reminders r
        ON r.owner_id = src.owner_id
       AND r.deposit_id = src.deposit_id
       AND COALESCE(NULLIF(r.month_bucket, ''), LEFT(r.target_date, 7))
         = COALESCE(NULLIF(src.month_bucket, ''), LEFT(src.target_date, 7))
      WHERE src.id = ${params.id}
        AND NULLIF(BTRIM(r.client_response), '') IS NOT NULL
      ORDER BY r.client_response_at DESC NULLS LAST
      LIMIT 1
    `;
    const note = notes[0] as
      | { client_response: string | null; client_response_at: string | null }
      | undefined;
    return NextResponse.json({
      uploads: (files as Array<{
        id: string;
        original_name: string;
        mime_type: string | null;
        size: number | null;
        uploaded_at: string;
      }>).map((f) => ({
        id: f.id,
        originalName: f.original_name,
        mimeType: f.mime_type,
        size: f.size,
        uploadedAt: f.uploaded_at,
      })),
      note: note?.client_response || "",
      noteAt: note?.client_response_at || null,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
