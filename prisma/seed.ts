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
 * Menu Aprez Locale (Citadines Sudirman Jakarta).
 *
 * NAMA HIDANGAN & ISINYA: dari Chope, Grab Dine Out, NOW! Jakarta, Nibble.id, Instagram @aprezlocale.id,
 *        dan foto pengunjung di Google Maps (November 2026).
 * FOTO: foto asli dari sumber yang sama, di /public/aprez/menu.
 * HARGA: PERKIRAAN untuk demo. Sumber publik tidak mencantumkan harga per hidangan; Chope menyebut
 *        kisaran Rp 100–250 rb per orang. Satu-satunya angka asli: voucher breakfast buffet Rp 871.200
 *        untuk 4 orang (Rp 217.800 nett per orang, kira-kira Rp 180.000++).
 *        Ganti dengan harga dari buku menu asli.
 * PILIHAN (level pedas, suhu, gula): PERKIRAAN, belum dicek ke menu asli.
 */
const K = 1000;
const img = (name: string) => `/aprez/menu/${name}.jpg`;

const pilih = (name: string, options: string[], min = 1, max = 1): Group => ({
  name,
  min,
  max,
  options: options.map((o, i) => ({ name: o, default: min > 0 && i < min })),
});
const pedas = pilih("Level sambal", ["Sedang", "Tidak pedas", "Pedas"]);
const gula = pilih("Tingkat gula", ["Normal", "Less sugar"]);
const suhu = (iceExtra = 0): Group => ({
  name: "Suhu",
  min: 1,
  max: 1,
  options: [{ name: "Hot", default: true }, { name: "Iced", price: iceExtra }],
});
const susu: Group = { name: "Susu", min: 0, max: 1, options: [{ name: "Ganti oat milk", price: 8 * K }] };
const kematangan = pilih("Kematangan telur", ["Sunny side up", "Orak-arik", "Rebus"]);

const MENU: { name: string; icon: string; items: Item[] }[] = [
  {
    name: "Sarapan",
    icon: "🌅",
    items: [
      { name: "Breakfast Buffet", emoji: "🍳", price: 180 * K, desc: "Sarapan prasmanan setiap hari pukul 06.00–10.00: hidangan Asia & Nusantara, pastry, dan pilihan yang lebih ringan. Harga per orang.", featured: true },
      { name: "Croque Monsieur", emoji: "🥪", price: 95 * K, desc: "Roti panggang berisi smoked beef dan keju Emmental yang meleleh.", groups: [kematangan] },
    ],
  },
  {
    name: "Pembuka & Salad",
    icon: "🥗",
    items: [
      { name: "Chef's Salad", image: img("chefs-salad"), emoji: "🥗", price: 85 * K, desc: "Mixed greens, keju, smoked beef, brokoli, walnut panggang, bawang, apel hijau, tomat, pommery dressing, dan crostini.", featured: true },
      { name: "Thai Salad", emoji: "🥗", price: 78 * K, desc: "Salad segar ala Thailand dengan dressing asam-pedas-manis." },
      { name: "General Tso's Chicken Wings", emoji: "🍗", price: 88 * K, desc: "Sayap ayam renyah berbalut saus General Tso yang manis, gurih, dan sedikit pedas." },
      { name: "Dimsum Platter", emoji: "🥟", price: 75 * K, desc: "Aneka dimsum kukus, disajikan dengan saus cocolan." },
      { name: "Double Decker Club Sandwich", emoji: "🥪", price: 98 * K, desc: "Club sandwich bertingkat dua dengan isian lengkap, disajikan dengan kentang goreng." },
    ],
  },
  {
    name: "Asian Roots",
    icon: "🍜",
    items: [
      { name: "Nasi Ikan Nusantara", image: img("nasi-ikan-nusantara"), emoji: "🐟", price: 145 * K, desc: "Ikan barramundi utuh digoreng renyah, nasi putih hangat, sambal, dan sayur lodeh.", featured: true, groups: [pedas] },
      { name: "Pho Noodle", image: img("pho-noodle"), emoji: "🍜", price: 115 * K, desc: "Pho sapi ala Vietnam: kaldu sapi, bakso, irisan daging sapi Australia, daun herba segar, dengan jeruk nipis, cabai, dan kecap di samping.", featured: true },
      { name: "Hainanese Chicken Rice", image: img("hainanese-chicken-rice"), emoji: "🍗", price: 98 * K, desc: "Ayam rebus yang lembut, nasi gurih kaldu ayam, timun, dan saus jahe-cabai.", featured: true },
      { name: "Nasi Bakar Nusantara", image: img("nasi-bakar"), emoji: "🍙", price: 95 * K, desc: "Nasi berbumbu dibungkus daun pisang lalu dibakar, dengan lauk, lalapan, dan sambal.", groups: [pedas] },
      { name: "Char Kway Teow", emoji: "🍜", price: 98 * K, desc: "Kwetiau lebar ditumis di wajan panas sampai harum smoky, gaya Penang.", groups: [pedas] },
      { name: "Tori Uma Rice Bowl", emoji: "🍚", price: 95 * K, desc: "Rice bowl ayam gaya Jepang dengan saus gurih-manis." },
    ],
  },
  {
    name: "World Flavors",
    icon: "🍽️",
    items: [
      { name: "Wagyu Beef Cheek Estouffade", image: img("wagyu-beef-cheek"), emoji: "🥩", price: 195 * K, desc: "Pipi sapi wagyu dimasak perlahan dalam saus estouffade yang pekat sampai empuk, dengan sayuran dan kentang goreng.", featured: true },
      { name: "Pan Seared Salmon", image: img("pan-seared-salmon"), emoji: "🐟", price: 185 * K, desc: "Salmon dipanggang di wajan sampai kulitnya renyah, dengan sayuran dan saus." },
      { name: "Fish & Chips", image: img("fish-and-chips"), emoji: "🐟", price: 118 * K, desc: "Ikan goreng tepung yang renyah, kentang goreng, dan saus tartar." },
      { name: "Aprez Beef Burger", image: img("burger"), emoji: "🍔", price: 125 * K, desc: "Burger daging sapi dengan keju dan sayuran segar, disajikan dengan kentang goreng." },
      { name: "Chicken Parmigiana", emoji: "🍗", price: 115 * K, desc: "Ayam goreng tepung dengan saus tomat dan keju yang dipanggang sampai meleleh." },
    ],
  },
  {
    name: "Dessert",
    icon: "🍰",
    items: [
      { name: "Choco Melted", image: img("choco-melted"), emoji: "🍫", price: 65 * K, desc: "Kue cokelat dengan bagian tengah yang lumer, disajikan dengan es krim.", featured: true },
      { name: "Matcha Bloom", emoji: "🍵", price: 68 * K, desc: "Dessert matcha yang lembut dengan rasa teh hijau yang bersih." },
      { name: "Warm Baked Apple Crumble", emoji: "🥧", price: 65 * K, desc: "Apel panggang hangat dengan crumble mentega yang renyah." },
    ],
  },
  {
    name: "Kopi",
    icon: "☕",
    items: [
      { name: "Es Kopi Susu", image: img("es-kopi-susu"), emoji: "🧋", price: 45 * K, desc: "Espresso, susu segar, dan gula aren. Bisa less sugar.", featured: true, groups: [gula, susu] },
      { name: "Iced Latte", image: img("iced-latte"), emoji: "🥛", price: 48 * K, desc: "Espresso di atas susu dingin, berlapis rapi di gelas.", groups: [gula, susu] },
      { name: "Ice Cube Latte", image: img("ice-cube-latte"), emoji: "🧊", price: 55 * K, desc: "Es batu dari kopi, disajikan dengan sebotol susu dingin untuk dituang sendiri.", featured: true },
      { name: "Sea Salt Coffee", emoji: "☕", price: 50 * K, desc: "Kopi susu dingin dengan krim sea salt yang gurih di atasnya.", groups: [gula] },
      { name: "Americano", emoji: "☕", price: 40 * K, desc: "Espresso dengan air.", groups: [suhu(3 * K)] },
      { name: "Cappuccino", emoji: "☕", price: 48 * K, desc: "Espresso, susu steamed, dan foam tebal.", groups: [suhu(3 * K), susu] },
    ],
  },
  {
    name: "Dari Bar",
    icon: "🍹",
    items: [
      { name: "Strawberry Matcha", image: img("strawberry-matcha"), emoji: "🍓", price: 55 * K, desc: "Matcha, susu, dan saus stroberi berlapis tiga warna.", featured: true, groups: [gula] },
      { name: "Blue Mojito", image: img("blue-mojito"), emoji: "🍹", price: 52 * K, desc: "Mocktail biru yang segar dengan daun mint, jeruk nipis, dan soda.", featured: true },
      { name: "Taro Milk", image: img("taro-milk"), emoji: "🥤", price: 48 * K, desc: "Susu taro dingin yang lembut dan manis.", groups: [gula] },
      { name: "Strawberry Milkshake", image: img("strawberry-milkshake"), emoji: "🍓", price: 55 * K, desc: "Milkshake stroberi yang kental." },
      { name: "Vanilla Milkshake", image: img("vanilla-shake"), emoji: "🥤", price: 55 * K, desc: "Milkshake vanila klasik." },
      { name: "Teh Melati", emoji: "🫖", price: 35 * K, desc: "Teh melati seduh, panas atau dingin.", groups: [suhu()] },
      { name: "Air Mineral", emoji: "💧", price: 20 * K, desc: "Air mineral botol." },
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
  const outletRow = await db.outlet.create({
    data: {
      name: "Aprez Locale",
      slug: "aprez-locale",
      address: "Citadines Sudirman Jakarta, Jl. Karet Sawah No.219, Karet Semanggi, Setiabudi, Jakarta Selatan 12930",
      phone: "0852-8570-6736",
      // PERKIRAAN: Chope menulis harga "++" (pajak & service belum termasuk). PB1 Jakarta 10% dan
      // service 10% (lazim di restoran hotel), belum dicek ke struk asli.
      taxRate: 10,
      serviceRate: 10,
      openTime: "06:00",
      closeTime: "22:00",
      receiptFooter: "Terima kasih sudah makan di Aprez Locale. Sampai jumpa lagi! IG @aprezlocale.id",
    },
  });

  const tableDefs = [
    ...Array.from({ length: 10 }, (_, i) => ({ name: `Meja ${String(i + 1).padStart(2, "0")}`, area: "Ruang makan", capacity: i < 4 ? 2 : 4 })),
    ...Array.from({ length: 4 }, (_, i) => ({ name: `Meja ${i + 11}`, area: "Sisi jendela", capacity: 2 })),
    ...Array.from({ length: 2 }, (_, i) => ({ name: `Meja ${i + 15}`, area: "Meja panjang", capacity: 8 })),
    { name: "Semi-VIP Sedang", area: "Ruang semi-VIP", capacity: 8 },
    { name: "Semi-VIP Besar", area: "Ruang semi-VIP", capacity: 12 },
  ];
  const outletTables = [];
  for (const [i, t] of tableDefs.entries()) {
    outletTables.push(await db.diningTable.create({ data: { ...t, outletId: outletRow.id, qrToken: token(), sortOrder: i } }));
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
  const habis = allProducts.find((p) => p.name === "Warm Baked Apple Crumble")!;
  await db.productUnavailable.create({ data: { outletId: outletRow.id, productId: habis.id } });

  console.log("👤 Akun staf…");
  const password = await hashPassword("password123");
  const users = [
    { name: "Ega Owner", email: "owner@santap.id", role: "OWNER" as const, outletId: null },
    { name: "Sari Kasir", email: "kasir@santap.id", role: "KASIR" as const, outletId: outletRow.id },
    { name: "Budi Dapur", email: "dapur@santap.id", role: "DAPUR" as const, outletId: outletRow.id },
    { name: "Rina Pelayan", email: "pelayan@santap.id", role: "PELAYAN" as const, outletId: outletRow.id },
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
  for (const outlet of [outletRow]) {
    const cashierId = created["kasir@santap.id"];
    const tables = outletTables;
    for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
      const day = new Date();
      day.setDate(day.getDate() - daysAgo);
      const open = new Date(day);
      open.setHours(6, 0, 0, 0);
      const close = new Date(day);
      close.setHours(22, 0, 0, 0);
      const shift = await db.shift.create({
        data: { outletId: outlet.id, userId: cashierId, openedAt: open, closedAt: close, openingCash: 500000 },
      });
      const weekend = [0, 6].includes(day.getDay());
      const count = randInt(24, 40) + (weekend ? 12 : 0);
      let cashTotal = 0;
      for (let n = 1; n <= count; n++) {
        const createdAt = new Date(day);
        const hour = pick([6, 7, 7, 8, 8, 9, 11, 12, 12, 12, 13, 13, 14, 15, 16, 17, 18, 18, 19, 19, 19, 20, 20, 21]);
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
  console.log(`\nContoh link QR meja: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/t/${outletTables[0].qrToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
