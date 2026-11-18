import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/staff/page-header";
import { UsersManager } from "./users-manager";
import type { StaffRole } from "@/lib/constants";

export const metadata = { title: "Pengguna" };

export default async function UsersPage() {
  const me = await requireUser(["OWNER"]);
  const [users, outlets] = await Promise.all([
    db.user.findMany({ where: { role: { not: "CUSTOMER" } }, orderBy: [{ role: "asc" }, { name: "asc" }], include: { outlet: { select: { name: true } } } }),
    db.outlet.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Pengguna" description="Akun staf dan hak aksesnya. Staf login di /login." />
      <UsersManager
        meId={me.id}
        outlets={outlets}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role as StaffRole, outletId: u.outletId, outletName: u.outlet?.name ?? null, isActive: u.isActive }))}
      />
    </div>
  );
}
