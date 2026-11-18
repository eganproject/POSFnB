import { db } from "@/lib/db";
import { requireOutlet, requireUser } from "@/lib/session";
import { ordersNeedingRefund } from "@/server/orders";
import { PageHeader } from "@/components/staff/page-header";
import { RefundList } from "./refund-list";

export const metadata = { title: "Refund" };
export const dynamic = "force-dynamic";

const TZ = process.env.APP_TIMEZONE || "Asia/Jakarta";
const fmt = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

export default async function RefundsPage() {
  await requireUser(["OWNER"]);
  const outlet = await requireOutlet();
  const [due, history] = await Promise.all([
    ordersNeedingRefund(outlet.id),
    db.refund.findMany({
      where: { order: { outletId: outlet.id } },
      include: { order: { select: { queueNumber: true, code: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Refund"
        description="Pesanan yang uangnya harus dikembalikan ke customer: pesanan batal yang sudah dibayar, atau pembayaran dobel / telat."
      />
      <RefundList
        due={due.map(({ order, money }) => ({
          id: order.id,
          code: order.code,
          queueNumber: order.queueNumber,
          createdAt: fmt(order.createdAt),
          customerName: order.customerName,
          tableName: order.table?.name ?? null,
          status: order.status,
          cancelReason: order.cancelReason,
          total: order.total,
          paid: money.paid,
          refunded: money.refunded,
          refundDue: money.refundDue,
          methods: [...new Set(order.payments.map((p) => p.method))],
        }))}
        history={history.map((r) => ({
          id: r.id,
          createdAt: fmt(r.createdAt),
          queueNumber: r.order.queueNumber,
          code: r.order.code,
          amount: r.amount,
          method: r.method,
          reason: r.reason,
          user: r.user?.name ?? "-",
        }))}
      />
    </div>
  );
}
