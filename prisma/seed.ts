import { PrismaClient, type PaymentMethod } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import crypto from "node:crypto";

const db = new PrismaClient();
const id = () => crypto.randomBytes(16).toString("hex");
const token = () => crypto.randomBytes(9).toString("base64url");

type Opt = { name: string; price?: number; default?: boolean };
type Group = { name: string; min: number; max: number; options: Opt[] };
type Item = { name: string; price: number; desc: string; emoji?: string; featured?: boolean; groups?: Group[] };

const suhu: Group = { name: "Suhu", min: 1, max: 1, options: [{ name: "Dingin", default: true }, { name: "Panas" }] };
const ukuran: Group = { name: "Ukuran", min: 1, max: 1, options: [{ name: "Regular", default: true }, { name: "Large", price: 6000 }] };
const gula: Group = { name: "Tingkat manis", min: 1, max: 1, options: [{ name: "Normal", default: true }, { name: "Less sugar" }, { name: "Tanpa gula" }] };
const extraKopi: Group = { name: "Tambahan", min: 0, max: 3, options: [{ name: "Extra shot espresso", price: 6000 }, { name: "Oat milk", price: 8000 }, { name: "Sirup hazelnut", price: 5000 }] };
const pedas: Group = { name: "Level pedas", min: 1, max: 1, options: [{ name: "Tidak pedas", default: true }, { name: "Sedang" }, { name: "Pedas" }, { name: "Extra pedas", price: 2000 }] };
const lauk: Group = { name: "Tambahan", min: 0, max: 4, options: [{ name: "Telur ceplok", price: 5000 }, { name: "Kerupuk udang", price: 4000 }, { name: "Sate ayam (3 tusuk)", price: 12000 }, { name: "Nasi tambah", price: 6000 }] };
const mieTopping: Group = { name: "Topping", min: 0, max: 3, options: [{ name: "Bakso sapi", price: 7000 }, { name: "Pangsit goreng", price: 5000 }, { name: "Telur rebus", price: 5000 }] };
const saus: Group = { name: "Saus", min: 1, max: 2, options: [{ name: "Saus sambal", default: true }, { name: "Mayones" }, { name: "Keju leleh", price: 5000 }] };

const MENU: { name: string; icon: string; items: Item[] }[] = [
  {
    name: "Makanan Utama",
    icon: "🍛",
    items: [
      { name: "Nasi Goreng Kampung", emoji: "🍳", price: 32000, desc: "Nasi goreng bumbu terasi, ayam suwir, telur, acar dan kerupuk.", featured: true, groups: [pedas, lauk] },
      { name: "Ayam Bakar Taliwang", emoji: "🍗", price: 45000, desc: "Ayam kampung bakar bumbu taliwang khas Lombok, plecing kangkung.", featured: true, groups: [pedas, lauk] },
      { name: "Nasi Ayam Geprek", emoji: "🌶️", price: 28000, desc: "Ayam crispy digeprek sambal bawang, lalapan dan nasi hangat.", groups: [pedas, lauk] },
      { name: "Sop Buntut", emoji: "🍲", price: 68000, desc: "Buntut sapi empuk dengan kuah bening rempah, wortel dan kentang.", groups: [lauk] },
      { name: "Beef Rice Bowl", emoji: "🍚", price: 42000, desc: "Irisan sapi teriyaki, onsen egg, dan salad wijen di atas nasi Jepang.", groups: [pedas] },
    ],
  },
  {
    name: "Mie & Pasta",
    icon: "🍜",
    items: [
      { name: "Mie Ayam Jamur", emoji: "🍜", price: 27000, desc: "Mie kenyal dengan ayam jamur kecap, sawi, dan kuah kaldu.", groups: [mieTopping, pedas] },
      { name: "Mie Goreng Jawa", emoji: "🍝", price: 30000, desc: "Mie goreng arang dengan bumbu kemiri, ayam dan sayuran.", groups: [pedas, mieTopping] },
      { name: "Spaghetti Aglio Olio", emoji: "🍤", price: 38000, desc: "Bawang putih, cabai kering, peterseli dan udang.", groups: [pedas] },
    ],
  },
  {
    name: "Camilan",
    icon: "🍟",
    items: [
      { name: "French Fries", emoji: "🍟", price: 22000, desc: "Kentang goreng renyah dengan bumbu garlic parsley.", groups: [saus] },
      { name: "Tahu Cabe Garam", emoji: "🧈", price: 20000, desc: "Tahu sutra goreng tepung, tumis cabai dan bawang.", featured: true },
      { name: "Pisang Goreng Keju", emoji: "🍌", price: 23000, desc: "Pisang kepok goreng, keju parut dan susu kental manis." },
      { name: "Dimsum Ayam (4 pcs)", emoji: "🥟", price: 25000, desc: "Siomay ayam udang kukus dengan saus chili oil." },
    ],
  },
  {
    name: "Kopi",
    icon: "☕",
    items: [
      { name: "Es Kopi Susu Gula Aren", emoji: "🧋", price: 24000, desc: "Espresso, susu segar, dan gula aren asli. Andalan kami!", featured: true, groups: [ukuran, gula, extraKopi] },
      { name: "Americano", emoji: "☕", price: 22000, desc: "Double shot espresso dengan air.", groups: [suhu, ukuran, extraKopi] },
      { name: "Caffè Latte", emoji: "☕", price: 28000, desc: "Espresso lembut dengan susu steamed.", groups: [suhu, ukuran, gula, extraKopi] },
      { name: "Kopi Tubruk", emoji: "🫖", price: 15000, desc: "Kopi robusta Temanggung diseduh tradisional.", groups: [gula] },
    ],
  },
  {
    name: "Non-Kopi",
    icon: "🧋",
    items: [
      { name: "Matcha Latte", emoji: "🍵", price: 30000, desc: "Matcha Jepang premium dengan susu segar.", groups: [suhu, ukuran, gula] },
      { name: "Es Teh Leci", emoji: "🥤", price: 20000, desc: "Teh melati dingin dengan buah leci.", groups: [ukuran, gula] },
      { name: "Chocolate Signature", emoji: "🍫", price: 28000, desc: "Cokelat Belgia pekat, creamy dan tidak terlalu manis.", groups: [suhu, ukuran] },
      { name: "Air Mineral", emoji: "💧", price: 8000, desc: "Air mineral botol 600 ml." },
    ],
  },
  {
    name: "Dessert",
    icon: "🍨",
    items: [
      { name: "Es Campur Nusantara", emoji: "🍧", price: 25000, desc: "Cincau, kolang-kaling, alpukat, nangka dan sirup merah.", featured: true },
      { name: "Klepon Cake", emoji: "🍰", price: 32000, desc: "Bolu pandan lembut dengan gula merah cair dan kelapa." },
      { name: "Affogato", emoji: "🍨", price: 30000, desc: "Es krim vanila disiram espresso panas." },
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
      name: "Santap Kemang",
      slug: "kemang",
      address: "Jl. Kemang Raya No. 12, Jakarta Selatan",
      phone: "0812-0000-1111",
      taxRate: 10,
      serviceRate: 5,
      receiptFooter: "Terima kasih sudah bersantap! Wi-Fi: santap / makanenak",
    },
  });
  const bandung = await db.outlet.create({
    data: {
      name: "Santap Dago",
      slug: "dago",
      address: "Jl. Ir. H. Juanda No. 88, Bandung",
      phone: "0812-0000-2222",
      taxRate: 10,
      serviceRate: 0,
      receiptFooter: "Sampai jumpa lagi di Santap Dago!",
    },
  });

  const tableDefs = [
    ...Array.from({ length: 8 }, (_, i) => ({ name: `Meja ${String(i + 1).padStart(2, "0")}`, area: "Indoor", capacity: i < 4 ? 2 : 4 })),
    ...Array.from({ length: 4 }, (_, i) => ({ name: `Teras ${i + 1}`, area: "Outdoor", capacity: 4 })),
  ];
  const kemangTables = [];
  for (const [i, t] of tableDefs.entries()) {
    kemangTables.push(await db.diningTable.create({ data: { ...t, outletId: kemang.id, qrToken: token(), sortOrder: i } }));
  }
  const dagoTables = [];
  for (let i = 0; i < 6; i++) {
    dagoTables.push(
      await db.diningTable.create({
        data: { name: `Meja ${String(i + 1).padStart(2, "0")}`, area: "Indoor", capacity: 4, outletId: bandung.id, qrToken: token(), sortOrder: i },
      })
    );
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
  const affogato = allProducts.find((p) => p.name === "Affogato")!;
  await db.productUnavailable.create({ data: { outletId: kemang.id, productId: affogato.id } });

  console.log("👤 Akun staf…");
  const password = await hashPassword("password123");
  const users = [
    { name: "Ega Owner", email: "owner@santap.id", role: "OWNER" as const, outletId: null },
    { name: "Sari Kasir", email: "kasir@santap.id", role: "KASIR" as const, outletId: kemang.id },
    { name: "Budi Dapur", email: "dapur@santap.id", role: "DAPUR" as const, outletId: kemang.id },
    { name: "Rina Pelayan", email: "pelayan@santap.id", role: "PELAYAN" as const, outletId: kemang.id },
    { name: "Dimas Kasir", email: "kasir.dago@santap.id", role: "KASIR" as const, outletId: bandung.id },
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
  for (const outlet of [kemang, bandung]) {
    const cashierId = outlet.id === kemang.id ? created["kasir@santap.id"] : created["kasir.dago@santap.id"];
    const tables = outlet.id === kemang.id ? kemangTables : dagoTables;
    for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
      const day = new Date();
      day.setDate(day.getDate() - daysAgo);
      const open = new Date(day);
      open.setHours(9, 0, 0, 0);
      const close = new Date(day);
      close.setHours(21, 30, 0, 0);
      const shift = await db.shift.create({
        data: { outletId: outlet.id, userId: cashierId, openedAt: open, closedAt: close, openingCash: 500000 },
      });
      const weekend = [0, 6].includes(day.getDay());
      const count = randInt(outlet.id === kemang.id ? 18 : 10, outlet.id === kemang.id ? 34 : 20) + (weekend ? 10 : 0);
      let cashTotal = 0;
      for (let n = 1; n <= count; n++) {
        const createdAt = new Date(day);
        const hour = pick([10, 11, 12, 12, 12, 13, 13, 14, 15, 16, 17, 18, 18, 19, 19, 19, 20]);
        createdAt.setHours(hour, randInt(0, 59), randInt(0, 59), 0);
        const lineCount = randInt(1, 4);
        const items = Array.from({ length: lineCount }, () => {
          const p = pick(allProducts);
          const modifiers = p.groups.flatMap((g) => (g.min > 0 ? [{ group: g.name, option: g.options[0].name, priceDelta: g.options[0].priceDelta }] : []));
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
