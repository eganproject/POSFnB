import { db } from "@/lib/db";
import { requireOutlet, requireUser } from "@/lib/session";
import { getMenuForOutlet } from "@/server/menu";
import { isMidtransEnabled } from "@/server/midtrans";
import { PosApp } from "./pos-app";

export const metadata = { title: "Kasir" };
export const dynamic = "force-dynamic";

export default async function PosPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const user = await requireUser(["OWNER", "KASIR", "PELAYAN"]);
  const outlet = await requireOutlet();
  const { order } = await searchParams;
  const [categories, tables, openBills, shift, requests] = await Promise.all([
    getMenuForOutlet(outlet.id),
    db.diningTable.findMany({
      where: { outletId: outlet.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        orders: {
          where: { OR: [{ status: { in: ["PENDING", "CONFIRMED", "PREPARING", "READY"] } }, { paymentStatus: { in: ["UNPAID", "PARTIAL"] }, status: { not: "CANCELLED" } }] },
          select: { id: true },
        },
      },
    }),
    db.order.findMany({
      where: { outletId: outlet.id, paymentStatus: { in: ["UNPAID", "PARTIAL"] }, status: { not: "CANCELLED" } },
      include: { table: { select: { name: true } }, payments: { where: { state: "SUCCESS" }, select: { amount: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    user.role === "PELAYAN" ? null : db.shift.findFirst({ where: { userId: user.id, outletId: outlet.id, closedAt: null } }),
    db.serviceRequest.count({ where: { outletId: outlet.id, resolvedAt: null } }),
  ]);

  return (
    <PosApp
      user={{ name: user.name, role: user.role }}
      outlet={{ id: outlet.id, name: outlet.name, taxRate: outlet.taxRate, serviceRate: outlet.serviceRate }}
      categories={categories}
      tables={tables.map((t) => ({ id: t.id, name: t.name, area: t.area, capacity: t.capacity, busy: t.orders.length > 0 }))}
      openBills={openBills.map((o) => ({
        id: o.id,
        queueNumber: o.queueNumber,
        tableName: o.table?.name ?? null,
        customerName: o.customerName,
        status: o.status,
        source: o.source,
        total: o.total,
        remaining: o.total - o.payments.reduce((s, p) => s + p.amount, 0),
        createdAt: o.createdAt.toISOString(),
      }))}
      shift={shift ? { id: shift.id, openedAt: shift.openedAt.toISOString(), openingCash: shift.openingCash } : null}
      initialOrderId={order ?? null}
      requestCount={requests}
      payment={{
        demo: !isMidtransEnabled(),
        clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "",
        isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
      }}
    />
  );
}
