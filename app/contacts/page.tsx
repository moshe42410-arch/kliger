import { redirect } from "next/navigation";
import { getSql, parseContact, type ContactRow } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ContactsTab } from "@/components/ContactsTab";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM contacts WHERE owner_id = ${user.id} ORDER BY name ASC
  `;
  return (
    <ContactsTab initialContacts={(rows as ContactRow[]).map(parseContact)} />
  );
}
