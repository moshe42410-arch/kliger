import { NextRequest, NextResponse } from "next/server";
import { getSql, nowIso, parseUser, type UserRow } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import {
  TEMPLATE_META,
  TEMPLATE_VARIABLES,
  TEMPLATE_CATEGORY_LABELS,
  DEFAULT_TEMPLATES,
  mergeTemplates,
  type TemplateId,
} from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const merged = mergeTemplates(user.emailTemplates);
    return NextResponse.json({
      templates: merged,
      defaults: DEFAULT_TEMPLATES,
      meta: TEMPLATE_META,
      variables: TEMPLATE_VARIABLES,
      categoryLabels: TEMPLATE_CATEGORY_LABELS,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const incoming = body?.templates;
    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json({ error: "חסר שדה templates" }, { status: 400 });
    }

    const validIds = new Set(TEMPLATE_META.map((m) => m.id));
    const toStore: Record<string, { subject: string; body: string }> = {};

    for (const [key, val] of Object.entries(incoming)) {
      if (!validIds.has(key as TemplateId)) continue;
      if (!val || typeof val !== "object") continue;
      const v = val as { subject?: unknown; body?: unknown };
      const subject = typeof v.subject === "string" ? v.subject.trim() : "";
      const bodyText = typeof v.body === "string" ? v.body : "";
      if (!subject || !bodyText.trim()) continue;

      const def = DEFAULT_TEMPLATES[key as TemplateId];
      if (def.subject === subject && def.body === bodyText) continue;

      toStore[key] = { subject, body: bodyText };
    }

    const sql = getSql();
    const finalJson = Object.keys(toStore).length ? JSON.stringify(toStore) : null;
    await sql`
      UPDATE users SET email_templates = ${finalJson}, updated_at = ${nowIso()}
      WHERE id = ${user.id}
    `;

    const rows = await sql`SELECT * FROM users WHERE id = ${user.id}`;
    const fresh = parseUser((rows as UserRow[])[0]);
    return NextResponse.json({
      templates: mergeTemplates(fresh.emailTemplates),
      defaults: DEFAULT_TEMPLATES,
      meta: TEMPLATE_META,
      variables: TEMPLATE_VARIABLES,
      categoryLabels: TEMPLATE_CATEGORY_LABELS,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
