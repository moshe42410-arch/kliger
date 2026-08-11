import { NextRequest, NextResponse } from "next/server";
import {
  getSql,
  nowIso,
  parseClient,
  type ClientRow,
  type IncomeLine,
  type IncomeSnapshot,
  type LiabilityLine,
} from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";
import { recomputeSnapshotTotals } from "@/lib/affordability";

export const dynamic = "force-dynamic";

function asLinesIncomes(raw: unknown): IncomeLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      const o = x as Record<string, unknown>;
      const amount = Number(o.amount);
      if (!Number.isFinite(amount)) return null;
      return {
        status: o.status != null ? String(o.status) : null,
        person: o.person != null ? String(o.person) : null,
        amount,
        notes: o.notes != null ? String(o.notes) : null,
        role: o.role != null ? String(o.role) : null,
      } satisfies IncomeLine;
    })
    .filter(Boolean) as IncomeLine[];
}

function asLinesLiabilities(raw: unknown): LiabilityLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      const o = x as Record<string, unknown>;
      const monthly = Number(o.monthly);
      if (!Number.isFinite(monthly)) return null;
      const balance =
        o.balance === null || o.balance === undefined || o.balance === ""
          ? null
          : Number(o.balance);
      return {
        kind: o.kind != null ? String(o.kind) : null,
        where: o.where != null ? String(o.where) : null,
        monthly,
        balance: balance != null && Number.isFinite(balance) ? balance : null,
        endDate: o.endDate != null ? String(o.endDate) : null,
        takenIn: o.takenIn != null ? String(o.takenIn) : null,
      } satisfies LiabilityLine;
    })
    .filter(Boolean) as LiabilityLine[];
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const exists = (await sql`
      SELECT id FROM clients WHERE id = ${params.id} AND owner_id = ${ownerId}
    `) as Array<{ id: string }>;
    if (!exists[0]) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    const body = await req.json();
    const amountPer100kRaw = body.amountPer100k;
    const amountPer100k =
      amountPer100kRaw === null ||
      amountPer100kRaw === undefined ||
      amountPer100kRaw === ""
        ? null
        : Number(amountPer100kRaw);

    const snapshot: IncomeSnapshot = recomputeSnapshotTotals({
      incomes: asLinesIncomes(body.incomes),
      liabilities: asLinesLiabilities(body.liabilities),
      amountPer100k:
        amountPer100k != null && Number.isFinite(amountPer100k)
          ? amountPer100k
          : null,
    });

    const at = nowIso();
    await sql`
      UPDATE clients
      SET income_snapshot = ${JSON.stringify(snapshot)},
          income_snapshot_at = ${at},
          updated_at = ${at}
      WHERE id = ${params.id}
    `;

    const rows = await sql`SELECT * FROM clients WHERE id = ${params.id}`;
    return NextResponse.json(parseClient((rows as ClientRow[])[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
