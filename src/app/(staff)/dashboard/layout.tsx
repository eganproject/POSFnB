import { db } from "@/lib/db";
import { getActiveOutlet, requireUser } from "@/lib/session";
import { MobileTopbar, Sidebar } from "@/components/staff/sidebar";
import { LiveAlerts } from "@/components/staff/live-alerts";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const outlet = await getActiveOutlet();
  const outlets = user.role === "OWNER" ? await db.outlet.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }) : [];
  const props = { user, outlet: outlet ? { id: outlet.id, name: outlet.name } : null, outlets };
  return (
    <div className="flex min-h-dvh bg-muted/40">
      <Sidebar {...props} />
      <div className="min-w-0 flex-1">
        <MobileTopbar {...props} />
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      {outlet && <LiveAlerts notifyOrders={user.role !== "DAPUR"} />}
    </div>
  );
}
