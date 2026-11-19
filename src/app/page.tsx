import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, CalendarCheck, MapPin, MessageCircle, QrCode } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ROLE_HOME } from "@/lib/constants";
import { BRAND, BRAND_FAMILY, BRAND_PHOTOS, BRAND_ROOMS } from "@/lib/brand";
import { formatRupiah } from "@/lib/utils";
import { isOpenNow } from "@/lib/pickup";
import { BrandMark } from "@/components/shared/brand-mark";
import { LandingMotion } from "@/components/landing/landing-motion";
import { OrderPhone, type PhoneItem } from "@/components/landing/order-phone";
import {
  Chili,
  HeroBowl,
  Leaf,
  Lime,
  PlateKwayTeow,
  PlateNasiIkan,
  PlatePho,
  Shrimp,
  Skyline,
  StarAnise,
  Stamp,
  TablePlan,
} from "@/components/landing/aprez-art";
import "./landing.css";

export const dynamic = "force-dynamic";

const TICKER_A = ["Nasi Ikan Nusantara", "Char Kway Teow", "Pho Noodle", "Tori Uma Rice Bowl", "General Tso's Wings", "Dimsum"];
const TICKER_B = ["Breakfast buffet 06.00–10.00", "Makan siang", "Makan malam", "Takeaway", "Ruang semi-VIP", "Ramah keluarga"];

/** Tiga hidangan signature yang tersusun di piring saat scroll. `parts` = isi piring, urut sesuai munculnya. */
const SIGNATURES = [
  {
    name: "Nasi Ikan Nusantara",
    origin: "Nusantara",
    desc: "Barramundi utuh digoreng renyah, ditemani nasi hangat, sayur lodeh, dan sambal.",
    parts: ["Nasi putih hangat", "Barramundi goreng utuh", "Sayur lodeh", "Sambal", "Jeruk & daun segar"],
    Plate: PlateNasiIkan,
  },
  {
    name: "Pho Noodle",
    origin: "Vietnam",
    desc: "Kaldu sapi bening yang dimasak lama, mi beras, dan irisan daging sapi Australia.",
    parts: ["Kaldu sapi", "Mi beras", "Irisan sapi Australia", "Bakso sapi", "Daun herba & cabai", "Jeruk nipis"],
    Plate: PlatePho,
  },
  {
    name: "Char Kway Teow",
    origin: "Penang",
    desc: "Kwetiau lebar dilempar di wajan panas sampai harum smoky.",
    parts: ["Kwetiau lebar", "Udang", "Tauge", "Kucai", "Telur"],
    Plate: PlateKwayTeow,
  },
];

/** Satu hari di Aprez Locale. `hour` menggerakkan matahari di busur dan warna langit. */
const DAY = [
  {
    hour: 6,
    label: "06.00",
    title: "Sarapan buffet",
    desc: "Prasmanan pagi pukul 06.00–10.00: hidangan Asia dan Nusantara, pastry, dan pilihan yang lebih ringan.",
    dishes: ["Breakfast Buffet", "Croque Monsieur"],
  },
  {
    hour: 12,
    label: "12.00",
    title: "Makan siang",
    desc: "Comfort food yang mengenyangkan untuk jeda di tengah hari kerja Sudirman.",
    dishes: ["Nasi Ikan Nusantara", "Char Kway Teow", "Tori Uma Rice Bowl"],
  },
  {
    hour: 15.5,
    label: "15.30",
    title: "Sore yang pelan",
    desc: "Kopi, teh, dan dessert hangat sambil menunggu macet reda.",
    dishes: ["Matcha Bloom", "Warm Baked Apple Crumble", "Cappuccino"],
  },
  {
    hour: 19,
    label: "19.00",
    title: "Makan malam",
    desc: "Duduk lebih lama bersama keluarga atau tamu, dengan hidangan Asia dan Western.",
    dishes: ["Wagyu Beef Cheek Estouffade", "Pho Noodle", "General Tso's Chicken Wings"],
  },
];

const STEPS = [
  { title: "Scan QR di meja", desc: "Setiap meja punya QR sendiri. Menu terbuka di HP tanpa install aplikasi." },
  { title: "Pilih menu", desc: "Atur level sambal, suhu minuman, dan catatan untuk dapur." },
  { title: "Bayar di HP", desc: "Bayar pakai QRIS langsung dari HP, atau bayar di kasir kalau lebih nyaman." },
  { title: "Pantau pesanan", desc: "Status dari dapur dan bar tampil langsung sampai hidangan diantar ke mejamu." },
];

/** Dipakai mockup HP bila menu di database belum lengkap */
const PHONE_FALLBACK: PhoneItem[] = [
  { name: "Nasi Ikan Nusantara", price: 145000, imageUrl: null, emoji: "🐟" },
  { name: "Es Kopi Susu Gula Aren", price: 45000, imageUrl: null, emoji: "🧋" },
  { name: "Pho Noodle", price: 115000, imageUrl: null, emoji: "🍜" },
  { name: "Matcha Bloom", price: 68000, imageUrl: null, emoji: "🍵" },
];

const clock = (hhmm: string) => hhmm.replace(":", ".");
const shortPrice = (n: number) => `${Math.round(n / 1000)}`;

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const [outlet, categories] = await Promise.all([
    db.outlet.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { products: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { name: true, price: true, description: true, emoji: true, isFeatured: true, imageUrl: true } } },
    }),
  ]);
  const menuHref = outlet ? `/m/${outlet.slug}` : "/login";
  const openNow = outlet ? isOpenNow(new Date(), outlet, process.env.APP_TIMEZONE || "Asia/Jakarta") : null;
  const products = categories.flatMap((c) => c.products);
  const priceOf = (name: string) => products.find((p) => p.name === name)?.price ?? null;
  const menuCount = products.length;

  const byName = (names: string[]) => names.flatMap((n) => products.filter((p) => p.name === n));
  const phonePicked = byName(["Nasi Ikan Nusantara", "Es Kopi Susu Gula Aren", "Pho Noodle", "Matcha Bloom"]);
  const phoneItems: PhoneItem[] = phonePicked.length >= 4 ? phonePicked : PHONE_FALLBACK;
  const menuCats = categories.filter((c) => c.products.length > 0);

  return (
    <div className="lp ap">
      <LandingMotion />
      <noscript>
        <style>{`.ap .lp-rv{opacity:1;transform:none}.ap .ap-part{opacity:1;transform:none}.ap .ap-seat{opacity:1;transform:none}`}</style>
      </noscript>
      <div className="lp-progress" aria-hidden />

      {/* Header */}
      <header className="lp-hdr">
        <div className="lp-wrap">
          <Link href="/" className="ap-logo" aria-label={BRAND.name}>
            <BrandMark className="size-9" />
            <span>
              <b>Aprez</b>
              <small>Locale</small>
            </span>
          </Link>
          <nav className="lp-nav">
            <a href="#signature">Signature</a>
            <a href="#hari">Sepanjang hari</a>
            <a href="#menu">Menu</a>
            <a href="#ruang">Ruang</a>
            <a href="#pesan">Cara pesan</a>
            <a href="#kunjungi">Lokasi</a>
          </nav>
          <Link href={menuHref} className="lp-btn lp-btn-sm">
            <QrCode className="size-4" /> Pesan
          </Link>
        </div>
      </header>

      <main className="lp-main">
        {/* 1. Hero */}
        <section className="ap-hero" id="top">
          <canvas className="ap-steamfx" aria-hidden />
          <div className="ap-ghost" data-heroghost aria-hidden>
            LOCALE LOCALE
          </div>
          <div className="lp-wrap ap-hero-grid">
            <div className="ap-hero-copy">
              <p className="lp-eyebrow lp-rv">Citadines Sudirman · Setiabudi, Jakarta</p>
              <h1 className="lp-rv" style={delay(0.08)}>
                Rasa yang akrab,
                <em> dari pagi sampai malam.</em>
              </h1>
              <p className="ap-lead lp-rv" style={delay(0.16)}>
                Comfort food Asia dan Nusantara, dari sarapan buffet sampai makan malam bersama keluarga. Pesan langsung dari meja lewat QR.
              </p>
              <div className="lp-cta lp-rv" style={delay(0.24)}>
                <Link href={menuHref} className="lp-btn">
                  Lihat menu &amp; pesan <ArrowRight className="size-4" />
                </Link>
                <a href={BRAND.links.whatsapp} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost">
                  <MessageCircle className="size-4" /> Reservasi
                </a>
              </div>
              <ul className="ap-facts lp-rv" style={delay(0.32)}>
                <li>
                  <b>{BRAND.hoursShort}</b>
                  <span>setiap hari</span>
                </li>
                <li>
                  <b>06.00–10.00</b>
                  <span>breakfast buffet</span>
                </li>
                <li>
                  <b data-count={menuCount} data-ms="1200">
                    {menuCount}
                  </b>
                  <span>pilihan menu</span>
                </li>
              </ul>
            </div>
            <div className="ap-hero-art">
              <div className="ap-sun" data-hero="0.18" aria-hidden />
              <div className="ap-bowlwrap" data-hero="-0.06">
                <HeroBowl />
              </div>
              <div className="ap-float ap-f1" data-hero="-0.5">
                <Chili className="ap-bob" />
              </div>
              <div className="ap-float ap-f2" data-hero="-0.28">
                <StarAnise className="ap-spin" />
              </div>
              <div className="ap-float ap-f3" data-hero="-0.42">
                <Lime className="ap-bob" />
              </div>
              <div className="ap-float ap-f4" data-hero="-0.2">
                <Leaf className="ap-sway" />
              </div>
              <div className="ap-float ap-f5" data-hero="-0.6">
                <Shrimp className="ap-bob" />
              </div>
              <Stamp text="ASIAN COMFORT · ALL DAY · SUDIRMAN · " className="ap-stamp" />
            </div>
          </div>
          <a href="#signature" className="lp-scrollhint" aria-label="Gulir ke bawah">
            <span>Gulir</span>
            <i />
          </a>
        </section>

        {/* Dua pita bersilang */}
        <div className="ap-tickers" aria-hidden>
          <div className="ap-tick ap-tick-a">
            <div className="ap-ttrack" data-tick="1">
              {[0, 1, 2, 3].map((k) => (
                <span key={k}>
                  {TICKER_A.map((t) => (
                    <span key={t}>
                      {t}
                      <i>✺</i>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
          <div className="ap-tick ap-tick-b">
            <div className="ap-ttrack" data-tick="-1">
              {[0, 1, 2, 3].map((k) => (
                <span key={k}>
                  {TICKER_B.map((t) => (
                    <span key={t}>
                      {t}
                      <i>●</i>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Signature: piring tersusun mengikuti scroll */}
        <section className="ap-sig" id="signature">
          <div className="ap-pin">
            <div className="lp-wrap ap-sig-grid">
              <div className="ap-sig-copy">
                <p className="lp-eyebrow">Signature</p>
                <h2>Satu piring, banyak cerita.</h2>
                <div className="ap-sig-cards">
                  {SIGNATURES.map((s, i) => {
                    const price = priceOf(s.name);
                    return (
                      <article key={s.name} className={`ap-sig-card${i === 0 ? " lp-on" : ""}`} data-sig={i}>
                        <span className="ap-origin">
                          {String(i + 1).padStart(2, "0")} · {s.origin}
                        </span>
                        <h3>{s.name}</h3>
                        <p>{s.desc}</p>
                        <ol>
                          {s.parts.map((p, j) => (
                            <li key={p} style={{ "--ap-i": j } as React.CSSProperties}>
                              {p}
                            </li>
                          ))}
                        </ol>
                        {price !== null && <span className="ap-price">{formatRupiah(price)}</span>}
                      </article>
                    );
                  })}
                </div>
                <div className="ap-sig-dots" aria-hidden>
                  {SIGNATURES.map((s) => (
                    <i key={s.name} />
                  ))}
                </div>
              </div>
              <div className="ap-sig-stage" aria-hidden>
                <div className="ap-table" />
                {SIGNATURES.map(({ name, Plate }, i) => (
                  <div key={name} className={`ap-plate-slot${i === 0 ? " lp-on" : ""}`} data-plate={i}>
                    <Plate />
                  </div>
                ))}
                <div className="ap-chop" />
              </div>
            </div>
          </div>
        </section>

        {/* 3. Sepanjang hari: matahari berjalan di busur, langit berganti */}
        <section className="ap-day" id="hari">
          <div className="lp-wrap ap-day-grid">
            <div className="ap-sky-col">
              <div className="ap-sky" aria-hidden>
                <div className="ap-stars" />
                <svg viewBox="0 0 400 230" className="ap-arc">
                  <path d="M20 210a180 180 0 0 1 360 0" />
                  <path className="ap-arc-done" d="M20 210a180 180 0 0 1 360 0" pathLength="1" />
                </svg>
                <div className="ap-orb">
                  <i />
                </div>
                <div className="ap-horizon">
                  <Skyline layer="mid" />
                </div>
                <div className="ap-time">
                  <b>06.00</b>
                  <span>Sarapan buffet</span>
                </div>
              </div>
            </div>
            <div className="ap-moments">
              <header>
                <p className="lp-eyebrow">Sepanjang hari</p>
                <h2 className="lp-rv">Buka sejak matahari terbit.</h2>
                <p className="lp-rv" style={delay(0.08)}>
                  Dari sarapan sebelum rapat pertama sampai makan malam setelah semuanya selesai.
                </p>
              </header>
              {DAY.map((m) => (
                <article key={m.label} className="ap-moment" data-hour={m.hour} data-title={m.title}>
                  <span className="ap-mtime">{m.label}</span>
                  <h3>{m.title}</h3>
                  <p>{m.desc}</p>
                  <ul>
                    {m.dishes.map((d) => {
                      const price = priceOf(d);
                      return (
                        <li key={d}>
                          <span>{d}</span>
                          {price !== null && <b>{shortPrice(price)}</b>}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Menu bergaya buku menu klasik */}
        <section className="ap-menu" id="menu">
          <div className="lp-wrap">
            <div className="ap-menu-head">
              <p className="lp-eyebrow">Menu</p>
              <h2 className="lp-rv">Daftar menu</h2>
              <p className="lp-rv" style={delay(0.08)}>
                Harga dalam ribu Rupiah, belum termasuk pajak dan service.
              </p>
            </div>
            <div className="ap-menu-card lp-rv">
              <div className="ap-menu-cols">
                {menuCats.map((c) => (
                  <div key={c.id} className="ap-mcat">
                    <h3>{c.name}</h3>
                    <ul>
                      {c.products.map((p) => (
                        <li key={p.name}>
                          <div className="ap-mrow">
                            <span className="ap-mname">
                              {p.name}
                              {p.isFeatured && <i title="Rekomendasi">✺</i>}
                            </span>
                            <span className="ap-mdots" />
                            <span className="ap-mprice">{shortPrice(p.price)}</span>
                          </div>
                          {p.description && <p>{p.description}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="ap-menu-foot">
                <Link href={menuHref} className="lp-btn">
                  Pesan dari meja <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Jendela parallax: kota Sudirman dari balik lengkung jendela */}
        <section className="ap-window" aria-label="Lokasi di Sudirman">
          <div className="ap-wsky" data-band="0.3" />
          <div className="ap-wlayer ap-wfar" data-band="0.22">
            <Skyline layer="far" />
          </div>
          <div className="ap-wlayer ap-wmid" data-band="0.12">
            <Skyline layer="mid" />
          </div>
          <div className="ap-wlayer ap-wnear" data-band="0.02">
            <Skyline layer="near" />
          </div>
          <div className="lp-wrap ap-wtext" data-bandin>
            <p className="lp-eyebrow">Lantai dasar Citadines Sudirman</p>
            <h2>Turun dari kamar, keluar dari kantor, langsung makan.</h2>
          </div>
        </section>

        {/* 6. Ruang */}
        <section className="ap-rooms" id="ruang">
          <div className="lp-wrap">
            <div className="ap-rooms-head">
              <p className="lp-eyebrow">Ruang</p>
              <h2 className="lp-rv">Untuk keluarga, tim, dan rombongan.</h2>
              <p className="lp-rv" style={delay(0.08)}>
                Selain ruang makan utama, ada dua ruang semi-VIP untuk makan bersama yang lebih tenang.
              </p>
            </div>
            <div className="ap-room-grid">
              {BRAND_ROOMS.map((r, i) => (
                <article key={r.name} className="ap-room lp-rv" style={delay(i * 0.1)}>
                  <TablePlan seats={r.guests} />
                  <div>
                    <h3>{r.name}</h3>
                    <p>
                      Maks. <b>{r.guests} tamu</b> · minimum order {r.minimum}
                    </p>
                  </div>
                </article>
              ))}
              <article className="ap-room ap-room-note lp-rv" style={delay(0.2)}>
                <ul>
                  <li>Ramah anak &amp; keluarga</li>
                  <li>Cocok untuk rombongan besar</li>
                  <li>Dine in &amp; takeaway</li>
                  <li>Reservasi lewat WhatsApp atau Chope</li>
                </ul>
                <a href={BRAND.links.reservation} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-sm">
                  <CalendarCheck className="size-4" /> Pesan tempat
                </a>
              </article>
            </div>
          </div>
        </section>

        {/* 7. Dapur */}
        <section className="ap-kitchen">
          <div className="lp-wrap ap-kitchen-grid">
            <div className="lp-rv">
              <p className="lp-eyebrow">Dari dapur</p>
              <h2>
                Bahan lokal, rasa yang dikenal,
                <em> dirapikan untuk hari ini.</em>
              </h2>
            </div>
            <div className="lp-rv" style={delay(0.1)}>
              <p>
                Menu Aprez Locale disusun oleh Chef Stefu Santoso, Corporate Executive Chef Amuz Group. Dapurnya mengutamakan bahan dari
                produsen lokal dan regional, pendekatan yang mereka sebut <i>soft sustainability</i>.
              </p>
              <div className="ap-family">
                <span>Satu keluarga dengan</span>
                <ul>
                  {BRAND_FAMILY.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Cara pesan */}
        <section className="lp-flow" id="pesan">
          <div className="lp-pin">
            <div className="lp-wrap">
              <div className="lp-flowcopy">
                <p className="lp-eyebrow">Cara pesan</p>
                <h2>Pesan dari meja, tanpa menunggu pelayan.</h2>
                <ol className="lp-steps">
                  <li className="lp-rail" aria-hidden>
                    <i />
                  </li>
                  {STEPS.map((s, i) => (
                    <li key={s.title} className={i === 0 ? "lp-on" : undefined}>
                      <span className="lp-n">{i + 1}</span>
                      <div>
                        <b>{s.title}</b>
                        <p>{s.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="lp-phonebox">
                <OrderPhone logo={BRAND_PHOTOS.logo} brand={BRAND.name} items={phoneItems} table="07" />
                <span className="lp-bub" data-at="1">
                  + Nasi Ikan Nusantara
                </span>
                <span className="lp-bub" data-at="2">
                  QRIS · Lunas
                </span>
                <span className="lp-bub" data-at="3">
                  Dapur: sedang dimasak
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 9. Kunjungi */}
        <section className="ap-visit" id="kunjungi">
          <canvas className="ap-steamfx" data-few="1" aria-hidden />
          <div className="lp-wrap ap-visit-grid">
            <div>
              <p className="lp-eyebrow">Kunjungi kami</p>
              <h2 className="lp-rv">{BRAND.area}</h2>
              <p className="lp-rv" style={delay(0.08)}>
                {BRAND.address}
              </p>
              {outlet && openNow !== null && (
                <span className={`lp-open${openNow ? "" : " lp-closed"}`}>
                  <i aria-hidden />
                  <span>{openNow ? `Buka sekarang · tutup ${clock(outlet.closeTime)}` : `Sedang tutup · buka ${clock(outlet.openTime)}`}</span>
                </span>
              )}
              <div className="lp-cta">
                <a href={BRAND.links.maps} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-light">
                  <MapPin className="size-4" /> Buka di Google Maps
                </a>
              </div>
            </div>
            <div>
              <dl className="ap-info">
                <div className="lp-rv">
                  <dt>Senin – Minggu</dt>
                  <dd>{BRAND.hoursShort}</dd>
                </div>
                <div className="lp-rv" style={delay(0.08)}>
                  <dt>Breakfast buffet</dt>
                  <dd>06.00 – 10.00</dd>
                </div>
                <div className="lp-rv" style={delay(0.16)}>
                  <dt>Kisaran harga</dt>
                  <dd>{BRAND.priceRange.replace(" per orang", "")}</dd>
                </div>
                <div className="lp-rv" style={delay(0.24)}>
                  <dt>WhatsApp</dt>
                  <dd>{BRAND.phone}</dd>
                </div>
              </dl>
              <div className="lp-chips lp-rv" style={delay(0.3)}>
                <ExtLink href={BRAND.links.whatsapp}>Reservasi via WhatsApp</ExtLink>
                <ExtLink href={BRAND.links.reservation}>Reservasi di Chope</ExtLink>
                <ExtLink href={BRAND.links.instagram}>Instagram {BRAND.links.instagramHandle}</ExtLink>
              </div>
            </div>
          </div>
        </section>
      </main>

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

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} <ArrowUpRight className="size-3.5" />
    </a>
  );
}
