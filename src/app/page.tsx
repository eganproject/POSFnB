import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ChefHat, CreditCard, LineChart, QrCode, Smartphone, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ROLE_HOME } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: QrCode, title: "QR per meja", desc: "Customer scan, pilih menu, langsung pesan tanpa antre." },
  { icon: CreditCard, title: "Bayar online", desc: "QRIS, e-wallet & VA lewat Midtrans, otomatis terkonfirmasi." },
  { icon: ChefHat, title: "Dapur realtime", desc: "Pesanan muncul seketika di layar dapur dengan timer." },
  { icon: Zap, title: "Kasir cepat", desc: "Open bill, split bill, diskon, dan cetak struk thermal." },
  { icon: Smartphone, title: "Lacak pesanan", desc: "Customer memantau status masakan dari HP-nya." },
  { icon: LineChart, title: "Laporan lengkap", desc: "Penjualan harian, menu terlaris, jam ramai, shift kasir." },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const demo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGIN === "true";
  const outlet = demo ? await db.outlet.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" }, include: { tables: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 4 } } }) : null;

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between p-5">
        <span className="flex items-center gap-2.5 text-lg font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-lg">🍽️</span> Santap POS
        </span>
        <Button asChild variant="dark">
          <Link href="/login">Masuk staf</Link>
        </Button>
      </header>

      <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-10 text-center sm:pt-20">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 size-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-xs">
          <span className="size-2 rounded-full bg-success" /> Sistem POS F&B modern
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
          Dari scan QR meja sampai <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">dapur</span>, semua terhubung.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-muted-foreground sm:text-lg">
          Customer pesan & bayar sendiri, dapur menerima pesanan seketika, kasir fokus melayani. Laporan tersaji otomatis.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="xl">
            <Link href="/login">
              Masuk dashboard <ArrowRight />
            </Link>
          </Button>
          {outlet?.tables[0] && (
            <Button asChild size="xl" variant="outline">
              <Link href={`/t/${outlet.tables[0].qrToken}`}>Coba sebagai customer</Link>
            </Button>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <f.icon className="size-5" />
            </span>
            <h3 className="mt-4 font-bold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      {outlet && outlet.tables.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="rounded-3xl border border-dashed bg-card/60 p-6">
            <p className="text-sm font-semibold">🧪 Mode development: link QR meja {outlet.name}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {outlet.tables.map((t) => (
                <Link key={t.id} href={`/t/${t.qrToken}`} className="rounded-full border bg-card px-4 py-2 text-sm font-medium transition hover:border-primary hover:text-primary">
                  {t.name}
                </Link>
              ))}
              <Link href={`/m/${outlet.slug}`} className="rounded-full border bg-card px-4 py-2 text-sm font-medium transition hover:border-primary hover:text-primary">
                Takeaway
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
