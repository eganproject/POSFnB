/**
 * Identitas outlet yang tampil di website, menu customer, struk, dan layar staf.
 * Ganti isi file ini (dan foto di /public/aprez) untuk memakai aplikasi di brand lain.
 * Sumber: Google Maps, Chope, Grab Dine Out, NOW! Jakarta, Nibble.id, bio Instagram @aprezlocale.id (November 2026).
 */
export const BRAND = {
  name: "Aprez Locale",
  shortName: "Aprez Locale",
  tagline: "Asian roots, world flavors",
  description:
    "Masakan Asia dan Nusantara yang akrab di lidah, dari sarapan sampai makan malam, di lantai dasar Citadines Sudirman Jakarta. Pesan langsung dari meja lewat QR.",
  address: "Citadines Sudirman Jakarta (The Newton 1, Ciputra World 2), Jl. Karet Sawah No.219, Karet Semanggi, Setiabudi, Jakarta Selatan 12930",
  area: "Citadines Sudirman, Setiabudi",
  hours: "Setiap hari, 06.00 – 22.00",
  hoursShort: "06.00 – 22.00",
  priceRange: "Rp 100–250 rb per orang",
  rating: { score: "5,0", count: 19 },
  phone: "0852-8570-6736",
  links: {
    maps: "https://maps.app.goo.gl/yeQhoWiyuPgu9r997",
    instagram: "https://www.instagram.com/aprezlocale.id/",
    instagramHandle: "@aprezlocale.id",
    whatsapp: "https://wa.me/6285285706736",
    reservation: "https://www.chope.co/jakarta-restaurants/restaurant/aprez-locale-citadines-sudirman-jakarta",
  },
  /** Hijau olive logo dan krem kayu terang: warna tema browser/PWA */
  themeColor: "#55652f",
  backgroundColor: "#f6f1e6",
  poweredBy: "Santap POS",
} as const;

const photo = (name: string) => `/aprez/photos/${name}.jpg`;

/** Foto resmi (Grab Dine Out, Chope, NOW! Jakarta) dan foto pengunjung Google Maps. Perlu izin pemilik bila dipakai sungguhan. */
export const BRAND_PHOTOS = {
  logo: "/aprez/logo.svg",
  logoLight: "/aprez/logo-light.svg",
  front: photo("window-dining"),
  entrance: photo("front"),
  interior: [photo("hall"), photo("window"), photo("banquette"), photo("buffet-station")],
  display: photo("buffet-station"),
  window: photo("window"),
  hall: photo("hall-2"),
  privateRoom: photo("private-room"),
} as const;

/** Ruang semi-VIP dari halaman reservasi Chope */
export const BRAND_ROOMS = [
  { name: "Ruang sedang", guests: 8, minimum: "Rp 1,5 jt++" },
  { name: "Ruang besar", guests: 12, minimum: "Rp 2,5 jt++" },
] as const;

/** Grup usaha yang sama (Amuz Group), dari NOW! Jakarta */
export const BRAND_FAMILY = ["Amuz Gourmet", "Artoz Bar", "Aprez Café", "Aprez Catering", "Caffe Tutti"] as const;

/** Potongan pendek ulasan tamu di Google Maps */
export const BRAND_REVIEWS = [
  { quote: "Es kopi susu mantab, terasa kopinya pas, saya pesan yang less sugar.", by: "Andri G · Ulasan Google" },
  { quote: "Lunch meeting di sini, ada private meeting room. Penyajian cepat, suasana tidak ramai.", by: "Ulasan Google" },
  { quote: "Makanan dan suasananya suka banget.", by: "Ulasan Google" },
] as const;
