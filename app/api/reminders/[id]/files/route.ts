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
      SELECT id, original_name, size, uploaded_at
      FROM uploads WHERE reminder_id = ${params.id}
      ORDER BY uploaded_at ASC
    `;
    const notes = await sql`
      SELECT client_response, client_response_at
      FROM reminders WHERE id = ${params.id}
    `;
    const note = notes[0] as
      | { client_response: string | null; client_response_at: string | null }
      | undefined;
    return NextResponse.json({
      uploads: (files as Array<{
        id: string;
        original_name: string;
        size: number | null;
        uploaded_at: string;
      }>).map((f) => ({
        id: f.id,
        originalName: f.original_name,
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
