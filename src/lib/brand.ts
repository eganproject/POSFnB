/**
 * Identitas outlet yang tampil di website, menu customer, struk, dan layar staf.
 * Ganti isi file ini (dan foto di /public/amalgam) untuk memakai aplikasi di brand lain.
 */
export const BRAND = {
  name: "Amalgam Coffee Brewery",
  shortName: "Amalgam",
  tagline: "Coffee · Dining · Private Room",
  description:
    "Kopi roasting sendiri, brunch, masakan Nusantara, dan seafood di Kebon Sirih, Menteng. Pesan langsung dari meja lewat QR.",
  address: "Jl. Kebon Sirih No.39, RT.14/RW.2, Kebon Sirih, Menteng, Jakarta Pusat 10340",
  area: "Kebon Sirih, Menteng",
  hours: "Setiap hari, 07.00 – 22.00",
  hoursShort: "07.00 – 22.00",
  priceRange: "Rp 100–200 rb per orang",
  rating: { score: "4,4", count: 757 },
  links: {
    maps: "https://maps.app.goo.gl/YuznGXshomQBCjku9",
    instagram: "https://www.instagram.com/amalgam.kebonsirih/",
    instagramHandle: "@amalgam.kebonsirih",
    tiktok: "https://www.tiktok.com/@amalgam.kebonsirih",
    website: "https://amalgamcoffee.com/",
    reservation: "https://wa.me/6281932400777?text=Halo%20Amalgam%2C%20saya%20ingin%20melakukan%20reservasi%20meja",
  },
  /** Warna tema browser/PWA (hijau botol dari buku menu) */
  themeColor: "#085030",
  backgroundColor: "#f3f1ea",
  poweredBy: "Santap POS",
} as const;

export const BRAND_PHOTOS = {
  front: "/amalgam/front.jpg",
  storefront: "/amalgam/storefront.jpg",
  interior: ["/amalgam/interior-1.jpg", "/amalgam/interior-2.jpg", "/amalgam/interior-3.jpg"],
  logoGreen: "/amalgam/logo-green.png",
  logoCream: "/amalgam/logo-cream.png",
} as const;

/** Cuplikan ulasan asli di Google Maps (November 2026). */
export const BRAND_REVIEWS = [
  { quote: "Tempatnya enak apalagi buat meeting, fasilitas yang tersedia sangat baik.", by: "Ulasan Google" },
  { quote: "Aku coba yang pineapple, seger asemnya dapet tapi rasa kopinya tetap ada.", by: "Ulasan Google" },
  { quote: "Tempat yang saya datangi lagi ketika belum tahu mau mampir ngopi di mana.", by: "Ulasan Google" },
] as const;
