import { redirect } from "next/navigation";
import { getSql, parseAssociation, type AssociationRow } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { AssociationsTab } from "@/components/AssociationsTab";

export const dynamic = "force-dynamic";

export default async function AssociationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sql = getSql();
  const ownerId = user.id;

  const [assocRows, usageRows] = await Promise.all([
    sql`SELECT * FROM associations WHERE owner_id = ${ownerId} ORDER BY name ASC`,
    sql`SELECT association_id, COUNT(*)::int as c FROM deposits WHERE owner_id = ${ownerId} AND association_id IS NOT NULL GROUP BY association_id`,
  ]);

  const associations = (assocRows as AssociationRow[]).map(parseAssociation);
  const usage: Record<string, number> = {};
  for (const r of usageRows as Array<{ association_id: string; c: number }>) {
    usage[r.association_id] = r.c;
  }

  return <AssociationsTab initialAssociations={associations} usage={usage} />;
}
