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
 * Menu Amalgam Coffee Brewery, disalin dari "AMALGAM - Menu.pdf" (tautan "See our Menu" di amalgamcoffee.com, November 2026).
 * Harga dalam Rupiah, belum termasuk pajak & service. Foto di /public/amalgam dipotong dari buku menu yang sama.
 * Kepiting dan ikan kerapu (harga per 100 gr / market price) sengaja tidak dimasukkan: atur manual di dashboard bila perlu.
 */
const K = 1000;
const img = (name: string) => `/amalgam/${name}.jpg`;

/** Pilihan suhu; harga dasar produk = varian termurah, selisihnya jadi priceDelta. */
const suhu = (hot: number | null, ice: number | null): Group => {
  const base = Math.min(...[hot, ice].filter((v): v is number => v !== null));
  const options: Opt[] = [];
  if (ice !== null) options.push({ name: "Iced", price: (ice - base) * K, default: true });
  if (hot !== null) options.push({ name: "Hot", price: (hot - base) * K, default: ice === null });
  return { name: "Suhu", min: 1, max: 1, options };
};
/** Semua minuman susu: Greenfields (harga dasar) atau Oatly (+15 rb), sesuai buku menu. */
const susu: Group = { name: "Susu", min: 1, max: 1, options: [{ name: "Greenfields milk", default: true }, { name: "Oatly", price: 15 * K }] };
const extraShot: Group = { name: "Tambahan", min: 0, max: 2, options: [{ name: "Extra shot espresso", price: 15 * K }] };
const sausSteak: Group = { name: "Saus", min: 1, max: 1, options: [{ name: "Mushroom", default: true }, { name: "Black pepper" }, { name: "BBQ" }] };

const kopi = (name: string, hot: number | null, ice: number | null, extra: Partial<Item> & { milk?: boolean } = {}): Item => {
  const { milk, ...rest } = extra;
  const groups: Group[] = [];
  if (hot !== null && ice !== null) groups.push(suhu(hot, ice));
  if (milk) groups.push(susu);
  groups.push(extraShot);
  return { name, emoji: "☕", price: Math.min(...[hot, ice].filter((v): v is number => v !== null)) * K, desc: "", groups, ...rest };
};
const frappe = (name: string, price: number, extra: Partial<Item> = {}): Item => ({ name, emoji: "🥤", price: price * K, desc: "", groups: [susu], ...extra });
const nonKopi = (name: string, hot: number, ice: number, extra: Partial<Item> = {}): Item => ({
  name, emoji: "🍫", price: Math.min(hot, ice) * K, desc: "", groups: [suhu(hot, ice), susu], ...extra,
});
const dish = (name: string, price: number, desc: string, emoji: string, extra: Partial<Item> = {}): Item => ({ name, price: price * K, desc, emoji, ...extra });

const MENU: { name: string; icon: string; items: Item[] }[] = [
  {
    name: "Signature Coffee",
    icon: "✨",
    items: [
      dish("Americano Lemon", 53, "Refreshing americano brightened with lemon.", "🍋", { featured: true, image: img("americano-lemon") }),
      dish("Pina Sour Coffee", 53, "Americano with pineapple, fresh and lightly sour.", "🍍", { image: img("pina-sour") }),
      dish("Americano Mango", 53, "Iced americano with mango.", "🥭"),
      dish("Americano Ginger", 63, "Iced americano with ginger.", "🫚"),
      dish("Coffee Bloom", 53, "Coffee mocktail.", "🌸"),
    ],
  },
  {
    name: "Coffee",
    icon: "☕",
    items: [
      kopi("Espresso", 25, null, { desc: "Fresh coffee, roasted daily." }),
      kopi("Espresso on the Rock", null, 30),
      kopi("Americano", 32, 40),
      kopi("Vietnam Drip", 35, null),
      kopi("Manual Brew V60", 40, null, { desc: "Single origin: Gayo, Garut, Gunung Halu, Ijen, Kerinci, atau Puntang." }),
      kopi("Japanese Manual Brew", null, 40),
      kopi("Cappuccino", 35, 45, { milk: true, image: img("cappuccino") }),
      kopi("Caffe Latte", 34, 45, { milk: true, desc: "Double shot espresso with fresh milk.", image: img("latte-art") }),
      kopi("Piccolo", 28, null, { milk: true }),
      kopi("Cortado", 28, null, { milk: true }),
      kopi("Flat White", 45, null, { milk: true }),
      kopi("Caramel Latte", 40, 48, { milk: true }),
      kopi("Hazelnut Latte", 40, 48, { milk: true }),
      kopi("Mochaccino", 40, 48, { milk: true }),
      kopi("Iced Cocopandan Latte", null, 48, { milk: true }),
      kopi("Iced Vanilla Latte", null, 48, { milk: true }),
      kopi("Iced Coconut Latte", null, 48, { milk: true }),
    ],
  },
  {
    name: "Non Coffee",
    icon: "🍫",
    items: [
      nonKopi("Chocolate", 38, 42),
      nonKopi("Matcha", 40, 45, { emoji: "🍵" }),
      nonKopi("Red Velvet", 40, 45, { emoji: "❤️", image: img("red-velvet") }),
      dish("Ginger Honey Lemon", 50, "Disajikan hangat.", "🫚"),
    ],
  },
  {
    name: "Frappe",
    icon: "🥤",
    items: [
      frappe("Avocado Oreo Frappe", 55),
      frappe("Avocado Coffee Oreo Frappe", 60),
      frappe("Vanilla Marie Frappe", 55),
      frappe("Red Velvet Frappe", 55),
      frappe("Choco Frappe", 55),
      frappe("Matcha Frappe", 55, { image: img("frappe") }),
      frappe("Salted Caramel Frappe", 55),
    ],
  },
  {
    name: "Tea",
    icon: "🍵",
    items: [
      dish("Iced Tea", 30, "", "🧊"),
      dish("Green Tea", 40, "Disajikan hangat.", "🍵"),
      dish("Chamomile", 40, "Disajikan hangat.", "🌼"),
      dish("English Breakfast", 40, "Disajikan hangat.", "🫖"),
      dish("Lychee Tea", 40, "Disajikan dingin.", "🧋"),
    ],
  },
  {
    name: "Mocktail",
    icon: "🍹",
    items: [
      dish("Lychee Lemonade", 55, "Chia seeds, apple juice, lemonade syrup, lychee syrup.", "🍹", { featured: true, image: img("lychee-lemonade") }),
      dish("Strawberry Mojito", 50, "Soda, strawberry syrup, lime, mint.", "🍓", { image: img("mojito") }),
      dish("Virgin Mojito", 50, "Soda, lime, mint.", "🌿"),
      dish("Passion Soda", 55, "Passion fruit syrup, soda, lime, mint.", "🥤", { image: img("passion-soda") }),
    ],
  },
  {
    name: "Mineral Water",
    icon: "💧",
    items: [dish("Equil Sparkling", 45, "", "💧"), dish("Equil Still", 40, "", "💧")],
  },
  {
    name: "Breakfast",
    icon: "🍳",
    items: [
      dish("Big Breakfast", 145, "Sausage, beef bacon, sunny side up egg, mushroom, hash brown, salad and toast.", "🍳", { featured: true, image: img("big-breakfast") }),
      dish("Egg Benedict Smoked Salmon", 145, "Muffins, egg, smoked salmon with salad.", "🥚", { image: img("egg-benedict") }),
      dish("Cheese Omelette", 95, "Egg and cheese with salad.", "🧀", { image: img("cheese-omelette") }),
      dish("Toast Bread with Pandan Kaya", 75, "", "🍞"),
      dish("Boiled Egg with Toast Bread Pandan Kaya", 95, "", "🍞"),
      dish("Chicken Caesar Salad", 110, "Mixed greens, grilled chicken, croutons, country salad dressing with anchovies.", "🥗"),
    ],
  },
  {
    name: "Pastry & Dessert",
    icon: "🥐",
    items: [
      dish("Butter Croissant", 30, "", "🥐", { image: img("croissant") }),
      dish("Pain au Chocolate", 45, "", "🥐"),
      dish("Almond Croissant", 45, "", "🥐"),
      dish("Cheese Cake", 60, "", "🍰"),
      dish("Chocolate Cake", 60, "", "🍫"),
      dish("Moca Cake", 60, "", "🍰"),
      dish("Tiramisu Cake", 60, "", "🍮"),
      dish("Rujak Buah", 80, "Mixed fruits.", "🍉"),
    ],
  },
  {
    name: "Pasta",
    icon: "🍝",
    items: [
      dish("Crispy Salmon Fettuccine Pesto", 170, "Fettuccine in basil pesto sauce with crispy grilled salmon.", "🍝", { featured: true, image: img("salmon-pesto") }),
      dish("Spaghetti Marinara Seafood", 165, "Spaghetti in marinara sauce with mussel, squid, and shrimp.", "🍝", { image: img("marinara-seafood") }),
      dish("Spaghetti Aglio Olio with Prawn", 145, "Spaghetti with garlic, olive oil, chili flakes, sautéed prawn, and cherry tomatoes.", "🍤", { image: img("aglio-olio-prawn") }),
      dish("Spaghetti Aglio Olio", 90, "Spaghetti with garlic, olive oil, chili flakes, and cherry tomatoes.", "🍝"),
      dish("Spaghetti Aglio Olio with Basil", 95, "Spaghetti with garlic, olive oil, chili flakes, basil, and cherry tomatoes.", "🌿"),
      dish("Fettuccine Alfredo Mushroom", 100, "Fettuccine in creamy Alfredo sauce with sauteed mushroom and sliced beef bacon.", "🍄"),
      dish("Spaghetti Bolognese", 95, "Spaghetti with slow-cooked minced beef Bolognese sauce.", "🍝"),
    ],
  },
  {
    name: "Western",
    icon: "🥩",
    items: [
      dish("Tenderloin Steak", 295, "Australian prime beef 200 gr.", "🥩", { image: img("tenderloin-steak") }),
      dish("Sirloin Steak", 210, "200 gr Australian prime steak served with french fries, garden salad, and choice of sauce.", "🥩", { image: img("sirloin-steak"), groups: [sausSteak] }),
      dish("Salmon Steak", 220, "200 gr grilled salmon steak with creamy sauce, french fries, and garden salad.", "🐟"),
      dish("Chicken Creamy Mushroom", 130, "Grilled chicken with creamy mushrooms, french fries, and garden salad.", "🍗", { image: img("chicken-mushroom") }),
    ],
  },
  {
    name: "Soup",
    icon: "🥣",
    items: [
      dish("Mushroom Soup", 80, "Creamy mushroom soup with chives.", "🍄"),
      dish("Asparagus Soup", 80, "Chicken broth soup with minced chicken, silky egg white, and asparagus.", "🥣"),
      dish("Corn Soup", 80, "Chicken broth soup with minced chicken, silky egg white and sweet corn.", "🌽", { image: img("corn-soup") }),
    ],
  },
  {
    name: "Rice",
    icon: "🍚",
    items: [
      dish("Nasi Goreng Amalgam", 125, "Our signature Indonesian fried rice served with Ayam Goreng Kalasan, egg, prawn crackers, and pickled vegetables.", "🍛", { image: img("nasi-goreng") }),
      dish("Nasi Campur Bali", 115, "Steamed rice with shredded chicken, satay lilit, crispy chicken skin, vegetables, Balado egg, Balado anchovies & peanuts, and sambal matah.", "🍛", { featured: true, image: img("nasi-campur-bali") }),
      dish("Nasi Gila", 90, "Indonesian-style rice with a mix of sliced chicken, beef sausage, meatballs, egg, and vegetables.", "🍚"),
      dish("Nasi Goreng Teri Medan", 95, "Indonesian fried rice with crispy Medan anchovies, served with egg and prawn crackers.", "🍛"),
      dish("Nasi Goreng Seafood", 125, "Indonesian fried rice with prawns, squid, and fish ball, served with egg and prawn crackers.", "🍤"),
      dish("Nasi Goreng Jambal", 95, "Indonesian fried rice with salted Jambal fish, served with egg and prawn crackers.", "🍛"),
      dish("Nasi Goreng Buntut", 210, "Indonesian fried rice with tender slow-cooked oxtail, and prawn crackers.", "🍛"),
      dish("Chicken Rice Curry Katsu", 95, "Crispy chicken katsu over steamed rice with Japanese curry, carrots, and potatoes.", "🍛"),
    ],
  },
  {
    name: "Noodle",
    icon: "🍜",
    items: [
      dish("Mie Goreng Seafood Indochina Style", 115, "Stir-fried noodles with prawns, squid, and fish ball in an Indochina-style sauce.", "🍜"),
      dish("Mie Goreng Ayam Indochina Style", 95, "Stir-fried noodles with chicken in an Indochina-style sauce, served with a sunny side up egg.", "🍜"),
      dish("Kwetiaw Goreng Seafood Indochina Style", 115, "Wok-fried flat rice noodles with prawns, squid, and fish ball in an Indochina-style sauce.", "🍜"),
      dish("Kwetiaw Goreng Ayam Indochina Style", 95, "Wok-fried flat rice noodles with chicken in an Indochina-style sauce.", "🍜"),
      dish("Bihun Goreng Seafood Indochina Style", 115, "Stir-fried rice vermicelli with prawns, squid, and fish ball in an Indochina-style sauce.", "🍜"),
      dish("Bihun Kuah Seafood Indochina Style", 115, "Rice vermicelli in an Indochina-style broth with prawns, squid, and fish ball.", "🍲"),
      dish("Bihun Goreng Ayam Indochina Style", 95, "Stir-fried rice vermicelli with chicken in an Indochina-style sauce, served with a sunny side up egg.", "🍜"),
      dish("Japanese Style Ramen", 75, "Japanese-style ramen with Bok Choy, mushroom, seaweed, boiled egg, bean sprouts, and prawns in a savory broth.", "🍜"),
      dish("Udon Curry Katsu", 95, "Udon noodles served with crispy chicken katsu, Japanese curry sauce, carrots, and potatoes.", "🍛"),
    ],
  },
  {
    name: "Nusantara",
    icon: "🍲",
    items: [
      dish("Iga Bakar", 195, "Tender grilled beef ribs glazed with our signature sweet and savory sauce, served with steamed rice and fresh vegetables.", "🍖", { image: img("iga-bakar") }),
      dish("Iga Bakar Lada Hitam", 215, "Grilled beef ribs coated in black pepper sauce, served with steamed rice and fresh vegetables.", "🍖"),
      dish("Sop Buntut", 195, "Slow-cooked oxtail soup with vegetables in a clear broth, served with steamed rice and fresh vegetables.", "🍲", { image: img("sop-buntut") }),
      dish("Sop Buntut Bakar", 205, "Grilled oxtail served with clear beef broth, steamed rice and seasonal vegetables.", "🍲"),
      dish("Buntut Bakar Lada Hitam", 210, "Grilled oxtail in black pepper sauce, served with steamed rice and seasonal vegetables.", "🍖"),
      dish("Soto Daging Bandung", 105, "Bandung-style beef soup with tender beef, white radish, crispy fried soybeans, and a clear aromatic broth.", "🍲"),
      dish("Laksa Seafood", 150, "Laksa broth with prawns, squid, fish ball, tofu, bean sprouts, long beans and noodles, finished with fresh herbs.", "🍜"),
      dish("Dori Sambal Matah", 105, "Crispy dory fillet served with fresh Balinese sambal matah and seasonal vegetables.", "🐟", { image: img("dori-sambal-matah") }),
      dish("Bebek Crispy Sambal Matah", 115, "Crispy fried duck served with fresh sambal matah, fried tempeh, and seasonal vegetables.", "🦆"),
      dish("White Rice", 15, "", "🍚"),
    ],
  },
  {
    name: "Seafood",
    icon: "🦐",
    items: [
      dish("Seafood Tumpah Mix (up to 4 pax)", 450, "Crab, green scallops, mussels, shrimp, squid, and sweet corn, cooked in our signature spicy and savory sauce.", "🦀", { featured: true, image: img("seafood-tumpah") }),
      dish("Udang Saus Padang", 230, "Cooked in spicy and savory Padang-style sauce.", "🦐"),
      dish("Udang Saus Singapore", 230, "Cooked in Singapore-style sweet, savory, and mildly spicy sauce.", "🦐"),
      dish("Udang Lada Hitam", 230, "Cooked in black pepper sauce.", "🦐", { image: img("udang-lada-hitam") }),
      dish("Udang Saus Mentega", 230, "Cooked in butter sauce.", "🦐"),
      dish("Udang Garlic Steam Saus Hongkong", 230, "Steamed shrimp in Hongkong-style sauce with steamed egg white and rice vermicelli.", "🦐"),
      dish("Udang Bakar Madu", 230, "Grilled shrimp served with honey sauce.", "🦐"),
      dish("Cumi Saus Padang (250 gr)", 120, "Cooked in spicy and savory Padang-style sauce.", "🦑"),
      dish("Cumi Saus Singapore (250 gr)", 120, "Cooked in Singapore-style sweet, savory, and mildly spicy sauce.", "🦑"),
      dish("Cumi Lada Hitam (250 gr)", 120, "Cooked in black pepper sauce.", "🦑"),
      dish("Cumi Telur Asin (170 gr)", 150, "Squid coated in a rich, creamy salted egg yolk sauce.", "🦑"),
      dish("Cumi Bakar Madu (125 gr)", 68, "Grilled squid served with honey sauce.", "🦑", { image: img("cumi-bakar-madu") }),
      dish("Kerang Hijau Saus Singapore (250 gr)", 110, "Green scallops cooked in Singapore-style sweet, savory, and mildly spicy sauce.", "🦪"),
      dish("Kerang Kepah Saus Padang (250 gr)", 110, "Green scallops cooked in spicy and savory Padang-style sauce.", "🦪"),
      dish("Kerang Batik Saus Padang (250 gr)", 95, "Batik mussels cooked in spicy and savory Padang-style sauce.", "🦪", { image: img("kerang-batik") }),
      dish("Kerang Batik Saus Singapore (250 gr)", 95, "Batik mussels cooked in Singapore-style sweet, savory, and mildly spicy sauce.", "🦪"),
      dish("Kerang Dara Saus Padang (250 gr)", 95, "Dara mussels cooked in spicy and savory Padang-style sauce.", "🦪"),
      dish("Kerang Dara Saus Singapore (250 gr)", 95, "Dara mussels cooked in Singapore-style sweet, savory, and mildly spicy sauce.", "🦪"),
      dish("Ikan Gurame Goreng Asam Manis (500 gr)", 198, "Sweet and sour fried carp.", "🐟"),
      dish("Ikan Gurame Goreng Telur Asin (500 gr)", 198, "Salted egg fried carp.", "🐟"),
      dish("Ikan Gurame Goreng Bumbu Rujak (500 gr)", 198, "Deep fried carp with fruit salad.", "🐟"),
      dish("Ikan Gurame Goreng Saus Mangga (500 gr)", 198, "Deep fried carp with mango sauce.", "🐟", { image: img("gurame") }),
    ],
  },
  {
    name: "Veggies",
    icon: "🥦",
    items: [
      dish("Toge Garlic", 70, "Stir-fried bean sprouts with garlic.", "🌱", { image: img("toge") }),
      dish("Toge Ikan Asin Jambal", 85, "Stir-fried bean sprouts with traditional dried salted fish.", "🌱"),
      dish("Mixed Vegetables", 95, "Broccoli, cauliflower, and assorted mushrooms wok-tossed in a savory oyster sauce.", "🥦"),
      dish("Pocay 2 Rasa", 85, "Sautéed Bok Choy with scrambled egg and creamy salted egg yolk sauce.", "🥬"),
      dish("Brokoli Garlic", 70, "Broccoli with minced garlic.", "🥦"),
      dish("Brokoli Jamur Hitam", 85, "Broccoli with black mushroom.", "🥦", { image: img("brokoli-jamur") }),
      dish("Brokoli Tumis Seafood", 115, "Sautéed broccoli with seafood and carrots.", "🥦"),
      dish("Baby Kailan Garlic", 70, "Sautéed baby kailan with garlic.", "🥬", { image: img("kailan") }),
      dish("Baby Kailan 2 Rasa", 85, "Sautéed baby kailan with Balado and garlic sauce.", "🥬"),
      dish("Kangkung Garlic", 70, "Stir-fried water spinach with garlic.", "🥬"),
      dish("Kangkung Balacan", 85, "Stir-fried water spinach with traditional shrimp paste.", "🥬", { image: img("kangkung") }),
      dish("Baby Buncis Garlic", 70, "Baby green beans sautéed with garlic.", "🫛"),
      dish("Baby Buncis Cabe Garam", 85, "Baby green beans stir-fried with chili salt.", "🫛"),
      dish("Baby Buncis Telur Asin", 85, "Baby green beans tossed in a rich, creamy salted egg yolk sauce.", "🫛", { image: img("buncis-telur-asin") }),
    ],
  },
  {
    name: "Beef, Chicken & Tofu",
    icon: "🍗",
    items: [
      dish("Sapi Lada Hitam", 210, "Sliced beef in a black pepper sauce with onions and bell peppers.", "🥩"),
      dish("Ayam Goreng Telur Asin", 165, "Fried chicken coated in a rich, creamy salted egg yolk sauce.", "🍗"),
      dish("Ayam Goreng Cabe Garam", 165, "Fried chicken with garlic, chili, and savory seasoning.", "🍗"),
      dish("Ayam Goreng Mentega", 165, "Chicken sautéed in a rich butter sauce with garlic and onions.", "🍗"),
      dish("Ayam Goreng Saus Mangga", 165, "Chicken served with a sweet and tangy mango sauce.", "🍗"),
      dish("Mun Tahu", 110, "Silky soft tofu braised with shiitake mushrooms and minced chicken in a savory gravy.", "🍢"),
      dish("Tahu Telur Asin", 110, "Silky soft tofu covered in salted egg and sprinkled with chopped Bok Choy.", "🍢"),
      dish("Tahu Telur Shimeji", 130, "Soft tofu coated with spinach and drizzled in a thick sauce with shimeji mushroom.", "🍢"),
      dish("Mapo Tofu", 110, "Minced meat stir fried tofu with spicy savory taste.", "🌶️"),
    ],
  },
  {
    name: "Snack",
    icon: "🍟",
    items: [
      dish("Mix Platter", 140, "BBQ chicken wings, french fries, chicken skin, mini wonton, sausages.", "🍟", { image: img("mix-platter") }),
      dish("French Fries with Homemade Cheese Sauce", 85, "", "🍟", { image: img("fries-cheese") }),
      dish("Spicy Garlic Chicken Wings", 105, "", "🍗"),
      dish("Spicy Beef Nachos", 110, "", "🌮"),
      dish("Fried Banana with Cheese", 85, "Served with vanilla ice cream.", "🍌"),
      dish("Chocolate Cheese Grilled Banana", 85, "", "🍌"),
      dish("Fried Cassava", 85, "", "🍠"),
      dish("Lupis", 85, "", "🍡"),
      dish("Bala Bala", 85, "", "🥟"),
      dish("Perkedel Jagung", 85, "", "🌽"),
      dish("Tahu Cabe Garam", 85, "", "🌶️"),
      dish("Chicken Skin", 95, "", "🍗"),
      dish("Mini Wonton", 95, "", "🥟"),
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
      name: "Amalgam Coffee",
      slug: "amalgam",
      address: "Jl. Kebon Sirih No.39, Kebon Sirih, Menteng, Jakarta Pusat 10340",
      phone: "0819-3240-0777",
      // Buku menu: harga belum termasuk pajak & service. Sesuaikan persentasenya di Pengaturan outlet.
      taxRate: 10,
      serviceRate: 5,
      receiptFooter: "Thank you for slowing down with us. See you again at Amalgam! IG @amalgam.kebonsirih",
    },
  });

  const tableDefs = [
    ...Array.from({ length: 12 }, (_, i) => ({ name: `Meja ${String(i + 1).padStart(2, "0")}`, area: "Indoor", capacity: i < 6 ? 2 : 4 })),
    ...Array.from({ length: 4 }, (_, i) => ({ name: `Teras ${i + 1}`, area: "Teras", capacity: 4 })),
    { name: "Private Room", area: "Private Room", capacity: 10 },
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
          description: item.desc || null,
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
  const habis = allProducts.find((p) => p.name === "Almond Croissant")!;
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
      open.setHours(7, 0, 0, 0);
      const close = new Date(day);
      close.setHours(22, 0, 0, 0);
      const shift = await db.shift.create({
        data: { outletId: outlet.id, userId: cashierId, openedAt: open, closedAt: close, openingCash: 500000 },
      });
      const weekend = [0, 6].includes(day.getDay());
      const count = randInt(18, 34) + (weekend ? 10 : 0);
      let cashTotal = 0;
      for (let n = 1; n <= count; n++) {
        const createdAt = new Date(day);
        const hour = pick([7, 8, 9, 9, 10, 11, 12, 12, 12, 13, 13, 14, 15, 16, 17, 18, 18, 19, 19, 20, 21]);
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
