import "server-only";
import type { OrderStatus, OrderType, PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Data pelanggan untuk dashboard owner.
 * - "Akun": pelanggan yang login Google (User role CUSTOMER), pesanan lewat Order.customerId.
 * - "Tamu": pesanan tanpa akun yang mengisi nomor WhatsApp, dikelompokkan per nomor.
 * Semua angka dihitung dari pesanan di outlet aktif; pesanan batal tidak dihitung.
 */

export type CustomerKind = "ACCOUNT" | "GUEST";

export type CustomerRow = {
  key: string;
  kind: CustomerKind;
  name: string;
  email: string | null;
  phone: string | null;
  image: string | null;
  isActive: boolean;
  joinedAt: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
};

const GUEST_PREFIX = "tamu-";

/** Samakan format nomor HP: 0812..., +62812..., 62812... → 0812... */
export function normalizePhone(raw: string | null | undefined) {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  else if (d.startsWith("8")) d = "0" + d;
  return d.length >= 8 ? d : null;
}

export const guestKey = (phone: string) => `${GUEST_PREFIX}${phone}`;
export const parseGuestKey = (key: string) => (key.startsWith(GUEST_PREFIX) ? normalizePhone(key.slice(GUEST_PREFIX.length)) : null);

const counted: Prisma.OrderWhereInput = { status: { not: "CANCELLED" } };
/** Belanja = pesanan yang sudah dibayar (lunas/sebagian), tidak batal */
const paid: Prisma.OrderWhereInput = { status: { not: "CANCELLED" }, paymentStatus: { in: ["PAID", "PARTIAL"] } };

export async function listCustomers(outletId: string): Promise<CustomerRow[]> {
  const [accounts, accCount, accSpent, guestOrders] = await Promise.all([
    db.user.findMany({
      where: { role: "CUSTOMER" },
      select: { id: true, name: true, email: true, phone: true, image: true, isActive: true, createdAt: true },
    }),
    db.order.groupBy({
      by: ["customerId"],
      where: { outletId, customerId: { not: null }, ...counted },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    db.order.groupBy({
      by: ["customerId"],
      where: { outletId, customerId: { not: null }, ...paid },
      _sum: { total: true },
    }),
    db.order.findMany({
      where: { outletId, customerId: null, customerPhone: { not: null }, ...counted },
      select: { customerName: true, customerPhone: true, total: true, paymentStatus: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const countBy = new Map(accCount.map((g) => [g.customerId!, g]));
  const spentBy = new Map(accSpent.map((g) => [g.customerId!, g._sum.total ?? 0]));

  const rows: CustomerRow[] = accounts.map((u) => {
    const c = countBy.get(u.id);
    return {
      key: u.id,
      kind: "ACCOUNT",
      name: u.name,
      email: u.email,
      phone: u.phone,
      image: u.image,
      isActive: u.isActive,
      joinedAt: u.createdAt.toISOString(),
      orderCount: c?._count._all ?? 0,
      totalSpent: spentBy.get(u.id) ?? 0,
      lastOrderAt: c?._max.createdAt?.toISOString() ?? null,
    };
  });

  // Tamu: urut terbaru dulu, jadi nama pertama yang ditemui = nama terakhir yang dipakai
  const guests = new Map<string, CustomerRow>();
  for (const o of guestOrders) {
    const phone = normalizePhone(o.customerPhone);
    if (!phone) continue;
    let g = guests.get(phone);
    if (!g) {
      g = {
        key: guestKey(phone),
        kind: "GUEST",
        name: o.customerName?.trim() || "Tamu",
        email: null,
        phone,
        image: null,
        isActive: true,
        joinedAt: null,
        orderCount: 0,
        totalSpent: 0,
        lastOrderAt: o.createdAt.toISOString(),
      };
      guests.set(phone, g);
    }
    g.orderCount++;
    if (o.paymentStatus === "PAID" || o.paymentStatus === "PARTIAL") g.totalSpent += o.total;
    g.joinedAt = o.createdAt.toISOString(); // pesanan paling awal = pertama datang
  }

  return [...rows, ...guests.values()];
}

export type CustomerOrder = {
  id: string;
  code: string;
  queueNumber: number;
  createdAt: string;
  type: OrderType;
  tableName: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  items: { name: string; quantity: number }[];
};

export type CustomerDetail = {
  profile: CustomerRow;
  orders: CustomerOrder[];
  favorites: { name: string; quantity: number }[];
  avgSpent: number;
  cancelledCount: number;
};

export async function getCustomerDetail(outletId: string, key: string): Promise<CustomerDetail | null> {
  const guestPhone = parseGuestKey(key);
  let where: Prisma.OrderWhereInput;
  let base: Omit<CustomerRow, "orderCount" | "totalSpent" | "lastOrderAt">;

  if (guestPhone) {
    // Nomor bisa tersimpan dengan format lain (+62, spasi, strip): cocokkan setelah dinormalisasi
    const candidates = await db.order.findMany({
      where: { outletId, customerId: null, customerPhone: { not: null } },
      select: { id: true, customerPhone: true },
    });
    const ids = candidates.filter((o) => normalizePhone(o.customerPhone) === guestPhone).map((o) => o.id);
    if (ids.length === 0) return null;
    where = { id: { in: ids } };
    base = { key, kind: "GUEST", name: "Tamu", email: null, phone: guestPhone, image: null, isActive: true, joinedAt: null };
  } else {
    const u = await db.user.findFirst({
      where: { id: key, role: "CUSTOMER" },
      select: { id: true, name: true, email: true, phone: true, image: true, isActive: true, createdAt: true },
    });
    if (!u) return null;
    where = { outletId, customerId: u.id };
    base = { key, kind: "ACCOUNT", name: u.name, email: u.email, phone: u.phone, image: u.image, isActive: u.isActive, joinedAt: u.createdAt.toISOString() };
  }

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true, code: true, queueNumber: true, createdAt: true, type: true, status: true, paymentStatus: true, total: true,
      customerName: true, customerPhone: true,
      table: { select: { name: true } },
      items: { select: { name: true, quantity: true } },
    },
  });

  const live = orders.filter((o) => o.status !== "CANCELLED");
  const paidOrders = live.filter((o) => o.paymentStatus === "PAID" || o.paymentStatus === "PARTIAL");
  const totalSpent = paidOrders.reduce((s, o) => s + o.total, 0);

  const fav = new Map<string, number>();
  for (const o of live) for (const it of o.items) fav.set(it.name, (fav.get(it.name) ?? 0) + it.quantity);
  const favorites = [...fav.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, quantity]) => ({ name, quantity }));

  if (guestPhone) {
    base.name = orders.find((o) => o.customerName?.trim())?.customerName?.trim() || "Tamu";
    base.joinedAt = orders.at(-1)?.createdAt.toISOString() ?? null;
  }

  return {
    profile: {
      ...base,
      orderCount: live.length,
      totalSpent,
      lastOrderAt: live[0]?.createdAt.toISOString() ?? null,
    },
    orders: orders.map((o) => ({
      id: o.id,
      code: o.code,
      queueNumber: o.queueNumber,
      createdAt: o.createdAt.toISOString(),
      type: o.type,
      tableName: o.table?.name ?? null,
      status: o.status,
      paymentStatus: o.paymentStatus,
      total: o.total,
      items: o.items.map((i) => ({ name: i.name, quantity: i.quantity })),
    })),
    favorites,
    avgSpent: paidOrders.length ? Math.round(totalSpent / paidOrders.length) : 0,
    cancelledCount: orders.length - live.length,
  };
}
