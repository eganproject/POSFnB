import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { expireStaleOrders } from "@/server/orders";
import { requireOutlet, requireUser } from "@/lib/session";
import { businessDate } from "@/lib/utils";
import { PageHeader } from "@/components/staff/page-header";
import { OrdersBoard, type BoardOrder } from "./orders-board";

export const metadata = { title: "Pesanan" };
export const dynamic = "force-dynamic";

const FILTERS: Record<string, Prisma.OrderWhereInput> = {
  action: { status: "PENDING" },
  active: { status: { in: ["CONFIRMED", "PREPARING", "READY"] } },
  unpaid: { paymentStatus: { in: ["UNPAID", "PARTIAL"] }, status: { not: "CANCELLED" } },
  done: { status: "COMPLETED" },
  cancelled: { status: "CANCELLED" },
  all: {},
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; id?: string; q?: string; date?: string }> }) {
  const user = await requireUser(["OWNER", "KASIR", "PELAYAN"]);
  const outlet = await requireOutlet();
  const sp = await searchParams;
  const tab = sp.tab && sp.tab in FILTERS ? sp.tab : "active";
  const date = sp.date || businessDate();
  const q = sp.q?.trim();
  await expireStaleOrders(outlet.id);

  const base: Prisma.OrderWhereInput = {
    outletId: outlet.id,
    // Pesanan aktif/menunggu tampil walau dari hari sebelumnya
    ...(tab === "action" || tab === "active" || tab === "unpaid" ? {} : { businessDate: date }),
    ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { customerName: { contains: q, mode: "insensitive" } }] } : {}),
  };

  const include = {
    table: { select: { name: true } },
    items: true,
    payments: { where: { state: "SUCCESS" as const } },
  };
  const [orders, counts, requests, selected] = await Promise.all([
    db.order.findMany({ where: { ...base, ...FILTERS[tab] }, include, orderBy: { createdAt: tab === "active" || tab === "action" ? "asc" : "desc" }, take: 120 }),
    Promise.all(
      (["action", "active", "unpaid"] as const).map((k) => db.order.count({ where: { outletId: outlet.id, ...FILTERS[k] } }))
    ),
    db.serviceRequest.findMany({ where: { outletId: outlet.id, resolvedAt: null }, include: { table: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    sp.id ? db.order.findFirst({ where: { id: sp.id, outletId: outlet.id }, include: { ...include, payments: { orderBy: { createdAt: "asc" as const } } } }) : null,
  ]);

  const map = (o: (typeof orders)[number]): BoardOrder => ({
    id: o.id,
    code: o.code,
    queueNumber: o.queueNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    payPreference: o.payPreference,
    source: o.source,
    type: o.type,
    customerName: o.customerName,
    note: o.note,
    tableName: o.table?.name ?? null,
    total: o.total,
    subtotal: o.subtotal,
    discount: o.discount,
    tax: o.tax,
    serviceCharge: o.serviceCharge,
    paid: o.payments.filter((p) => p.state === "SUCCESS").reduce((s, p) => s + p.amount, 0),
    createdAt: o.createdAt.toISOString(),
    cancelReason: o.cancelReason,
    items: o.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, lineTotal: i.lineTotal, note: i.note, modifiers: (i.modifiers as { option: string }[]).map((m) => m.option) })),
    payments: o.payments.map((p) => ({ id: p.id, method: p.method, amount: p.amount, state: p.state, label: p.label, createdAt: p.createdAt.toISOString() })),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Pesanan" description="Konfirmasi pesanan QR, pantau status, dan proses pembayaran." />
      <OrdersBoard
        tab={tab}
        q={q ?? ""}
        date={date}
        role={user.role}
        counts={{ action: counts[0], active: counts[1], unpaid: counts[2] }}
        orders={orders.map(map)}
        selected={selected ? map(selected) : null}
        requests={requests.map((r) => ({ id: r.id, type: r.type, tableName: r.table.name, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  );
}
