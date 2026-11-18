import "server-only";
import crypto from "node:crypto";
import { Prisma, type OrderItemStatus, type OrderStatus, type OrderType, type OrderSource, type PaymentMethod, type PaymentState, type Role } from "@prisma/client";
import { db } from "@/lib/db";
import { businessDate, formatRupiah } from "@/lib/utils";
import { channels, publish } from "@/lib/events";
import { computeTotals, OrderError, priceLines, type CartLineInput } from "./pricing";
import { ChargeError, createCoreCharge, createSnapTransaction, demoCoreAction, expireTransaction, isOnlinePaymentAvailable } from "./midtrans";
import { getMidtransConfig } from "./settings";
import { CHANNEL_INFO, isCoreChannel, type CoreChannel } from "@/lib/payment-channels";
import { moneyState } from "@/lib/payment-math";
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
  discountReason?: string | null;
  /** Batas diskon (% subtotal). null = tanpa batas (owner) */
  maxDiscountPercent?: number | null;
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
  const discount = Math.max(0, Math.round(input.discount ?? 0));
  if (input.maxDiscountPercent != null && discount > Math.floor((subtotal * input.maxDiscountPercent) / 100)) {
    throw new OrderError(`Diskon kasir maksimal ${input.maxDiscountPercent}% dari subtotal. Minta owner untuk diskon lebih besar.`);
  }
  const totals = computeTotals(subtotal, outlet, discount);
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
            discountReason: totals.discount > 0 ? input.discountReason?.trim() || null : null,
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

/** Kunci baris pesanan sampai transaksi selesai, agar dua pembayaran tidak bisa jalan bersamaan */
async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
}

export type AuditEntry = {
  outletId: string;
  userId?: string | null;
  action: string;
  orderId?: string | null;
  message: string;
  detail?: Prisma.InputJsonValue;
};

/** Catat aksi sensitif ke log aktivitas */
export async function audit(client: Tx | typeof db, e: AuditEntry) {
  await client.auditLog.create({
    data: {
      outletId: e.outletId,
      userId: e.userId ?? null,
      action: e.action,
      orderId: e.orderId ?? null,
      message: e.message,
      detail: e.detail,
    },
  });
}


/** Kunci pesanan lalu baca beserta item-itemnya: dua staf yang menekan tombol bersamaan tidak saling menimpa. */
async function lockOrderWithItems(tx: Tx, orderId: string) {
  await lockOrder(tx, orderId);
  return tx.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { id: "asc" } }, table: { select: { name: true } } },
  });
}
type LockedOrder = NonNullable<Awaited<ReturnType<typeof lockOrderWithItems>>>;

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
  opts: { role?: Role; reason?: string; outletId?: string; userId?: string } = {}
) {
  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const order = await lockOrderWithItems(tx, orderId);
    if (!order) throw new OrderError("Pesanan tidak ditemukan.");
    if (opts.outletId && order.outletId !== opts.outletId) throw new OrderError("Pesanan bukan milik outlet ini.");
    const prev = order.status;
    if (prev === next) return { order, prev, status: prev, readied: [] as string[], pendingGateway: [] as string[] };
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
      if (!opts.reason?.trim()) throw new OrderError("Isi alasan pembatalan.");
      // Status item dibiarkan sebagai riwayat dapur; pesanan batal tidak diturunkan dari item
      await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", cancelReason: opts.reason.trim() } });
      const pending = await tx.payment.findMany({ where: { orderId, state: "PENDING" } });
      const pendingGateway = pending.flatMap((p) => (p.method === "MIDTRANS" && p.gatewayOrderId ? [p.gatewayOrderId] : []));
      await tx.payment.updateMany({ where: { orderId, state: "PENDING" }, data: { state: "FAILED" } });
      // Uang yang sudah masuk tidak otomatis dianggap kembali: owner mencatat refund-nya
      await recalcPaymentTx(tx, orderId);
      await audit(tx, {
        outletId: order.outletId,
        userId: opts.userId,
        action: "ORDER_CANCEL",
        orderId,
        message: `Pesanan #${order.queueNumber} dibatalkan: ${opts.reason.trim()}`,
        detail: { total: order.total, paymentStatus: order.paymentStatus },
      });
      return { order, prev, status: "CANCELLED" as OrderStatus, readied: [] as string[], pendingGateway };
    }
    if (prev === "PENDING") {
      // Konfirmasi: masuk antrean dapur, semua item tetap Antre
      await tx.order.update({ where: { id: orderId }, data: { status: "CONFIRMED", confirmedAt: order.confirmedAt ?? now } });
      return { order, prev, status: "CONFIRMED" as OrderStatus, readied: [] as string[], pendingGateway: [] as string[] };
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
    return { order, prev, status, readied: changes.filter((c) => c.to === "READY").map((c) => c.id), pendingGateway: [] as string[] };
  });
  for (const id of result.pendingGateway) await expireTransaction(id);
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
    const order = await lockOrderWithItems(tx, input.orderId);
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
  const order = await lockOrderWithItems(tx, orderId);
  if (!order) return null;
  const status = await syncOrderStatus(tx, order, new Date());
  return { order, prev: order.status, status };
}

export function notifyOrder(outletId: string, orderId: string, status?: string) {
  publish(channels.outlet(outletId), { type: "order.updated", orderId, status });
  publish(channels.order(orderId), { type: "order.updated", orderId, status });
}

/** Hitung ulang status bayar dari pembayaran sukses dikurangi refund (di dalam transaksi). */
async function recalcPaymentTx(tx: Tx, orderId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { payments: true, refunds: true } });
  if (!order) throw new OrderError("Pesanan tidak ditemukan.");
  const m = moneyState(order);
  const data: Prisma.OrderUpdateInput = {};
  if (m.paymentStatus !== order.paymentStatus) data.paymentStatus = m.paymentStatus;
  if (m.paymentStatus === "PAID" && !order.paidAt) data.paidAt = new Date();
  // Pesanan QR yang lunas langsung diteruskan ke dapur
  if (m.paymentStatus === "PAID" && order.status === "PENDING") {
    data.status = "CONFIRMED";
    data.confirmedAt = new Date();
  }
  const updated = Object.keys(data).length ? await tx.order.update({ where: { id: orderId }, data }) : order;
  return { order: updated, before: order, money: m };
}

function publishPayment(outletId: string, orderId: string, statusChanged?: string) {
  publish(channels.outlet(outletId), { type: "payment.updated", orderId });
  publish(channels.order(orderId), { type: "payment.updated", orderId });
  if (statusChanged) notifyOrder(outletId, orderId, statusChanged);
}

/** Hitung ulang status bayar (di luar transaksi lain). */
export async function recalcPayment(orderId: string) {
  const r = await db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    return recalcPaymentTx(tx, orderId);
  });
  publishPayment(r.order.outletId, orderId, r.order.status !== r.before.status ? r.order.status : undefined);
  return r.order;
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

/** Satu pembayaran manual di dalam transaksi; sisa tagihan dicek setelah baris pesanan dikunci. */
async function addManualPaymentTx(tx: Tx, p: ManualPaymentInput) {
  await lockOrder(tx, p.orderId);
  const order = await tx.order.findUnique({ where: { id: p.orderId }, include: { items: true, payments: true, refunds: true } });
  if (!order) throw new OrderError("Pesanan tidak ditemukan.");
  if (order.status === "CANCELLED") throw new OrderError("Pesanan sudah dibatalkan.");
  const remaining = moneyState(order).remaining;
  if (remaining <= 0) throw new OrderError("Pesanan sudah lunas.");
  const amount = Math.round(p.amount);
  if (amount <= 0) throw new OrderError("Nominal pembayaran tidak valid.");
  if (amount > remaining) throw new OrderError("Nominal melebihi sisa tagihan.");
  if (p.method === "CASH") {
    if ((p.cashReceived ?? 0) < amount) throw new OrderError("Uang diterima kurang dari tagihan.");
  }
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
  return recalcPaymentTx(tx, order.id);
}

/** Pembayaran yang diterima langsung oleh kasir (tunai, EDC, transfer). */
export async function addManualPayment(p: ManualPaymentInput) {
  const r = await db.$transaction((tx) => addManualPaymentTx(tx, p));
  publishPayment(r.order.outletId, r.order.id, r.order.status !== r.before.status ? r.order.status : undefined);
  return r.order;
}

/**
 * Bayar beberapa pesanan sekaligus (gabungan per meja) dalam SATU transaksi:
 * semua tercatat, atau tidak sama sekali.
 */
export async function payOrdersBatch(p: {
  outletId: string;
  orderIds: string[];
  method: Exclude<PaymentMethod, "MIDTRANS">;
  cashReceived?: number | null;
  reference?: string | null;
  shiftId: string;
  userId: string;
}) {
  const ids = [...new Set(p.orderIds)].sort();
  const result = await db.$transaction(async (tx) => {
    for (const id of ids) await lockOrder(tx, id);
    const orders = await tx.order.findMany({
      where: { id: { in: ids }, outletId: p.outletId, status: { not: "CANCELLED" } },
      include: { payments: true, refunds: true },
      orderBy: { createdAt: "asc" },
    });
    const due = orders.map((o) => ({ id: o.id, remaining: moneyState(o).remaining })).filter((o) => o.remaining > 0);
    if (!due.length) throw new OrderError("Semua tagihan sudah lunas.");
    const total = due.reduce((s, o) => s + o.remaining, 0);
    const cash = p.method === "CASH" ? p.cashReceived ?? total : null;
    if (cash !== null && cash < total) throw new OrderError("Uang diterima kurang dari total tagihan.");
    const change = cash !== null ? cash - total : 0;
    const results = [];
    for (const [i, o] of due.entries()) {
      const last = i === due.length - 1;
      results.push(
        await addManualPaymentTx(tx, {
          orderId: o.id,
          method: p.method,
          amount: o.remaining,
          // Kembalian dicatat di pesanan terakhir agar rekap kas tetap akurat
          cashReceived: cash !== null ? o.remaining + (last ? change : 0) : null,
          reference: p.reference ?? null,
          label: due.length > 1 ? "Gabungan meja" : null,
          shiftId: p.shiftId,
          userId: p.userId,
        })
      );
    }
    return { total, change, results };
  });
  for (const r of result.results) {
    publishPayment(r.order.outletId, r.order.id, r.order.status !== r.before.status ? r.order.status : undefined);
  }
  return { total: result.total, change: result.change };
}

export type SplitItem = { itemId: string; quantity: number };

/** Transaksi Snap masih bisa dipakai ulang selama ini (Snap berlaku 30 menit) */
const SNAP_REUSE_MS = 25 * 60 * 1000;
/** Transaksi Core API dipakai ulang hanya jika masih berlaku minimal selama ini */
const CORE_REUSE_MARGIN_MS = 90 * 1000;

/** Transaksi Midtrans untuk percobaan ini sudah selesai dibuat */
function isPrepared(p: { gatewayMode: string | null; gatewayAction: unknown; snapToken: string | null }) {
  return p.gatewayMode === "core" ? Boolean(p.gatewayAction) : Boolean(p.snapToken);
}

function sameSplit(a: unknown, b: SplitItem[] | null) {
  const norm = (x: unknown) =>
    JSON.stringify(
      ((Array.isArray(x) ? x : []) as SplitItem[])
        .map((i) => ({ itemId: i.itemId, quantity: i.quantity }))
        .sort((p, q) => p.itemId.localeCompare(q.itemId))
    );
  return norm(a) === norm(b);
}

/**
 * Buat pembayaran online lewat Midtrans (Snap atau Core API, sesuai Pengaturan). Mode demo hanya jika diizinkan.
 *
 * Aturan agar data pembayaran tidak ambigu:
 * - Satu percobaan bayar = satu baris Payment = satu order_id Midtrans (gatewayOrderId unik).
 * - Baris Payment dibuat & disimpan DULU, baru transaksi dibuat di Midtrans, sehingga notifikasi
 *   Midtrans selalu menemukan pembayarannya.
 * - Permintaan yang sama (nominal, mode, kanal, item split) memakai ulang transaksi yang masih berlaku.
 * - Percobaan baru dengan kanal / nominal lain membatalkan percobaan pending sebelumnya (juga di Midtrans).
 *   Bila ternyata percobaan lama tetap dibayar, pembayaran itu tetap dicatat dan kelebihannya muncul di Refund.
 */
export async function createGatewayPayment(opts: {
  orderId: string;
  amount?: number;
  label?: string | null;
  shiftId?: string | null;
  userId?: string | null;
  /** Wajib untuk mode Core API */
  channel?: CoreChannel | null;
  /** Split bill per item: item ditandai lunas saat pembayaran ini berhasil */
  splitItems?: SplitItem[] | null;
}) {
  if (!(await isOnlinePaymentAvailable())) throw new OrderError("Pembayaran online belum aktif. Silakan bayar di kasir.");
  const cfg = await getMidtransConfig();
  const live = cfg.enabled;
  const mode = cfg.mode;
  const channel = mode === "core" ? opts.channel ?? null : null;
  if (mode === "core") {
    if (!channel || !isCoreChannel(channel)) throw new OrderError("Pilih metode pembayaran.");
    if (!cfg.coreChannels.includes(channel)) throw new OrderError(`${CHANNEL_INFO[channel].label} tidak tersedia di outlet ini.`);
    const st = cfg.channelStatus[channel];
    if (st && !st.ok) throw new OrderError(st.message);
  }
  const splitItems = opts.splitItems?.filter((i) => i.quantity > 0) ?? null;

  const step = await db.$transaction(async (tx) => {
    await lockOrder(tx, opts.orderId);
    const order = await tx.order.findUnique({ where: { id: opts.orderId }, include: { outlet: true, payments: true, refunds: true, items: true } });
    if (!order) throw new OrderError("Pesanan tidak ditemukan.");
    if (order.status === "CANCELLED") throw new OrderError("Pesanan sudah dibatalkan.");
    const remaining = moneyState(order).remaining;
    if (remaining <= 0) throw new OrderError("Pesanan sudah lunas.");
    const amount = Math.min(Math.round(opts.amount ?? remaining), remaining);
    if (amount <= 0) throw new OrderError("Nominal pembayaran tidak valid.");
    if (splitItems?.length) {
      for (const sel of splitItems) {
        const item = order.items.find((i) => i.id === sel.itemId);
        if (!item || sel.quantity < 1 || item.paidQty + sel.quantity > item.quantity) throw new OrderError("Item split bill tidak valid.");
      }
    }

    const now = Date.now();
    const pending = order.payments
      .filter((p) => p.method === "MIDTRANS" && p.state === "PENDING")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const gatewayMode = mode;
    const reusable = pending.find((p) => {
      if (p.amount !== amount || (p.gatewayMode ?? "snap") !== gatewayMode || !sameSplit(p.splitItems, splitItems)) return false;
      if (gatewayMode === "core" && p.gatewayChannel !== channel) return false;
      // Sedang dibuat oleh permintaan lain (klik dua kali) → tunggu hasilnya
      if (!isPrepared(p)) return now - p.createdAt.getTime() < 30_000;
      if (gatewayMode === "snap") return now - p.createdAt.getTime() < SNAP_REUSE_MS;
      return Boolean(p.expiresAt && p.expiresAt.getTime() - now > CORE_REUSE_MARGIN_MS);
    });
    if (reusable) return { kind: "reuse" as const, payment: reusable };

    // Percobaan lain yang masih pending dibatalkan supaya hanya ada satu tagihan online aktif
    const superseded = pending;
    if (superseded.length) {
      await tx.payment.updateMany({ where: { id: { in: superseded.map((p) => p.id) }, state: "PENDING" }, data: { state: "FAILED" } });
    }
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        method: "MIDTRANS",
        state: "PENDING",
        amount,
        label: opts.label ?? null,
        gatewayOrderId: `${order.code}-${randomCode(4)}`,
        gatewayMode,
        gatewayChannel: channel,
        splitItems: splitItems?.length ? splitItems : undefined,
        shiftId: opts.shiftId ?? null,
        receivedById: opts.userId ?? null,
      },
    });
    return {
      kind: "new" as const,
      payment,
      order,
      superseded: superseded.flatMap((p) => (p.gatewayOrderId ? [p.gatewayOrderId] : [])),
    };
  }, { timeout: 15_000 });

  if (step.kind === "reuse") {
    if (isPrepared(step.payment)) return step.payment;
    // Tunggu permintaan lain selesai membuat transaksi
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const p = await db.payment.findUnique({ where: { id: step.payment.id } });
      if (!p || p.state !== "PENDING") break;
      if (isPrepared(p)) return p;
    }
    throw new OrderError("Pembayaran sedang disiapkan. Coba lagi sebentar.");
  }

  if (step.superseded.length) publish(channels.order(step.order.id), { type: "payment.updated", orderId: step.order.id });
  for (const id of step.superseded) await expireTransaction(id);

  const { payment, order } = step;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const itemName = `${order.outlet.name} #${order.queueNumber}`;
  try {
    if (mode === "snap") {
      let snapToken = `demo-${randomCode(10)}`;
      let redirectUrl: string | null = null;
      if (live) {
        const snap = await createSnapTransaction({
          orderId: payment.gatewayOrderId!,
          amount: payment.amount,
          itemName,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          finishUrl: `${appUrl}/order/${order.id}`,
        });
        snapToken = snap.token;
        redirectUrl = snap.redirectUrl;
      }
      return await db.payment.update({ where: { id: payment.id }, data: { snapToken, snapRedirectUrl: redirectUrl } });
    }
    const ch = channel!;
    if (!live) {
      return await db.payment.update({
        where: { id: payment.id },
        data: {
          gatewayAction: demoCoreAction(ch, payment.gatewayOrderId!),
          expiresAt: new Date(Date.now() + CHANNEL_INFO[ch].expiryMinutes * 60_000),
        },
      });
    }
    const charge = await createCoreCharge(
      {
        orderId: payment.gatewayOrderId!,
        amount: payment.amount,
        channel: ch,
        itemName,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        callbackUrl: `${appUrl}/order/${order.id}`,
      },
      cfg
    );
    return await db.payment.update({
      where: { id: payment.id },
      data: { gatewayAction: charge.action, expiresAt: charge.expiresAt, gatewayType: ch === "qris" ? "qris" : undefined },
    });
  } catch (e) {
    // Percobaan gagal dibuat: tandai gagal agar tidak dianggap tagihan aktif
    await db.payment.updateMany({
      where: { id: payment.id, state: "PENDING" },
      data: { state: "FAILED", gatewayRaw: { error: e instanceof Error ? e.message : String(e) } },
    });
    if (e instanceof ChargeError) throw new OrderError(e.message);
    if (e instanceof OrderError) throw e;
    console.error("Gagal membuat transaksi Midtrans", e);
    throw new OrderError(e instanceof Error && e.message ? `Midtrans: ${e.message}` : "Gagal membuat transaksi pembayaran. Coba lagi.");
  }
}

/**
 * Terapkan status dari Midtrans (webhook / cek status / simulasi demo).
 * Pembayaran yang masuk untuk pesanan batal, atau yang membuat lebih bayar,
 * dicatat di log dan muncul di halaman Refund.
 */
export async function applyGatewayState(
  paymentId: string,
  state: PaymentState,
  raw?: Prisma.InputJsonValue,
  gatewayType?: string,
  /** Kanal spesifik (mis. bni_va) dari notifikasi; kanal yang sudah tercatat tidak ditimpa */
  gatewayChannel?: string | null
) {
  const first = await db.payment.findUnique({ where: { id: paymentId } });
  if (!first) return null;
  const r = await db.$transaction(async (tx) => {
    await lockOrder(tx, first.orderId);
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.state === "SUCCESS" || payment.state === state) return null;
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        state,
        gatewayRaw: raw,
        gatewayType: gatewayType ?? payment.gatewayType,
        gatewayChannel: payment.gatewayChannel ?? gatewayChannel ?? null,
        paidAt: state === "SUCCESS" ? new Date() : null,
      },
    });
    // Split bill per item yang dibayar online: tandai item lunas (tidak melebihi jumlah item)
    if (state === "SUCCESS" && Array.isArray(payment.splitItems)) {
      for (const sel of payment.splitItems as SplitItem[]) {
        const item = await tx.orderItem.findUnique({ where: { id: sel.itemId } });
        if (!item || item.orderId !== payment.orderId) continue;
        const qty = Math.min(sel.quantity, item.quantity - item.paidQty);
        if (qty > 0) await tx.orderItem.update({ where: { id: item.id }, data: { paidQty: { increment: qty } } });
      }
    }
    const rc = await recalcPaymentTx(tx, payment.orderId);
    if (state === "SUCCESS" && rc.money.refundDue > 0) {
      await audit(tx, {
        outletId: rc.order.outletId,
        action: "OVERPAID",
        orderId: rc.order.id,
        message:
          rc.order.status === "CANCELLED"
            ? `Pembayaran online masuk untuk pesanan #${rc.order.queueNumber} yang sudah dibatalkan. Perlu refund.`
            : `Pesanan #${rc.order.queueNumber} lebih bayar (pembayaran dobel). Perlu refund.`,
        detail: { paymentId, amount: payment.amount, refundDue: rc.money.refundDue },
      });
    }
    return { updated, rc };
  });
  if (!r) return first;
  publishPayment(r.rc.order.outletId, r.rc.order.id, r.rc.order.status !== r.rc.before.status ? r.rc.order.status : undefined);
  return r.updated;
}

/**
 * Tandai pembayaran online yang masih pending sebagai gagal, dan matikan juga
 * di Midtrans agar customer tidak bisa menyelesaikannya belakangan.
 */
export async function voidPendingGatewayPayments(orderId: string) {
  const pending = await db.payment.findMany({ where: { orderId, state: "PENDING", method: "MIDTRANS" } });
  if (!pending.length) return;
  await db.payment.updateMany({ where: { id: { in: pending.map((p) => p.id) }, state: "PENDING" }, data: { state: "FAILED" } });
  for (const p of pending) if (p.gatewayOrderId) await expireTransaction(p.gatewayOrderId);
}

/** Catat pengembalian dana. Hanya sebesar kelebihan / uang pesanan batal. */
export async function recordRefund(p: {
  orderId: string;
  outletId: string;
  amount: number;
  method: PaymentMethod;
  reason: string;
  userId: string;
}) {
  const r = await db.$transaction(async (tx) => {
    await lockOrder(tx, p.orderId);
    const order = await tx.order.findUnique({ where: { id: p.orderId }, include: { payments: true, refunds: true } });
    if (!order || order.outletId !== p.outletId) throw new OrderError("Pesanan tidak ditemukan.");
    const { refundDue } = moneyState(order);
    const amount = Math.round(p.amount);
    if (refundDue <= 0) throw new OrderError("Pesanan ini tidak punya kelebihan bayar untuk direfund.");
    if (amount <= 0 || amount > refundDue) throw new OrderError("Nominal refund maksimal sebesar kelebihan bayar.");
    // Refund tunai diambil dari laci kas shift yang sedang dibuka oleh user ini
    const shift =
      p.method === "CASH"
        ? await tx.shift.findFirst({ where: { userId: p.userId, outletId: order.outletId, closedAt: null }, orderBy: { openedAt: "desc" } })
        : null;
    const refund = await tx.refund.create({
      data: { orderId: order.id, method: p.method, amount, reason: p.reason, shiftId: shift?.id ?? null, userId: p.userId },
    });
    await audit(tx, {
      outletId: order.outletId,
      userId: p.userId,
      action: "REFUND",
      orderId: order.id,
      message: `Refund ${formatRupiah(amount)} via ${p.method} untuk pesanan #${order.queueNumber}: ${p.reason}`,
      detail: { refundId: refund.id, amount, method: p.method, shiftId: shift?.id ?? null },
    });
    return recalcPaymentTx(tx, order.id);
  });
  publishPayment(r.order.outletId, r.order.id);
  return r.order;
}

/** Pesanan outlet yang uangnya harus dikembalikan ke customer */
export async function ordersNeedingRefund(outletId: string) {
  const orders = await db.order.findMany({
    where: {
      outletId,
      paymentStatus: { not: "REFUNDED" },
      payments: { some: { state: "SUCCESS" } },
      OR: [{ status: "CANCELLED" }, { paymentStatus: "PAID" }],
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    include: { payments: { where: { state: "SUCCESS" } }, refunds: true, table: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return orders
    .map((o) => ({ order: o, money: moneyState(o) }))
    .filter((x) => x.money.refundDue > 0);
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
    const changed = await db.$transaction(async (tx) => {
      await lockOrder(tx, o.id);
      const cur = await tx.order.findUnique({ where: { id: o.id } });
      if (!cur || cur.status !== "PENDING" || cur.paymentStatus !== "UNPAID") return false;
      await tx.order.update({
        where: { id: o.id },
        data: { status: "CANCELLED", cancelReason: "Pembayaran online tidak diselesaikan" },
      });
      await tx.payment.updateMany({ where: { orderId: o.id, state: "PENDING" }, data: { state: "EXPIRED" } });
      return true;
    });
    if (changed) notifyOrder(outletId, o.id, "CANCELLED");
  }
  return stale.length;
}

export { OrderError };
