import Link from "next/link";
import { Banknote, Download, Percent, Receipt, ShoppingBag, XCircle } from "lucide-react";
import { requireOutlet, requireUser } from "@/lib/session";
import { businessDate, cn, formatRupiah, shiftDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { bestSellers, dailySales, salesByCategory, salesByHour, salesByPaymentMethod, salesBySource, salesSummary } from "@/server/reports";
import { PageHeader } from "@/components/staff/page-header";
import { BarList, StatCard } from "@/components/staff/stat-card";
import { HourChart, RevenueChart } from "@/components/staff/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RangePicker } from "./range-picker";
import type { PaymentMethod } from "@prisma/client";

export const metadata = { title: "Laporan" };
export const dynamic = "force-dynamic";

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireUser(["OWNER"]);
  const outlet = await requireOutlet();
  const sp = await searchParams;
  const today = businessDate();
  const to = isDate(sp.to) ? sp.to! : today;
  const from = isDate(sp.from) ? sp.from! : shiftDate(to, -6);
  const range = from <= to ? { from, to } : { from: to, to: from };

  const [summary, daily, top, cats, methods, hours, sources] = await Promise.all([
    salesSummary(outlet.id, range),
    dailySales(outlet.id, range),
    bestSellers(outlet.id, range, 15),
    salesByCategory(outlet.id, range),
    salesByPaymentMethod(outlet.id, range),
    salesByHour(outlet.id, range),
    salesBySource(outlet.id, range),
  ]);
  const methodTotal = methods.reduce((s, m) => s + m.amount, 0) || 1;
  const qr = sources.find((s) => s.source === "QR");
  const pos = sources.find((s) => s.source === "POS");
  const peak = [...hours].sort((a, b) => b.orders - a.orders)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan penjualan"
        description={`${outlet.name} · hanya pesanan lunas yang dihitung`}
        actions={
          <>
            <RangePicker from={range.from} to={range.to} today={today} />
            <Button asChild variant="outline">
              <Link href={`/api/reports/export?from=${range.from}&to=${range.to}`} prefetch={false}>
                <Download /> CSV
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="primary" label="Pendapatan kotor" value={formatRupiah(summary.revenue)} icon={<Banknote />} hint={`Pajak ${formatRupiah(summary.tax)} · Service ${formatRupiah(summary.service)}`} />
        <StatCard label="Transaksi" value={summary.orders} icon={<Receipt />} hint={`${summary.itemsSold} item terjual`} />
        <StatCard label="Rata-rata / transaksi" value={formatRupiah(summary.avgTicket)} icon={<ShoppingBag />} hint={peak?.orders ? `Jam tersibuk ${peak.hour}:00` : undefined} />
        <StatCard label="Diskon & batal" value={formatRupiah(summary.discount)} icon={summary.cancelled ? <XCircle /> : <Percent />} hint={`${summary.cancelled} pesanan dibatalkan`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pendapatan harian</CardTitle>
          <CardDescription>
            Pesanan via QR: <b>{qr?.orders ?? 0}</b> ({formatRupiah(qr?.revenue ?? 0)}) · via kasir: <b>{pos?.orders ?? 0}</b> ({formatRupiah(pos?.revenue ?? 0)})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueChart data={daily} height={300} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Menu terlaris</CardTitle>
            <CardDescription>Berdasarkan jumlah porsi</CardDescription>
          </CardHeader>
          <CardContent>
            {top.length ? (
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 font-medium">#</th>
                    <th className="py-2 font-medium">Menu</th>
                    <th className="py-2 text-right font-medium">Porsi</th>
                    <th className="py-2 text-right font-medium">Penjualan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {top.map((t, i) => (
                    <tr key={t.name} className="transition-colors hover:bg-muted/40">
                      <td className="py-2 text-muted-foreground">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
                      <td className="py-2 font-medium">{t.name}</td>
                      <td className="py-2 text-right tabular">{t.qty}</td>
                      <td className="py-2 text-right tabular">{formatRupiah(t.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Per kategori</CardTitle>
            </CardHeader>
            <CardContent>{cats.length ? <BarList items={cats.map((c) => ({ name: c.name, value: c.revenue }))} format={formatRupiah} /> : <Empty />}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Metode pembayaran</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {methods.length ? (
                <>
                  <div className="flex h-3 overflow-hidden rounded-full">
                    {methods.map((m, i) => (
                      <div key={m.method} style={{ width: `${(m.amount / methodTotal) * 100}%` }} className={cn(PALETTE[i % PALETTE.length])} />
                    ))}
                  </div>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {methods.map((m, i) => (
                      <li key={m.method} className="flex items-center gap-2 text-sm">
                        <span className={cn("size-2.5 rounded-full", PALETTE[i % PALETTE.length])} />
                        <span className="flex-1">{PAYMENT_METHOD_LABEL[m.method as PaymentMethod]}</span>
                        <span className="font-semibold tabular">{Math.round((m.amount / methodTotal) * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <Empty />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jam ramai</CardTitle>
          <CardDescription>Jumlah transaksi per jam</CardDescription>
        </CardHeader>
        <CardContent>
          <HourChart data={hours} />
        </CardContent>
      </Card>
    </div>
  );
}

const PALETTE = ["bg-primary", "bg-sky-500", "bg-emerald-500", "bg-violet-500", "bg-amber-400"];

function Empty() {
  return <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data di periode ini</p>;
}
