import Link from "next/link";
import { notFound } from "next/navigation";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { ArrowLeft, CalendarDays, Heart, Mail, MessageCircle, Phone, Receipt, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { requireOutlet, requireUser } from "@/lib/session";
import { getCustomerDetail } from "@/server/customers";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { formatRupiah, pad } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { CustomerAvatar, fmtAgo, fmtDate, waLink } from "../shared";

export const metadata = { title: "Detail pelanggan" };
export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<OrderStatus, "default" | "secondary" | "success" | "warning" | "destructive" | "info"> = {
  PENDING: "warning",
  CONFIRMED: "info",
  PREPARING: "info",
  READY: "default",
  COMPLETED: "success",
  CANCELLED: "destructive",
};
const PAY_VARIANT: Record<PaymentStatus, "success" | "warning" | "secondary" | "destructive"> = {
  PAID: "success",
  PARTIAL: "warning",
  UNPAID: "secondary",
  REFUNDED: "destructive",
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["OWNER"]);
  const outlet = await requireOutlet();
  const { id } = await params;
  const detail = await getCustomerDetail(outlet.id, decodeURIComponent(id));
  if (!detail) notFound();
  const { profile: c, orders, favorites, avgSpent, cancelledCount } = detail;
  const now = Date.now();
  const guest = c.kind === "GUEST";
  const maxFav = favorites[0]?.quantity ?? 1;

  const stats = [
    { label: "Pesanan", value: String(c.orderCount), hint: cancelledCount ? `${cancelledCount} dibatalkan (tidak dihitung)` : "Tidak termasuk yang batal", icon: ShoppingBag },
    { label: "Total belanja", value: formatRupiah(c.totalSpent), hint: "Pesanan yang sudah dibayar", icon: Wallet },
    { label: "Rata-rata/pesanan", value: formatRupiah(avgSpent), hint: "Dari pesanan yang dibayar", icon: TrendingUp },
    { label: "Terakhir pesan", value: fmtAgo(c.lastOrderAt, now), hint: c.lastOrderAt ? fmtDate(c.lastOrderAt, true) : "Belum ada pesanan", icon: CalendarDays },
  ];

  return (
    <div className="space-y-5">
      <Link href="/dashboard/customers" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="size-4" /> Semua pelanggan
      </Link>

      {/* Profil */}
      <section className="relative overflow-hidden rounded-3xl border bg-card shadow-xs">
        <div className="h-20 bg-gradient-to-r from-olive-deep via-olive to-primary/80 sm:h-24" />
        <div className="flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <CustomerAvatar name={c.name} image={c.image} guest={guest} className="-mt-10 size-20 text-xl ring-4 sm:-mt-12 sm:size-24 sm:text-2xl" />
            <div className="min-w-0 space-y-1.5 sm:pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight">{c.name}</h1>
                <Badge variant={guest ? "secondary" : "default"}>{guest ? "Tamu" : "Akun Google"}</Badge>
                {!c.isActive && <Badge variant="destructive">Nonaktif</Badge>}
              </div>
              <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4">
                {c.email && (
                  <a href={`mailto:${c.email}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-foreground">
                    <Mail className="size-3.5 shrink-0" /> <span className="truncate">{c.email}</span>
                  </a>
                )}
                {c.phone && (
                  <span className="inline-flex items-center gap-1.5 tabular"><Phone className="size-3.5" /> {c.phone}</span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" /> {guest ? "Pertama pesan" : "Bergabung"} {fmtDate(c.joinedAt)}
                </span>
              </div>
            </div>
          </div>
          {c.phone && (
            <a
              href={waLink(c.phone)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white shadow-xs transition hover:brightness-95"
            >
              <MessageCircle className="size-4" /> Chat WhatsApp
            </a>
          )}
        </div>
      </section>

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-xs sm:p-4">
            <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:grid">
              <s.icon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold leading-tight tabular sm:truncate sm:text-xl">{s.value}</p>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block" title={s.hint}>{s.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Riwayat pesanan */}
        <section className="order-2 min-w-0 overflow-hidden rounded-2xl border bg-card shadow-xs lg:order-1">
          <header className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
            <h2 className="font-semibold">Riwayat pesanan</h2>
            <span className="text-xs text-muted-foreground">{orders.length} pesanan</span>
          </header>
          {orders.length === 0 ? (
            <EmptyState icon={<Receipt />} title="Belum ada pesanan" description={`Pelanggan ini belum pernah memesan di ${outlet.name}.`} className="m-4 border-0" />
          ) : (
            <ul className="divide-y">
              {orders.map((o) => {
                const items = o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
                const qty = o.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <li key={o.id} className={o.status === "CANCELLED" ? "opacity-60" : undefined}>
                    <div className="flex gap-3 px-4 py-3.5 sm:px-5">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-sm font-bold tabular">#{pad(o.queueNumber)}</span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                          <p className="text-sm font-medium">
                            {fmtDate(o.createdAt, true)}
                            <span className="text-muted-foreground"> · {o.type === "TAKEAWAY" ? "Takeaway" : o.tableName ?? "Makan di tempat"}</span>
                          </p>
                          <p className="font-semibold tabular">{formatRupiah(o.total)}</p>
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground" title={items}>
                          {qty} item: {items}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <Badge variant={STATUS_VARIANT[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                          <Badge variant={PAY_VARIANT[o.paymentStatus]}>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</Badge>
                          <a
                            href={`/receipt/${o.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <Receipt className="size-3.5" /> Struk
                          </a>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Menu favorit */}
        <aside className="order-1 space-y-5 lg:order-2">
          <section className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Heart className="size-4 text-primary" /> Menu favorit
            </h2>
            {favorites.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data.</p>
            ) : (
              <ol className="space-y-3">
                {favorites.map((f, i) => (
                  <li key={f.name} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate"><span className="mr-1.5 font-semibold text-muted-foreground tabular">{i + 1}.</span>{f.name}</span>
                      <span className="shrink-0 text-xs font-semibold tabular">{f.quantity}×</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, (f.quantity / maxFav) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {guest && (
            <p className="rounded-2xl border border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
              Tamu dikenali dari nomor WhatsApp yang diisi saat memesan tanpa login. Nama yang tampil adalah nama terakhir yang dipakai.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
