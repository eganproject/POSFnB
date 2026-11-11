import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getActiveOutlet, requireUser } from "@/lib/session";
import { DashboardShell } from "@/components/staff/shell";
import { SIDEBAR_COOKIE } from "@/components/staff/nav";
import { LiveAlerts } from "@/components/staff/live-alerts";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const outlet = await getActiveOutlet();
  const outlets = user.role === "OWNER" ? await db.outlet.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }) : [];
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";
  return (
    <>
      <DashboardShell
        user={{ name: user.name, email: user.email, role: user.role }}
        outlet={outlet ? { id: outlet.id, name: outlet.name } : null}
        outlets={outlets}
        defaultCollapsed={collapsed}
      >
        {children}
      </DashboardShell>
      {outlet && <LiveAlerts notifyOrders={user.role !== "DAPUR"} />}
    </>
  );
}
