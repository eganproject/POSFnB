import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChefHat,
  CreditCard,
  QrCode,
  ScanLine,
  Smartphone,
  Store,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ROLE_HOME } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: ScanLine, title: "Scan QR di meja", desc: "Customer memindai QR, menu langsung terbuka di HP tanpa perlu install aplikasi." },
  { icon: CreditCard, title: "Pesan & bayar", desc: "Pilih menu, tambah catatan, lalu bayar online atau di kasir." },
  { icon: ChefHat, title: "Dapur langsung masak", desc: "Pesanan masuk ke layar dapur seketika, customer bisa memantau statusnya." },
];

const FEATURES = [
  { icon: QrCode, title: "QR per meja", desc: "Setiap meja punya QR sendiri, pesanan otomatis tercatat ke meja yang benar." },
  { icon: CreditCard, title: "Pembayaran online", desc: "QRIS, e-wallet, dan virtual account lewat Midtrans, terkonfirmasi otomatis." },
  { icon: ChefHat, title: "Layar dapur realtime", desc: "Antrean pesanan rapi dengan timer, tanpa kertas dan tanpa teriak." },
  { icon: Zap, title: "Kasir cepat", desc: "Open bill, split bill, diskon, dan cetak struk thermal dalam beberapa ketukan." },
  { icon: Smartphone, title: "Lacak pesanan", desc: "Customer melihat status masakan dan perkiraan waktu dari HP-nya." },
  { icon: BarChart3, title: "Laporan otomatis", desc: "Penjualan harian, menu terlaris, jam ramai, dan rekap shift kasir." },
];

const ROLES = [
  { emoji: "👑", title: "Owner", desc: "Atur menu, meja, staf, dan lihat laporan." },
  { emoji: "💳", title: "Kasir", desc: "Terima pembayaran dan kelola open bill." },
  { emoji: "👨‍🍳", title: "Dapur", desc: "Lihat antrean dan tandai pesanan siap." },
  { emoji: "🧑‍💼", title: "Pelayan", desc: "Bantu pesan dan antar ke meja." },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const demo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGIN === "true";
  const outlet = demo
    ? await db.outlet.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        include: { tables: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 6 } },
      })
    : null;
  const tryHref = outlet?.tables[0] ? `/t/${outlet.tables[0].qrToken}` : null;

  return (
    <div className="theme-mono min-h-dvh bg-white text-neutral-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <span className="grid size-9 place-items-center rounded-xl bg-neutral-900 text-white">
              <UtensilsCrossed className="size-4" />
            </span>
            Santap POS
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-neutral-500 md:flex">
            <a href="#cara-kerja" className="transition hover:text-neutral-900">Cara kerja</a>
            <a href="#fitur" className="transition hover:text-neutral-900">Fitur</a>
            <a href="#peran" className="transition hover:text-neutral-900">Untuk tim</a>
          </nav>
          <Button asChild className="rounded-full px-5 shadow-none">
            <Link href="/login">Masuk staf</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(circle_at_1px_1px,var(--color-neutral-200)_1px,transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-600">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Sistem kasir untuk restoran & kafe
            </p>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Pesan dari meja, masak tanpa menunggu.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-neutral-500 sm:text-lg lg:mx-0">
              Customer pesan dan bayar sendiri lewat QR. Dapur menerima pesanan seketika, kasir fokus melayani, dan laporan
              tersusun otomatis.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Button asChild size="xl" className="rounded-full px-7 shadow-lg shadow-neutral-900/10">
                <Link href="/login">
                  Masuk dashboard <ArrowRight />
                </Link>
              </Button>
              {tryHref && (
                <Button asChild size="xl" variant="outline" className="rounded-full border-neutral-200 px-7 hover:bg-neutral-50">
                  <Link href={tryHref}>
                    <QrCode /> Coba sebagai customer
                  </Link>
                </Button>
              )}
            </div>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-neutral-500 lg:justify-start">
              {["Tanpa install aplikasi", "Bisa dipakai di HP & tablet", "Pembayaran via Midtrans"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-neutral-900" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <HeroPreview />
        </div>
      </section>

      {/* Cara kerja */}
      <section id="cara-kerja" className="scroll-mt-20 border-t border-neutral-100 bg-neutral-50/70">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHead eyebrow="Cara kerja" title="Tiga langkah, dari meja ke dapur" />
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-3xl border border-neutral-200/70 bg-white p-7">
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl bg-neutral-900 text-white">
                    <s.icon className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-neutral-300">0{i + 1}</span>
                </div>
                <h3 className="mt-6 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Fitur */}
      <section id="fitur" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHead eyebrow="Fitur" title="Semua yang dibutuhkan outlet Anda" desc="Dibuat sederhana supaya tim bisa langsung pakai di hari pertama." />
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-neutral-200/70 bg-neutral-200/70 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="group bg-white p-7 transition-colors hover:bg-neutral-50">
                <span className="grid size-11 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-900 transition group-hover:border-neutral-900 group-hover:bg-neutral-900 group-hover:text-white">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-5 font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Peran */}
      <section id="peran" className="scroll-mt-20 border-t border-neutral-100 bg-neutral-50/70">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHead eyebrow="Untuk tim" title="Satu aplikasi, setiap peran punya layarnya" />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.title} className="rounded-3xl border border-neutral-200/70 bg-white p-6">
                <span className="grid size-12 place-items-center rounded-2xl bg-neutral-100 text-2xl">{r.emoji}</span>
                <h3 className="mt-5 font-bold">{r.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mode development */}
      {outlet && outlet.tables.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-20">
          <div className="rounded-3xl border border-dashed border-neutral-300 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">Demo</span>
              <p className="text-sm font-semibold">Coba pesan dari meja di {outlet.name}</p>
            </div>
            <p className="mt-1.5 text-sm text-neutral-500">Link ini sama dengan hasil scan QR. Hanya tampil di mode development.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {outlet.tables.map((t) => (
                <Link
                  key={t.id}
                  href={`/t/${t.qrToken}`}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
                >
                  <QrCode className="size-3.5" /> {t.name}
                </Link>
              ))}
              <Link
                href={`/m/${outlet.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
              >
                <Store className="size-3.5" /> Takeaway
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-neutral-900 px-6 py-14 text-center text-white sm:px-12">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-white/5" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-white/5" />
          <h2 className="relative mx-auto max-w-xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            Siap melayani lebih cepat hari ini?
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-neutral-400">Masuk dengan akun staf yang dibuat owner untuk mulai berjualan.</p>
          <Button asChild size="xl" className="relative mt-8 rounded-full bg-white px-7 text-neutral-900 shadow-none hover:bg-neutral-100 hover:brightness-100">
            <Link href="/login">
              Masuk sekarang <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-neutral-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-8 text-sm text-neutral-400 sm:flex-row">
          <span className="flex items-center gap-2 font-semibold text-neutral-900">
            <UtensilsCrossed className="size-4" /> Santap POS
          </span>
          <span>© {new Date().getFullYear()} Santap POS. Sistem POS untuk F&B.</span>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold text-neutral-400">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {desc && <p className="mt-3 text-neutral-500">{desc}</p>}
    </div>
  );
}

/** Ilustrasi tampilan aplikasi (dekoratif, tanpa data asli). */
function HeroPreview() {
  const items = [
    { emoji: "🍜", name: "Mie Ayam Spesial", price: "28.000", qty: 2 },
    { emoji: "🧋", name: "Es Kopi Susu", price: "22.000", qty: 1 },
    { emoji: "🍟", name: "Kentang Goreng", price: "18.000", qty: 1 },
  ];
  const steps = ["Diterima", "Dimasak", "Siap"];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md select-none">
      <div className="relative rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400">Meja 05</p>
            <p className="font-bold">Pesanan #A-1024</p>
          </div>
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">Lunas</span>
        </div>

        <div className="mt-5 space-y-2.5">
          {items.map((it) => (
            <div key={it.name} className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-xl">{it.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{it.name}</p>
                <p className="text-xs text-neutral-400">Rp {it.price}</p>
              </div>
              <span className="text-sm font-semibold text-neutral-500">×{it.qty}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Status pesanan</span>
            <span className="text-neutral-400">± 8 menit</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {steps.map((s, i) => (
              <div key={s}>
                <div className={`h-1.5 rounded-full ${i < 2 ? "bg-neutral-900" : "bg-neutral-200"}`} />
                <p className={`mt-1.5 text-xs ${i < 2 ? "font-semibold text-neutral-900" : "text-neutral-400"}`}>{s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2.5 rounded-2xl border border-neutral-200 bg-white px-3.5 py-2.5 shadow-lg shadow-neutral-900/5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-neutral-900 text-white">
            <ChefHat className="size-4" />
          </span>
          <div className="min-w-0 text-xs">
            <p className="truncate font-semibold">Masuk ke dapur</p>
            <p className="text-neutral-400">baru saja</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-2xl border border-neutral-200 bg-white px-3.5 py-2.5 shadow-lg shadow-neutral-900/5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
            <Check className="size-4" />
          </span>
          <div className="min-w-0 text-xs">
            <p className="truncate font-semibold">Bayar QRIS</p>
            <p className="text-neutral-400">Rp 96.000</p>
          </div>
        </div>
      </div>
    </div>
  );
}
