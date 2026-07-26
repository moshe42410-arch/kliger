import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, seedInitialAdminIfNeeded } from "@/lib/db";
import { verifyPassword } from "@/lib/auth-crypto";
import { createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) {
      return NextResponse.json({ error: "יש למלא מייל וסיסמה" }, { status: 400 });
    }

    // Try to seed admin on first login attempt (idempotent).
    try {
      await seedInitialAdminIfNeeded();
    } catch (err) {
      console.warn("[login] seedInitialAdmin warning:", err);
    }

    const user = await getUserByEmail(email);
    if (!user || !user.active) {
      return NextResponse.json(
        { error: "מייל או סיסמה שגויים" },
        { status: 401 }
      );
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "מייל או סיסמה שגויים" },
        { status: 401 }
      );
    }

    await createSession(user.id);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      mustChangePassword: user.mustChangePassword,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
