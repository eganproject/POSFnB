import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, CalendarCheck, MapPin, MessageCircle, QrCode, Star } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ROLE_HOME } from "@/lib/constants";
import { BRAND, BRAND_FAMILY, BRAND_PHOTOS, BRAND_REVIEWS, BRAND_ROOMS } from "@/lib/brand";
import { formatRupiah } from "@/lib/utils";
import { isOpenNow } from "@/lib/pickup";
import { BrandMark } from "@/components/shared/brand-mark";
import { LandingMotion } from "@/components/landing/landing-motion";
import { OrderPhone, type PhoneItem } from "@/components/landing/order-phone";
import { Monstera, Stamp, TablePlan } from "@/components/landing/aprez-art";
import "./landing.css";

export const dynamic = "force-dynamic";

const photo = (name: string) => `/aprez/photos/${name}.jpg`;

const TICKER_A = ["Nasi Ikan Nusantara", "Pho Noodle", "Chef's Salad", "Wagyu Beef Cheek", "Hainanese Chicken Rice", "Strawberry Matcha"];
const TICKER_B = ["Asian roots", "World flavors", "Breakfast buffet 06.00–10.00", "Locally sourced", "Ruang semi-VIP", "Dine in & takeaway"];

/** Tiga hidangan signature. Fotonya berganti dengan sapuan saat scroll, `parts` muncul satu per satu. */
const SIGNATURES = [
  {
    name: "Nasi Ikan Nusantara",
    origin: "Nusantara",
    img: photo("nasi-ikan"),
    pos: "50% 62%",
    desc: "Barramundi utuh digoreng renyah di atas daun pisang, ditemani nasi hangat, sayur lodeh, dan sambal.",
    parts: ["Barramundi goreng utuh", "Nasi putih hangat", "Sayur lodeh", "Sambal", "Daun pisang"],
  },
  {
    name: "Pho Noodle",
    origin: "Vietnam",
    img: photo("pho"),
    pos: "50% 50%",
    desc: "Kaldu sapi bening yang dimasak lama, mi beras, bakso, dan irisan daging sapi Australia.",
    parts: ["Kaldu sapi", "Mi beras", "Irisan sapi Australia", "Bakso sapi", "Daun herba", "Jeruk nipis & cabai"],
  },
  {
    name: "Chef's Salad",
    origin: "Dari kebun lokal",
    img: photo("chefs-salad"),
    pos: "50% 55%",
    desc: "Sayuran segar, smoked beef, keju, apel hijau, dan walnut panggang dengan pommery dressing.",
    parts: ["Mixed greens", "Smoked beef", "Keju", "Apel hijau", "Walnut panggang", "Pommery dressing"],
  },
];

/** Satu hari di Aprez Locale: empat kartu yang bertumpuk saat scroll. */
const DAY = [
  {
    label: "06.00",
    title: "Sarapan buffet",
    img: photo("buffet-station"),
    pos: "50% 50%",
    desc: "Prasmanan pagi pukul 06.00–10.00 di meja terrazzo hijau: hidangan Asia dan Nusantara, pastry, dan pilihan yang lebih ringan.",
    dishes: ["Breakfast Buffet", "Croque Monsieur"],
  },
  {
    label: "12.00",
    title: "Makan siang",
    img: photo("nusantara-platters"),
    pos: "50% 60%",
    desc: "Piring Nusantara yang mengenyangkan untuk jeda di tengah hari kerja Sudirman.",
    dishes: ["Nasi Ikan Nusantara", "Nasi Bakar Nusantara", "Hainanese Chicken Rice"],
  },
  {
    label: "15.30",
    title: "Sore yang pelan",
    img: photo("coffee-tray"),
    pos: "50% 62%",
    desc: "Kopi, minuman dingin dari bar, dan dessert sambil menunggu macet reda.",
    dishes: ["Ice Cube Latte", "Es Kopi Susu", "Choco Melted"],
  },
  {
    label: "19.00",
    title: "Makan malam",
    img: photo("beef-cheek"),
    pos: "50% 40%",
    desc: "Duduk lebih lama bersama keluarga atau tamu, dengan hidangan Asia dan Western.",
    dishes: ["Wagyu Beef Cheek Estouffade", "Pan Seared Salmon", "Pho Noodle"],
  },
];

/** Empat minuman di bagian "Dari bar"; tiap kolom bergerak dengan kecepatan berbeda. */
const BAR = [
  { name: "Strawberry Matcha", img: photo("strawberry-matcha"), note: "Matcha, susu, stroberi", drift: -46 },
  { name: "Blue Mojito", img: photo("blue-mojito"), note: "Mint, jeruk nipis, soda", drift: 54 },
  { name: "Iced Latte", img: photo("iced-latte"), note: "Espresso di atas susu dingin", drift: -24 },
  { name: "Ice Cube Latte", img: photo("coffee-tray"), note: "Es batu kopi, susu dituang sendiri", drift: 70 },
];

const STEPS = [
  { title: "Scan QR di meja", desc: "Setiap meja punya QR sendiri. Menu terbuka di HP tanpa install aplikasi." },
  { title: "Pilih menu", desc: "Atur level sambal, suhu minuman, dan catatan untuk dapur." },
  { title: "Bayar di HP", desc: "Bayar pakai QRIS langsung dari HP, atau bayar di kasir kalau lebih nyaman." },
  { title: "Pantau pesanan", desc: "Status dari dapur dan bar tampil langsung sampai hidangan diantar ke mejamu." },
];

/** Dipakai mockup HP bila menu di database belum lengkap */
const PHONE_FALLBACK: PhoneItem[] = [
  { name: "Nasi Ikan Nusantara", price: 145000, imageUrl: "/aprez/menu/nasi-ikan-nusantara.jpg", emoji: "🐟" },
  { name: "Es Kopi Susu", price: 45000, imageUrl: "/aprez/menu/es-kopi-susu.jpg", emoji: "🧋" },
  { name: "Pho Noodle", price: 115000, imageUrl: "/aprez/menu/pho-noodle.jpg", emoji: "🍜" },
  { name: "Strawberry Matcha", price: 55000, imageUrl: "/aprez/menu/strawberry-matcha.jpg", emoji: "🍓" },
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
  const phonePicked = byName(["Nasi Ikan Nusantara", "Es Kopi Susu", "Pho Noodle", "Strawberry Matcha"]);
  const phoneItems: PhoneItem[] = phonePicked.length >= 4 ? phonePicked : PHONE_FALLBACK;
  const menuCats = categories.filter((c) => c.products.length > 0);

  return (
    <div className="lp ap">
      <LandingMotion />
      <noscript>
        <style>{`.ap .lp-rv{opacity:1;transform:none}.ap .ap-seat{opacity:1;transform:none}.ap .ap-chips li{opacity:1;transform:none}`}</style>
      </noscript>
      <div className="lp-progress" aria-hidden />

      {/* Header */}
      <header className="lp-hdr">
        <div className="lp-wrap">
          <Link href="/" className="ap-logo" aria-label={BRAND.name}>
            <BrandMark className="size-9" leaf="var(--ap-gold)" />
            <span>
              <b>Aprez</b>
              <small>Locale</small>
            </span>
          </Link>
          <nav className="lp-nav">
            <a href="#signature">Signature</a>
            <a href="#hari">Sepanjang hari</a>
            <a href="#bar">Dari bar</a>
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
        {/* 1. Hero: jendela lengkung berisi foto ruang makan, foto hidangan dan daun melayang beda kecepatan */}
        <section className="ap-hero" id="top">
          <div className="ap-ghost" data-heroghost aria-hidden>
            LOCALE · LOCALE
          </div>
          <div className="lp-wrap ap-hero-grid">
            <div className="ap-hero-copy">
              <p className="lp-eyebrow lp-rv">Citadines Sudirman · Jakarta</p>
              <h1 className="lp-rv" style={delay(0.08)}>
                Asian roots,
                <em> world flavors.</em>
              </h1>
              <p className="ap-lead lp-rv" style={delay(0.16)}>
                Masakan Asia dan Nusantara dari bahan lokal, disajikan dari sarapan sampai makan malam di ruang makan yang teduh dan hijau.
                Pesan langsung dari meja lewat QR.
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
                  <b>
                    <Star className="ap-star" aria-hidden /> {BRAND.rating.score}
                  </b>
                  <span>{BRAND.rating.count} ulasan Google</span>
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
              <div className="ap-leaf ap-leaf-a" data-hero="0.14" aria-hidden>
                <Monstera id="ap-mon-a" />
              </div>
              <div className="ap-archwrap" data-hero="-0.05">
                <div className="ap-arch">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={BRAND_PHOTOS.window} alt="Ruang makan Aprez Locale dengan jendela besar menghadap taman" className="ap-par" data-par="0.1" fetchPriority="high" />
                </div>
              </div>
              <div className="ap-float ap-disc" data-hero="-0.34">
                <div data-spin="0.12">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo("pho")} alt="Pho Noodle" />
                </div>
              </div>
              <div className="ap-float ap-snap" data-hero="-0.2">
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo("strawberry-matcha")} alt="Strawberry Matcha" />
                  <figcaption>Strawberry Matcha</figcaption>
                </figure>
              </div>
              <div className="ap-leaf ap-leaf-b" data-hero="-0.5" aria-hidden>
                <Monstera id="ap-mon-b" />
              </div>
              <div className="ap-float ap-stampwrap" data-hero="-0.28" aria-hidden>
                <Stamp text="ASIAN ROOTS · WORLD FLAVORS · SUDIRMAN · " className="ap-stamp" />
              </div>
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
                      <i>✦</i>
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

        {/* 2. Signature: layar menahan, foto hidangan berganti dengan sapuan mengikuti scroll */}
        <section className="ap-sig" id="signature">
          <div className="ap-pin">
            <div className="lp-wrap ap-sig-grid">
              <div className="ap-sig-copy">
                <p className="lp-eyebrow">Signature</p>
                <h2>
                  Akar Asia, <em>di satu meja.</em>
                </h2>
                <div className="ap-sig-cards">
                  {SIGNATURES.map((s, i) => {
                    const price = priceOf(s.name);
                    return (
                      <article key={s.name} className={`ap-sig-card${i === 0 ? " lp-on" : ""}`}>
                        <span className="ap-origin">
                          {String(i + 1).padStart(2, "0")} · {s.origin}
                        </span>
                        <h3>{s.name}</h3>
                        <p>{s.desc}</p>
                        <ul className="ap-chips">
                          {s.parts.map((p, j) => (
                            <li key={p} style={{ "--ap-i": j } as React.CSSProperties}>
                              {p}
                            </li>
                          ))}
                        </ul>
                        {price !== null && <span className="ap-price">{formatRupiah(price)}</span>}
                      </article>
                    );
                  })}
                </div>
              </div>
              <div className="ap-sig-stage">
                <div className="ap-sig-leaf" data-drift="-40" aria-hidden>
                  <Monstera id="ap-mon-c" />
                </div>
                <div className="ap-sig-framewrap">
                  <div className="ap-sig-frame">
                    {SIGNATURES.map((s, i) => (
                      <div key={s.name} className="ap-shot" style={{ zIndex: i + 1 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.img} alt={s.name} loading="lazy" style={{ objectPosition: s.pos }} />
                      </div>
                    ))}
                  </div>
                  <div className="ap-sig-count" aria-hidden>
                    <b>01</b>
                    <span>/ {String(SIGNATURES.length).padStart(2, "0")}</span>
                  </div>
                  <div className="ap-sig-dots" aria-hidden>
                    {SIGNATURES.map((s) => (
                      <i key={s.name} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Sepanjang hari: kartu foto yang bertumpuk */}
        <section className="ap-day" id="hari">
          <div className="lp-wrap">
            <header className="ap-day-head">
              <p className="lp-eyebrow">Sepanjang hari</p>
              <h2 className="lp-rv">
                Buka sejak <em>matahari terbit.</em>
              </h2>
              <p className="lp-rv" style={delay(0.08)}>
                Dari sarapan sebelum rapat pertama sampai makan malam setelah semuanya selesai.
              </p>
            </header>
            <div className="ap-dstack">
              {DAY.map((m, i) => (
                <article key={m.label} className="ap-dcard" style={{ "--i": i } as React.CSSProperties}>
                  <div className="ap-dcard-in">
                    <div className="ap-dphoto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.img} alt={m.title} loading="lazy" className="ap-par" data-par="0.08" style={{ objectPosition: m.pos }} />
                      <span className="ap-dtime">{m.label}</span>
                    </div>
                    <div className="ap-dtext">
                      <span className="ap-dnum">
                        {String(i + 1).padStart(2, "0")} / {String(DAY.length).padStart(2, "0")}
                      </span>
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
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Dari bar: empat foto minuman, tiap kolom bergerak dengan kecepatan berbeda */}
        <section className="ap-bar" id="bar">
          <div className="ap-bar-leaf" data-drift="90" aria-hidden>
            <Monstera id="ap-mon-d" />
          </div>
          <div className="lp-wrap">
            <header className="ap-bar-head">
              <p className="lp-eyebrow">Dari bar</p>
              <h2 className="lp-rv">
                Yang dingin, <em>yang berlapis.</em>
              </h2>
              <p className="lp-rv" style={delay(0.08)}>
                Kopi, matcha, dan mocktail yang diracik di bar, enak untuk menemani makan atau sekadar singgah sore.
              </p>
            </header>
            <div className="ap-bar-grid">
              {BAR.map((d) => {
                const price = priceOf(d.name);
                return (
                  <figure key={d.name} className="ap-drink" data-drift={d.drift}>
                    <div className="ap-drink-ph">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.img} alt={d.name} loading="lazy" className="ap-par" data-par="0.07" />
                    </div>
                    <figcaption>
                      <b>{d.name}</b>
                      <span>{d.note}</span>
                      {price !== null && <i>{shortPrice(price)}</i>}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        </section>

        {/* 5. Menu bergaya buku menu */}
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
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt="" loading="lazy" className="ap-mthumb" />
                          ) : (
                            <span className="ap-mthumb" aria-hidden>
                              {p.name.charAt(0)}
                            </span>
                          )}
                          <div>
                            <div className="ap-mrow">
                              <span className="ap-mname">
                                {p.name}
                                {p.isFeatured && <i title="Rekomendasi">✦</i>}
                              </span>
                              <span className="ap-mdots" />
                              <span className="ap-mprice">{shortPrice(p.price)}</span>
                            </div>
                            {p.description && <p>{p.description}</p>}
                          </div>
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

        {/* 6. Pita foto ruang makan: melebar sampai penuh saat masuk layar, fotonya bergerak lebih lambat */}
        <section className="ap-band" aria-label="Ruang makan Aprez Locale">
          <div className="ap-band-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_PHOTOS.hall} alt="Ruang makan Aprez Locale: dinding keramik hijau sage, kayu terang, dan lampu putih" loading="lazy" className="ap-par" data-par="0.16" />
            <div className="lp-wrap ap-band-text" data-drift="-30">
              <p className="lp-eyebrow">Lantai dasar Citadines Sudirman</p>
              <h2>Turun dari kamar, keluar dari kantor, langsung makan.</h2>
            </div>
          </div>
        </section>

        {/* 7. Ruang */}
        <section className="ap-rooms" id="ruang">
          <div className="lp-wrap ap-rooms-grid">
            <div className="ap-rooms-photo lp-rv">
              <div className="ap-rooms-arch">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={BRAND_PHOTOS.privateRoom} alt="Ruang semi-VIP dengan meja panjang dan pohon zaitun" loading="lazy" className="ap-par" data-par="0.1" />
              </div>
              <div className="ap-rooms-leaf" data-drift="-50" aria-hidden>
                <Monstera id="ap-mon-e" />
              </div>
            </div>
            <div>
              <div className="ap-rooms-head">
                <p className="lp-eyebrow">Ruang</p>
                <h2 className="lp-rv">
                  Untuk keluarga, tim, <em>dan rombongan.</em>
                </h2>
                <p className="lp-rv" style={delay(0.08)}>
                  Selain ruang makan utama, ada dua ruang semi-VIP berpintu kaca untuk rapat makan siang atau makan bersama yang lebih tenang.
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
              </div>
              <div className="ap-room-note lp-rv">
                <ul>
                  <li>Ramah anak &amp; keluarga</li>
                  <li>Cocok untuk rombongan</li>
                  <li>Dine in &amp; takeaway</li>
                </ul>
                <a href={BRAND.links.reservation} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-sm">
                  <CalendarCheck className="size-4" /> Pesan tempat
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Kata tamu */}
        <section className="ap-said">
          <div className="lp-wrap ap-said-grid">
            <div className="ap-score lp-rv">
              <b>{BRAND.rating.score}</b>
              <span className="ap-stars" aria-label={`Nilai ${BRAND.rating.score} dari 5`}>
                {[0, 1, 2, 3, 4].map((k) => (
                  <Star key={k} aria-hidden />
                ))}
              </span>
              <small>{BRAND.rating.count} ulasan di Google Maps</small>
            </div>
            {BRAND_REVIEWS.map((r, i) => (
              <blockquote key={r.quote} className="lp-rv" style={delay(0.08 * (i + 1))}>
                <p>“{r.quote}”</p>
                <footer>{r.by}</footer>
              </blockquote>
            ))}
          </div>
        </section>

        {/* 9. Dapur */}
        <section className="ap-kitchen">
          <div className="lp-wrap ap-kitchen-grid">
            <div className="lp-rv">
              <p className="lp-eyebrow">Dari dapur</p>
              <h2>
                Bahan lokal, rasa yang dikenal,
                <em> dirapikan untuk hari ini.</em>
              </h2>
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
            <div className="ap-kitchen-photos lp-rv" style={delay(0.1)}>
              <div className="ap-kph ap-kph-a" data-drift="-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo("banquette")} alt="Bangku panjang dan area buffet" loading="lazy" />
              </div>
              <div className="ap-kph ap-kph-b" data-drift="34">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo("hainan")} alt="Hainanese Chicken Rice" loading="lazy" />
              </div>
            </div>
          </div>
        </section>

        {/* 10. Cara pesan */}
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

        {/* 11. Kunjungi */}
        <section className="ap-visit" id="kunjungi">
          <div className="ap-visit-bg" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_PHOTOS.entrance} alt="" loading="lazy" className="ap-par" data-par="0.14" />
          </div>
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
            <BrandMark className="size-5" leaf="var(--ap-gold)" /> {BRAND.name}
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
