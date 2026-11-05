import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isMidtransEnabled } from "@/server/midtrans";
import { OrderTracker } from "@/components/customer/order-tracker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Status pesanan" };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pay?: string }>;
}) {
  const { id } = await params;
  const { pay } = await searchParams;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
      outlet: { select: { id: true, name: true, slug: true, taxRate: true, serviceRate: true } },
      table: { select: { name: true, qrToken: true } },
    },
  });
  if (!order) notFound();
  const paid = order.payments.filter((p) => p.state === "SUCCESS").reduce((s, p) => s + p.amount, 0);
  // Posisi antrean & estimasi dari rata-rata waktu masak 7 hari terakhir
  let ahead = 0;
  let etaMinutes: number | null = null;
  if (order.status === "CONFIRMED" || order.status === "PREPARING") {
    const since = order.confirmedAt ?? order.createdAt;
    const [count, recent] = await Promise.all([
      db.order.count({ where: { outletId: order.outletId, status: { in: ["CONFIRMED", "PREPARING"] }, confirmedAt: { lt: since }, id: { not: order.id } } }),
      db.order.findMany({
        where: { outletId: order.outletId, readyAt: { not: null, gte: new Date(Date.now() - 7 * 864e5) }, confirmedAt: { not: null } },
        select: { confirmedAt: true, readyAt: true },
        orderBy: { readyAt: "desc" },
        take: 40,
      }),
    ]);
    ahead = count;
    const durations = recent.map((r) => (r.readyAt!.getTime() - r.confirmedAt!.getTime()) / 60000).filter((m) => m > 0 && m < 90);
    const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 12;
    const elapsed = (Date.now() - since.getTime()) / 60000;
    etaMinutes = Math.max(2, Math.round(avg + ahead * avg * 0.35 - elapsed));
  }
  const pending = order.payments.findLast((p) => p.method === "MIDTRANS" && p.state === "PENDING");
  return (
    <OrderTracker
      autoPay={pay === "1"}
      demo={!isMidtransEnabled()}
      clientKey={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? ""}
      isProduction={process.env.MIDTRANS_IS_PRODUCTION === "true"}
      order={{
        id: order.id,
        code: order.code,
        queueNumber: order.queueNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        payPreference: order.payPreference,
        type: order.type,
        customerName: order.customerName,
        note: order.note,
        subtotal: order.subtotal,
        discount: order.discount,
        serviceCharge: order.serviceCharge,
        tax: order.tax,
        total: order.total,
        paid,
        createdAt: order.createdAt.toISOString(),
        confirmedAt: order.confirmedAt?.toISOString() ?? null,
        preparingAt: order.preparingAt?.toISOString() ?? null,
        readyAt: order.readyAt?.toISOString() ?? null,
        completedAt: order.completedAt?.toISOString() ?? null,
        cancelReason: order.cancelReason,
        outlet: order.outlet,
        table: order.table,
        pendingPaymentId: pending?.id ?? null,
        ahead,
        etaMinutes,
        items: order.items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
          note: i.note,
          modifiers: (i.modifiers as { option: string }[]).map((m) => m.option),
        })),
        payments: order.payments
          .filter((p) => p.state === "SUCCESS")
          .map((p) => ({ id: p.id, method: p.method, amount: p.amount, gatewayType: p.gatewayType })),
      }}
    />
  );
}
