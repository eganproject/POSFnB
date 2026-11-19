import { PrismaClient, type PaymentMethod } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import crypto from "node:crypto";

const db = new PrismaClient();
const id = () => crypto.randomBytes(16).toString("hex");
const token = () => crypto.randomBytes(9).toString("base64url");

type Opt = { name: string; price?: number; default?: boolean };
type Group = { name: string; min: number; max: number; options: Opt[] };
type Item = { name: string; price: number; desc: string; emoji?: string; image?: string; featured?: boolean; groups?: Group[] };

/**
 * Menu Agreya Coffee Menteng: nama, harga, deskripsi, dan foto disalin dari halaman pesan online
 * resmi mereka (ESB Order, November 2026). Harga dalam Rupiah, belum termasuk PB1 10% dan service 3%.
 * Pilihan (rasa gelato, sirup, sambal, topping) diambil dari deskripsi menu; tingkat gula dan
 * level pedas adalah tambahan perkiraan untuk demo.
 */
const K = 1000;
const img = (name: string) => `/agreya/menu/${name}.jpg`;

const pilih = (name: string, options: string[], min = 1, max = 1): Group => ({
  name,
  min,
  max,
  options: options.map((o, i) => ({ name: o, default: min > 0 && i < min })),
});
const GELATO = ["Vanilla", "Tiramisu", "Strawberry", "Nutella"];
const rasaGelato = pilih("Rasa", GELATO);
const duaRasaGelato = pilih("Pilih 2 rasa", GELATO, 2, 2);
const sirup = pilih("Sirup", ["Butterscotch", "Hazelnut", "Salted Caramel", "Vanilla"]);
const gula = pilih("Tingkat gula", ["Normal", "Less sugar"]);
const pedas = pilih("Level pedas", ["Sedang", "Tidak pedas", "Pedas"]);
const sambal = pilih("Sambal", ["Sambal Bawang", "Sambal Hijau", "Sambal Hitam", "Sambal Matah"]);
const toppingKari = pilih("Topping", ["Ayam", "Udang"]);

const MENU: { name: string; icon: string; items: Item[] }[] = [
  {
    name: "Java Series",
    icon: "🥫",
    items: [
      { name: "Sekar Can", emoji: "🥫", price: 39 * K, desc: "Sekar adalah minuman dari perpaduan rasa espresso, caramel dan cream. Minuman ini juga lebih dominan rasa creamy pas untuk di sajikan bersama ice cube.", image: img("sekar-can") },
      { name: "Aksara Can", emoji: "🥫", price: 39 * K, desc: "Aksara adalah minuman perpaduan dari coklat dan rasa kacang. Rasa minuman ini akan lebih terasa jika disajikan dengan Ice Cube.", image: img("aksara-can") },
      { name: "Rahayu Can", emoji: "🥫", price: 39 * K, desc: "Rahayu Kombinasi sempurna antara kopi pilihan dengan kelembutan susu menghadirkan sensasi kesegaran.", image: img("rahayu-can"), featured: true },
      { name: "Patih Can", emoji: "🥫", price: 39 * K, desc: "Patih: Perpaduan harmonis antara aroma dan rasa yang unik dalam setiap tegukan. Sentuhan kopi hitam dibalut dengan rempah-rempah khas Indonesia.", image: img("patih-can"), featured: true },
      { name: "Asih Can", emoji: "🥫", price: 35 * K, desc: "Biji kopi dari nusa tenggara timur Flores Bajawa menjadi pilihan untuk meberikan rasa eksotis yang sangat berkarakter dan unik, dengan proses cold brew recirculated immersion selama sehari penuh menghasilkan notes rasa vanilla, peach dan jasmine yang cocok di nikmati di saat santai.", image: img("asih-can") },
      { name: "Dimas Can", emoji: "🥫", price: 35 * K, desc: "Pilihan biji kopi terbaik dari Jawa Barat di salah satu daerah tertinggi di sukabumi, Gunung Arca dengan natural pembuatan cold brew inirecirculated immersion dengan melalui proses sepanjang hari menghasilkan taste notes black tea, guava dan palm sugar yang sangat cocok di nikmati para pecinta kopi dengan rasa yang bold.", image: img("dimas-can") },
      { name: "Mont Blanc Asih", emoji: "☕", price: 42 * K, desc: "Kopi hitam Asih dengan sea salt cream & taburan kulit jeruk.", image: img("mont-blanc-asih"), featured: true },
      { name: "Mont Blanc Dimas", emoji: "☕", price: 42 * K, desc: "Kopi hitam Dimas dengan sentuhan sea salt cream di atasnya & taburan kayu manis.", image: img("mont-blanc-dimas") },
    ],
  },
  {
    name: "Es Kopi",
    icon: "🧊",
    items: [
      { name: "Es Kopi Susu Agreya", emoji: "🧋", price: 35 * K, desc: "Nikmati Es Kopi Susu Agreya dengan perpaduan House Blend, susu, dan gula aren yang creamy, manis, dan balance.", image: img("es-kopi-susu-agreya"), featured: true, groups: [gula] },
      { name: "Ice Americano", emoji: "🧋", price: 32 * K, desc: "Nikmati kesegaran Ice Americano dari perpaduan espresso dan air dingin, dengan rasa kopi yang bold, ringan, dan menyegarkan.", image: img("ice-americano") },
      { name: "Iced Flavored Latte", emoji: "🧋", price: 55 * K, desc: "Nikmati Iced Flavored Latte dari perpaduan espresso, susu, dan sirup pilihan yang creamy dan manis. Pilih rasa favoritmu, Butterscotch, Hazelnut, Salted Caramel, atau Vanilla.", image: img("iced-flavored-latte"), groups: [sirup, gula] },
      { name: "Dirty Matcha", emoji: "🧋", price: 38 * K, desc: "Nikmati Dirty Matcha dari perpaduan matcha yang creamy dan espresso, menghasilkan rasa earthy, bold, dan seimbang dalam setiap tegukan.", image: img("dirty-matcha"), groups: [gula] },
      { name: "Salted Shaken Latte", emoji: "🧋", price: 42 * K, desc: "Nikmati Salted Shaken Latte dari perpaduan espresso, susu dingin, dan sentuhan rasa salted yang creamy, gurih, dan seimbang.", image: img("salted-shaken-latte"), groups: [gula] },
      { name: "Dirty Latte", emoji: "🧋", price: 35 * K, desc: "Espresso with Cold Milk.", image: img("dirty-latte") },
      { name: "Ice Cafe Latte", emoji: "🧋", price: 43 * K, desc: "Espresso dengan susu dingin dan es, menghasilkan rasa kopi yang creamy, smooth, dan balance.", image: img("ice-cafe-latte"), groups: [gula] },
      { name: "Ice Cappuccino", emoji: "🧋", price: 45 * K, desc: "Perpaduan espresso yang diberi sentuhan es dan susu rasanya tidak terlalu pahit dan foam lebih tebal.", image: img("ice-cappuccino"), groups: [gula] },
      { name: "Ice Pandan Latte", emoji: "🧋", price: 55 * K, desc: "Minuman segar dengan kombinasi pandan dan kopi yang lezat.", image: img("ice-pandan-latte"), groups: [gula] },
      { name: "Espresso On The Rock", emoji: "🧋", price: 28 * K, desc: "Sensasi kopi kuat dengan sentuhan segar batu es.", image: img("espresso-on-the-rock") },
    ],
  },
  {
    name: "Kopi Panas",
    icon: "☕",
    items: [
      { name: "Magic", emoji: "☕", price: 45 * K, desc: "Perpaduan espresso pekat dan susu silky yang lembut, menghasilkan rasa kopi yang bold, creamy, dan seimbang di setiap tegukan.", image: img("magic"), featured: true },
      { name: "Espresso", emoji: "☕", price: 28 * K, desc: "Sebuah kombinasi sempurna kafein yang menggugah selera.", image: img("espresso") },
      { name: "Americano", emoji: "☕", price: 32 * K, desc: "Minuman kopi panas yang klasik, kuat, dan menenangkan.", image: img("americano") },
      { name: "Piccolo", emoji: "☕", price: 30 * K, desc: "Kopi PICCOLO adalah espresso penuh perasaan dengan sentuhan krim lembut.", image: img("piccolo") },
      { name: "Hot Cappuccino", emoji: "☕", price: 45 * K, desc: "Cappuccino, minuman kopi bergaya Italia dengan krim lembut dan rasa yang nikmat.", image: img("hot-cappuccino") },
      { name: "Cafe Latte", emoji: "☕", price: 43 * K, desc: "Cafe Latte adalah minuman kopi dengan susu yang halus dan creamy.", image: img("cafe-latte") },
      { name: "Salted Caramel Latte", emoji: "☕", price: 45 * K, desc: "Salah satu minuman kopi spesial dengan sentuhan karamel yang asin dengan perpaduan susu yang creamy.", image: img("salted-caramel-latte") },
    ],
  },
  {
    name: "Non-Coffee",
    icon: "🍵",
    items: [
      { name: "Hot Matcha", emoji: "🍵", price: 40 * K, desc: "MATCHA adalah bubuk hijau berkualitas Tinggi dengan aroma dan rasa yang unik.", image: img("hot-matcha") },
      { name: "Hot Chocolate", emoji: "🍵", price: 40 * K, desc: "Hot Chocolate adalah minuman cocoa manis yang lezat dan menggugah selera.", image: img("hot-chocolate") },
      { name: "Ice Chocolate", emoji: "🍵", price: 40 * K, desc: "Nikmati Ice Chocolate dengan rasa cokelat yang creamy, manis, dan menyegarkan.", image: img("ice-chocolate"), groups: [gula] },
      { name: "Ice Matcha", emoji: "🍵", price: 40 * K, desc: "Ice matcha dengan rasa matcha yang lembut dan creamy, berpadu dengan susu dingin untuk sensasi segar dan seimbang.", image: img("ice-matcha"), groups: [gula] },
    ],
  },
  {
    name: "Frappe",
    icon: "🥤",
    items: [
      { name: "Butterscotch Frappe", emoji: "🥤", price: 65 * K, desc: "Frappe kopi dengan perpaduan rasa butterscotch yang manis dan creamy, menghasilkan rasa kopi yang lembut dengan sentuhan karamel yang khas.", image: img("butterscotch-frappe") },
      { name: "Salted Caramel Frappe", emoji: "🥤", price: 65 * K, desc: "Frappe kopi dengan salted caramel yang manis gurih.", image: img("salted-caramel-frappe") },
      { name: "Chocolate Frappe", emoji: "🥤", price: 62 * K, desc: "Chocolate Frappe adalah minuman coklat dingin yang lezat dengan sentuhan krim.", image: img("chocolate-frappe") },
      { name: "Cookies & Cream", emoji: "🥤", price: 62 * K, desc: "Minuman lezat yang menyegarkan dengan rasa cream dan cookie.", image: img("cookies-cream") },
      { name: "Marie & Cream", emoji: "🥤", price: 65 * K, desc: "Marie & Cream frappe adalah minuman segar dengan rasa creamy yang lezat.", image: img("marie-cream") },
      { name: "Matcha Frappe", emoji: "🥤", price: 65 * K, desc: "Segelas nikmat minuman dingin dengan sentuhan rempah-rempah Jepang yang sempurna.", image: img("matcha-frappe") },
    ],
  },
  {
    name: "Teh",
    icon: "🫖",
    items: [
      { name: "Ice Black Tea", emoji: "🫖", price: 18 * K, desc: "Perpaduan teh hitam dan mendalam dalam secangkir kenikmatan.", image: img("ice-black-tea"), groups: [gula] },
      { name: "Hot Black Tea", emoji: "🫖", price: 18 * K, desc: "Teh hitam yang hangat dengan cita rasa kuat.", image: img("hot-black-tea") },
      { name: "Ice Lychee Tea", emoji: "🫖", price: 38 * K, desc: "Segar, manis, menyegarkan, rasa alami buah lychee terasa kuat.", image: img("ice-lychee-tea"), featured: true, groups: [gula] },
      { name: "Ice Strawberry Tea", emoji: "🫖", price: 38 * K, desc: "Segar, manis, dan nikmatnya teh stroberi yang dicampur es.", image: img("ice-strawberry-tea"), groups: [gula] },
      { name: "Ice Lemon Tea", emoji: "🫖", price: 38 * K, desc: "Ice Lemon Tea adalah minuman segar dengan perpaduan teh dan lemon.", image: img("ice-lemon-tea"), groups: [gula] },
      { name: "Ice Thai Tea", emoji: "🫖", price: 35 * K, desc: "Minuman segar Thai Tea dengan cita rasa autentik dan menyegarkan.", image: img("ice-thai-tea"), groups: [gula] },
    ],
  },
  {
    name: "Mixologist",
    icon: "🍹",
    items: [
      { name: "Sunset Berry", emoji: "🍹", price: 48 * K, desc: "Mocktail berry segar dengan warna senja.", image: img("sunset-berry") },
      { name: "Orangepresso", emoji: "🍹", price: 48 * K, desc: "Espresso bertemu jeruk segar, pahit manis yang menyegarkan.", image: img("orangepresso") },
      { name: "Virgin Mojito", emoji: "🍹", price: 38 * K, desc: "Minuman segar dengan perpaduan jeruk nipis, mint, dan soda.", image: img("virgin-mojito") },
      { name: "Graperose", emoji: "🍹", price: 40 * K, desc: "Mocktail Graprose adalah minuman segar dengan kombinasi anggur merah dan jeruk.", image: img("graperose") },
      { name: "Blue Sky", emoji: "🍹", price: 42 * K, desc: "Mocktail soda biru yang segar dan manis.", image: img("blue-sky") },
    ],
  },
  {
    name: "Jus & Smoothies",
    icon: "🥭",
    items: [
      { name: "Mango Juice", emoji: "🥤", price: 42 * K, desc: "Mango Juice adalah minuman segar yang manis dengan aroma tropis.", image: img("mango-juice") },
      { name: "Orange Juice", emoji: "🥤", price: 42 * K, desc: "Segelas aroma segar, manis asam, berwarna kuning cerah dan menyegarkan.", image: img("orange-juice") },
      { name: "Dragon Fruit Juice", emoji: "🥤", price: 42 * K, desc: "Dragon Fruit Juice adalah minuman segar dengan rasa manis dan menyegarkan.", image: img("dragon-fruit-juice") },
      { name: "I'm Berry Happy", emoji: "🥤", price: 48 * K, desc: "Kebahagiaan dan kesegaran di setiap tegukan smoothie penuh berries.", image: img("i-m-berry-happy") },
      { name: "Green N Chill", emoji: "🥤", price: 48 * K, desc: "Smoothie buah dan sayuran, tercipta minuman segar dengan rasa lembut dan menyegarkan.", image: img("green-n-chill") },
      { name: "Fruity Bestie", emoji: "🥤", price: 48 * K, desc: "Perpaduan segar buah-buahan dalam smoothie yang sehat.", image: img("fruity-bestie") },
      { name: "The Energizer", emoji: "🥤", price: 48 * K, desc: "Minuman segar yang menghidupkan semangat pengisi energi yang menyegarkan.", image: img("the-energizer") },
      { name: "Pure Coconut", emoji: "🥥", price: 35 * K, desc: "Nikmati kebaikan segar kelapa dengan keaslian yang murni.", image: img("pure-coconut") },
      { name: "Air Mineral", emoji: "💧", price: 19 * K, desc: "Air mineral adalah air yang dikemas dalam botol yang siap minum.", image: img("air-mineral") },
    ],
  },
  {
    name: "Gelato",
    icon: "🍨",
    items: [
      { name: "Mix Double Scoop", emoji: "🍨", price: 50 * K, desc: "Nikmati 2 scoop gelato dengan 2 rasa favoritmu dalam satu cup. Creamy, lembut, dan bebas pilih kombinasi Vanilla, Tiramisu, Strawberry, atau Nutella.", image: img("mix-double-scoop"), featured: true, groups: [duaRasaGelato] },
      { name: "Double Scoop Gelato", emoji: "🍨", price: 50 * K, desc: "Nikmati 2 scoop gelato dengan rasa favoritmu dalam satu cup. Creamy, lembut, dan tersedia dalam pilihan Vanilla, Tiramisu, Strawberry, atau Nutella.", image: img("double-scoop-gelato"), groups: [rasaGelato] },
      { name: "Single Scoop Gelato", emoji: "🍨", price: 28 * K, desc: "Satu scoop gelato yang lembut, creamy, dan dibuat untuk menemani setiap momen. Tersedia dalam pilihan rasa Vanilla, Tiramisu, Strawberry, dan Nutella.", image: img("single-scoop-gelato"), groups: [rasaGelato] },
    ],
  },
  {
    name: "Mamak Signatures",
    icon: "🍜",
    items: [
      { name: "Nasi Goreng Mamak", emoji: "🍜", price: 60 * K, desc: "Hidangan nasi goreng yang telah diadaptasi dengan cita rasa rempah-rempah dan bumbu yang khas Melayu yang pedas (SPICY PRODUCT).", image: img("nasi-goreng-mamak"), featured: true, groups: [pedas] },
      { name: "Mie Goreng Mamak", emoji: "🍜", price: 65 * K, desc: "Hidangan Mie goreng tebal yang telah diadaptasi dengan cita rasa rempah-rempah dan bumbu yang khas Melayu yang pedas (SPICY PRODUCT).", image: img("mie-goreng-mamak"), groups: [pedas] },
      { name: "Kwetiaw Goreng Mamak", emoji: "🍜", price: 60 * K, desc: "Hidangan Mie goreng lembut yang telah diadaptasi dengan cita rasa rempah-rempah dan bumbu yang khas Melayu yang pedas (SPICY PRODUCT).", image: img("kwetiaw-goreng-mamak"), groups: [pedas] },
    ],
  },
  {
    name: "Nasi & Mie Goreng",
    icon: "🍚",
    items: [
      { name: "Nasi Goreng Kampung", emoji: "🍚", price: 49 * K, desc: "Nasi goreng khas Nusantara dengan ayam, bakso sapi, dan bumbu rempah pilihan, disajikan dengan telur mata sapi, kerupuk udang, timun, dan acar. Gurih, harum, dengan sentuhan rasa manis dan smoky.", image: img("nasi-goreng-kampung"), featured: true, groups: [pedas] },
      { name: "Nasi Goreng Teri Medan", emoji: "🍚", price: 49 * K, desc: "Nasi goreng teri asli Medan, lezat dengan rasa gurih khas.", image: img("nasi-goreng-teri-medan"), featured: true, groups: [pedas] },
      { name: "Mie Goreng Manis Special", emoji: "🍚", price: 65 * K, desc: "Mie goreng manis special dengan resep khas manis dengan beragam topping.", image: img("mie-goreng-manis-special"), groups: [pedas] },
      { name: "Nasi Goreng Kecombrang", emoji: "🍚", price: 49 * K, desc: "Nasi goreng rempah khas Indonesia, cita rasa harum yang khas dan lezat.", image: img("nasi-goreng-kecombrang"), groups: [pedas] },
      { name: "Nasi Goreng Kambing", emoji: "🍚", price: 80 * K, desc: "Perpaduan aroma kari dan citarasa kambing yang lezat.", image: img("nasi-goreng-kambing"), groups: [pedas] },
    ],
  },
  {
    name: "Favorit Nusantara",
    icon: "🍗",
    items: [
      { name: "Ayam Goreng", emoji: "🍗", price: 60 * K, desc: "Ayam Goreng dengan sambal, jukut, tahu, tempe & lalapan.", image: img("ayam-goreng"), featured: true, groups: [sambal] },
      { name: "Bebek Goreng", emoji: "🍗", price: 70 * K, desc: "Bebek Goreng dengan sambal pilihan, jukut, tahu, tempe & lalapan.", image: img("bebek-goreng"), groups: [sambal] },
      { name: "Nasi Campur Aduk", emoji: "🍗", price: 60 * K, desc: "Campuran nasi, daging, sayuran, dan rempah yang lezat dan menggugah selera.", image: img("nasi-campur-aduk") },
      { name: "Bubur Ayam", emoji: "🍗", price: 38 * K, desc: "Bubur ayam gurih dengan potongan ayam, cakwe, pangsit goreng, dan kerupuk yang renyah.", image: img("bubur-ayam") },
      { name: "Nasi Mandhi Ayam", emoji: "🍛", price: 65 * K, desc: "Nasi Mandhi rempah yang disajikan dengan daging ayam.", image: img("nasi-mandhi-ayam") },
    ],
  },
  {
    name: "Signature Soup",
    icon: "🍲",
    items: [
      { name: "Iga Konro Bakar", emoji: "🍲", price: 125 * K, desc: "Sajian lezat daging iga dengan bumbu khas, nikmati!", image: img("iga-konro-bakar") },
      { name: "Sop Iga Gurih Special", emoji: "🍲", price: 115 * K, desc: "Sop dengan iga yang gurih dan lembut dengan proses memasak yang panjang.", image: img("sop-iga-gurih-special") },
      { name: "Sop Buntut Gurih Special", emoji: "🍲", price: 115 * K, desc: "Rasakan kenikmatan daging empuk dan berkuah lezat dengan cita rasa yang khas.", image: img("sop-buntut-gurih-special"), featured: true },
    ],
  },
  {
    name: "Mie & Bakso",
    icon: "🍜",
    items: [
      { name: "Mie Kari Kaldu Rempah", emoji: "🍜", price: 52 * K, desc: "Mie kari berkuah rempah yang gurih dan aromatik, dipadukan dengan pilihan topping ayam atau udang.", image: img("mie-kari-kaldu-rempah"), groups: [toppingKari] },
      { name: "Bakso Agreya", emoji: "🍜", price: 55 * K, desc: "Bakso urat, bakso halus, mie, krispi tahu pong dan kulit pangsit goreng.", image: img("bakso-agreya") },
      { name: "Bakmi Ayam", emoji: "🍜", price: 45 * K, desc: "Makanan lezat berupa bakmi dengan ayam, bakso dan kuah gurih istimewa.", image: img("bakmi-ayam") },
      { name: "Cuanki", emoji: "🍜", price: 48 * K, desc: "Sensasi cita rasa Makanan Legendaris Indonesia Dalam Satu Mangkuk!", image: img("cuanki") },
    ],
  },
  {
    name: "Western",
    icon: "🍝",
    items: [
      { name: "Beef Croissant Sandwich", emoji: "🍝", price: 52 * K, desc: "Renyahnya croissant di padu dengan scramble yang lembut dan gurihnya smoke beef sangat menemani pagi anda.", image: img("beef-croissant-sandwich") },
      { name: "Sausage Croissant Sandwich", emoji: "🍝", price: 56 * K, desc: "Crunchy dan lembutnya croissant dipadu dengan beef sosis dan di balur dengan saos mayonaise di atasnya.", image: img("sausage-croissant-sandwich") },
      { name: "Homemade Chicken Curry", emoji: "🍝", price: 70 * K, desc: "Resep curry special agreya, perpaduan antara nasi dan ayam di baluri dengan kuah curry dan potongan sayur. yang sangat lezat dan authentique.", image: img("homemade-chicken-curry") },
      { name: "Agreya Breakfast", emoji: "🍝", price: 65 * K, desc: "Sarapan spesial dari Agreya Coffee yang berisikan full protein dengan cukup karbohidrat untuk memulai hari.", image: img("agreya-breakfast"), featured: true },
      { name: "Spaghetti Aglio Olio with Prawn", emoji: "🍝", price: 78 * K, desc: "Spaghetti Aglio Olio dengan udang yang juicy berbalut minyak zaitun dan ditaburi cabai kering.", image: img("spaghetti-aglio-olio-with-prawn") },
      { name: "Spaghetti Carbonara Mushroom Beef", emoji: "🍝", price: 82 * K, desc: "Lezatnya Spaghetti Carbonara dengan saus Jamur yang harum.", image: img("spaghetti-carbonara-mushroom-beef") },
    ],
  },
  {
    name: "Burger & Pizza",
    icon: "🍔",
    items: [
      { name: "Classic Cheese Burger with Fries", emoji: "🍔", price: 85 * K, desc: "Beef burger lezat dengan patty sapi juicy, keju leleh, sayuran segar, dan saus spesial, disajikan dalam roti bun empuk yang menggoda selera.", image: img("classic-cheese-burger-with-fries") },
      { name: "Double Smash Classic Burger with Fries", emoji: "🍔", price: 105 * K, desc: "Dua patty sapi smash dengan keju leleh, disajikan dengan kentang goreng.", image: img("double-smash-classic-burger-with-fries") },
      { name: "Pizzareya Margherita", emoji: "🍕", price: 125 * K, desc: "Fresh, clean, and timeless. Classic pizza with bright plum tomato sauce, creamy aged mozzarella, and fresh basil. Light, balanced, and never heavy.", image: img("pizzareya-margherita"), featured: true },
      { name: "Pizzareya Tartufatta Beef", emoji: "🍕", price: 145 * K, desc: "Hearty but balanced. Savory beef crumble, bright plum tomato sauce, and melted aged mozzarella, finished with aromatic truffle oil after baking.", image: img("pizzareya-tartufatta-beef") },
      { name: "Pizzareya Tartufatta", emoji: "🍕", price: 135 * K, desc: "Creamy, earthy, and aromatic. White pizza with sautéed mushrooms, aged mozzarella, and a drizzle of truffle oil. Rich in flavor, but still light on the palate.", image: img("pizzareya-tartufatta") },
      { name: "Pizzareya Pepperoni", emoji: "🍕", price: 145 * K, desc: "Crispy pepperoni, clean melt. Beef pepperoni with a light char, melted aged mozzarella, and tangy plum tomato sauce. A modern take on the all-time favorite.", image: img("pizzareya-pepperoni") },
    ],
  },
  {
    name: "Healthy Food",
    icon: "🥗",
    items: [
      { name: "Happy Berry Dragon Bowl", emoji: "🥗", price: 75 * K, desc: "Smoothie bowl buah naga dan aneka berry dengan topping buah segar.", image: img("happy-berry-dragon-bowl") },
      { name: "Healthy Power Booster", emoji: "🥗", price: 75 * K, desc: "Bowl sehat penuh buah dan granola untuk menambah tenaga.", image: img("healthy-power-booster") },
      { name: "Chicken Salad", emoji: "🥗", price: 60 * K, desc: "Salad dengan topping potongan ayam.", image: img("chicken-salad") },
      { name: "Green Salad", emoji: "🥗", price: 45 * K, desc: "Salad dengan sayur pilihan sayur segar.", image: img("green-salad") },
      { name: "Smoked Beef Salad", emoji: "🥗", price: 60 * K, desc: "Salad segar dengan topping smoked beef.", image: img("smoked-beef-salad") },
    ],
  },
  {
    name: "Snack & Sharing",
    icon: "🍟",
    items: [
      { name: "French Fries", emoji: "🍟", price: 35 * K, desc: "Kentang goreng renyah dengan rasa gurih dan tekstur lembut di bagian dalam.", image: img("french-fries") },
      { name: "Tempe Goreng", emoji: "🍟", price: 44 * K, desc: "Tempe tradisional yang digoreng hingga renyah, dengan rasa gurih dan tekstur kriuk yang nikmat.", image: img("tempe-goreng") },
      { name: "Mix Platter", emoji: "🍟", price: 105 * K, desc: "Salah satu menu andalan untuk sharing sembari manghabiskan waktu di agreya bersama sahabat.", image: img("mix-platter"), featured: true },
      { name: "Chicken Wings", emoji: "🍟", price: 48 * K, desc: "Chicken wings original hidangan ayam panggang dengan rasa khas yang lezat.", image: img("chicken-wings") },
      { name: "Batagor", emoji: "🍟", price: 38 * K, desc: "Batagor goreng dengan tekstur renyah di luar dan lembut di dalam, disajikan bersama saus kacang gurih dan perasan jeruk limau yang segar.", image: img("batagor") },
      { name: "Tahu Walik", emoji: "🍟", price: 35 * K, desc: "Tahu walik memiliki tekstur yang renyah diluar dan lembut didalam.", image: img("tahu-walik") },
      { name: "Pempek Palembang", emoji: "🍟", price: 55 * K, desc: "Pempek Palembang Tenggiri adalah hidangan ikan khas Palembang yang lezat.", image: img("pempek-palembang"), featured: true },
      { name: "Singkong Goreng Krispi", emoji: "🍟", price: 35 * K, desc: "Singkong goreng krispi, lezat, renyah, dan gurih, cocok dijadikan camilan.", image: img("singkong-goreng-krispi") },
      { name: "Cireng Bawang", emoji: "🍟", price: 38 * K, desc: "Cireng dengan wangi dan rasa Daun Bawang dengan rasa gurih yang renyah dan lezat.", image: img("cireng-bawang") },
      { name: "Tape Goreng", emoji: "🍟", price: 35 * K, desc: "Tape goreng yang di sajikan dengan caramel sauce.", image: img("tape-goreng") },
      { name: "Pisang Goreng Madu Nikmat", emoji: "🍟", price: 40 * K, desc: "Lezatnya pisang goreng madu dalam setiap gigitannya yang menggoda selera dan membuat nagih.", image: img("pisang-goreng-madu-nikmat") },
    ],
  },
  {
    name: "Pastry",
    icon: "🥐",
    items: [
      { name: "Butter Croissant", emoji: "🥐", price: 33 * K, desc: "Croissant berlapis dengan bagian luar renyah, bagian dalam lembut, dan aroma butter.", image: img("butter-croissant"), featured: true },
      { name: "Almond Croissant", emoji: "🥐", price: 40 * K, desc: "Croissant beraroma butter dengan almond renyah dan rasa gurih manis.", image: img("almond-croissant") },
      { name: "Pain au Chocolat", emoji: "🥐", price: 37 * K, desc: "Croissant berlapis dengan isian cokelat dan aroma butter.", image: img("pain-au-chocolat") },
    ],
  },
  {
    name: "Bakery",
    icon: "🍞",
    items: [
      { name: "Abon Gulung Keju", emoji: "🍞", price: 42 * K, desc: "Roti gulung lembut dengan abon sapi, mayones, dan keju.", image: img("abon-gulung-keju") },
      { name: "Abon Gulung Original", emoji: "🍞", price: 40 * K, desc: "Roti gulung lembut dengan abon sapi dan olesan mayones.", image: img("abon-gulung-original") },
      { name: "Beef & Cheese Panini", emoji: "🍞", price: 48 * K, desc: "Roti panini dengan isian smoked beef dan keju.", image: img("beef-cheese-panini") },
      { name: "Chicken Truffle Panini", emoji: "🍞", price: 48 * K, desc: "Roti panini dengan ayam cincang, potongan jamur, dan saus truffle mayo.", image: img("chicken-truffle-panini") },
      { name: "Coffee Bun", emoji: "🍞", price: 30 * K, desc: "Roti lembut dengan lapisan atas renyah beraroma kopi.", image: img("coffee-bun") },
      { name: "Salt Bread Beef & Cheese", emoji: "🍞", price: 28 * K, desc: "Salt bread dengan isian daging sapi dan keju.", image: img("salt-bread-beef-cheese") },
      { name: "Salt Bread Garlic", emoji: "🍞", price: 25 * K, desc: "Salt bread dengan olesan butter bawang putih yang gurih.", image: img("salt-bread-garlic") },
      { name: "Salt Bread Ube", emoji: "🍞", price: 28 * K, desc: "Salt bread dengan rasa butter gurih dan isian ube manis.", image: img("salt-bread-ube") },
      { name: "Sourdough Berry & Cheese", emoji: "🍞", price: 49 * K, desc: "Roti fermentasi alami dengan cranberry kering bercita rasa manis asam.", image: img("sourdough-berry-cheese") },
      { name: "Sourdough Ube", emoji: "🍞", price: 47 * K, desc: "Roti fermentasi alami dengan ube yang memberi warna ungu khas.", image: img("sourdough-ube") },
      { name: "Ube Bun", emoji: "🍞", price: 32 * K, desc: "Roti lembut berwarna ungu dengan isian pasta ube.", image: img("ube-bun") },
    ],
  },
  {
    name: "Cakes",
    icon: "🍰",
    items: [
      { name: "Basque Burnt Cheesecake", emoji: "🍰", price: 50 * K, desc: "Cheesecake bertekstur padat dengan rasa keju yang creamy.", image: img("basque-burnt-cheesecake"), featured: true },
      { name: "Mocha Choco", emoji: "🍰", price: 48 * K, desc: "Sponge cake mocha lembut berlapis buttercream, dengan taburan meses dan topping chocoball.", image: img("mocha-choco") },
      { name: "Nougat Cake", emoji: "🍰", price: 48 * K, desc: "Sponge cake mocha lembut berlapis buttercream dengan taburan nougat renyah.", image: img("nougat-cake") },
      { name: "Mocha Rainbow", emoji: "🍰", price: 48 * K, desc: "Sponge cake mocha lembut dengan buttercream, meses warna-warni, dan topping marshmallow.", image: img("mocha-rainbow") },
      { name: "Strawberry Cheesecake", emoji: "🍰", price: 56 * K, desc: "Cheesecake dengan saus stroberi bercita rasa manis asam.", image: img("strawberry-cheesecake") },
    ],
  },
  {
    name: "Tambahan",
    icon: "➕",
    items: [
      { name: "Extra Keju Parut", emoji: "➕", price: 5 * K, desc: "Tambahkan keju parut dengan rasa gurih dan creamy untuk menambah cita rasa pada menu favoritmu.", image: img("extra-keju-parut") },
      { name: "Add On Scramble Egg", emoji: "➕", price: 12 * K, desc: "Tambahkan scrambled egg yang lembut dan creamy sebagai pelengkap menu favoritmu.", image: img("add-on-scramble-egg") },
      { name: "Add On Ayam Mandhi", emoji: "➕", price: 35 * K, desc: "Tambahan ayam mandhi.", image: img("add-on-ayam-mandhi") },
      { name: "Add On Nasi Mandhi", emoji: "➕", price: 35 * K, desc: "Tambahan nasi mandhi rempah.", image: img("add-on-nasi-mandhi") },
      { name: "Add On Sausage", emoji: "➕", price: 18 * K, desc: "Tambahan 3 cocktail sausage yang gurih dan juicy untuk melengkapi menu favoritmu.", image: img("add-on-sausage") },
      { name: "Add On Sambal Bawang", emoji: "➕", price: 12 * K, desc: "Tambahan sambal bawang.", image: img("add-on-sambal-bawang") },
      { name: "Add On Sambal Hijau", emoji: "➕", price: 12 * K, desc: "Tambahan sambal hijau.", image: img("add-on-sambal-hijau") },
      { name: "Add On Sambal Hitam", emoji: "➕", price: 12 * K, desc: "Tambahan sambal hitam.", image: img("add-on-sambal-hitam") },
      { name: "Add On Sambal Matah", emoji: "➕", price: 12 * K, desc: "Tambahan sambal matah.", image: img("add-on-sambal-matah") },
      { name: "Add On Sweet and Tangy", emoji: "➕", price: 12 * K, desc: "Tambahan saus sweet and tangy.", image: img("add-on-sweet-and-tangy") },
      { name: "Add On Honey Mustard Dressing", emoji: "➕", price: 12 * K, desc: "Tambahan honey mustard dressing.", image: img("add-on-honey-mustard-dressing") },
      { name: "Add On Roasted Sesame", emoji: "➕", price: 12 * K, desc: "Tambahan roasted sesame dressing.", image: img("add-on-roasted-sesame") },
      { name: "Add On Telur Dadar", emoji: "➕", price: 8 * K, desc: "Telur dadar adalah hidangan sederhana yang terdiri dari telur yang dikocok dan digoreng menjadi lezat dan gurih.", image: img("add-on-telur-dadar") },
      { name: "Add On Nasi Putih", emoji: "➕", price: 10 * K, desc: "Nasi putih adalah makanan pokok Asia yang lezat dan gurih.", image: img("add-on-nasi-putih") },
      { name: "Add On Telur Mata Sapi", emoji: "➕", price: 8 * K, desc: "Sajian lezat dengan telur yang dihidangkan dengan kuning setengah matang.", image: img("add-on-telur-mata-sapi") },
      { name: "Extra Nutella Gelato", emoji: "➕", price: 15 * K, desc: "Tambahkan 1 scoop Nutella Gelato dengan rasa cokelat hazelnut yang creamy dan rich.", image: img("extra-nutella-gelato") },
      { name: "Extra Strawberry Gelato", emoji: "➕", price: 15 * K, desc: "Tambahkan 1 scoop Strawberry Gelato dengan rasa manis, fruity, dan menyegarkan.", image: img("extra-strawberry-gelato") },
      { name: "Extra Tiramisu Gelato", emoji: "➕", price: 15 * K, desc: "Tambahkan 1 scoop Tiramisu Gelato dengan rasa creamy, lembut, dan aroma kopi yang khas.", image: img("extra-tiramisu-gelato") },
      { name: "Extra Vanilla Gelato", emoji: "➕", price: 15 * K, desc: "Tambahkan 1 scoop Vanilla Gelato dengan rasa creamy, lembut, dan manis yang ringan.", image: img("extra-vanilla-gelato") },
      { name: "Extra Simple Syrup", emoji: "➕", price: 3 * K, desc: "Tambahan simple syrup.", image: img("extra-simple-syrup") },
    ],
  },
];

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code4 = () => Array.from({ length: 4 }, () => pick(ALPH.split(""))).join("");
const dateKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

async function main() {
  // Seed menghapus SEMUA data dan membuat akun demo berpassword "password123".
  // Jangan pernah dijalankan di server produksi. Untuk akun owner pertama di server,
  // pakai: pnpm create-owner
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "true") {
    console.error("❌ Seed demo ditolak karena NODE_ENV=production (akan menghapus semua data).");
    console.error("   Buat akun owner dengan: pnpm create-owner");
    process.exit(1);
  }
  console.log("🧹 Membersihkan data lama…");
  await db.auditLog.deleteMany();
  await db.refund.deleteMany();
  await db.serviceRequest.deleteMany();
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.shift.deleteMany();
  await db.productUnavailable.deleteMany();
  await db.modifierOption.deleteMany();
  await db.modifierGroup.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
  await db.diningTable.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.user.deleteMany();
  await db.outlet.deleteMany();

  console.log("🏪 Outlet & meja…");
  const kemang = await db.outlet.create({
    data: {
      name: "Agreya Coffee Menteng",
      slug: "agreya-menteng",
      address: "Jl. Taman Sunda Kelapa No.6, Menteng, Jakarta Pusat 10310",
      phone: "0811-1185-5620",
      // PB1 10% dan service charge 3%, sesuai halaman pesan online Agreya
      taxRate: 10,
      serviceRate: 3,
      openTime: "06:00",
      closeTime: "01:00",
      receiptFooter: "Terima kasih sudah mampir. A Place for Your Activities. IG @agreyacoffee",
    },
  });

  const tableDefs = [
    ...Array.from({ length: 12 }, (_, i) => ({ name: `Meja ${String(i + 1).padStart(2, "0")}`, area: "Indoor", capacity: i < 6 ? 2 : 4 })),
    ...Array.from({ length: 4 }, (_, i) => ({ name: `Meja ${i + 13}`, area: "Smoking Indoor", capacity: 4 })),
    ...Array.from({ length: 6 }, (_, i) => ({ name: `Meja ${i + 17}`, area: "Outdoor", capacity: i < 3 ? 2 : 4 })),
    ...Array.from({ length: 2 }, (_, i) => ({ name: `Pods ${i + 1}`, area: "Meeting Room", capacity: 8 })),
  ];
  const kemangTables = [];
  for (const [i, t] of tableDefs.entries()) {
    kemangTables.push(await db.diningTable.create({ data: { ...t, outletId: kemang.id, qrToken: token(), sortOrder: i } }));
  }

  console.log("🍽️  Menu…");
  const allProducts: { id: string; name: string; price: number; groups: { name: string; options: { name: string; priceDelta: number }[]; min: number }[] }[] = [];
  for (const [ci, cat] of MENU.entries()) {
    const category = await db.category.create({ data: { name: cat.name, icon: cat.icon, sortOrder: ci } });
    for (const [pi, item] of cat.items.entries()) {
      const product = await db.product.create({
        data: {
          categoryId: category.id,
          name: item.name,
          description: item.desc,
          emoji: item.emoji,
          imageUrl: item.image,
          price: item.price,
          isFeatured: item.featured ?? false,
          sortOrder: pi,
          modifierGroups: {
            create: (item.groups ?? []).map((g, gi) => ({
              name: g.name,
              minSelect: g.min,
              maxSelect: g.max,
              sortOrder: gi,
              options: {
                create: g.options.map((o, oi) => ({ name: o.name, priceDelta: o.price ?? 0, isDefault: o.default ?? false, sortOrder: oi })),
              },
            })),
          },
        },
      });
      allProducts.push({
        id: product.id,
        name: item.name,
        price: item.price,
        groups: (item.groups ?? []).map((g) => ({ name: g.name, min: g.min, options: g.options.map((o) => ({ name: o.name, priceDelta: o.price ?? 0 })) })),
      });
    }
  }
  // Contoh stok habis
  const habis = allProducts.find((p) => p.name === "Pizzareya Pepperoni")!;
  await db.productUnavailable.create({ data: { outletId: kemang.id, productId: habis.id } });

  console.log("👤 Akun staf…");
  const password = await hashPassword("password123");
  const users = [
    { name: "Ega Owner", email: "owner@santap.id", role: "OWNER" as const, outletId: null },
    { name: "Sari Kasir", email: "kasir@santap.id", role: "KASIR" as const, outletId: kemang.id },
    { name: "Budi Dapur", email: "dapur@santap.id", role: "DAPUR" as const, outletId: kemang.id },
    { name: "Rina Pelayan", email: "pelayan@santap.id", role: "PELAYAN" as const, outletId: kemang.id },
  ];
  const created: Record<string, string> = {};
  for (const u of users) {
    const userId = id();
    await db.user.create({ data: { id: userId, ...u, emailVerified: true } });
    await db.account.create({ data: { id: id(), accountId: userId, providerId: "credential", userId, password } });
    created[u.email] = userId;
  }

  console.log("📈 Riwayat transaksi 14 hari…");
  const methods: PaymentMethod[] = ["CASH", "CASH", "MIDTRANS", "MIDTRANS", "QRIS_STATIC", "CARD"];
  for (const outlet of [kemang]) {
    const cashierId = created["kasir@santap.id"];
    const tables = kemangTables;
    for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
      const day = new Date();
      day.setDate(day.getDate() - daysAgo);
      const open = new Date(day);
      open.setHours(6, 0, 0, 0);
      const close = new Date(day);
      close.setHours(23, 59, 0, 0);
      const shift = await db.shift.create({
        data: { outletId: outlet.id, userId: cashierId, openedAt: open, closedAt: close, openingCash: 500000 },
      });
      const weekend = [0, 6].includes(day.getDay());
      const count = randInt(28, 46) + (weekend ? 14 : 0);
      let cashTotal = 0;
      for (let n = 1; n <= count; n++) {
        const createdAt = new Date(day);
        const hour = pick([6, 7, 7, 8, 8, 9, 10, 11, 12, 12, 13, 14, 15, 16, 16, 17, 18, 19, 19, 20, 20, 21, 22, 23]);
        createdAt.setHours(hour, randInt(0, 59), randInt(0, 59), 0);
        const done = new Date(createdAt.getTime() + randInt(12, 35) * 60000);
        const lineCount = randInt(1, 4);
        const items = Array.from({ length: lineCount }, () => {
          const p = pick(allProducts);
          const modifiers = p.groups.flatMap((g) => {
            if (g.min === 0) return [];
            const o = pick(g.options);
            return [{ group: g.name, option: o.name, priceDelta: o.priceDelta }];
          });
          const unit = p.price + modifiers.reduce((s, m) => s + m.priceDelta, 0);
          const qty = randInt(1, 3);
          return {
            productId: p.id, name: p.name, unitPrice: unit, quantity: qty, modifiers, lineTotal: unit * qty, paidQty: qty,
            // Riwayat: semua item sudah diantar
            status: "SERVED" as const, startedAt: createdAt, readyAt: done, servedAt: done,
          };
        });
        const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
        const service = Math.round((subtotal * outlet.serviceRate) / 100);
        const tax = Math.round(((subtotal + service) * outlet.taxRate) / 100);
        const total = subtotal + service + tax;
        const source = Math.random() < 0.55 ? "QR" : "POS";
        const dineIn = Math.random() < 0.75;
        const method = source === "QR" ? pick<PaymentMethod>(["MIDTRANS", "MIDTRANS", "CASH"]) : pick(methods);
        if (method === "CASH") cashTotal += total;
        await db.order.create({
          data: {
            code: `${dateKey(day).slice(2).replace(/-/g, "")}-${code4()}`,
            queueNumber: n,
            businessDate: dateKey(day),
            outletId: outlet.id,
            tableId: dineIn ? pick(tables).id : null,
            type: dineIn ? "DINE_IN" : "TAKEAWAY",
            source,
            status: "COMPLETED",
            paymentStatus: "PAID",
            payPreference: source === "QR" && method === "MIDTRANS" ? "MIDTRANS" : null,
            customerName: pick(["Andi", "Putri", "Rizky", "Nadia", "Bayu", "Citra", "Fajar", "Dewi", "Gilang", "Maya", null]),
            subtotal,
            serviceCharge: service,
            tax,
            total,
            cashierId: source === "POS" ? cashierId : null,
            createdAt,
            confirmedAt: createdAt,
            readyAt: done,
            completedAt: done,
            paidAt: createdAt,
            items: { create: items },
            payments: {
              create: {
                method,
                state: "SUCCESS",
                amount: total,
                cashReceived: method === "CASH" ? Math.ceil(total / 50000) * 50000 : null,
                changeAmount: method === "CASH" ? Math.ceil(total / 50000) * 50000 - total : null,
                gatewayOrderId: method === "MIDTRANS" ? `SEED-${id().slice(0, 12)}` : null,
                gatewayType: method === "MIDTRANS" ? pick(["qris", "gopay", "bank_transfer", "shopeepay"]) : null,
                shiftId: shift.id,
                receivedById: method === "MIDTRANS" ? null : cashierId,
                createdAt,
                paidAt: createdAt,
              },
            },
          },
        });
      }
      await db.shift.update({
        where: { id: shift.id },
        data: { expectedCash: 500000 + cashTotal, closingCash: 500000 + cashTotal - pick([0, 0, 0, 2000, 5000]) },
      });
    }
  }

  console.log("\n✅ Seed selesai!\n");
  console.log("Login staf (password: password123)");
  users.forEach((u) => console.log(`  • ${u.role.padEnd(8)} ${u.email}`));
  console.log(`\nContoh link QR meja: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/t/${kemangTables[0].qrToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
