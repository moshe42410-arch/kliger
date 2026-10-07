import { NextRequest, NextResponse } from "next/server";
import { AuthError, getCurrentOwnerId } from "@/lib/auth";
import { sendAssociationPendingDigest } from "@/lib/association-pending";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = await getCurrentOwnerId();
    const result = await sendAssociationPendingDigest({
      ownerId,
      associationId: params.id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, count: result.count, to: result.to });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
