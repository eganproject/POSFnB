import { db } from "@/lib/db";
import { requireOutlet, requireUser } from "@/lib/session";
import { shiftSummary } from "@/server/reports";
import { PageHeader } from "@/components/staff/page-header";
import { ShiftView } from "./shift-view";

export const metadata = { title: "Shift kasir" };
export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  const user = await requireUser(["OWNER", "KASIR"]);
  const outlet = await requireOutlet();
  const open = await db.shift.findFirst({ where: { userId: user.id, outletId: outlet.id, closedAt: null } });
  const current = open ? await shiftSummary(open.id) : null;
  const history = await db.shift.findMany({
    where: { outletId: outlet.id, ...(user.role === "OWNER" ? {} : { userId: user.id }), closedAt: { not: null } },
    include: { user: { select: { name: true } }, payments: { where: { state: "SUCCESS" }, select: { amount: true } } },
    orderBy: { openedAt: "desc" },
    take: 30,
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Shift kasir" description="Buka/tutup shift dan cocokkan uang kas di laci." />
      <ShiftView
        current={
          current
            ? {
                openedAt: current.shift.openedAt.toISOString(),
                openingCash: current.shift.openingCash,
                cashSales: current.cashSales,
                totalSales: current.totalSales,
                expectedCash: current.expectedCash,
                byMethod: current.byMethod,
              }
            : null
        }
        history={history.map((h) => ({
          id: h.id,
          user: h.user.name,
          openedAt: h.openedAt.toISOString(),
          closedAt: h.closedAt!.toISOString(),
          openingCash: h.openingCash,
          expectedCash: h.expectedCash ?? 0,
          closingCash: h.closingCash ?? 0,
          totalSales: h.payments.reduce((s, p) => s + p.amount, 0),
          note: h.note,
        }))}
      />
    </div>
  );
}
