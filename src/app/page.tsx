import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, Clock, MapPin, QrCode, Star, Store } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ROLE_HOME } from "@/lib/constants";
import { BRAND, BRAND_PHOTOS, BRAND_REVIEWS } from "@/lib/brand";
import { formatRupiah } from "@/lib/utils";
import { BrandMark } from "@/components/shared/brand-mark";
import { ProductImage } from "@/components/shared/product-image";

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Scan QR di meja", desc: "Setiap meja punya QR sendiri. Menu terbuka di HP tanpa install aplikasi." },
  { title: "Pilih & bayar", desc: "Atur hot atau ice, cocolan, sampai level pedas. Bayar QRIS di HP atau di kasir." },
  { title: "Pantau pesanan", desc: "Status dari bar dan dapur tampil langsung, sampai pesanan diantar ke mejamu." },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const demo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGIN === "true";
  const [outlet, favourites] = await Promise.all([
    db.outlet.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      include: { tables: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 6 } },
    }),
    db.product.findMany({
      where: { isActive: true, isFeatured: true, imageUrl: { not: null } },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: { category: { select: { name: true } } },
      take: 6,
    }),
  ]);
  const menuHref = outlet ? `/m/${outlet.slug}` : "/login";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-olive-deep/20 bg-olive text-cream">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark className="size-8" />
            <span className="font-display text-2xl leading-none tracking-wide">{BRAND.shortName}</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-cream/75 md:flex">
            <a href="#favorit" className="transition hover:text-cream">Favorit</a>
            <a href="#ruang" className="transition hover:text-cream">Ruang</a>
            <a href="#pesan" className="transition hover:text-cream">Cara pesan</a>
            <a href="#kunjungi" className="transition hover:text-cream">Kunjungi</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/akun" className="rounded-full px-3 py-2 text-sm text-cream/75 transition hover:text-cream">
              Akun saya
            </Link>
            <Link href="/login" className="hidden rounded-full px-3 py-2 text-sm text-cream/75 transition hover:text-cream sm:block">
              Masuk staf
            </Link>
            <Link
              href={menuHref}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-cream px-5 text-sm font-semibold text-olive-deep transition hover:brightness-95 active:scale-[0.98]"
            >
              Lihat menu
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-olive text-cream">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cream/70">{BRAND.tagline}</p>
            <h1 className="mt-4 font-display text-[clamp(4rem,13vw,8.5rem)] leading-[0.88]">
              Warm
              <br />
              Hour
            </h1>
            <p className="mt-5 max-w-md font-serif text-2xl italic leading-snug text-cream/90">
              Kopi, matcha, roti cocol &amp; salt bread, untuk jam-jam yang ingin dinikmati pelan-pelan.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={menuHref}
                className="inline-flex items-center gap-2 rounded-full bg-cream px-7 py-3.5 font-semibold text-olive-deep transition hover:brightness-95 active:scale-[0.98]"
              >
                {outlet?.takeawayEnabled ? "Pesan takeaway" : "Lihat menu"} <ArrowRight className="size-4" />
              </Link>
              <a
                href={BRAND.links.maps}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-cream/40 px-7 py-3.5 font-semibold transition hover:bg-cream/10"
              >
                <MapPin className="size-4" /> Petunjuk arah
              </a>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-cream/25 pt-5 text-sm">
              <div>
                <dt className="text-cream/60">Buka setiap hari</dt>
                <dd className="mt-1 font-semibold tabular">{BRAND.hoursShort}</dd>
              </div>
              <div>
                <dt className="text-cream/60">Google</dt>
                <dd className="mt-1 flex items-center gap-1 font-semibold">
                  <Star className="size-3.5 fill-honey text-honey" /> {BRAND.rating.score}
                  <span className="font-normal text-cream/60">({BRAND.rating.count})</span>
                </dd>
              </div>
              <div>
                <dt className="text-cream/60">Lokasi</dt>
                <dd className="mt-1 font-semibold">Duri Pulo</dd>
              </div>
            </dl>
          </div>

          {/* Kolase foto */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <Photo src={BRAND_PHOTOS.interior[0]} alt="Ruang dalam Warm Hour Cafe" className="aspect-[4/5] w-[78%] rounded-[2rem]" eager />
            <Photo
              src="/warmhour/roti-cocol.jpg"
              alt="Roti cocol dengan aneka cocolan"
              className="absolute -bottom-6 right-0 aspect-square w-[46%] rounded-[1.5rem] ring-[6px] ring-olive"
              eager
            />
            <Photo
              src="/warmhour/matcha-corn-tea.jpg"
              alt="Matcha Warm Hour"
              className="absolute right-[4%] top-6 aspect-square w-[32%] rounded-[1.25rem] ring-[6px] ring-olive"
              eager
            />
          </div>
        </div>
      </section>

      {/* Favorit */}
      {favourites.length > 0 && (
        <section id="favorit" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <SectionHead eyebrow="Dari bar & dapur kami" title="House favourites" action={{ href: menuHref, label: "Semua menu" }} />
            <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:gap-x-6">
              {favourites.map((p) => (
                <Link key={p.id} href={menuHref} className="group block">
                  <ProductImage
                    src={p.imageUrl}
                    name={p.name}
                    emoji={p.emoji}
                    className="aspect-[4/3] rounded-2xl"
                    imgClassName="transition duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <h3 className="font-serif text-xl font-semibold leading-tight sm:text-2xl">{p.name}</h3>
                    <span className="shrink-0 text-sm font-semibold tabular text-muted-foreground">{formatRupiah(p.price)}</span>
                  </div>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{p.category.name}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Ruang */}
      <section id="ruang" className="scroll-mt-20 bg-secondary">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <SectionHead eyebrow="Ruang" title="Tenang, hangat, dan tidak berdesakan" />
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <Photo src={BRAND_PHOTOS.front} alt="Tampak depan Warm Hour Cafe" className="aspect-[3/4] rounded-2xl" />
            <Photo src={BRAND_PHOTOS.interior[1]} alt="Sudut meja dengan lampu hangat" className="aspect-[3/4] rounded-2xl md:mt-8" />
            <Photo src={BRAND_PHOTOS.display} alt="Etalase kue dan salt bread" className="aspect-[3/4] rounded-2xl" />
            <Photo src={BRAND_PHOTOS.interior[3]} alt="Deretan meja di dekat jendela" className="aspect-[3/4] rounded-2xl md:mt-8" />
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {BRAND_REVIEWS.map((r) => (
              <figure key={r.quote} className="border-t border-olive/30 pt-5">
                <blockquote className="font-serif text-xl italic leading-snug">“{r.quote}”</blockquote>
                <figcaption className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <Star className="size-3.5 fill-honey text-honey" /> {r.by}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Cara pesan */}
      <section id="pesan" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <SectionHead eyebrow="Tanpa antre di kasir" title="Pesan dari meja" />
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t-2 border-olive pt-5">
                <span className="font-display text-5xl leading-none text-honey">{i + 1}</span>
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 leading-relaxed text-muted-foreground">{s.desc}</p>
              </li>
            ))}
          </ol>

          {demo && outlet && outlet.tables.length > 0 && (
            <div className="mt-12 rounded-3xl border border-dashed border-olive/40 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-olive px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cream">Demo</span>
                <p className="text-sm font-semibold">Coba pesan seperti tamu di {outlet.name}</p>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">Link ini sama dengan hasil scan QR di meja. Hanya tampil di mode demo.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {outlet.tables.map((t) => (
                  <Link
                    key={t.id}
                    href={`/t/${t.qrToken}`}
                    className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium transition hover:border-olive hover:bg-olive hover:text-cream"
                  >
                    <QrCode className="size-3.5" /> {t.name}
                  </Link>
                ))}
                <Link
                  href={`/m/${outlet.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium transition hover:border-olive hover:bg-olive hover:text-cream"
                >
                  <Store className="size-3.5" /> Bawa pulang
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Kunjungi */}
      <section id="kunjungi" className="scroll-mt-20 bg-olive text-cream">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:py-20 md:grid-cols-2 md:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cream/65">Kunjungi kami</p>
            <h2 className="mt-3 font-display text-5xl leading-none sm:text-6xl">{BRAND.area}</h2>
            <p className="mt-5 max-w-sm leading-relaxed text-cream/85">{BRAND.address}</p>
            <a
              href={BRAND.links.maps}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3 font-semibold text-olive-deep transition hover:brightness-95"
            >
              <MapPin className="size-4" /> Buka di Google Maps
            </a>
          </div>
          <div>
            <dl className="font-serif text-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-cream/25 py-3">
                <dt className="flex items-center gap-2.5">
                  <Clock className="size-5 text-cream/60" /> Senin – Minggu
                </dt>
                <dd className="tabular">{BRAND.hoursShort}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-cream/25 py-3">
                <dt>Kisaran harga</dt>
                <dd className="text-right">Rp 50–75 rb</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-cream/25 py-3">
                <dt>Layanan</dt>
                <dd className="text-right">Dine in · Takeaway</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-2.5 text-sm font-semibold">
              <ExtLink href={BRAND.links.instagram}>Instagram {BRAND.links.instagramHandle}</ExtLink>
              <ExtLink href={BRAND.links.grabfood}>GrabFood</ExtLink>
              <ExtLink href={BRAND.links.customCake}>Custom cake</ExtLink>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-olive-deep text-cream/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-7 text-sm sm:flex-row">
          <span className="flex items-center gap-2 text-cream">
            <BrandMark className="size-5" /> <span className="font-display text-lg tracking-wide">{BRAND.name}</span>
          </span>
          <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span>Pemesanan meja &amp; kasir oleh {BRAND.poweredBy}</span>
            <Link href="/login" className="font-semibold text-cream underline-offset-4 hover:underline">
              Masuk staf
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, action }: { eyebrow: string; title: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-2 font-display text-4xl leading-none text-olive-deep text-balance sm:text-5xl">{title}</h2>
      </div>
      {action && (
        <Link href={action.href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-olive-deep underline-offset-4 hover:underline">
          {action.label} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

function Photo({ src, alt, className, eager }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <div className={`overflow-hidden bg-olive-deep/20 ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} className="size-full object-cover" />
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-cream/40 px-4 py-2 transition hover:bg-cream/10"
    >
      {children} <ArrowUpRight className="size-3.5 opacity-70" />
    </a>
  );
}
