import { redirect } from "next/navigation";
import { getSql, parseClient, type ClientRow } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClientsTab } from "@/components/ClientsTab";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM clients WHERE owner_id = ${user.id} ORDER BY created_at DESC
  `;
  const clients = (rows as ClientRow[]).map(parseClient);
  return <ClientsTab initialClients={clients} />;
}
