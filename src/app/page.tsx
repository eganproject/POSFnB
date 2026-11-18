import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, MapPin, QrCode, Star, Store } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ROLE_HOME } from "@/lib/constants";
import { BRAND, BRAND_PHOTOS, BRAND_REVIEWS } from "@/lib/brand";
import { formatRupiah } from "@/lib/utils";
import { isOpenNow } from "@/lib/pickup";
import { BrandMark } from "@/components/shared/brand-mark";
import { LandingMotion } from "@/components/landing/landing-motion";
import { OrderPhone, type PhoneItem } from "@/components/landing/order-phone";
import { RoastDial } from "@/components/landing/roast-dial";
import "./landing.css";

export const dynamic = "force-dynamic";

const ORIGINS = ["Gayo", "Garut", "Gunung Halu", "Ijen", "Kerinci", "Puntang"];

/** Tiga tahap yang tampil bergantian saat biji kopi di-roasting mengikuti scroll */
const ROAST = [
  { title: "Biji pilihan dari enam daerah", desc: "Gayo, Garut, Gunung Halu, Ijen, Kerinci, dan Puntang. Single origin untuk manual brew." },
  { title: "Kami roasting sendiri, setiap hari", desc: "Dari biji hijau sampai matang di roastery kami, supaya yang sampai ke cangkirmu selalu segar." },
  { title: "House blend 70% Arabica, 30% Robusta", desc: "Dasar untuk espresso, latte, dan signature coffee seperti Americano Lemon." },
];

const RIBBON = ["Coffee", "Brunch", "Nusantara", "Seafood", "Pasta & Steak", "Private Room"];

/** Kartu "Sehari di Amalgam" yang bergeser ke samping */
const DAY = [
  { hour: "07", part: "Pagi", img: "/amalgam/croissant.jpg", alt: "Butter croissant", title: "Kopi pertama & croissant", desc: "Butter croissant dan cappuccino dari biji yang kami roasting sendiri." },
  { hour: "10", part: "Brunch", img: "/amalgam/big-breakfast.jpg", alt: "Big Breakfast", title: "Brunch sepanjang hari", desc: "Big Breakfast, Egg Benedict Smoked Salmon, sampai omelette keju." },
  { hour: "13", part: "Siang", img: "/amalgam/tenderloin-steak.jpg", alt: "Tenderloin steak", title: "Makan siang yang serius", desc: "Nasi Campur Bali, Sop Buntut, pasta, sampai Tenderloin Steak." },
  { hour: "16", part: "Sore", img: "/amalgam/mojito.jpg", alt: "Strawberry Mojito", title: "Sore yang segar", desc: "Strawberry Mojito, Lychee Lemonade, atau Americano Lemon." },
  { hour: "19", part: "Malam", img: "/amalgam/veggies.jpg", alt: "Aneka tumisan sayur untuk makan tengah", title: "Makan tengah bersama", desc: "Seafood, iga bakar, dan aneka tumisan sayur untuk satu meja." },
];

/** Menu seafood yang harganya diambil dari database (nama harus sama dengan di menu) */
const SEAFOOD = [
  { name: "Seafood Tumpah Mix (up to 4 pax)", label: "Seafood Tumpah Mix" },
  { name: "Udang Lada Hitam", label: "Udang Lada Hitam" },
  { name: "Ikan Gurame Goreng Saus Mangga (500 gr)", label: "Ikan Gurame Saus Mangga" },
  { name: "Kerang Batik Saus Padang (250 gr)", label: "Kerang Batik Saus Padang" },
];

const STEPS = [
  { title: "Scan QR di meja", desc: "Setiap meja punya QR sendiri. Menu terbuka di HP tanpa install aplikasi." },
  { title: "Pilih menu", desc: "Atur hot atau iced, susu Greenfields atau Oatly, sampai pilihan saus." },
  { title: "Bayar di HP", desc: "Bayar pakai QRIS langsung dari HP, atau bayar di kasir kalau lebih nyaman." },
  { title: "Pantau pesanan", desc: "Status dari bar dan dapur tampil langsung, sampai pesanan diantar ke mejamu." },
];

/** Dipakai mockup HP bila menu unggulan di database belum cukup */
const PHONE_FALLBACK: PhoneItem[] = [
  { name: "Americano Lemon", price: 53000, imageUrl: "/amalgam/americano-lemon.jpg", emoji: "🍋" },
  { name: "Nasi Campur Bali", price: 115000, imageUrl: "/amalgam/nasi-campur-bali.jpg", emoji: "🍛" },
  { name: "Big Breakfast", price: 145000, imageUrl: "/amalgam/big-breakfast.jpg", emoji: "🍳" },
  { name: "Lychee Lemonade", price: 55000, imageUrl: "/amalgam/lychee-lemonade.jpg", emoji: "🍹" },
];

const clock = (hhmm: string) => hhmm.replace(":", ".");

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const demo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGIN === "true";
  const [outlet, favourites, menuCount, seafoodRows] = await Promise.all([
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
    db.product.findMany({ where: { isActive: true, name: { in: SEAFOOD.map((s) => s.name) } }, select: { name: true, price: true } }),
  ]);
  const menuHref = outlet ? `/m/${outlet.slug}` : "/login";
  const openNow = outlet ? isOpenNow(new Date(), outlet, process.env.APP_TIMEZONE || "Asia/Jakarta") : null;
  const seafood = SEAFOOD.map((s) => ({ label: s.label, price: seafoodRows.find((r) => r.name === s.name)?.price ?? null }));
  // HP peraga: satu minuman (bar) lalu satu makanan (dapur) masuk keranjang
  const phoneItems: PhoneItem[] =
    favourites.length >= 4 ? [favourites[0], favourites[favourites.length - 2], ...favourites.slice(1, favourites.length - 2)] : PHONE_FALLBACK;
  const stats = [
    { value: Number(BRAND.rating.score.replace(",", ".")), text: BRAND.rating.score, dec: 1, label: "rating Google" },
    { value: BRAND.rating.count, text: String(BRAND.rating.count), dec: 0, label: "ulasan tamu" },
    { value: menuCount, text: String(menuCount), dec: 0, label: "pilihan menu" },
  ].filter((s) => s.value > 0);

  return (
    <div className="lp">
      <LandingMotion />
      {/* Tanpa JavaScript semua isi tetap terlihat */}
      <noscript>
        <style>{`.lp .lp-rv,.lp .lp-revs .lp-w{opacity:1;transform:none}.lp .lp-gal .lp-ph{clip-path:none}.lp .lp-pinwrap svg{opacity:1}`}</style>
      </noscript>
      <div className="lp-progress" aria-hidden />

      {/* Header */}
      <header className="lp-hdr">
        <div className="lp-wrap">
          <Link href="/" className="lp-logo" aria-label={BRAND.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_PHOTOS.logoCream} alt={BRAND.name} />
          </Link>
          <nav className="lp-nav">
            <a href="#kopi">Kopi</a>
            {favourites.length > 0 && <a href="#favorit">Favorit</a>}
            <a href="#sehari">Sehari di Amalgam</a>
            <a href="#seafood">Seafood</a>
            <a href="#ruang">Ruang</a>
            <a href="#pesan">Cara pesan</a>
            <a href="#kunjungi">Kunjungi</a>
          </nav>
          <div className="lp-hact">
            <Link href="/akun">Akun saya</Link>
            <Link href="/login" className="lp-staff">
              Masuk staf
            </Link>
            <Link href={menuHref} className="lp-btn lp-btn-cream">
              Lihat menu
            </Link>
          </div>
        </div>
      </header>

      {/* 1. Hero: foto berlapis bergerak beda kecepatan */}
      <section className="lp-hero">
        <canvas className="lp-beans" aria-hidden />
        <div className="lp-ghost" data-heroghost aria-hidden>
          coffee brewery
        </div>
        <div className="lp-wrap lp-grid">
          <div>
            <p className="lp-eyebrow lp-intro" style={delay(0.1)}>
              {BRAND.tagline}
            </p>
            <h1>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BRAND_PHOTOS.logoCream} alt={BRAND.name} />
            </h1>
            <p className="lp-lede lp-intro" style={delay(0.8)}>
              Tempat waktu berjalan pelan, seperti Minggu pagi yang tenang.
            </p>
            <p className="lp-sub lp-intro" style={delay(0.9)}>
              Kopi yang kami roasting sendiri, brunch sepanjang hari, masakan Nusantara, sampai seafood untuk makan bersama.
            </p>
            <div className="lp-cta lp-intro" style={delay(1)}>
              <Link href={menuHref} className="lp-btn lp-btn-cream">
                {outlet?.takeawayEnabled ? "Pesan takeaway" : "Lihat menu"} <ArrowRight className="size-4" />
              </Link>
              <a href={BRAND.links.maps} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-line">
                <MapPin className="size-4" /> Petunjuk arah
              </a>
            </div>
            <dl className="lp-intro" style={delay(1.1)}>
              <div>
                <dt>Buka setiap hari</dt>
                <dd>{BRAND.hoursShort}</dd>
              </div>
              <div>
                <dt>Google</dt>
                <dd>
                  ★ {BRAND.rating.score} <span>({BRAND.rating.count})</span>
                </dd>
              </div>
              <div>
                <dt>Lokasi</dt>
                <dd>Kebon Sirih</dd>
              </div>
            </dl>
          </div>
          <div className="lp-collage">
            <div data-hero="-0.10">
              <div className="lp-ph lp-p1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={BRAND_PHOTOS.front} alt="Rumah kaca berangka hijau di depan Amalgam" />
              </div>
            </div>
            <div className="lp-ph lp-p3 lp-float lp-b" data-hero="-0.26">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/amalgam/americano-lemon.jpg" alt="Americano Lemon, signature coffee Amalgam" />
            </div>
            <div className="lp-ph lp-p2 lp-float" data-hero="-0.18">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/amalgam/nasi-campur-bali.jpg" alt="Nasi Campur Bali dengan sate lilit dan sambal matah" />
            </div>
            <div className="lp-stamp" data-hero="-0.32" aria-hidden>
              <svg className="lp-ring" viewBox="0 0 128 128">
                <defs>
                  <path id="lp-stamp-circle" d="M64 64m-48 0a48 48 0 1 1 96 0a48 48 0 1 1-96 0" />
                </defs>
                <text>
                  <textPath href="#lp-stamp-circle">fresh coffee · roasted daily · jakarta · </textPath>
                </text>
              </svg>
              <svg className="lp-cup" viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <g className="lp-steam">
                  <path d="M19 20c0-4 4-4 4-8" />
                  <path d="M26 20c0-4 4-4 4-8" />
                  <path d="M33 20c0-4 4-4 4-8" />
                </g>
                <path d="M12 25h28v6a12 12 0 0 1-12 12h-4a12 12 0 0 1-12-12zM40 27h2.5a4.5 4.5 0 0 1 0 9H39" />
              </svg>
            </div>
          </div>
        </div>
        <div className="lp-scrollhint" aria-hidden>
          <span>Scroll</span>
          <i />
        </div>
      </section>

      {/* Pita teks yang berjalan mengikuti scroll */}
      <div className="lp-ribbon" aria-hidden>
        <div className="lp-rtrack">
          {[0, 1, 2, 3].flatMap((n) => RIBBON.map((w) => <span key={`${n}-${w}`}>{w}</span>))}
        </div>
      </div>

      {/* 2. Roasting: layar menahan, biji kopi berubah warna mengikuti scroll */}
      <section id="kopi" className="lp-pinsec lp-roast">
        <div className="lp-pin">
          <canvas className="lp-beans" data-few="1" aria-hidden />
          <div className="lp-wrap">
            <div>
              <p className="lp-eyebrow">Roasted in Jakarta</p>
              <h2>Fresh coffee, roasted daily</h2>
              <div className="lp-caps">
                {ROAST.map((r, i) => (
                  <div key={r.title} className={`lp-cap${i === 0 ? " lp-on" : ""}`}>
                    <b>{r.title}</b>
                    <p>{r.desc}</p>
                  </div>
                ))}
              </div>
              <div className="lp-dots" aria-hidden>
                <i />
                <i />
                <i />
              </div>
              <div className="lp-origins" aria-hidden>
                {ORIGINS.map((o) => (
                  <span key={o}>{o}</span>
                ))}
              </div>
            </div>
            <RoastDial />
          </div>
        </div>
      </section>

      {/* 3. Favorit */}
      {favourites.length > 0 && (
        <section id="favorit" className="lp-sec">
          <div className="lp-wrap">
            <div className="lp-head lp-rv">
              <div>
                <p className="lp-eyebrow">Dari bar &amp; dapur kami</p>
                <h2 className="lp-title">House favourites</h2>
              </div>
              <Link href={menuHref}>
                Semua menu <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="lp-favs">
              {favourites.map((p, i) => (
                <Link key={p.id} href={menuHref} className="lp-fav lp-rv" style={delay((i % 3) * 0.1)}>
                  <div className="lp-ph lp-tilt">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl ?? ""} alt={p.name} loading="lazy" data-inner />
                  </div>
                  <div className="lp-row">
                    <h3>{p.name}</h3>
                    <span className="lp-price" data-count={p.price} data-step="1000" data-prefix="Rp&nbsp;" data-ms="1100">
                      {formatRupiah(p.price)}
                    </span>
                  </div>
                  <p className="lp-cat">{p.category.name}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. Jendela parallax: foto di belakang bergerak lebih lambat dari tulisan */}
      <section className="lp-band">
        <div className="lp-bg" data-band>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND_PHOTOS.interior[0]} alt="Ruang dalam Amalgam yang terang dengan bar kopi" loading="lazy" />
        </div>
        <div className="lp-ghost" data-bandx="-1" aria-hidden>
          slow sunday · slow sunday
        </div>
        <div className="lp-in" data-bandin>
          <p className="lp-big">Duduk dulu, pelan-pelan saja.</p>
          <p className="lp-sm">Untuk ngopi, makan, dan meeting, dari pagi sampai malam.</p>
        </div>
      </section>

      {/* 5. Sehari di Amalgam: scroll ke bawah, kartu bergeser ke samping */}
      <section id="sehari" className="lp-pinsec lp-day">
        <div className="lp-pin">
          <div className="lp-wrap lp-dhead">
            <div className="lp-row">
              <div>
                <p className="lp-eyebrow">Buka {BRAND.hoursShort.replace("–", "sampai")}</p>
                <h2 className="lp-title">Sehari di Amalgam</h2>
              </div>
              <div className="lp-hbar" aria-hidden>
                <i />
              </div>
            </div>
          </div>
          <div className="lp-view">
            <div className="lp-track">
              {DAY.map((d) => (
                <article key={d.hour} className="lp-panel">
                  <div className="lp-ph">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.img} alt={d.alt} loading="lazy" />
                    <span className="lp-num" aria-hidden>
                      {d.hour}
                      <small>{d.part}</small>
                    </span>
                  </div>
                  <div className="lp-tx">
                    <h3>{d.title}</h3>
                    <p>{d.desc}</p>
                  </div>
                </article>
              ))}
              <div className="lp-panel lp-end">
                <b>{menuCount > 0 ? `${menuCount} menu, dari kopi sampai seafood.` : "Dari kopi sampai seafood."}</b>
                <Link href={menuHref} className="lp-btn">
                  Lihat semua menu
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Seafood: foto bertumpuk dengan kedalaman */}
      <section id="seafood" className="lp-sec lp-sea">
        <canvas className="lp-beans" data-few="1" aria-hidden />
        <div className="lp-wrap">
          <div>
            <p className="lp-eyebrow">Seafood &amp; Nusantara</p>
            <h2 className="lp-rv">Tumpah di meja, dimakan bersama</h2>
            <p className="lp-lead lp-rv" style={delay(0.1)}>
              Seafood Tumpah Mix berisi kepiting, kerang hijau, kerang, udang, cumi, dan jagung manis dalam saus pedas gurih khas kami. Cukup untuk
              berempat.
            </p>
            <ul>
              {seafood.map((s, i) => (
                <li key={s.label} className="lp-line lp-io" style={delay(i * 0.12)}>
                  <span>{s.label}</span>
                  {s.price !== null && <span>{formatRupiah(s.price)}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div className="lp-stack">
            <div className="lp-ph lp-b" data-plx="-0.55">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/amalgam/udang-lada-hitam.jpg" alt="Udang Lada Hitam" loading="lazy" />
            </div>
            <div className="lp-ph lp-a" data-plx="-0.15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/amalgam/seafood-tumpah.jpg" alt="Seafood Tumpah Mix" loading="lazy" />
            </div>
            <div className="lp-ph lp-c" data-plx="0.55">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/amalgam/kerang-batik.jpg" alt="Kerang Batik Saus Padang" loading="lazy" />
            </div>
            <div className="lp-ph lp-d" data-plx="0.95">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/amalgam/gurame.jpg" alt="Ikan Gurame Goreng Saus Mangga" loading="lazy" />
            </div>
            <div className="lp-pax" data-plx="1.3" aria-hidden>
              <span>
                up to<b>4</b>pax
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Ruang: galeri terbuka seperti tirai */}
      <section id="ruang" className="lp-sec lp-room">
        <div className="lp-wrap">
          <div className="lp-head lp-rv">
            <div>
              <p className="lp-eyebrow">Ruang</p>
              <h2 className="lp-title">Untuk ngopi, makan, dan meeting</h2>
            </div>
          </div>
          <div className="lp-gal lp-io">
            <GalleryPhoto src={BRAND_PHOTOS.interior[1]} alt="Sofa hijau dan dinding keramik hijau" i={0} />
            <GalleryPhoto src="/amalgam/roastery.jpg" alt="Kemasan biji kopi Amalgam Coffee Roastery" i={1} />
            <GalleryPhoto src={BRAND_PHOTOS.interior[2]} alt="Ruang dalam Amalgam" i={2} />
            <GalleryPhoto src="/amalgam/frappe.jpg" alt="Barista menyiapkan frappe" i={3} />
          </div>
          <div className="lp-stats">
            {stats.map((s, i) => (
              <div key={s.label} className="lp-rv" style={delay(i * 0.1)}>
                <b data-count={s.value} data-dec={s.dec}>
                  {s.text}
                </b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
          <div className="lp-revs">
            {BRAND_REVIEWS.map((r, i) => (
              <figure key={r.quote} className="lp-io" style={delay(i * 0.2)}>
                <blockquote>
                  <Words text={`“${r.quote}”`} />
                </blockquote>
                <figcaption>
                  <Star className="lp-star" /> {r.by}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Cara pesan: HP memperagakan alur, berganti mengikuti scroll */}
      <section id="pesan" className="lp-pinsec lp-flow">
        <div className="lp-pin">
          <div className="lp-wrap">
            <div>
              <p className="lp-eyebrow">Tanpa antre di kasir</p>
              <h2 className="lp-title">Pesan dari meja</h2>
              <div className="lp-steps">
                <span className="lp-rail" aria-hidden>
                  <i />
                </span>
                <ol>
                  {STEPS.map((s, i) => (
                    <li key={s.title} className={i === 0 ? "lp-on" : undefined}>
                      <span className="lp-n">{i + 1}</span>
                      <h3>{s.title}</h3>
                      <p>{s.desc}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="lp-phonebox">
              <OrderPhone logo={BRAND_PHOTOS.logoGreen} brand={BRAND.shortName} items={phoneItems} />
              <div className="lp-bub lp-a" data-at="1" aria-hidden>
                🛒 Masuk keranjang<small>{phoneItems[0].name}</small>
              </div>
              <div className="lp-bub lp-b" data-at="2" aria-hidden>
                ✅ Pembayaran diterima<small>QRIS</small>
              </div>
              <div className="lp-bub lp-c" data-at="3" aria-hidden>
                👩‍🍳 Masuk ke dapur<small>baru saja</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {demo && outlet && outlet.tables.length > 0 && (
        <section className="lp-demo">
          <div className="lp-wrap">
            <div className="lp-rv rounded-3xl border border-dashed border-olive/40 p-6 sm:p-8">
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
          </div>
        </section>
      )}

      {/* Jendela parallax kedua */}
      <section className="lp-band lp-short">
        <div className="lp-bg" data-band>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND_PHOTOS.storefront} alt="Tampak depan Amalgam di malam hari" loading="lazy" />
        </div>
        <div className="lp-ghost" data-bandx="1" aria-hidden>
          kebon sirih · kebon sirih
        </div>
        <div className="lp-in" data-bandin>
          <p className="lp-big">Lampu kami menyala sampai malam.</p>
          <p className="lp-sm">Dine in, takeaway, dan private room untuk acaramu.</p>
        </div>
      </section>

      {/* 9. Kunjungi */}
      <section id="kunjungi" className="lp-sec lp-visit">
        <canvas className="lp-beans" data-few="1" aria-hidden />
        <div className="lp-wrap">
          <div>
            <span className="lp-pinwrap lp-io" aria-hidden>
              <svg viewBox="0 0 44 56">
                <path d="M22 1C10.4 1 1 10.2 1 21.6 1 37 22 55 22 55s21-18 21-33.4C43 10.2 33.6 1 22 1Zm0 28.5a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
              </svg>
            </span>
            <p className="lp-eyebrow">Kunjungi kami</p>
            <h2 className="lp-rv">{BRAND.area}</h2>
            <p className="lp-rv" style={delay(0.1)}>
              {BRAND.address}
            </p>
            {outlet && openNow !== null && (
              <span className={`lp-open${openNow ? "" : " lp-closed"}`}>
                <i aria-hidden />
                <span>{openNow ? `Buka sekarang · tutup ${clock(outlet.closeTime)}` : `Sedang tutup · buka ${clock(outlet.openTime)}`}</span>
              </span>
            )}
            <div className="lp-cta">
              <a href={BRAND.links.maps} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-cream">
                <MapPin className="size-4" /> Buka di Google Maps
              </a>
            </div>
          </div>
          <div>
            <dl className="lp-info">
              <div className="lp-line lp-io">
                <dt>Senin – Minggu</dt>
                <dd>{BRAND.hoursShort}</dd>
              </div>
              <div className="lp-line lp-io" style={delay(0.15)}>
                <dt>Kisaran harga</dt>
                <dd>{BRAND.priceRange.replace(" per orang", "")}</dd>
              </div>
              <div className="lp-line lp-io" style={delay(0.3)}>
                <dt>Layanan</dt>
                <dd>Dine in · Takeaway · Private room</dd>
              </div>
            </dl>
            <div className="lp-chips lp-rv" style={delay(0.3)}>
              <ExtLink href={BRAND.links.reservation}>Reservasi via WhatsApp</ExtLink>
              <ExtLink href={BRAND.links.instagram}>Instagram {BRAND.links.instagramHandle}</ExtLink>
              <ExtLink href={BRAND.links.tiktok}>TikTok</ExtLink>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <b>
            <BrandMark className="size-5" /> {BRAND.name}
          </b>
          <span>
            <span>Pemesanan meja &amp; kasir oleh {BRAND.poweredBy}</span>
            <Link href="/login">Masuk staf</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

/** Jeda animasi (detik) lewat variabel CSS --lp-d */
function delay(seconds: number) {
  return { "--lp-d": `${seconds}s` } as React.CSSProperties;
}

/** Kalimat yang katanya muncul satu per satu */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(/\s+/).map((w, i) => (
        <span key={i}>
          <span className="lp-w" style={{ "--lp-i": i } as React.CSSProperties}>
            {w}
          </span>{" "}
        </span>
      ))}
    </>
  );
}

function GalleryPhoto({ src, alt, i }: { src: string; alt: string; i: number }) {
  return (
    <div className="lp-ph" style={delay(i * 0.12)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" data-inner />
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} <ArrowUpRight className="size-3.5" />
    </a>
  );
}
