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
 * Menu Warm Hour Cafe, disalin dari MENU.pdf di linktr.ee/warmhourcafe (November 2026).
 * Harga dalam Rupiah. Foto di /public/warmhour berasal dari profil Google Maps cafe.
 */
const K = 1000;
const img = (name: string) => `/warmhour/${name}.jpg`;

/** Pilihan suhu; harga dasar produk = varian termurah, selisihnya jadi priceDelta. */
const suhu = (hot: number | null, ice: number | null): Group => {
  const base = Math.min(...[hot, ice].filter((v): v is number => v !== null));
  const options: Opt[] = [];
  if (ice !== null) options.push({ name: "Ice", price: (ice - base) * K, default: true });
  if (hot !== null) options.push({ name: "Hot", price: (hot - base) * K, default: ice === null });
  return { name: "Suhu", min: 1, max: 1, options };
};
const extraKopi: Group = { name: "Tambahan", min: 0, max: 2, options: [{ name: "Additional shot", price: 10 * K }, { name: "Ganti oat milk", price: 7 * K }] };
const ceremonial: Group = { name: "Upgrade", min: 0, max: 1, options: [{ name: "Ceremonial matcha", price: 12 * K }] };
const manis: Group = { name: "Tingkat manis", min: 1, max: 1, options: [{ name: "Normal", default: true }, { name: "Less sweet" }] };
const COCOLAN = ["Pandan Kaya", "Thai Tea", "Hojicha", "Creamy Milk", "Milo"];
const roti: Group = { name: "Roti", min: 1, max: 1, options: [{ name: "Kukus", default: true }, { name: "Bakar" }] };
const cocolan: Group = { name: "Cocolan (termasuk 1)", min: 1, max: 1, options: COCOLAN.map((name, i) => ({ name, default: i === 0 })) };
const ekstraCocolan: Group = { name: "Ekstra cocolan", min: 0, max: 4, options: COCOLAN.map((name) => ({ name: `Ekstra ${name}`, price: 10 * K })) };
const telur: Group = { name: "Porsi", min: 1, max: 1, options: [{ name: "1 Egg", default: true }, { name: "2 Eggs", price: 8 * K }] };
const pedas: Group = { name: "Level pedas", min: 1, max: 1, options: [{ name: "Level 0" }, { name: "Level 1", default: true }, { name: "Level 2" }, { name: "Level 3" }] };
const protein: Group = { name: "Protein", min: 1, max: 1, options: [{ name: "Chicken", default: true }, { name: "Pork", price: 5 * K }] };

const kopi = (name: string, hot: number | null, ice: number | null, desc: string, extra: Partial<Item> = {}): Item => ({
  name,
  emoji: "☕",
  price: Math.min(...[hot, ice].filter((v): v is number => v !== null)) * K,
  desc,
  groups: [suhu(hot, ice), extraKopi],
  ...extra,
});
const matcha = (name: string, price: number, desc: string, extra: Partial<Item> = {}): Item => ({
  name,
  emoji: "🍵",
  price: price * K,
  desc,
  groups: [ceremonial, manis],
  ...extra,
});

const MENU: { name: string; icon: string; items: Item[] }[] = [
  {
    name: "Coffee",
    icon: "☕",
    items: [
      kopi("Montblanc", null, 45, "Kopi dingin dengan krim lembut dan taburan kulit jeruk.", { featured: true, image: img("montblanc") }),
      kopi("Dirty Latte", null, 45, "Espresso dituang di atas susu dingin.", { featured: true, image: img("dirty-latte") }),
      kopi("Kopi Susu", null, 30, "Es kopi susu khas Warm Hour.", { image: img("kopi-susu") }),
      kopi("Espresso", 27, null, "Single origin, diseduh pendek."),
      kopi("Black", 33, 35, "Espresso dengan air, panas atau dingin.", { image: img("black") }),
      kopi("White", 36, 42, "Espresso dengan susu steamed."),
      kopi("Piccolo", 36, null, "Ristretto dengan sedikit susu."),
      kopi("Cappucino", 36, null, "Espresso, susu, dan foam tebal."),
      kopi("Magic", 36, null, "Double ristretto dengan susu, gaya Melbourne."),
      kopi("Dirty Chai", null, 45, "Chai latte dengan satu shot espresso."),
    ],
  },
  {
    name: "Matcha",
    icon: "🍵",
    items: [
      matcha("Matcha Kinako", 47, "Matcha cold-whisked dengan oat milk dan kinako.", { featured: true }),
      matcha("Matcha Berry", 49, "Matcha cold-whisked dengan oat milk dan saus berry.", { featured: true }),
      matcha("Matcha Latte", 45, "Matcha cold-whisked dengan oat milk.", { image: img("matcha-latte") }),
      matcha("Matcha Corn Tea", 47, "Matcha cold-whisked dengan oat milk dan teh jagung.", { image: img("matcha-corn-tea") }),
      matcha("Dirty Matcha", 49, "Matcha latte dengan satu shot espresso."),
      { name: "Hojicha Latte", emoji: "🍵", price: 45 * K, desc: "Teh hijau sangrai dengan oat milk, disajikan dingin.", groups: [manis] },
    ],
  },
  {
    name: "Non-Coffee",
    icon: "🧋",
    items: [
      { name: "Es Teh Tarik", featured: true, emoji: "🧋", price: 32 * K, desc: "Teh susu tarik dingin.", groups: [manis] },
      { name: "Es Sonkit", featured: true, emoji: "🍋", price: 22 * K, desc: "Jeruk sonkit segar dengan es." },
      { name: "Earl Grey Latte", emoji: "🫖", price: 37 * K, desc: "Earl grey dengan susu, disajikan dingin.", groups: [manis] },
      { name: "Chai Latte", emoji: "🫖", price: 35 * K, desc: "Teh rempah dengan susu, disajikan dingin.", groups: [manis] },
      { name: "Earl Grey Lychee Tea", emoji: "🍹", price: 35 * K, desc: "Earl grey dingin dengan leci." },
      { name: "Teh Tawar", emoji: "🍵", price: 13 * K, desc: "Teh tanpa gula.", groups: [suhu(13, 15)] },
      { name: "Teh Manis", emoji: "🍵", price: 15 * K, desc: "Teh dengan gula.", groups: [suhu(15, 17)] },
    ],
  },
  {
    name: "All Day Breakfast",
    icon: "🍞",
    items: [
      { name: "Roti Cocol", emoji: "🍞", price: 30 * K, desc: "Roti kukus atau bakar dengan satu cocolan pilihanmu.", featured: true, image: img("roti-cocol"), groups: [roti, cocolan, ekstraCocolan] },
      { name: "Soft Boiled Egg", emoji: "🥚", price: 10 * K, desc: "Telur setengah matang, teman roti cocol.", groups: [telur] },
    ],
  },
  {
    name: "Light Bites",
    icon: "🍢",
    items: [
      { name: "Tahu Rempah", emoji: "🍢", price: 27 * K, desc: "Tahu goreng berbalut bumbu rempah.", featured: true, image: img("tahu-rempah") },
      { name: "Singkong Goreng Cabe Ijo", emoji: "🌶️", price: 32 * K, desc: "Singkong goreng dengan sambal cabe ijo. Pedas, mengandung ketumbar.", image: img("singkong-cabe-ijo") },
      { name: "Pisang Goreng Kaya", emoji: "🍌", price: 34 * K, desc: "Pisang goreng renyah dengan cocolan kaya.", image: img("pisang-goreng-kaya") },
      { name: "Chicken Bites", emoji: "🍗", price: 43 * K, desc: "Ayam goreng potong dengan spicy peanut sauce. Pedas, mengandung kacang.", image: img("chicken-bites") },
    ],
  },
  {
    name: "Main",
    icon: "🍚",
    items: [
      { name: "Classic Gua Bao", emoji: "🥙", price: 57 * K, desc: "Bao kukus isi pork, acar, dan daun ketumbar. Mengandung pork dan kacang.", featured: true, image: img("gua-bao") },
      { name: "Thai Sauce Rice with Egg", emoji: "🍳", price: 50 * K, desc: "Nasi dengan saus thai dan telur mata sapi. Pilih chicken atau pork.", image: img("thai-sauce-rice"), groups: [protein] },
      { name: "Nashville Chicken Bao", emoji: "🥙", price: 53 * K, desc: "Bao kukus isi ayam nashville. Pedas, mengandung kacang." },
      { name: "Beef Pad Kra Pao with Egg", emoji: "🍛", price: 55 * K, desc: "Daging sapi cincang tumis basil dengan nasi dan telur.", groups: [pedas] },
    ],
  },
  {
    name: "Bakery",
    icon: "🥐",
    items: [
      { name: "Salt Bread Original", emoji: "🥐", price: 17 * K, desc: "Roti mentega asin, renyah di luar dan lembut di dalam.", image: img("salt-bread") },
      { name: "Salt Bread Garlic", emoji: "🧄", price: 20 * K, desc: "Salt bread dengan mentega bawang putih." },
      { name: "Salted Choco Krisp", emoji: "🍫", price: 27 * K, desc: "Salt bread cokelat dengan topping renyah.", featured: true },
      { name: "Egg & Cheese Mayo", featured: true, emoji: "🧀", price: 27 * K, desc: "Salt bread isi telur dan keju mayo.", image: img("egg-cheese-mayo") },
      { name: "Pistachio Cream", emoji: "🥐", price: 30 * K, desc: "Salt bread isi krim pistachio." },
      { name: "Tuna Mayo", emoji: "🐟", price: 30 * K, desc: "Salt bread isi tuna mayo." },
      { name: "Blueberry Cream Cheese", emoji: "🫐", price: 30 * K, desc: "Salt bread isi blueberry dan cream cheese." },
      { name: "Mini Salt Bread (10 pcs)", emoji: "🥐", price: 60 * K, desc: "Sepuluh salt bread mini untuk berbagi." },
    ],
  },
  {
    name: "Dessert",
    icon: "🍰",
    items: [
      { name: "Basque No. 5", emoji: "🍰", price: 68 * K, desc: "Basque cheesecake andalan Warm Hour.", featured: true, image: img("basque-no5") },
      { name: "Original Basque Cheese Cake", emoji: "🍰", price: 55 * K, desc: "Basque cheesecake klasik dengan permukaan karamel." },
      { name: "Choco Berry Basque Cheese Cake", emoji: "🍫", price: 58 * K, desc: "Basque cheesecake cokelat dengan berry." },
      { name: "Tiramisu", emoji: "🍮", price: 65 * K, desc: "Mascarpone, kopi, dan kakao." },
      { name: "Carrot Cake Slice", emoji: "🥕", price: 60 * K, desc: "Carrot cake dengan cream cheese frosting." },
      { name: "Blackforest Cake Slice", featured: true, emoji: "🍒", price: 60 * K, desc: "Kue cokelat berlapis krim dan ceri.", image: img("blackforest") },
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
  console.log("🧹 Membersihkan data lama…");
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
      name: "Warm Hour Cafe",
      slug: "warm-hour",
      address: "No.11 Blok A1, Jl. KH. Moh. Mansyur, Duri Pulo, Gambir, Jakarta Pusat",
      phone: "0852-8262-3535",
      taxRate: 10,
      serviceRate: 0,
      receiptFooter: "Thank you for visiting Warm Hour. See you any other hour! IG @cafe_by_warmhour",
    },
  });

  const tableDefs = [
    ...Array.from({ length: 10 }, (_, i) => ({ name: `Meja ${String(i + 1).padStart(2, "0")}`, area: "Indoor", capacity: i < 6 ? 2 : 4 })),
    ...Array.from({ length: 3 }, (_, i) => ({ name: `Teras ${i + 1}`, area: "Teras", capacity: 2 })),
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
  const habis = allProducts.find((p) => p.name === "Pistachio Cream")!;
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
      open.setHours(7, 30, 0, 0);
      const close = new Date(day);
      close.setHours(21, 0, 0, 0);
      const shift = await db.shift.create({
        data: { outletId: outlet.id, userId: cashierId, openedAt: open, closedAt: close, openingCash: 500000 },
      });
      const weekend = [0, 6].includes(day.getDay());
      const count = randInt(18, 34) + (weekend ? 10 : 0);
      let cashTotal = 0;
      for (let n = 1; n <= count; n++) {
        const createdAt = new Date(day);
        const hour = pick([8, 8, 9, 9, 10, 10, 11, 12, 12, 13, 14, 15, 15, 16, 16, 17, 18, 19, 20]);
        createdAt.setHours(hour, randInt(0, 59), randInt(0, 59), 0);
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
          return { productId: p.id, name: p.name, unitPrice: unit, quantity: qty, modifiers, lineTotal: unit * qty, isDone: true, paidQty: qty };
        });
        const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
        const service = Math.round((subtotal * outlet.serviceRate) / 100);
        const tax = Math.round(((subtotal + service) * outlet.taxRate) / 100);
        const total = subtotal + service + tax;
        const source = Math.random() < 0.55 ? "QR" : "POS";
        const dineIn = Math.random() < 0.75;
        const method = source === "QR" ? pick<PaymentMethod>(["MIDTRANS", "MIDTRANS", "CASH"]) : pick(methods);
        const done = new Date(createdAt.getTime() + randInt(12, 35) * 60000);
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
