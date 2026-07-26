import { redirect } from "next/navigation";
import {
  getSql,
  parseClient,
  parseDeposit,
  parseAssociation,
  type ClientRow,
  type DepositRow,
  type AssociationRow,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { DepositsTab } from "@/components/DepositsTab";

export const dynamic = "force-dynamic";

export default async function DepositsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sql = getSql();
  const ownerId = user.id;

  const [depositRows, clientRows, associationRows, reminderCounts] =
    await Promise.all([
      sql`SELECT * FROM deposits WHERE owner_id = ${ownerId} ORDER BY created_at DESC`,
      sql`SELECT * FROM clients WHERE owner_id = ${ownerId} ORDER BY name ASC`,
      sql`SELECT * FROM associations WHERE owner_id = ${ownerId} ORDER BY name ASC`,
      sql`
        SELECT deposit_id, COUNT(*)::int as c, MAX(last_sent_at) as last_sent, MAX(sends_count)::int as sends
        FROM reminders WHERE owner_id = ${ownerId} GROUP BY deposit_id
      `,
    ]);

  const deposits = (depositRows as DepositRow[]).map(parseDeposit);
  const clients = (clientRows as ClientRow[]).map(parseClient);
  const associations = (associationRows as AssociationRow[]).map(parseAssociation);

  const metaMap: Record<string, { sends: number; lastSent: string | null }> = {};
  for (const r of reminderCounts as Array<{
    deposit_id: string;
    c: number;
    last_sent: string | null;
    sends: number;
  }>) {
    metaMap[r.deposit_id] = { sends: r.sends || 0, lastSent: r.last_sent };
  }

  return (
    <DepositsTab
      initialDeposits={deposits}
      clients={clients}
      associations={associations}
      reminderMeta={metaMap}
    />
  );
}
