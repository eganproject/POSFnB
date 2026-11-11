import Link from "next/link";
import { ArrowRight, Banknote, ClipboardList, Receipt, ShoppingBag, TrendingDown, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { db } from "@/lib/db";
import { requireOutlet, requireUser } from "@/lib/session";
import { businessDate, formatRupiah, pad, percentChange, shiftDate } from "@/lib/utils";
import { bestSellers, dailySales, salesSummary } from "@/server/reports";
import { PageHeader } from "@/components/staff/page-header";
import { BarList, StatCard } from "@/components/staff/stat-card";
import { RevenueChart } from "@/components/staff/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Ringkasan" };

export default async function OverviewPage() {
  const user = await requireUser(["OWNER"]);
  const outlet = await requireOutlet();
  const today = businessDate();
  const yesterday = shiftDate(today, -1);
  const [todayS, yestS, week, top, active, recent] = await Promise.all([
    salesSummary(outlet.id, { from: today, to: today }),
    salesSummary(outlet.id, { from: yesterday, to: yesterday }),
    dailySales(outlet.id, { from: shiftDate(today, -13), to: today }),
    bestSellers(outlet.id, { from: shiftDate(today, -6), to: today }, 6),
    db.order.groupBy({ by: ["status"], where: { outletId: outlet.id, status: { in: ["PENDING", "CONFIRMED", "PREPARING", "READY"] } }, _count: true }),
    db.order.findMany({
      where: { outletId: outlet.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { table: { select: { name: true } } },
    }),
  ]);
  const activeCount = (s: string) => active.find((a) => a.status === s)?._count ?? 0;
  const revChange = percentChange(todayS.revenue, yestS.revenue);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: process.env.APP_TIMEZONE || "Asia/Jakarta" }).format(new Date()));
  const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greet}, ${user.name.split(" ")[0]} 👋`}
        description={`Ini performa ${outlet.name} hari ini.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/reports">
                Laporan lengkap <ArrowRight />
              </Link>
            </Button>
          </>
        }
      />

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="primary"
          label="Pendapatan hari ini"
          value={formatRupiah(todayS.revenue)}
          icon={<Banknote />}
          hint={
            revChange === null ? "Belum ada data kemarin" : (
              <span className="inline-flex items-center gap-1">
                {revChange >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {revChange >= 0 ? "+" : ""}{revChange}% dibanding kemarin
              </span>
            )
          }
        />
        <StatCard label="Pesanan lunas" value={todayS.orders} icon={<Receipt />} hint={`${todayS.itemsSold} item terjual`} />
        <StatCard label="Rata-rata transaksi" value={formatRupiah(todayS.avgTicket)} icon={<ShoppingBag />} hint={`Kemarin ${formatRupiah(yestS.avgTicket)}`} />
        <StatCard
          label="Pesanan aktif"
          value={activeCount("PENDING") + activeCount("CONFIRMED") + activeCount("PREPARING") + activeCount("READY")}
          icon={<ClipboardList />}
          hint={`${activeCount("PENDING")} menunggu · ${activeCount("PREPARING")} dimasak · ${activeCount("READY")} siap`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Tren pendapatan</CardTitle>
            <CardDescription>14 hari terakhir</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={week} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Menu terlaris</CardTitle>
            <CardDescription>7 hari terakhir</CardDescription>
          </CardHeader>
          <CardContent>
            {top.length ? (
              <BarList items={top.map((t) => ({ name: t.name, value: t.qty, sub: "porsi" }))} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Belum ada penjualan</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Pesanan terbaru</CardTitle>
            <CardDescription>Update otomatis secara realtime</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/orders">
              Semua pesanan <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState icon={<Receipt />} title="Belum ada pesanan" />
          ) : (
            <div className="stagger -mx-2 divide-y divide-border/70">
              {recent.map((o) => (
                <Link key={o.id} href={`/dashboard/orders?id=${o.id}`} className="group flex items-center gap-4 rounded-xl px-2 py-3 transition hover:bg-muted/50">
                  <span className="grid size-11 place-items-center rounded-xl bg-muted font-bold tabular transition group-hover:bg-primary/10 group-hover:text-primary">#{pad(o.queueNumber)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{o.customerName || "Tanpa nama"} · {o.table?.name ?? "Takeaway"}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.source === "QR" ? "QR" : "Kasir"} · {formatDistanceToNow(o.createdAt, { addSuffix: true, locale: localeId })}
                    </p>
                  </div>
                  <OrderStatusBadge status={o.status} />
                  <span className="hidden w-28 text-right font-semibold tabular sm:block">{formatRupiah(o.total)}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
