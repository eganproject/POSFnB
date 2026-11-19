/**
 * Identitas outlet yang tampil di website, menu customer, struk, dan layar staf.
 * Ganti isi file ini (dan foto di /public/aprez) untuk memakai aplikasi di brand lain.
 * Sumber: Chope, NOW! Jakarta, Nibble.id, aprez.id, Instagram @aprezlocale.id (November 2026).
 */
export const BRAND = {
  name: "Aprez Locale",
  shortName: "Aprez Locale",
  tagline: "Asian comfort, all day",
  description:
    "Masakan Asia dan Nusantara yang akrab di lidah, dari sarapan sampai makan malam, di lantai dasar Citadines Sudirman Jakarta. Pesan langsung dari meja lewat QR.",
  address: "Citadines Sudirman Jakarta (The Newton 1, Ciputra World 2), Jl. Karet Sawah No.219, Karet Semanggi, Setiabudi, Jakarta Selatan 12930",
  area: "Citadines Sudirman, Setiabudi",
  hours: "Setiap hari, 06.00 – 22.00",
  hoursShort: "06.00 – 22.00",
  priceRange: "Rp 100–250 rb per orang",
  /** Isi angka rating Google bila sudah dicek; count 0 = bagian rating disembunyikan */
  rating: { score: "", count: 0 },
  phone: "0852-8570-6736",
  links: {
    maps: "https://maps.app.goo.gl/yeQhoWiyuPgu9r997",
    instagram: "https://www.instagram.com/aprezlocale.id/",
    instagramHandle: "@aprezlocale.id",
    whatsapp: "https://wa.me/6285285706736",
    reservation: "https://www.chope.co/jakarta-restaurants/restaurant/aprez-locale-citadines-sudirman-jakarta",
  },
  /** Terakota dan kertas nasi: warna tema browser/PWA */
  themeColor: "#9c4a2b",
  backgroundColor: "#f7f0e4",
  poweredBy: "Santap POS",
} as const;

export const BRAND_PHOTOS = {
  logo: "/aprez/logo.svg",
  logoLight: "/aprez/logo-light.svg",
  /** Foto tampak depan/suasana. Kosong = pakai ilustrasi bawaan. */
  front: "/aprez/front.svg",
  interior: ["/aprez/front.svg"],
  display: "/aprez/front.svg",
} as const;

/** Ruang semi-VIP dari halaman reservasi Chope */
export const BRAND_ROOMS = [
  { name: "Ruang sedang", guests: 8, minimum: "Rp 1,5 jt++" },
  { name: "Ruang besar", guests: 12, minimum: "Rp 2,5 jt++" },
] as const;

/** Grup usaha yang sama (Amuz Group), dari NOW! Jakarta */
export const BRAND_FAMILY = ["Amuz Gourmet", "Artoz Bar", "Aprez Café", "Aprez Catering", "Caffe Tutti"] as const;

export const BRAND_REVIEWS = [] as readonly { quote: string; by: string }[];
