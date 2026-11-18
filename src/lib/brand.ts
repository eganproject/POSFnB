/**
 * Identitas outlet yang tampil di website, menu customer, struk, dan layar staf.
 * Ganti isi file ini (dan foto di /public/warmhour) untuk memakai aplikasi di brand lain.
 */
export const BRAND = {
  name: "Warm Hour Cafe",
  shortName: "Warm Hour",
  tagline: "a neighborhood cafe",
  description: "Kopi, matcha, roti cocol, dan salt bread di Duri Pulo, Jakarta Pusat. Pesan langsung dari meja lewat QR.",
  address: "No.11 Blok A1, Jl. KH. Moh. Mansyur, RT.15/RW.4, Duri Pulo, Gambir, Jakarta Pusat 10140",
  area: "Duri Pulo, Gambir",
  hours: "Setiap hari, 07.30 – 21.00",
  hoursShort: "07.30 – 21.00",
  priceRange: "Rp 50–75 rb per orang",
  rating: { score: "4,7", count: 64 },
  links: {
    maps: "https://maps.app.goo.gl/hyFFEfSgGyvhn1Fz6",
    instagram: "https://www.instagram.com/cafe_by_warmhour/",
    instagramHandle: "@cafe_by_warmhour",
    grabfood: "https://r.grab.com/g/2-1-6-C8DDGUABSFCUG2",
    customCake: "https://www.instagram.com/warmhour__",
  },
  /** Warna tema browser/PWA (hijau zaitun dari papan menu) */
  themeColor: "#66694f",
  backgroundColor: "#fbf6ea",
  poweredBy: "Santap POS",
} as const;

export const BRAND_PHOTOS = {
  front: "/warmhour/front.jpg",
  interior: ["/warmhour/interior-1.jpg", "/warmhour/interior-2.jpg", "/warmhour/interior-3.jpg", "/warmhour/interior-4.jpg"],
  display: "/warmhour/display.jpg",
} as const;

export const BRAND_REVIEWS = [
  { quote: "Salah satu kafe yang sangat worth to visit buat menikmati suasana tenang.", by: "Ulasan Google" },
  { quote: "Tahu rempahnya mantep banget, ditambah manis-manis matcha & roti cocol.", by: "Ulasan Google" },
  { quote: "Their roti, cakes and salt bread are god tier level.", by: "Ulasan Google" },
] as const;
