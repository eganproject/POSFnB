import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, MapPin, QrCode, Star, Store } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ROLE_HOME } from "@/lib/constants";
import { BRAND, BRAND_OUTLETS, BRAND_PHOTOS, BRAND_REVIEWS } from "@/lib/brand";
import { formatRupiah } from "@/lib/utils";
import { isOpenNow } from "@/lib/pickup";
import { BrandMark } from "@/components/shared/brand-mark";
import { LandingMotion } from "@/components/landing/landing-motion";
import { OrderPhone, type PhoneItem } from "@/components/landing/order-phone";
import "./landing.css";

export const dynamic = "force-dynamic";

const menuPhoto = (slug: string) => `/agreya/menu/${slug}.jpg`;

const RIBBON = ["Freshly Brewed Coffee", "Work From Cafe", "Meeting Room", "Nusantara", "Pastry & Gelato", `Buka ${BRAND.hoursShort}`];

/**
 * Kartu "Sehari di Agreya" yang bergeser ke samping. `hour` dipakai jam berjalan di pojok:
 * dari 06.00 saat buka sampai 01.00 (ditulis 25) saat tutup, dan latar ikut berubah dari siang ke malam.
 */
const DAY = [
  { hour: 6, part: "Pagi", img: menuPhoto("agreya-breakfast"), alt: "Agreya Breakfast: sosis, telur orak-arik, jamur, dan sayuran", title: "Sarapan sebelum kota ramai", desc: "Pintu sudah buka jam 6. Agreya Breakfast dan kopi pertama hari ini." },
  { hour: 9, part: "Kerja", img: "/agreya/cup.jpg", alt: "Cangkir hijau berlogo Agreya Coffee di meja", title: "Work from cafe", desc: "Buka laptop, pesan dari meja, dan lanjutkan kerjaan tanpa terburu-buru." },
  { hour: 12, part: "Siang", img: menuPhoto("nasi-goreng-mamak"), alt: "Nasi Goreng Mamak dengan kerupuk dan acar", title: "Makan siang Nusantara", desc: "Nasi Goreng Mamak, Sop Buntut, sampai Pempek Palembang." },
  { hour: 15, part: "Sore", img: "/agreya/seating.jpg", alt: "Area duduk semi terbuka Agreya yang ramai dengan pepohonan di luar", title: "Meeting dan ngobrol sore", desc: "Ruang yang lega untuk rapat kecil, atau pesan meeting room untuk timmu." },
  { hour: 19, part: "Malam", img: menuPhoto("mix-platter"), alt: "Mix Platter: kentang goreng, sayap ayam, dan sosis", title: "Kumpul bareng teman", desc: "Mix Platter, pizza, dan mocktail untuk dibagi satu meja." },
  { hour: 23, part: "Larut", img: "/agreya/cappuccino.jpg", alt: "Cappuccino dengan latte art di cangkir keramik", title: "Masih buka sampai jam 1", desc: "Untuk yang baru sempat ngopi setelah semuanya selesai." },
];

/** Java Series dan Black Series: tiga pasang kaleng yang berganti mengikuti scroll (harga dari database) */
const CANS = [
  {
    names: ["Patih Can", "Rahayu Can"],
    title: "Patih & Rahayu",
    desc: "Patih: kopi hitam berbalut rempah khas Indonesia. Rahayu: kopi pilihan dengan lembutnya susu.",
    photos: [menuPhoto("patih-can"), menuPhoto("rahayu-can")],
  },
  {
    names: ["Sekar Can", "Aksara Can"],
    title: "Sekar & Aksara",
    desc: "Sekar: espresso, caramel, dan cream. Aksara: cokelat dengan rasa kacang. Paling pas dengan es batu.",
    photos: [menuPhoto("sekar-can"), menuPhoto("aksara-can")],
  },
  {
    names: ["Asih Can", "Dimas Can"],
    title: "Asih & Dimas",
    desc: "Black Series, cold brew yang diseduh sehari penuh. Asih dari Flores Bajawa, Dimas dari Gunung Arca, Sukabumi.",
    photos: [menuPhoto("asih-can"), menuPhoto("dimas-can")],
  },
];
const CAN_NAMES = CANS.flatMap((c) => c.names);

/** Urutan menu di bagian Favorit (nama harus sama dengan di menu); sisanya diisi menu unggulan lain */
const FAVOURITES = ["Es Kopi Susu Agreya", "Magic", "Nasi Goreng Kampung", "Sop Buntut Gurih Special", "Butter Croissant", "Mix Double Scoop"];

const SPACES = [
  { label: "Work from cafe", note: "mulai 06.00" },
  { label: "Meeting room", note: "dengan reservasi" },
  { label: "Smoking indoor", note: "ruang terpisah" },
  { label: "Area outdoor", note: "di bawah pepohonan" },
  { label: "Masjid Sunda Kelapa", note: "satu area" },
];

const STEPS = [
  { title: "Scan QR di meja", desc: "Setiap meja punya QR sendiri. Menu terbuka di HP tanpa install aplikasi." },
  { title: "Pilih menu", desc: "Atur tingkat gula, level pedas, sampai rasa gelato sesuai seleramu." },
  { title: "Bayar di HP", desc: "Bayar pakai QRIS langsung dari HP, atau bayar di kasir kalau lebih nyaman." },
  { title: "Pantau pesanan", desc: "Status dari bar dan dapur tampil langsung, sampai pesanan diantar ke mejamu." },
];

/** Dipakai mockup HP bila menu unggulan di database belum cukup */
const PHONE_FALLBACK: PhoneItem[] = [
  { name: "Es Kopi Susu Agreya", price: 35000, imageUrl: menuPhoto("es-kopi-susu-agreya"), emoji: "🧋" },
  { name: "Nasi Goreng Kampung", price: 49000, imageUrl: menuPhoto("nasi-goreng-kampung"), emoji: "🍚" },
  { name: "Magic", price: 45000, imageUrl: menuPhoto("magic"), emoji: "☕" },
  { name: "Butter Croissant", price: 33000, imageUrl: menuPhoto("butter-croissant"), emoji: "🥐" },
];

const clock = (hhmm: string) => hhmm.replace(":", ".");

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const demo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGIN === "true";
  const [outlet, featured, menuCount, canRows] = await Promise.all([
    db.outlet.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      include: { tables: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 6 } },
    }),
    db.product.findMany({
      where: { isActive: true, isFeatured: true, imageUrl: { not: null } },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: { category: { select: { name: true } } },
    }),
    db.product.count({ where: { isActive: true } }),
    db.product.findMany({ where: { isActive: true, name: { in: CAN_NAMES } }, select: { name: true, price: true } }),
  ]);
  const menuHref = outlet ? `/m/${outlet.slug}` : "/login";
  const openNow = outlet ? isOpenNow(new Date(), outlet, process.env.APP_TIMEZONE || "Asia/Jakarta") : null;

  // Favorit: urutan pilihan kami lebih dulu, lalu menu unggulan lain sampai enam
  const picked = FAVOURITES.flatMap((name) => featured.filter((p) => p.name === name));
  const favourites = [...picked, ...featured.filter((p) => !picked.includes(p) && !CAN_NAMES.includes(p.name))].slice(0, 6);
  // HP peraga: satu minuman (bar) lalu satu makanan (dapur) masuk keranjang
  const phoneItems: PhoneItem[] = favourites.length >= 4 ? [favourites[0], favourites[2], favourites[1], favourites[3]] : PHONE_FALLBACK;
  const cans = CANS.map((c) => {
    const prices = c.names.map((n) => canRows.find((r) => r.name === n)?.price).filter((v): v is number => typeof v === "number");
    return { ...c, price: prices.length ? Math.min(...prices) : null };
  });
  const stats = [
    { value: Number(BRAND.rating.score.replace(",", ".")), text: BRAND.rating.score, dec: 1, label: "rating Google" },
    { value: BRAND.rating.count, text: BRAND.rating.count.toLocaleString("id-ID"), dec: 0, label: "ulasan tamu" },
    { value: menuCount, text: String(menuCount), dec: 0, label: "pilihan menu" },
    { value: BRAND_OUTLETS.length, text: String(BRAND_OUTLETS.length), dec: 0, label: "outlet Jakarta & Bogor" },
  ].filter((s) => s.value > 0);

  return (
    <div className="lp">
      <LandingMotion />
      {/* Tanpa JavaScript semua isi tetap terlihat */}
      <noscript>
        <style>{`.lp .lp-rv,.lp .lp-revs .lp-w{opacity:1;transform:none}.lp .lp-pinwrap svg{opacity:1}.lp .lp-thread{display:none}`}</style>
      </noscript>
      <div className="lp-progress" aria-hidden />

      {/* Header */}
      <header className="lp-hdr">
        <div className="lp-wrap">
          <Link href="/" className="lp-logo" aria-label={BRAND.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_PHOTOS.logoWhite} alt={BRAND.name} />
          </Link>
          <nav className="lp-nav">
            <a href="#sehari">Sehari di Agreya</a>
            <a href="#kopi">Java Series</a>
            {favourites.length > 0 && <a href="#favorit">Favorit</a>}
            <a href="#ruang">Ruang</a>
            <a href="#pesan">Cara pesan</a>
            <a href="#kunjungi">Kunjungi</a>
          </nav>
          <div className="lp-hact">
            <Link href="/akun">Akun saya</Link>
            <Link href="/login" className="lp-staff">
              Masuk staf
            </Link>
            <Link href={menuHref} className="lp-btn lp-btn-gold">
              Lihat menu
            </Link>
          </div>
        </div>
      </header>

      <main className="lp-main">
        {/* Benang emas: satu garis yang tumbuh mengikuti scroll dan menyambungkan semua bagian */}
        <svg className="lp-thread" aria-hidden>
          <path className="lp-tbase" />
          <path className="lp-tline" />
          <g />
          <circle className="lp-ttip" r="4.5" />
        </svg>

        {/* 1. Hero: foto taman, daun, kaleng kopi, dan matahari bergerak beda kecepatan */}
        <section className="lp-hero">
          <div className="lp-bg" data-hero="0.24">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_PHOTOS.garden} alt="" fetchPriority="high" />
          </div>
          <div className="lp-leaf lp-l1" data-hero="-0.12" aria-hidden>
            <Leaf />
          </div>
          <div className="lp-leaf lp-l2" data-hero="0.1" aria-hidden>
            <Leaf />
          </div>
          <div className="lp-leaf lp-l3" data-hero="-0.3" aria-hidden>
            <Leaf />
          </div>
          <canvas className="lp-beans" aria-hidden />
          <div className="lp-ghost" data-heroghost aria-hidden>
            work. meet. gather.
          </div>
          <div className="lp-wrap lp-grid">
            <div>
              <p className="lp-eyebrow lp-intro" style={delay(0.1)}>
                {BRAND.name} · Menteng
              </p>
              <h1 className="lp-intro" style={delay(0.25)}>
                A Place for Your <em>Activities</em>
              </h1>
              <p className="lp-lede lp-intro" style={delay(0.45)}>
                Ngopi, kerja, meeting, atau sekadar duduk lama. Ada tempatnya di sini, dari jam 6 pagi sampai jam 1 malam.
              </p>
              <div className="lp-cta lp-intro" style={delay(0.6)}>
                <Link href={menuHref} className="lp-btn lp-btn-gold">
                  {outlet?.takeawayEnabled ? "Pesan takeaway" : "Lihat menu"} <ArrowRight className="size-4" />
                </Link>
                <a href={BRAND.links.maps} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-line">
                  <MapPin className="size-4" /> Petunjuk arah
                </a>
              </div>
              <dl className="lp-intro" style={delay(0.75)}>
                <div>
                  <dt>Buka setiap hari</dt>
                  <dd>{BRAND.hoursShort}</dd>
                </div>
                <div>
                  <dt>Google</dt>
                  <dd>
                    ★ {BRAND.rating.score} <span>({BRAND.rating.count.toLocaleString("id-ID")})</span>
                  </dd>
                </div>
                <div>
                  <dt>Lokasi</dt>
                  <dd>Menteng</dd>
                </div>
              </dl>
            </div>
            <div className="lp-cansbox">
              <div className="lp-sun" data-hero="-0.08" aria-hidden>
                <Sun />
              </div>
              <div className="lp-cans" data-hero="-0.2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={BRAND_PHOTOS.cans} alt="Kopi kaleng Agreya Java Series: Patih dan Rahayu" />
              </div>
              <div className="lp-stamp" data-hero="-0.34" aria-hidden>
                <svg className="lp-ring" viewBox="0 0 128 128">
                  <defs>
                    <path id="lp-stamp-circle" d="M64 64m-48 0a48 48 0 1 1 96 0a48 48 0 1 1-96 0" />
                  </defs>
                  <text>
                    <textPath href="#lp-stamp-circle">freshly brewed · java series · menteng · </textPath>
                  </text>
                </svg>
                <BrandMark className="lp-mark" />
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

        {/* 2. Sehari di Agreya: scroll ke bawah, kartu bergeser ke samping, jam berjalan, siang menjadi malam */}
        <section id="sehari" className="lp-pinsec lp-day" data-node>
          <div className="lp-pin">
            <div className="lp-wrap lp-dhead">
              <div className="lp-row">
                <div>
                  <p className="lp-eyebrow">Buka {BRAND.hoursShort.replace("–", "sampai")}</p>
                  <h2 className="lp-title">Sehari di Agreya</h2>
                </div>
                <div className="lp-clock" aria-hidden>
                  <span className="lp-sky">
                    <i />
                  </span>
                  <b>06.00</b>
                </div>
              </div>
              <div className="lp-hbar" aria-hidden>
                <i />
              </div>
            </div>
            <div className="lp-view">
              <div className="lp-track">
                {DAY.map((d) => (
                  <article key={d.hour} className="lp-panel" data-hour={d.hour}>
                    <div className="lp-ph">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.img} alt={d.alt} loading="lazy" />
                      <span className="lp-num" aria-hidden>
                        {String(d.hour).padStart(2, "0")}
                        <small>{d.part}</small>
                      </span>
                    </div>
                    <div className="lp-tx">
                      <h3>{d.title}</h3>
                      <p>{d.desc}</p>
                    </div>
                  </article>
                ))}
                <div className="lp-panel lp-end" data-hour={25}>
                  <b>{menuCount > 0 ? `${menuCount} menu, dari kopi sampai gelato.` : "Dari kopi sampai gelato."}</b>
                  <Link href={menuHref} className="lp-btn">
                    Lihat semua menu
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Java Series: layar menahan, tiga pasang kaleng berganti mengikuti scroll */}
        <section id="kopi" className="lp-pinsec lp-java" data-node>
          <div className="lp-pin">
            <canvas className="lp-beans" data-few="1" aria-hidden />
            <div className="lp-wrap">
              <div>
                <p className="lp-eyebrow">Java Series</p>
                <h2>Kopi Agreya, sekarang dalam kaleng</h2>
                <div className="lp-caps">
                  {cans.map((c, i) => (
                    <div key={c.title} className={`lp-cap${i === 0 ? " lp-on" : ""}`}>
                      <b>
                        {c.title}
                        {c.price !== null && <small>{formatRupiah(c.price)}</small>}
                      </b>
                      <p>{c.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="lp-dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </div>
                <div className="lp-origins" aria-hidden>
                  {CAN_NAMES.map((n) => (
                    <span key={n}>{n.replace(" Can", "")}</span>
                  ))}
                </div>
              </div>
              <div className="lp-stage">
                <Orbit />
                {cans.map((c, i) => (
                  <div key={c.title} className={`lp-pair${i === 0 ? " lp-on" : ""}`}>
                    {c.photos.map((src, k) => (
                      <div key={src} className="lp-ph">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Kopi kaleng ${c.names[k].replace(" Can", "")}`} loading="lazy" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4. Favorit */}
        {favourites.length > 0 && (
          <section id="favorit" className="lp-sec" data-node>
            <div className="lp-wrap">
              <div className="lp-head lp-rv">
                <div>
                  <p className="lp-eyebrow">Dari bar &amp; dapur kami</p>
                  <h2 className="lp-title">Yang paling sering dipesan</h2>
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

        {/* 5. Jendela parallax: mural di belakang bergerak lebih lambat dari tulisan */}
        <section className="lp-band">
          <div className="lp-bg" data-band>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/agreya/mural.jpg" alt="Mural bergambar orang-orang beraktivitas di dinding Agreya Coffee" loading="lazy" />
          </div>
          <div className="lp-ghost" data-bandx="-1" aria-hidden>
            work. meet. gather. work. meet.
          </div>
          <div className="lp-in" data-bandin>
            <p className="lp-big">Satu tempat, banyak kegiatan.</p>
            <p className="lp-sm">Kerja sendiri, rapat kecil, atau kumpul sampai larut.</p>
          </div>
        </section>

        {/* 6. Ruang: foto bertumpuk dengan kedalaman */}
        <section id="ruang" className="lp-sec lp-space" data-node>
          <canvas className="lp-beans" data-few="1" aria-hidden />
          <div className="lp-wrap">
            <div>
              <p className="lp-eyebrow">Ruang</p>
              <h2 className="lp-rv">Pilih sudutmu sendiri</h2>
              <p className="lp-lead lp-rv" style={delay(0.1)}>
                Di area Masjid Sunda Kelapa, Menteng. Tempatnya lega, dengan sudut untuk bekerja, ruang rapat, dan area terbuka yang teduh.
              </p>
              <ul>
                {SPACES.map((s, i) => (
                  <li key={s.label} className="lp-line lp-io" style={delay(i * 0.1)}>
                    <span>{s.label}</span>
                    <span>{s.note}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-stack">
              <div className="lp-ph lp-b" data-plx="-0.55">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/agreya/sign.jpg" alt="Papan nama Agreya Coffee Menteng" loading="lazy" />
              </div>
              <div className="lp-ph lp-a" data-plx="-0.15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/agreya/interior.jpg" alt="Ruang dalam Agreya Coffee Menteng dengan bar di ujung ruangan" loading="lazy" />
              </div>
              <div className="lp-ph lp-c" data-plx="0.55">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/agreya/counter.jpg" alt="Bar dan etalase pastry Agreya Coffee Menteng" loading="lazy" />
              </div>
              <div className="lp-ph lp-d" data-plx="0.95">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/agreya/rahayu.jpg" alt="Kopi kaleng Rahayu di meja" loading="lazy" />
              </div>
              <div className="lp-pax" data-plx="1.3" aria-hidden>
                <span>
                  buka<b>19</b>jam
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Angka dan ulasan */}
        <section className="lp-sec lp-room">
          <div className="lp-wrap">
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
        <section id="pesan" className="lp-pinsec lp-flow" data-node>
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
                <OrderPhone logo={BRAND_PHOTOS.logo} brand={BRAND.shortName} items={phoneItems} />
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
            <img src={BRAND_PHOTOS.garden} alt="Taman dan kolam di salah satu outlet Agreya Coffee" loading="lazy" />
          </div>
          <div className="lp-ghost" data-bandx="1" aria-hidden>
            menteng. menteng. menteng.
          </div>
          <div className="lp-in" data-bandin>
            <p className="lp-big">Dari jam 6 pagi sampai jam 1 malam.</p>
            <p className="lp-sm">Dine in, takeaway, dan meeting room untuk acaramu.</p>
          </div>
        </section>

        {/* 9. Kunjungi */}
        <section id="kunjungi" className="lp-sec lp-visit" data-node>
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
                <a href={BRAND.links.maps} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-gold">
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
                  <dd>Dine in · Takeaway · Meeting room</dd>
                </div>
              </dl>
              <div className="lp-chips lp-rv" style={delay(0.3)}>
                <ExtLink href={BRAND.links.whatsapp}>Reservasi via WhatsApp</ExtLink>
                <ExtLink href={BRAND.links.instagram}>Instagram {BRAND.links.instagramHandle}</ExtLink>
                <ExtLink href={BRAND.links.website}>agreyacoffee.com</ExtLink>
              </div>
              <div className="lp-outlets lp-rv" style={delay(0.4)}>
                <h3>Outlet Agreya</h3>
                <ul>
                  {BRAND_OUTLETS.map((o) => (
                    <li key={o.name}>
                      <b>
                        {o.name}
                        {o.here && <i>di sini</i>}
                      </b>
                      {o.address}
                    </li>
                  ))}
                </ul>
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

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} <ArrowUpRight className="size-3.5" />
    </a>
  );
}

/** Daun lebar seperti di taman Agreya */
function Leaf() {
  return (
    <svg viewBox="0 0 220 280">
      <path d="M22 268C4 160 58 44 200 10c12 124-52 232-178 258Z" fill="currentColor" />
      <g fill="none" stroke="rgb(0 0 0/.22)" strokeWidth="2" strokeLinecap="round">
        <path d="M22 268C74 180 138 86 200 10" />
        <path d="M58 212c-10-26-12-52-6-80M92 164c-8-24-8-48 0-74M128 116c-4-20-2-40 8-60M58 212c28 4 56 0 82-14M92 164c26 2 52-4 76-20M128 116c22 0 42-8 60-22" />
      </g>
    </svg>
  );
}

/** Matahari emas berkelopak, hiasan yang dipakai Agreya di materi menunya */
function Sun() {
  return (
    <svg viewBox="0 0 200 200">
      <g fill="var(--lp-honey)">
        {Array.from({ length: 16 }, (_, i) => (
          <ellipse key={i} cx="100" cy="40" rx="11.5" ry="38" transform={`rotate(${i * 22.5} 100 100)`} />
        ))}
        <circle cx="100" cy="100" r="34" />
      </g>
    </svg>
  );
}

/** Cincin titik-titik yang saling terhubung (motif logo Agreya), berputar mengikuti scroll */
function Orbit() {
  const dots = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return { x: 160 + Math.cos(a) * 150, y: 160 + Math.sin(a) * 150, r: i % 3 === 0 ? 7 : 3.5 };
  });
  return (
    <svg className="lp-orbit" viewBox="0 0 320 320" aria-hidden>
      <circle cx="160" cy="160" r="150" fill="none" stroke="rgb(230 179 80/.35)" strokeWidth="1.5" />
      <circle cx="160" cy="160" r="112" fill="rgb(230 179 80/.08)" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={d.r} fill="var(--lp-honey)" />
      ))}
    </svg>
  );
}
