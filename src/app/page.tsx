import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, Clock, MapPin, QrCode, Star, Store } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ROLE_HOME } from "@/lib/constants";
import { BRAND, BRAND_PHOTOS, BRAND_REVIEWS } from "@/lib/brand";
import { formatRupiah } from "@/lib/utils";
import { isOpenNow } from "@/lib/pickup";
import { BrandMark } from "@/components/shared/brand-mark";
import { ProductImage } from "@/components/shared/product-image";
import { BrewCup } from "@/components/landing/brew-cup";
import { LandingMotion } from "@/components/landing/landing-motion";
import { OrderPhone, type PhoneItem } from "@/components/landing/order-phone";
import "./landing.css";

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Scan QR di meja", desc: "Setiap meja punya QR sendiri. Menu terbuka di HP tanpa install aplikasi." },
  { title: "Pilih menu", desc: "Atur hot atau ice, cocolan, sampai level pedas, lalu masukkan ke keranjang." },
  { title: "Bayar di HP", desc: "Bayar pakai QRIS langsung dari HP, atau bayar di kasir kalau lebih nyaman." },
  { title: "Pantau pesanan", desc: "Status dari bar dan dapur tampil langsung, sampai pesanan diantar ke mejamu." },
];

const BREW = [
  { title: "Biji digiling saat kamu pesan", desc: "Espresso diekstrak segar untuk setiap cangkir, bukan disiapkan dari pagi." },
  { title: "Susu dituang pelan-pelan", desc: "Susu segar atau oat milk, panas atau dingin, sesuai seleramu." },
  { title: "Hangat, siap dinikmati", desc: "Diantar ke mejamu selagi masih mengepul." },
];

const RIBBON = ["Kopi", "Matcha", "Roti cocol", "Salt bread", "Basque cake", "Tahu rempah"];

/** Dipakai mockup HP bila menu unggulan di database belum cukup */
const PHONE_FALLBACK: PhoneItem[] = [
  { name: "Dirty Latte", price: 45000, imageUrl: "/warmhour/dirty-latte.jpg", emoji: "☕" },
  { name: "Roti Cocol", price: 30000, imageUrl: "/warmhour/roti-cocol.jpg", emoji: "🍞" },
  { name: "Tahu Rempah", price: 27000, imageUrl: "/warmhour/tahu-rempah.jpg", emoji: "🍢" },
  { name: "Montblanc", price: 45000, imageUrl: "/warmhour/montblanc.jpg", emoji: "☕" },
];

const clock = (hhmm: string) => hhmm.replace(":", ".");

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const demo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGIN === "true";
  const [outlet, favourites, menuCount] = await Promise.all([
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
    db.product.count({ where: { isActive: true } }),
  ]);
  const menuHref = outlet ? `/m/${outlet.slug}` : "/login";
  const phoneItems: PhoneItem[] = favourites.length >= 4 ? favourites : PHONE_FALLBACK;
  const openNow = outlet ? isOpenNow(new Date(), outlet, process.env.APP_TIMEZONE || "Asia/Jakarta") : null;
  const stats = [
    { value: Number(BRAND.rating.score.replace(",", ".")), text: BRAND.rating.score, dec: 1, label: "rating Google" },
    { value: BRAND.rating.count, text: String(BRAND.rating.count), dec: 0, label: "ulasan tamu" },
    { value: menuCount, text: String(menuCount), dec: 0, label: "pilihan menu" },
  ].filter((s) => s.value > 0);

  return (
    <div className="lp min-h-dvh bg-background text-foreground">
      <LandingMotion />
      <div className="lp-progress" aria-hidden />

      {/* Header */}
      <header className="lp-header sticky top-0 z-30 border-b border-olive-deep/20 bg-olive text-cream">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="size-8 shrink-0" />
            <span className="truncate font-display text-xl leading-none tracking-wide sm:text-2xl">{BRAND.shortName}</span>
          </Link>
          <nav className="lp-nav hidden items-center gap-6 whitespace-nowrap text-sm text-cream/75 min-[900px]:flex lg:gap-8">
            <a href="#favorit">Favorit</a>
            <a href="#ruang">Ruang</a>
            <a href="#pesan">Cara pesan</a>
            <a href="#kunjungi">Kunjungi</a>
          </nav>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link href="/akun" className="rounded-full px-2.5 py-2 text-sm text-cream/75 transition hover:text-cream sm:px-3">
              Akun<span className="hidden min-[400px]:inline"> saya</span>
            </Link>
            <Link href="/login" className="hidden rounded-full px-3 py-2 text-sm text-cream/75 transition hover:text-cream sm:block">
              Masuk staf
            </Link>
            <Link
              href={menuHref}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-cream px-4 text-sm font-semibold text-olive-deep transition hover:brightness-95 active:scale-[0.98] sm:px-5"
            >
              Lihat menu
            </Link>
          </div>
        </div>
      </header>

      {/* Hero: parallax berlapis */}
      <section className="lp-hero bg-olive text-cream">
        <canvas className="lp-beans" aria-hidden />
        <div className="relative z-[2] mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 sm:pt-14 md:grid-cols-[1.05fr_1fr] md:gap-8 md:pb-24 lg:gap-14 lg:pb-28">
          <div>
            <p className="lp-intro text-xs font-semibold uppercase tracking-[0.24em] text-cream/70" style={delay(0.1)}>
              {BRAND.tagline}
            </p>
            <h1 className="mt-4 font-display text-[clamp(3.75rem,13vw,8.5rem)] leading-[0.9]" aria-label={BRAND.shortName}>
              <Letters text="Warm" />
              <Letters text="Hour" from={4} />
            </h1>
            <p className="lp-intro mt-5 max-w-md font-serif text-[clamp(1.25rem,2.6vw,1.5rem)] italic leading-snug text-cream/90" style={delay(0.8)}>
              Kopi, matcha, roti cocol &amp; salt bread, untuk jam-jam yang ingin dinikmati pelan-pelan.
            </p>
            <div className="lp-intro mt-8 flex flex-wrap gap-3" style={delay(0.95)}>
              <Link
                href={menuHref}
                className="inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3.5 font-semibold text-olive-deep transition hover:brightness-95 active:scale-[0.98] sm:px-7"
              >
                {outlet?.takeawayEnabled ? "Pesan takeaway" : "Lihat menu"} <ArrowRight className="size-4" />
              </Link>
              <a
                href={BRAND.links.maps}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-cream/40 px-6 py-3.5 font-semibold transition hover:bg-cream/10 sm:px-7"
              >
                <MapPin className="size-4" /> Petunjuk arah
              </a>
            </div>
            <dl className="lp-intro mt-10 grid max-w-md grid-cols-3 gap-3 border-t border-cream/25 pt-5 text-[13px] sm:gap-4 sm:text-sm" style={delay(1.1)}>
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

          {/* Kolase foto: tiap lapis bergerak dengan kecepatan berbeda */}
          <div className="lp-collage">
            <div className="lp-plx" data-plx="50">
              <div className="lp-ph lp-p1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={BRAND_PHOTOS.interior[0]} alt="Ruang dalam Warm Hour Cafe" />
              </div>
            </div>
            <div className="lp-ph lp-p3 lp-pop lp-plx" data-plx="160">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/warmhour/matcha-corn-tea.jpg" alt="Matcha Warm Hour" />
            </div>
            <div className="lp-ph lp-p2 lp-pop lp-plx" data-plx="110">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/warmhour/roti-cocol.jpg" alt="Roti cocol dengan aneka cocolan" />
            </div>
            <div className="lp-stamp lp-plx" data-plx="190" aria-hidden>
              <svg className="lp-stamp-ring" viewBox="0 0 128 128">
                <defs>
                  <path id="lp-stamp-circle" d="M64 64m-48 0a48 48 0 1 1 96 0a48 48 0 1 1-96 0" />
                </defs>
                <text>
                  <textPath href="#lp-stamp-circle">{BRAND.tagline} · buka setiap hari · </textPath>
                </text>
              </svg>
              <svg className="lp-stamp-cup" viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <g className="lp-steam">
                  <path d="M19 20c0-4 4-4 4-8" />
                  <path d="M26 20c0-4 4-4 4-8" />
                  <path d="M33 20c0-4 4-4 4-8" />
                </g>
                <path d="M12 25h28v6a12 12 0 0 1-12 12h-4a12 12 0 0 1-12-12zM40 27h2.500a4.500 4.500 0 0 1 0 9H39" />
              </svg>
            </div>
          </div>
        </div>
        <div className="lp-hint absolute bottom-5 left-1/2 z-[3] hidden -translate-x-1/2 flex-col items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-cream/65 md:flex" aria-hidden>
          <span>Scroll</span>
          <i />
        </div>
      </section>

      {/* Pita teks berjalan mengikuti scroll */}
      <div className="lp-ribbon border-y border-olive-deep/15 bg-cream py-3 text-olive-deep sm:py-4" aria-hidden>
        <div className="lp-ribbon-track font-display text-[clamp(1.5rem,4vw,2.4rem)]">
          {[0, 1, 2, 3].flatMap((n) => RIBBON.map((w) => <span key={`${n}-${w}`}>{w}</span>))}
        </div>
      </div>

      {/* Cangkir terisi mengikuti scroll */}
      <section className="lp-brew bg-olive-deep text-cream">
        <div className="lp-brew-pin">
          <canvas className="lp-beans" data-few="1" aria-hidden />
          <div className="relative z-[2] mx-auto grid w-full max-w-6xl items-center gap-6 px-5 md:grid-cols-2 md:gap-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cream/60">Dari bar kami</p>
              <h2 className="mt-2 font-display text-[clamp(2rem,5vw,3.4rem)] leading-[1.02] text-balance">Diseduh pelan, satu cangkir sekali.</h2>
              <div className="lp-caps mt-5 sm:mt-6">
                {BREW.map((b, i) => (
                  <div key={b.title} className={`lp-cap${i === BREW.length - 1 ? " lp-on" : ""}`}>
                    <p className="font-serif text-[clamp(1.4rem,3.4vw,2rem)] italic leading-tight text-[#f6d79b]">{b.title}</p>
                    <p className="mt-2 max-w-sm text-cream/80">{b.desc}</p>
                  </div>
                ))}
              </div>
              <div className="lp-dots mt-2 flex gap-2" aria-hidden>
                <i />
                <i />
                <i />
              </div>
            </div>
            <BrewCup />
          </div>
        </div>
      </section>

      {/* Favorit */}
      {favourites.length > 0 && (
        <section id="favorit" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <div className="lp-rv" data-io>
              <SectionHead eyebrow="Dari bar & dapur kami" title="House favourites" action={{ href: menuHref, label: "Semua menu" }} />
            </div>
            <div className="lp-favs mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:gap-x-6">
              {favourites.map((p, i) => (
                <Link key={p.id} href={menuHref} className="lp-fav lp-rv group block" data-io style={delay((i % 3) * 0.1)}>
                  <ProductImage
                    src={p.imageUrl}
                    name={p.name}
                    emoji={p.emoji}
                    className="lp-tilt aspect-[4/3] rounded-2xl"
                    imgClassName="transition duration-700 group-hover:scale-[1.06]"
                  />
                  <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <h3 className="font-serif text-lg font-semibold leading-tight sm:text-2xl">{p.name}</h3>
                    <span className="shrink-0 text-sm font-semibold tabular text-muted-foreground" data-count={p.price} data-step="1000" data-prefix="Rp&nbsp;" data-ms="1100">
                      {formatRupiah(p.price)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{p.category.name}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Jendela parallax 1 */}
      <section className="lp-band bg-olive-deep text-cream">
        <div className="lp-band-bg" data-band="150">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND_PHOTOS.interior[1]} alt="Sudut meja dengan lampu hangat" loading="lazy" />
        </div>
        <div className="lp-ghost font-display" data-band-x="-260" aria-hidden>
          slow hours · slow hours · slow hours
        </div>
        <div className="lp-band-in px-5" data-band="-60">
          <p className="font-display text-[clamp(2.4rem,7.5vw,5.2rem)] leading-none">Duduk dulu.</p>
          <p className="mt-3 font-serif text-[clamp(1.15rem,3vw,1.7rem)] italic text-cream/90">Jam-jam terbaik itu yang tidak diburu-buru.</p>
        </div>
      </section>

      {/* Ruang */}
      <section id="ruang" className="scroll-mt-20 bg-secondary">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="lp-rv" data-io>
            <SectionHead eyebrow="Ruang" title="Tenang, hangat, dan tidak berdesakan" />
          </div>
          <div className="lp-gal mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" data-io>
            <GalleryPhoto src={BRAND_PHOTOS.front} alt="Tampak depan Warm Hour Cafe" i={0} />
            <GalleryPhoto src={BRAND_PHOTOS.interior[1]} alt="Sudut meja dengan lampu hangat" i={1} className="md:mt-8" />
            <GalleryPhoto src={BRAND_PHOTOS.display} alt="Etalase kue dan salt bread" i={2} />
            <GalleryPhoto src={BRAND_PHOTOS.interior[3]} alt="Deretan meja di dekat jendela" i={3} className="md:mt-8" />
          </div>
          <dl className="mt-12 grid grid-cols-3 gap-3 text-center sm:mt-14">
            {stats.map((s, i) => (
              <div key={s.label} className="lp-rv flex flex-col-reverse" data-io style={delay(i * 0.1)}>
                <dt className="mt-1.5 text-xs text-muted-foreground sm:text-sm">{s.label}</dt>
                <dd className="font-display text-[clamp(2.4rem,8vw,4.4rem)] leading-none text-olive-deep tabular" data-count={s.value} data-dec={s.dec}>
                  {s.text}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {BRAND_REVIEWS.map((r, i) => (
              <figure key={r.quote} className="lp-line pt-5" data-io style={delay(i * 0.2)}>
                <blockquote className="font-serif text-xl italic leading-snug">
                  <Words text={`“${r.quote}”`} />
                </blockquote>
                <figcaption className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <Star className="size-3.5 fill-honey text-honey" /> {r.by}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Cara pesan: HP memperagakan alur, berganti mengikuti scroll */}
      <section id="pesan" className="lp-flow">
        <div className="lp-flow-pin">
          <div className="lp-flow-grid mx-auto grid w-full max-w-6xl items-center gap-4 px-5 min-[860px]:grid-cols-2 min-[860px]:gap-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tanpa antre di kasir</p>
              <h2 className="mt-2 font-display text-[clamp(1.9rem,5vw,3rem)] leading-none text-olive-deep">Pesan dari meja</h2>
              <ol className="lp-steps mt-4 min-[860px]:mt-7">
                {STEPS.map((s, i) => (
                  <li key={s.title} className={i === 0 ? "lp-on" : undefined}>
                    <span className="lp-step-n font-display text-xl">{i + 1}</span>
                    <h3 className="text-base font-bold sm:text-lg">{s.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{s.desc}</p>
                  </li>
                ))}
                <li role="presentation" className="lp-rail" aria-hidden>
                  <i />
                </li>
              </ol>
            </div>
            <div className="relative">
              <OrderPhone brand={BRAND.shortName} items={phoneItems} />
              <div className="lp-bub lp-bub-a" data-at="1" aria-hidden>
                🛒 Masuk keranjang<small>{phoneItems[0].name}</small>
              </div>
              <div className="lp-bub lp-bub-b" data-at="2" aria-hidden>
                ✅ Pembayaran diterima<small>QRIS</small>
              </div>
              <div className="lp-bub lp-bub-c" data-at="3" aria-hidden>
                👩‍🍳 Masuk ke dapur<small>baru saja</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {demo && outlet && outlet.tables.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-16 sm:pb-20">
          <div className="lp-rv rounded-3xl border border-dashed border-olive/40 p-6 sm:p-8" data-io>
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
        </section>
      )}

      {/* Jendela parallax 2 */}
      <section className="lp-band lp-band-sm bg-olive-deep text-cream">
        <div className="lp-band-bg" data-band="150">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND_PHOTOS.display} alt="Etalase kue dan salt bread" loading="lazy" />
        </div>
        <div className="lp-ghost font-display" data-band-x="260" style={{ left: "auto", right: 0 }} aria-hidden>
          fresh from the oven · fresh from the oven
        </div>
        <div className="lp-band-in px-5" data-band="-60">
          <p className="font-display text-[clamp(2.2rem,7vw,4.8rem)] leading-none">Dipanggang setiap pagi.</p>
          <p className="mt-3 font-serif text-[clamp(1.15rem,3vw,1.7rem)] italic text-cream/90">Salt bread, basque, dan kue potong dari etalase kami.</p>
        </div>
      </section>

      {/* Kunjungi */}
      <section id="kunjungi" className="relative scroll-mt-20 overflow-hidden bg-olive text-cream">
        <canvas className="lp-beans" data-few="1" aria-hidden />
        <div className="relative z-[2] mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:py-20 md:grid-cols-2 md:gap-16">
          <div>
            <span className="lp-pin mb-2" data-io aria-hidden>
              <svg viewBox="0 0 44 56">
                <path d="M22 1C10.400 1 1 10.200 1 21.600 1 37 22 55 22 55s21-18 21-33.400C43 10.200 33.600 1 22 1Zm0 28.500a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
              </svg>
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cream/65">Kunjungi kami</p>
            <h2 className="lp-rv mt-3 font-display text-[clamp(2.6rem,7vw,3.75rem)] leading-none" data-io>
              {BRAND.area}
            </h2>
            <p className="lp-rv mt-5 max-w-sm leading-relaxed text-cream/85" data-io style={delay(0.1)}>
              {BRAND.address}
            </p>
            {outlet && openNow !== null && (
              <p className={`lp-open mt-5 inline-flex items-center gap-2 rounded-full bg-cream/15 px-3.5 py-1.5 text-[13px] font-semibold${openNow ? "" : " lp-closed"}`}>
                <i aria-hidden />
                {openNow ? `Buka sekarang · tutup ${clock(outlet.closeTime)}` : `Sedang tutup · buka ${clock(outlet.openTime)}`}
              </p>
            )}
            <div className="mt-6">
              <a
                href={BRAND.links.maps}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3 font-semibold text-olive-deep transition hover:brightness-95"
              >
                <MapPin className="size-4" /> Buka di Google Maps
              </a>
            </div>
          </div>
          <div>
            <dl className="font-serif text-xl sm:text-2xl [--lp-line-color:rgb(243_231_201/0.3)]">
              <div className="lp-line lp-line-b flex items-center justify-between gap-4 py-3" data-io>
                <dt className="flex items-center gap-2.5">
                  <Clock className="size-5 text-cream/60" /> Senin – Minggu
                </dt>
                <dd className="tabular">{BRAND.hoursShort}</dd>
              </div>
              <div className="lp-line lp-line-b flex items-center justify-between gap-4 py-3" data-io style={delay(0.15)}>
                <dt>Kisaran harga</dt>
                <dd className="text-right">Rp 50–75 rb</dd>
              </div>
              <div className="lp-line lp-line-b flex items-center justify-between gap-4 py-3" data-io style={delay(0.3)}>
                <dt>Layanan</dt>
                <dd className="text-right">Dine in · Takeaway</dd>
              </div>
            </dl>
            <div className="lp-rv mt-6 flex flex-wrap gap-2.5 text-sm font-semibold" data-io style={delay(0.3)}>
              <ExtLink href={BRAND.links.instagram}>Instagram {BRAND.links.instagramHandle}</ExtLink>
              <ExtLink href={BRAND.links.grabfood}>GrabFood</ExtLink>
              <ExtLink href={BRAND.links.customCake}>Custom cake</ExtLink>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-olive-deep text-cream/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-7 text-center text-sm sm:flex-row sm:text-left">
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

/** Jeda animasi (detik) lewat variabel CSS --d */
function delay(seconds: number) {
  return { "--d": `${seconds}s` } as React.CSSProperties;
}

/** Satu baris judul yang hurufnya naik satu per satu */
function Letters({ text, from = 0 }: { text: string; from?: number }) {
  return (
    <span className="lp-ln" aria-hidden>
      {[...text].map((ch, i) => (
        <span key={i} className="lp-ch" style={{ "--i": from + i } as React.CSSProperties}>
          {ch}
        </span>
      ))}
    </span>
  );
}

/** Kalimat yang katanya muncul satu per satu */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(/\s+/).map((w, i) => (
        <span key={i}>
          <span className="lp-w" style={{ "--i": i } as React.CSSProperties}>
            {w}
          </span>{" "}
        </span>
      ))}
    </>
  );
}

function GalleryPhoto({ src, alt, i, className }: { src: string; alt: string; i: number; className?: string }) {
  return (
    <div className={`lp-ph ${className ?? ""}`} style={delay(i * 0.12)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" data-plx-inner="46" />
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
