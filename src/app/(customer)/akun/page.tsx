import Link from "next/link";
import { ArrowLeft, History, ShoppingBag } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentCustomer, getSessionUser } from "@/lib/session";
import { isGoogleLoginEnabled } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/constants";
import { BRAND } from "@/lib/brand";
import { BrandMark } from "@/components/shared/brand-mark";
import { GoogleSignIn } from "@/components/customer/google-sign-in";
import { AccountView } from "@/components/customer/account-view";
import { orderSummaryInclude, toOrderSummary } from "@/server/order-summary";
import { sortOrderSummaries } from "@/lib/order-summary";


export const dynamic = "force-dynamic";
export const metadata = { title: "Akun saya" };

const ERRORS: Record<string, string> = {
  access_denied: "Login Google dibatalkan.",
  unable_to_create_session: "Akun ini dinonaktifkan. Hubungi kami.",
  email_not_found: "Akun Google tidak memberikan alamat email.",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const [sessionUser, customer, googleEnabled, outlets] = await Promise.all([
    getSessionUser(),
    getCurrentCustomer(),
    isGoogleLoginEnabled(),
    db.outlet.findMany({
      where: { isActive: true, takeawayEnabled: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, slug: true, address: true, openTime: true, closeTime: true },
    }),
  ]);

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto min-h-dvh max-w-xl bg-background pb-12">
      <header className="bg-olive px-5 pb-8 pt-4 text-cream">
        <div className="flex items-center justify-between">
          <Link href={safeNext ?? (outlets[0] ? `/m/${outlets[0].slug}` : "/")} className="flex items-center gap-1.5 rounded-full py-1.5 pr-2 text-sm font-medium text-cream/85 hover:text-cream">
            <ArrowLeft className="size-4" /> {safeNext ? "Kembali" : "Menu"}
          </Link>
          <span className="flex items-center gap-2">
            <BrandMark className="size-7" /> <span className="font-display text-xl leading-none">{BRAND.shortName}</span>
          </span>
        </div>
      </header>
      {children}
    </div>
  );

  if (sessionUser && sessionUser.role !== "CUSTOMER") {
    return shell(
      <div className="space-y-3 p-5">
        <h1 className="text-xl font-bold">Anda masuk sebagai staf</h1>
        <p className="text-sm text-muted-foreground">Riwayat pesanan hanya untuk akun pelanggan.</p>
        <Link href={ROLE_HOME[sessionUser.role]} className="inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Buka dashboard
        </Link>
      </div>
    );
  }

  if (!customer) {
    return shell(
      <div className="-mt-4 space-y-5 px-4">
        <section className="space-y-5 rounded-3xl border bg-card p-6 shadow-lg shadow-olive-deep/5">
          <div className="space-y-1.5">
            <h1 className="font-display text-3xl leading-tight text-olive-deep">Akun pelanggan</h1>
            <p className="text-sm text-muted-foreground">Masuk sekali untuk menyimpan riwayat kunjungan & pesanan, pesan ulang favoritmu, dan pesan takeaway dari rumah.</p>
          </div>
          <ul className="space-y-2 text-sm">
            {[
              [History, "Riwayat pesanan & kunjungan tersimpan di semua perangkat"],
              [ShoppingBag, "Pesan takeaway, pilih jam ambil, bayar online"],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof History;
              return (
                <li key={i} className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><I className="size-4" /></span>
                  {text as string}
                </li>
              );
            })}
          </ul>
          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {ERRORS[error] ?? "Gagal masuk dengan Google. Silakan coba lagi."}
            </p>
          )}
          {googleEnabled ? (
            <GoogleSignIn next={safeNext ?? "/akun"} />
          ) : (
            <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">Login pelanggan belum diaktifkan oleh pemilik outlet.</p>
          )}
          <p className="text-center text-xs text-muted-foreground">Tanpa login pun kamu tetap bisa pesan lewat QR meja.</p>
        </section>
        {outlets.length > 0 && <TakeawayList outlets={outlets} />}
      </div>
    );
  }

  const where = { customerId: customer.id };
  const [orders, totals, visits, favourites] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: orderSummaryInclude,
    }),
    db.order.aggregate({ where: { ...where, status: { not: "CANCELLED" } }, _count: true, _sum: { total: true } }),
    db.order.groupBy({ by: ["outletId", "businessDate"], where: { ...where, status: { not: "CANCELLED" } } }),
    db.orderItem.groupBy({
      by: ["name"],
      where: { order: { ...where, status: { not: "CANCELLED" } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 3,
    }),
  ]);

  return shell(
    <AccountView
      customer={customer}
      stats={{ orders: totals._count, spent: totals._sum.total ?? 0, visits: visits.length, favourites: favourites.map((f) => ({ name: f.name, qty: f._sum.quantity ?? 0 })) }}
      orders={sortOrderSummaries(orders.map((o) => toOrderSummary(o, { withDate: true })))}
    >
      {outlets.length > 0 && <TakeawayList outlets={outlets} />}
    </AccountView>
  );
}

function TakeawayList({ outlets }: { outlets: { id: string; name: string; slug: string; address: string | null; openTime: string; closeTime: string }[] }) {
  return (
    <section className="space-y-2.5">
      <h2 className="font-display text-2xl text-olive-deep">Pesan takeaway</h2>
      {outlets.map((o) => (
        <Link key={o.id} href={`/m/${o.slug}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 transition hover:border-primary hover:bg-primary/5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-cream text-olive-deep"><ShoppingBag className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{o.name}</span>
            <span className="block truncate text-xs text-muted-foreground">Buka {o.openTime}–{o.closeTime}{o.address ? ` · ${o.address}` : ""}</span>
          </span>
          <span className="text-sm font-semibold text-primary">Pesan</span>
        </Link>
      ))}
    </section>
  );
}
