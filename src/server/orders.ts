import "server-only";
import crypto from "node:crypto";
import { Prisma, type OrderItemStatus, type OrderStatus, type OrderType, type OrderSource, type PaymentMethod, type PaymentState, type Role } from "@prisma/client";
import { db } from "@/lib/db";
import { businessDate } from "@/lib/utils";
import { channels, publish } from "@/lib/events";
import { computeTotals, OrderError, priceLines, type CartLineInput } from "./pricing";
import { createSnapTransaction, isMidtransEnabled } from "./midtrans";
import {
  FlowError,
  ORDER_TRANSITIONS,
  assertItemChange,
  deriveOrderStatus,
  itemChangesForOrderAction,
  itemStampsFor,
  orderStampsFor,
} from "@/lib/order-flow";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(len = 4) {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export type CreateOrderInput = {
  outletId: string;
  tableId?: string | null;
  type: OrderType;
  source: OrderSource;
  lines: CartLineInput[];
  customerName?: string | null;
  customerPhone?: string | null;
  note?: string | null;
  payPreference?: PaymentMethod | null;
  cashierId?: string | null;
  discount?: number;
  customerId?: string | null;
  pickupAt?: Date | null;
};

export async function createOrder(input: CreateOrderInput) {
  const outlet = await db.outlet.findUnique({ where: { id: input.outletId } });
  if (!outlet || !outlet.isActive) throw new OrderError("Outlet sedang tidak menerima pesanan.");
  if (input.tableId) {
    const table = await db.diningTable.findFirst({ where: { id: input.tableId, outletId: outlet.id } });
    if (!table || !table.isActive) throw new OrderError("Meja tidak ditemukan.");
  }

  const lines = await priceLines(outlet.id, input.lines);
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const totals = computeTotals(subtotal, outlet, input.discount ?? 0);
  const date = businessDate();
  // Pesanan dari kasir langsung masuk dapur; pesanan QR menunggu bayar / konfirmasi staf
  const status: OrderStatus = input.source === "POS" ? "CONFIRMED" : "PENDING";

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const order = await db.$transaction(async (tx) => {
        const last = await tx.order.aggregate({
          where: { outletId: outlet.id, businessDate: date },
          _max: { queueNumber: true },
        });
        const queueNumber = (last._max.queueNumber ?? 0) + 1;
        return tx.order.create({
          data: {
            code: `${date.slice(2).replace(/-/g, "")}-${randomCode()}`,
            queueNumber,
            businessDate: date,
            outletId: outlet.id,
            tableId: input.type === "DINE_IN" ? input.tableId ?? null : null,
            type: input.type,
            source: input.source,
            status,
            confirmedAt: status === "CONFIRMED" ? new Date() : null,
            payPreference: input.payPreference ?? null,
            customerName: input.customerName?.trim() || null,
            customerPhone: input.customerPhone?.trim() || null,
            note: input.note?.trim() || null,
            cashierId: input.cashierId ?? null,
            customerId: input.customerId ?? null,
            pickupAt: input.type === "TAKEAWAY" ? input.pickupAt ?? null : null,
            ...totals,
            items: {
              create: lines.map((l) => ({
                productId: l.productId,
                name: l.name,
                unitPrice: l.unitPrice,
                quantity: l.quantity,
                modifiers: l.modifiers,
                note: l.note,
                lineTotal: l.lineTotal,
              })),
            },
          },
        });
      });
      publish(channels.outlet(outlet.id), { type: "order.created", orderId: order.id, source: order.source });
      return order;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new OrderError("Sistem sedang sibuk, silakan coba lagi.");
}

type Tx = Prisma.TransactionClient;

/** Kunci baris pesanan selama transaksi agar dua staf yang menekan tombol bersamaan tidak saling menimpa. */
async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  return tx.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { id: "asc" } }, table: { select: { name: true } } },
  });
}
type LockedOrder = NonNullable<Awaited<ReturnType<typeof lockOrder>>>;

/** Terapkan perubahan status item (+ cap waktunya) di dalam transaksi. */
async function applyItemChanges(tx: Tx, order: LockedOrder, changes: { id: string; to: OrderItemStatus }[], now: Date) {
  for (const c of changes) {
    const item = order.items.find((i) => i.id === c.id)!;
    await tx.orderItem.update({
      where: { id: c.id },
      data: { status: c.to, ...itemStampsFor(c.to, item, now) },
    });
    item.status = c.to;
  }
}

/**
 * Hitung ulang status pesanan dari item-itemnya dan simpan bila berubah.
 * Dipanggil setelah SETIAP perubahan item (status, hapus item, dll.) agar tidak pernah ambigu.
 */
async function syncOrderStatus(tx: Tx, order: LockedOrder, now: Date) {
  const next = deriveOrderStatus(order.status, order.items);
  if (next === order.status) return order.status;
  await tx.order.update({ where: { id: order.id }, data: { status: next, ...orderStampsFor(order.status, next, order, now) } });
  return next;
}

/** Kirim event realtime setelah transaksi selesai. */
function announce(order: LockedOrder, prevStatus: OrderStatus, nextStatus: OrderStatus, readied: string[]) {
  if (readied.length) {
    const ev = {
      type: "items.ready" as const,
      orderId: order.id,
      queueNumber: order.queueNumber,
      tableName: order.table?.name ?? null,
      items: order.items.filter((i) => readied.includes(i.id)).map((i) => `${i.quantity}× ${i.name}`),
      allReady: nextStatus === "READY",
    };
    publish(channels.outlet(order.outletId), ev);
    publish(channels.order(order.id), ev);
  }
  notifyOrder(order.outletId, order.id, nextStatus !== prevStatus ? nextStatus : undefined);
}

/**
 * Ubah status pesanan lewat aksi level pesanan.
 * Untuk tahap dapur, aksi ini diterjemahkan menjadi perubahan status SEMUA item terkait,
 * lalu status pesanan diturunkan dari item (lihat src/lib/order-flow.ts).
 */
export async function setOrderStatus(
  orderId: string,
  next: OrderStatus,
  opts: { role?: Role; reason?: string; outletId?: string } = {}
) {
  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) throw new OrderError("Pesanan tidak ditemukan.");
    if (opts.outletId && order.outletId !== opts.outletId) throw new OrderError("Pesanan bukan milik outlet ini.");
    const prev = order.status;
    if (prev === next) return { order, prev, status: prev, readied: [] as string[] };
    if (!ORDER_TRANSITIONS[prev].includes(next)) {
      throw new OrderError("Status pesanan tidak bisa diubah ke tahap tersebut.");
    }
    if (prev === "PENDING" && next === "CONFIRMED" && opts.role === "DAPUR") {
      throw new OrderError("Pesanan baru harus dikonfirmasi kasir / pelayan dulu.");
    }
    if (next === "CANCELLED") {
      if (order.paymentStatus !== "UNPAID" && opts.role !== "OWNER") {
        throw new OrderError("Pesanan yang sudah dibayar hanya bisa dibatalkan oleh owner.");
      }
      const data: Prisma.OrderUpdateInput = { status: "CANCELLED", cancelReason: opts.reason ?? null };
      if (order.paymentStatus !== "UNPAID") data.paymentStatus = "REFUNDED";
      await tx.order.update({ where: { id: orderId }, data });
      await tx.payment.updateMany({ where: { orderId, state: "PENDING" }, data: { state: "FAILED" } });
      return { order, prev, status: "CANCELLED" as OrderStatus, readied: [] as string[] };
    }
    if (prev === "PENDING") {
      // Konfirmasi: masuk antrean dapur, semua item tetap Antre
      await tx.order.update({ where: { id: orderId }, data: { status: "CONFIRMED", confirmedAt: order.confirmedAt ?? now } });
      return { order, prev, status: "CONFIRMED" as OrderStatus, readied: [] as string[] };
    }
    let changes;
    try {
      changes = itemChangesForOrderAction(prev, next, order.items);
    } catch (e) {
      if (e instanceof FlowError) throw new OrderError(e.message);
      throw e;
    }
    await applyItemChanges(tx, order, changes, now);
    const status = await syncOrderStatus(tx, order, now);
    return { order, prev, status, readied: changes.filter((c) => c.to === "READY").map((c) => c.id) };
  });
  announce(result.order, result.prev, result.status, result.readied);
  return { ...result.order, status: result.status };
}

/**
 * Ubah status satu atau beberapa item (layar dapur / halaman Pesanan).
 * `expected` (opsional) = status item yang dilihat staf di layar; bila sudah berubah oleh staf lain,
 * aksi ditolak agar tidak menimpa (mis. dua orang menekan "Siap" dan "Antar" bersamaan).
 */
export async function setItemStatus(
  input: { orderId: string; itemIds: string[]; to: OrderItemStatus; expected?: OrderItemStatus },
  opts: { outletId?: string } = {}
) {
  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    if (!order) throw new OrderError("Pesanan tidak ditemukan.");
    if (opts.outletId && order.outletId !== opts.outletId) throw new OrderError("Pesanan bukan milik outlet ini.");
    const prev = order.status;
    const changes: { id: string; to: OrderItemStatus }[] = [];
    for (const id of new Set(input.itemIds)) {
      const item = order.items.find((i) => i.id === id);
      if (!item) throw new OrderError("Item tidak ditemukan di pesanan ini.");
      if (input.expected && item.status !== input.expected) {
        throw new OrderError("Status item sudah diubah staf lain. Layar diperbarui.");
      }
      try {
        if (assertItemChange(prev, item.status, input.to)) changes.push({ id, to: input.to });
      } catch (e) {
        if (e instanceof FlowError) throw new OrderError(e.message);
        throw e;
      }
    }
    await applyItemChanges(tx, order, changes, now);
    const status = await syncOrderStatus(tx, order, now);
    return { order, prev, status, readied: input.to === "READY" ? changes.map((c) => c.id) : [] };
  });
  announce(result.order, result.prev, result.status, result.readied);
  return { status: result.status };
}

/**
 * Setelah item dihapus / dikurangi, status pesanan dihitung ulang
 * (mis. item terakhir yang belum siap dihapus → pesanan jadi Siap).
 */
export async function resyncOrderStatus(tx: Tx, orderId: string) {
  const order = await lockOrder(tx, orderId);
  if (!order) return null;
  const status = await syncOrderStatus(tx, order, new Date());
  return { order, prev: order.status, status };
}

export function notifyOrder(outletId: string, orderId: string, status?: string) {
  publish(channels.outlet(outletId), { type: "order.updated", orderId, status });
  publish(channels.order(orderId), { type: "order.updated", orderId, status });
}

/** Hitung ulang status bayar dari semua pembayaran sukses. */
export async function recalcPayment(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  if (!order) return null;
  const paid = order.payments.filter((p) => p.state === "SUCCESS").reduce((s, p) => s + p.amount, 0);
  if (order.paymentStatus === "REFUNDED") return order;
  const paymentStatus = paid >= order.total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
  const data: Prisma.OrderUpdateInput = { paymentStatus };
  if (paymentStatus === "PAID" && !order.paidAt) data.paidAt = new Date();
  // Pesanan QR yang lunas langsung diteruskan ke dapur
  if (paymentStatus === "PAID" && order.status === "PENDING") {
    data.status = "CONFIRMED";
    data.confirmedAt = new Date();
  }
  const updated = await db.order.update({ where: { id: orderId }, data });
  publish(channels.outlet(order.outletId), { type: "payment.updated", orderId });
  publish(channels.order(orderId), { type: "payment.updated", orderId });
  if (updated.status !== order.status) notifyOrder(order.outletId, orderId, updated.status);
  return updated;
}

export async function paidAmount(orderId: string) {
  const agg = await db.payment.aggregate({ where: { orderId, state: "SUCCESS" }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

export type ManualPaymentInput = {
  orderId: string;
  method: Exclude<PaymentMethod, "MIDTRANS">;
  amount: number;
  cashReceived?: number | null;
  reference?: string | null;
  label?: string | null;
  shiftId: string;
  userId: string;
  /** Split per item: item & qty yang dibayar */
  items?: { itemId: string; quantity: number }[];
};

/** Pembayaran yang diterima langsung oleh kasir (tunai, EDC, transfer). */
export async function addManualPayment(p: ManualPaymentInput) {
  const order = await db.order.findUnique({ where: { id: p.orderId }, include: { items: true } });
  if (!order) throw new OrderError("Pesanan tidak ditemukan.");
  if (order.status === "CANCELLED") throw new OrderError("Pesanan sudah dibatalkan.");
  const remaining = order.total - (await paidAmount(order.id));
  if (remaining <= 0) throw new OrderError("Pesanan sudah lunas.");
  const amount = Math.round(p.amount);
  if (amount <= 0) throw new OrderError("Nominal pembayaran tidak valid.");
  if (amount > remaining) throw new OrderError("Nominal melebihi sisa tagihan.");
  if (p.method === "CASH") {
    if ((p.cashReceived ?? 0) < amount) throw new OrderError("Uang diterima kurang dari tagihan.");
  }

  await db.$transaction(async (tx) => {
    if (p.items?.length) {
      for (const sel of p.items) {
        const item = order.items.find((i) => i.id === sel.itemId);
        if (!item || sel.quantity < 1 || item.paidQty + sel.quantity > item.quantity) {
          throw new OrderError("Item split bill tidak valid.");
        }
        await tx.orderItem.update({ where: { id: item.id }, data: { paidQty: { increment: sel.quantity } } });
      }
    }
    await tx.payment.create({
      data: {
        orderId: order.id,
        method: p.method,
        state: "SUCCESS",
        amount,
        label: p.label ?? null,
        cashReceived: p.method === "CASH" ? p.cashReceived ?? amount : null,
        changeAmount: p.method === "CASH" ? (p.cashReceived ?? amount) - amount : null,
        reference: p.reference ?? null,
        shiftId: p.shiftId,
        receivedById: p.userId,
        paidAt: new Date(),
      },
    });
  });
  return recalcPayment(order.id);
}

/** Buat pembayaran online (Midtrans Snap). Mode demo jika key belum diisi. */
export async function createGatewayPayment(opts: {
  orderId: string;
  amount?: number;
  label?: string | null;
  shiftId?: string | null;
  userId?: string | null;
}) {
  const order = await db.order.findUnique({ where: { id: opts.orderId }, include: { outlet: true } });
  if (!order) throw new OrderError("Pesanan tidak ditemukan.");
  if (order.status === "CANCELLED") throw new OrderError("Pesanan sudah dibatalkan.");
  const remaining = order.total - (await paidAmount(order.id));
  if (remaining <= 0) throw new OrderError("Pesanan sudah lunas.");
  const amount = Math.min(Math.round(opts.amount ?? remaining), remaining);
  if (amount <= 0) throw new OrderError("Nominal pembayaran tidak valid.");

  // Pakai ulang transaksi pending dengan nominal sama agar tidak dobel
  const existing = await db.payment.findFirst({
    where: { orderId: order.id, method: "MIDTRANS", state: "PENDING", amount, snapToken: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (existing && Date.now() - existing.createdAt.getTime() < 25 * 60 * 1000) return existing;

  const gatewayOrderId = `${order.code}-${randomCode(3)}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let snapToken = `demo-${randomCode(10)}`;
  let redirectUrl: string | null = null;
  if (await isMidtransEnabled()) {
    const snap = await createSnapTransaction({
      orderId: gatewayOrderId,
      amount,
      itemName: `${order.outlet.name} #${order.queueNumber}`,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      finishUrl: `${appUrl}/order/${order.id}`,
    });
    snapToken = snap.token;
    redirectUrl = snap.redirectUrl;
  }
  return db.payment.create({
    data: {
      orderId: order.id,
      method: "MIDTRANS",
      state: "PENDING",
      amount,
      label: opts.label ?? null,
      gatewayOrderId,
      snapToken,
      snapRedirectUrl: redirectUrl,
      shiftId: opts.shiftId ?? null,
      receivedById: opts.userId ?? null,
    },
  });
}

export async function applyGatewayState(
  paymentId: string,
  state: PaymentState,
  raw?: Prisma.InputJsonValue,
  gatewayType?: string
) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return null;
  if (payment.state === "SUCCESS" || payment.state === state) return payment;
  const updated = await db.payment.update({
    where: { id: paymentId },
    data: {
      state,
      gatewayRaw: raw,
      gatewayType: gatewayType ?? payment.gatewayType,
      paidAt: state === "SUCCESS" ? new Date() : null,
    },
  });
  await recalcPayment(payment.orderId);
  return updated;
}

/**
 * Batalkan otomatis pesanan QR "bayar online" yang tidak pernah dibayar
 * agar papan pesanan tetap bersih.
 */
export async function expireStaleOrders(outletId: string, maxAgeMinutes = 120) {
  const stale = await db.order.findMany({
    where: {
      outletId,
      status: "PENDING",
      paymentStatus: "UNPAID",
      payPreference: "MIDTRANS",
      createdAt: { lt: new Date(Date.now() - maxAgeMinutes * 60_000) },
    },
    select: { id: true },
  });
  for (const o of stale) {
    await db.order.update({
      where: { id: o.id },
      data: { status: "CANCELLED", cancelReason: "Pembayaran online tidak diselesaikan" },
    });
    await db.payment.updateMany({ where: { orderId: o.id, state: "PENDING" }, data: { state: "EXPIRED" } });
    notifyOrder(outletId, o.id, "CANCELLED");
  }
  return stale.length;
}

export { OrderError };
