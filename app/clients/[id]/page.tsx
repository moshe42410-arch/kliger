import { redirect, notFound } from "next/navigation";
import { getSql, parseClient, type ClientRow } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClientCaseView } from "@/components/ClientCaseView";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM clients WHERE id = ${params.id} AND owner_id = ${user.id}
  `;
  const row = (rows as ClientRow[])[0];
  if (!row) notFound();
  return <ClientCaseView initialClient={parseClient(row)} />;
}
