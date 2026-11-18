import type { Prisma } from "@prisma/client";
import { pickupLabel } from "@/lib/pickup-label";
import { db } from "@/lib/db";
import { expireStaleOrders } from "@/server/orders";
import { requireOutlet, requireUser } from "@/lib/session";
import { businessDate } from "@/lib/utils";
import { PageHeader } from "@/components/staff/page-header";
import { OrdersBoard, type BoardOrder } from "./orders-board";

export const metadata = { title: "Pesanan" };
export const dynamic = "force-dynamic";

type TabKey = "action" | "active" | "unpaid" | "done" | "cancelled" | "all";
const TAB_KEYS: TabKey[] = ["action", "active", "unpaid", "done", "cancelled", "all"];
const LIVE_TABS = new Set<TabKey>(["action", "active", "unpaid"]);

const FILTERS: Record<TabKey, Prisma.OrderWhereInput> = {
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
  const tab: TabKey = sp.tab && (TAB_KEYS as string[]).includes(sp.tab) ? (sp.tab as TabKey) : "active";
  const date = sp.date || businessDate();
  const q = sp.q?.trim();
  await expireStaleOrders(outlet.id);

  const search: Prisma.OrderWhereInput = q
    ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { customerName: { contains: q, mode: "insensitive" } }] }
    : {};
  // Filter yang sama dipakai untuk daftar & badge jumlah tiap tab
  const whereFor = (key: TabKey): Prisma.OrderWhereInput => ({
    outletId: outlet.id,
    // Pesanan aktif/menunggu tampil walau dari hari sebelumnya
    ...(LIVE_TABS.has(key) ? {} : { businessDate: date }),
    ...search,
    ...FILTERS[key],
  });

  const include = {
    table: { select: { name: true } },
    items: { orderBy: { id: "asc" as const } },
    payments: { where: { state: "SUCCESS" as const } },
  };
  const [orders, counts, requests, selected] = await Promise.all([
    db.order.findMany({ where: whereFor(tab), include, orderBy: { createdAt: tab === "active" || tab === "action" ? "asc" : "desc" }, take: 120 }),
    Promise.all(TAB_KEYS.map((k) => db.order.count({ where: whereFor(k) }))),
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
    pickupLabel: pickupLabel(o.pickupAt),
    total: o.total,
    subtotal: o.subtotal,
    discount: o.discount,
    tax: o.tax,
    serviceCharge: o.serviceCharge,
    paid: o.payments.filter((p) => p.state === "SUCCESS").reduce((s, p) => s + p.amount, 0),
    createdAt: o.createdAt.toISOString(),
    cancelReason: o.cancelReason,
    items: o.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, lineTotal: i.lineTotal, note: i.note, status: i.status, modifiers: (i.modifiers as { option: string }[]).map((m) => m.option) })),
    payments: o.payments.map((p) => ({ id: p.id, method: p.method, amount: p.amount, state: p.state, label: p.label, gatewayChannel: p.gatewayChannel, gatewayType: p.gatewayType, createdAt: p.createdAt.toISOString() })),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Pesanan" description="Konfirmasi pesanan QR, pantau status, dan proses pembayaran." />
      <OrdersBoard
        tab={tab}
        q={q ?? ""}
        date={date}
        role={user.role}
        counts={Object.fromEntries(TAB_KEYS.map((k, i) => [k, counts[i]]))}
        orders={orders.map(map)}
        selected={selected ? map(selected) : null}
        requests={requests.map((r) => ({ id: r.id, type: r.type, tableName: r.table.name, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  );
}
