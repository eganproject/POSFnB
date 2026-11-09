import Link from "next/link";
import { db } from "@/lib/db";
import { requireOutlet, requireUser } from "@/lib/session";
import { pad } from "@/lib/utils";
import { PageHeader } from "@/components/staff/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { History } from "lucide-react";

export const metadata = { title: "Log aktivitas" };
export const dynamic = "force-dynamic";

const TZ = process.env.APP_TIMEZONE || "Asia/Jakarta";
const fmt = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);

const LABEL: Record<string, { text: string; tone: string }> = {
  DISCOUNT: { text: "Diskon", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  ORDER_CANCEL: { text: "Batal", tone: "bg-destructive/10 text-destructive" },
  ITEM_ADJUST: { text: "Ubah item", tone: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  REFUND: { text: "Refund", tone: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  OVERPAID: { text: "Lebih bayar", tone: "bg-destructive/10 text-destructive" },
};

const FILTERS = [
  { v: "", label: "Semua" },
  { v: "DISCOUNT", label: "Diskon" },
  { v: "ORDER_CANCEL", label: "Batal" },
  { v: "ITEM_ADJUST", label: "Ubah item" },
  { v: "REFUND", label: "Refund" },
  { v: "OVERPAID", label: "Lebih bayar" },
];

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requireUser(["OWNER"]);
  const outlet = await requireOutlet();
  const { action } = await searchParams;
  const filter = action && LABEL[action] ? action : undefined;
  const logs = await db.auditLog.findMany({
    where: { outletId: outlet.id, ...(filter ? { action: filter } : {}) },
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const orderIds = [...new Set(logs.flatMap((l) => (l.orderId ? [l.orderId] : [])))];
  const orders = await db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, queueNumber: true, businessDate: true } });
  const byId = new Map(orders.map((o) => [o.id, o]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Log aktivitas"
        description="Jejak diskon, pembatalan, perubahan item, refund, dan pembayaran janggal. Tidak bisa diubah atau dihapus dari aplikasi."
      />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.v}
            href={f.v ? `/dashboard/activity?action=${f.v}` : "/dashboard/activity"}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${(filter ?? "") === f.v ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {logs.length === 0 ? (
        <EmptyState icon={<History />} title="Belum ada aktivitas" />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {logs.map((l) => {
              const tag = LABEL[l.action] ?? { text: l.action, tone: "bg-muted" };
              const order = l.orderId ? byId.get(l.orderId) : null;
              return (
                <div key={l.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:gap-4">
                  <span className={`w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tag.tone}`}>{tag.text}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{l.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(l.createdAt)} · {l.user ? `${l.user.name}` : "Sistem"}
                      {order ? ` · pesanan #${pad(order.queueNumber)} (${order.businessDate})` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
