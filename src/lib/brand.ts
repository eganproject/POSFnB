/**
 * Identitas outlet yang tampil di website, menu customer, struk, dan layar staf.
 * Ganti isi file ini (dan foto di /public/agreya) untuk memakai aplikasi di brand lain.
 * Sumber: agreyacoffee.com, Google Maps Agreya Coffee Menteng, Instagram @agreyacoffee (November 2026).
 */
export const BRAND = {
  name: "Agreya Coffee",
  shortName: "Agreya",
  tagline: "A Place for Your Activities",
  description:
    "Freshly brewed coffee, masakan Nusantara, pastry, dan ruang untuk semua aktivitasmu di Menteng, Jakarta Pusat. Pesan langsung dari meja lewat QR.",
  address: "Area Masjid Sunda Kelapa, Jl. Taman Sunda Kelapa No.6, Menteng, Jakarta Pusat 10310",
  area: "Menteng, Jakarta Pusat",
  hours: "Setiap hari, 06.00 – 01.00",
  hoursShort: "06.00 – 01.00",
  priceRange: "Rp 50–100 rb per orang",
  rating: { score: "4,8", count: 5255 },
  phone: "0811-1185-5620",
  links: {
    maps: "https://maps.app.goo.gl/kZNETi1QcVBfnobE8",
    instagram: "https://www.instagram.com/agreyacoffee/",
    instagramHandle: "@agreyacoffee",
    website: "https://agreyacoffee.com/",
    whatsapp: "https://wa.me/6281111855620",
  },
  /** Hijau tua dan krem sage dari logo serta buku menu Agreya */
  themeColor: "#004231",
  backgroundColor: "#eef0e7",
  poweredBy: "Santap POS",
} as const;

export const BRAND_PHOTOS = {
  logo: "/agreya/logo.png",
  logoWhite: "/agreya/logo-white.png",
  front: "/agreya/sign.jpg",
  interior: ["/agreya/counter.jpg", "/agreya/seating.jpg", "/agreya/interior.jpg", "/agreya/mural.jpg"],
  display: "/agreya/counter.jpg",
  garden: "/agreya/garden.jpg",
  cans: "/agreya/cans.webp",
} as const;

/** Outlet lain, dari halaman "Reservation & Big Orders" di profil Google Maps Agreya */
export const BRAND_OUTLETS = [
  { city: "Jakarta", name: "Menteng", address: "Jl. Taman Sunda Kelapa, Jakarta Pusat", here: true },
  { city: "Jakarta", name: "Duren Sawit", address: "Jl. Kolonel Sugiono No.15, Jakarta Timur", here: false },
  { city: "Jakarta", name: "Condet", address: "Jl. Raya Condet No.96, Jakarta Timur", here: false },
  { city: "Bogor", name: "Pandu Raya", address: "Jl. Kol. Enjo Martadisastra, Bogor Utara", here: false },
  { city: "Bogor", name: "Pajajaran", address: "Jl. Raya Pajajaran, Bogor", here: false },
] as const;

/** Potongan pendek ulasan tamu di Google Maps */
export const BRAND_REVIEWS = [
  { quote: "Tempatnya luas dan enak banget buat WFC, vibes produktifnya dapet.", by: "Ulasan Google" },
  { quote: "Selalu heran kenapa rame, dan sekarang ngerti kenapa rame.", by: "Ulasan Google" },
  { quote: "Nuansa outdoor maupun indoornya nyaman, layanan ramah.", by: "Ulasan Google" },
] as const;
