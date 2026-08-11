import { NextRequest, NextResponse } from "next/server";
import { getSql, getUserById, nowIso } from "@/lib/db";
import { getCurrentUser, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }
  return NextResponse.json(user);
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError("לא מחובר", 401);

    const body = await req.json();
    const name = String(body.name ?? user.name).trim();
    if (!name) {
      return NextResponse.json({ error: "שם חובה" }, { status: 400 });
    }
    const phone =
      body.phone === undefined
        ? user.phone
        : body.phone
          ? String(body.phone).trim()
          : null;
    const companyName =
      body.companyName === undefined
        ? user.companyName
        : body.companyName
          ? String(body.companyName).trim()
          : null;

    const dashboardCards = Array.isArray(body.dashboardCards)
      ? JSON.stringify(
          body.dashboardCards
            .filter((c: unknown) => typeof c === "string")
            .slice(0, 40)
        )
      : user.dashboardCards
        ? JSON.stringify(user.dashboardCards)
        : null;

    const autoRemindersEnabled =
      body.autoRemindersEnabled === undefined
        ? user.autoRemindersEnabled
        : Boolean(body.autoRemindersEnabled);

    const sql = getSql();
    await sql`
      UPDATE users
      SET name = ${name},
          phone = ${phone},
          company_name = ${companyName},
          dashboard_cards = ${dashboardCards},
          auto_reminders_enabled = ${autoRemindersEnabled ? 1 : 0},
          updated_at = ${nowIso()}
      WHERE id = ${user.id}
    `;

    const updated = await getUserById(user.id);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
