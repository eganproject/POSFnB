import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/staff/page-header";
import { OutletsManager } from "./outlets-manager";

export const metadata = { title: "Outlet" };

export default async function OutletsPage() {
  await requireUser(["OWNER"]);
  const outlets = await db.outlet.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { tables: true, users: true } } },
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Outlet" description="Cabang restoran, pajak, service charge, dan teks struk." />
      <OutletsManager
        outlets={outlets.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          address: o.address,
          phone: o.phone,
          taxRate: o.taxRate,
          serviceRate: o.serviceRate,
          maxDiscountPercent: o.maxDiscountPercent,
          receiptFooter: o.receiptFooter,
          isActive: o.isActive,
          tables: o._count.tables,
          staff: o._count.users,
        }))}
      />
    </div>
  );
}
