import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const TZ = process.env.APP_TIMEZONE || "Asia/Jakarta";

export type Range = { from: string; to: string }; // YYYY-MM-DD inklusif

const validOrder = (outletId: string, r: Range) => Prisma.sql`
  o."outletId" = ${outletId} AND o."businessDate" BETWEEN ${r.from} AND ${r.to}
  AND o."status" <> 'CANCELLED' AND o."paymentStatus" = 'PAID'`;

export async function salesSummary(outletId: string, r: Range) {
  const [row] = await db.$queryRaw<
    { orders: bigint; revenue: bigint | null; subtotal: bigint | null; tax: bigint | null; service: bigint | null; discount: bigint | null }[]
  >`SELECT COUNT(*) AS orders, SUM(o.total) AS revenue, SUM(o.subtotal) AS subtotal, SUM(o.tax) AS tax,
           SUM(o."serviceCharge") AS service, SUM(o.discount) AS discount
    FROM "Order" o WHERE ${validOrder(outletId, r)}`;
  const [items] = await db.$queryRaw<{ qty: bigint | null }[]>`
    SELECT SUM(i.quantity) AS qty FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" WHERE ${validOrder(outletId, r)}`;
  const cancelled = await db.order.count({ where: { outletId, businessDate: { gte: r.from, lte: r.to }, status: "CANCELLED" } });
  const orders = Number(row.orders);
  const revenue = Number(row.revenue ?? 0);
  return {
    orders,
    revenue,
    subtotal: Number(row.subtotal ?? 0),
    tax: Number(row.tax ?? 0),
    service: Number(row.service ?? 0),
    discount: Number(row.discount ?? 0),
    itemsSold: Number(items.qty ?? 0),
    avgTicket: orders ? Math.round(revenue / orders) : 0,
    cancelled,
  };
}

export async function dailySales(outletId: string, r: Range) {
  const rows = await db.$queryRaw<{ date: string; revenue: bigint; orders: bigint }[]>`
    SELECT o."businessDate" AS date, SUM(o.total) AS revenue, COUNT(*) AS orders
    FROM "Order" o WHERE ${validOrder(outletId, r)}
    GROUP BY o."businessDate" ORDER BY o."businessDate"`;
  const map = new Map(rows.map((x) => [x.date, x]));
  const out: { date: string; revenue: number; orders: number }[] = [];
  for (let d = new Date(`${r.from}T00:00:00Z`); d <= new Date(`${r.to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const x = map.get(key);
    out.push({ date: key, revenue: Number(x?.revenue ?? 0), orders: Number(x?.orders ?? 0) });
  }
  return out;
}

export async function bestSellers(outletId: string, r: Range, limit = 10) {
  const rows = await db.$queryRaw<{ name: string; qty: bigint; revenue: bigint }[]>`
    SELECT i.name, SUM(i.quantity) AS qty, SUM(i."lineTotal") AS revenue
    FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
    WHERE ${validOrder(outletId, r)}
    GROUP BY i.name ORDER BY qty DESC, revenue DESC LIMIT ${limit}`;
  return rows.map((x) => ({ name: x.name, qty: Number(x.qty), revenue: Number(x.revenue) }));
}

export async function salesByCategory(outletId: string, r: Range) {
  const rows = await db.$queryRaw<{ name: string | null; revenue: bigint; qty: bigint }[]>`
    SELECT c.name, SUM(i."lineTotal") AS revenue, SUM(i.quantity) AS qty
    FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
    LEFT JOIN "Product" p ON p.id = i."productId" LEFT JOIN "Category" c ON c.id = p."categoryId"
    WHERE ${validOrder(outletId, r)}
    GROUP BY c.name ORDER BY revenue DESC`;
  return rows.map((x) => ({ name: x.name ?? "Lainnya", revenue: Number(x.revenue), qty: Number(x.qty) }));
}

export async function salesByPaymentMethod(outletId: string, r: Range) {
  const rows = await db.$queryRaw<{ method: string; amount: bigint; count: bigint }[]>`
    SELECT p.method, SUM(p.amount) AS amount, COUNT(*) AS count
    FROM "Payment" p JOIN "Order" o ON o.id = p."orderId"
    WHERE o."outletId" = ${outletId} AND o."businessDate" BETWEEN ${r.from} AND ${r.to}
      AND p.state = 'SUCCESS' AND o.status <> 'CANCELLED'
    GROUP BY p.method ORDER BY amount DESC`;
  return rows.map((x) => ({ method: x.method, amount: Number(x.amount), count: Number(x.count) }));
}

export async function salesByHour(outletId: string, r: Range) {
  const rows = await db.$queryRaw<{ hour: number; orders: bigint; revenue: bigint }[]>`
    SELECT EXTRACT(HOUR FROM o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})::int AS hour,
           COUNT(*) AS orders, SUM(o.total) AS revenue
    FROM "Order" o WHERE ${validOrder(outletId, r)}
    GROUP BY hour ORDER BY hour`;
  const map = new Map(rows.map((x) => [x.hour, x]));
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: Number(map.get(h)?.orders ?? 0), revenue: Number(map.get(h)?.revenue ?? 0) })).filter(
    (x) => x.hour >= 7 && x.hour <= 23
  );
}

export async function salesBySource(outletId: string, r: Range) {
  const rows = await db.$queryRaw<{ source: string; orders: bigint; revenue: bigint }[]>`
    SELECT o.source, COUNT(*) AS orders, SUM(o.total) AS revenue FROM "Order" o WHERE ${validOrder(outletId, r)} GROUP BY o.source`;
  return rows.map((x) => ({ source: x.source, orders: Number(x.orders), revenue: Number(x.revenue) }));
}

/** Rekap kas satu shift */
export async function shiftSummary(shiftId: string) {
  const shift = await db.shift.findUnique({ where: { id: shiftId }, include: { user: { select: { name: true } } } });
  if (!shift) return null;
  const byMethod = await db.payment.groupBy({
    by: ["method"],
    where: { shiftId, state: "SUCCESS" },
    _sum: { amount: true },
    _count: true,
  });
  const cash = byMethod.find((m) => m.method === "CASH")?._sum.amount ?? 0;
  const total = byMethod.reduce((s, m) => s + (m._sum.amount ?? 0), 0);
  return {
    shift,
    byMethod: byMethod.map((m) => ({ method: m.method, amount: m._sum.amount ?? 0, count: m._count })),
    cashSales: cash,
    totalSales: total,
    expectedCash: shift.openingCash + cash,
  };
}
