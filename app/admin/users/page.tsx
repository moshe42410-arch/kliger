import { redirect } from "next/navigation";
import { getSql, parseUser, type UserRow } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { AdminUsersPanel } from "@/components/AdminUsersPanel";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "admin") {
    redirect("/?notice=admin_only");
  }

  const sql = getSql();
  const rows = await sql`SELECT * FROM users ORDER BY role DESC, created_at ASC`;
  const users = (rows as UserRow[]).map(parseUser);

  return <AdminUsersPanel initialUsers={users} currentUserId={me.id} />;
}
