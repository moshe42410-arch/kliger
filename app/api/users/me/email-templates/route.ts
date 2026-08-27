import { NextRequest, NextResponse } from "next/server";
import { getSql, nowIso, parseUser, type UserRow } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import {
  TEMPLATE_META,
  TEMPLATE_VARIABLES,
  TEMPLATE_CATEGORY_LABELS,
  DEFAULT_TEMPLATES,
  DEFAULT_DOCUMENTS_SEND_OPTIONS,
  getDocumentsSendOptions,
  mergeTemplates,
  type DocumentsSendOptions,
  type TemplateId,
} from "@/lib/email-templates";

export const dynamic = "force-dynamic";

function payload(user: ReturnType<typeof parseUser>) {
  return {
    templates: mergeTemplates(user.emailTemplates),
    defaults: DEFAULT_TEMPLATES,
    meta: TEMPLATE_META,
    variables: TEMPLATE_VARIABLES,
    categoryLabels: TEMPLATE_CATEGORY_LABELS,
    documentsSendOptions: getDocumentsSendOptions(user.emailTemplates),
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(payload(user));
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
    const prev = (user.emailTemplates || {}) as Record<string, unknown>;
    const toStore: Record<string, unknown> = { ...prev };

    for (const [key, val] of Object.entries(incoming)) {
      if (!validIds.has(key as TemplateId)) continue;
      if (!val || typeof val !== "object") continue;
      const v = val as { subject?: unknown; body?: unknown };
      const subject = typeof v.subject === "string" ? v.subject.trim() : "";
      const bodyText = typeof v.body === "string" ? v.body : "";
      if (!subject || !bodyText.trim()) {
        delete toStore[key];
        continue;
      }

      const def = DEFAULT_TEMPLATES[key as TemplateId];
      if (def.subject === subject && def.body === bodyText) {
        delete toStore[key];
        continue;
      }

      toStore[key] = { subject, body: bodyText };
    }

    if (body.documentsSendOptions && typeof body.documentsSendOptions === "object") {
      const o = body.documentsSendOptions as Partial<DocumentsSendOptions>;
      const next: DocumentsSendOptions = {
        includeLogo:
          typeof o.includeLogo === "boolean"
            ? o.includeLogo
            : DEFAULT_DOCUMENTS_SEND_OPTIONS.includeLogo,
        recipientNameDefault:
          typeof o.recipientNameDefault === "string"
            ? o.recipientNameDefault.trim()
            : "",
      };
      const isDefault =
        next.includeLogo === DEFAULT_DOCUMENTS_SEND_OPTIONS.includeLogo &&
        !next.recipientNameDefault;
      if (isDefault) delete toStore.documents_send_options;
      else toStore.documents_send_options = next;
    }

    const keys = Object.keys(toStore);
    const finalJson = keys.length ? JSON.stringify(toStore) : null;
    const sql = getSql();
    await sql`
      UPDATE users SET email_templates = ${finalJson}, updated_at = ${nowIso()}
      WHERE id = ${user.id}
    `;

    const rows = await sql`SELECT * FROM users WHERE id = ${user.id}`;
    const fresh = parseUser((rows as UserRow[])[0]);
    return NextResponse.json(payload(fresh));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
