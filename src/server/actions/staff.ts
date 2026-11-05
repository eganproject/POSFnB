"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { assertUser, canAccessOutlet, getActiveOutlet } from "@/lib/session";
import { channels, publish } from "@/lib/events";
import { OrderError, cartLineSchema, computeTotals } from "@/server/pricing";
import { addManualPayment, createGatewayPayment, createOrder, setOrderStatus } from "@/server/orders";
import { isMidtransEnabled } from "@/server/midtrans";
import { shiftSummary } from "@/server/reports";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof OrderError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Data tidak valid." };
  if (e instanceof Error && /akses|Sesi/.test(e.message)) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "Terjadi kesalahan. Coba lagi." };
}

async function ctx(roles?: Parameters<typeof assertUser>[0]) {
  const user = await assertUser(roles);
  const outlet = await getActiveOutlet();
  if (!outlet) throw new OrderError("Outlet belum dipilih.");
  if (!canAccessOutlet(user, outlet.id)) throw new OrderError("Anda tidak punya akses ke outlet ini.");
  return { user, outlet };
}

async function openShiftFor(userId: string, outletId: string) {
  return db.shift.findFirst({ where: { userId, outletId, closedAt: null }, orderBy: { openedAt: "desc" } });
}

// ───────── Status pesanan ─────────

export async function updateOrderStatus(orderId: string, status: OrderStatus, reason?: string): Promise<Result> {
  try {
    const roles = status === "CANCELLED" ? (["OWNER", "KASIR", "PELAYAN"] as const) : undefined;
    const { user, outlet } = await ctx(roles ? [...roles] : undefined);
    await setOrderStatus(orderId, status, { role: user.role, reason, outletId: outlet.id });
    revalidatePath("/dashboard/orders");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleItemDone(itemId: string, done: boolean): Promise<Result> {
  try {
    const { outlet } = await ctx(["OWNER", "KASIR", "DAPUR"]);
    const item = await db.orderItem.findUnique({ where: { id: itemId }, include: { order: true } });
    if (!item || item.order.outletId !== outlet.id) throw new OrderError("Item tidak ditemukan.");
    await db.orderItem.update({ where: { id: itemId }, data: { isDone: done } });
    publish(channels.outlet(outlet.id), { type: "order.updated", orderId: item.orderId });
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function resolveRequest(requestId: string): Promise<Result> {
  try {
    const { outlet } = await ctx();
    await db.serviceRequest.updateMany({ where: { id: requestId, outletId: outlet.id }, data: { resolvedAt: new Date() } });
    publish(channels.outlet(outlet.id), { type: "request.resolved", requestId });
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleSoldOut(productId: string, soldOut: boolean): Promise<Result> {
  try {
    const { outlet } = await ctx();
    if (soldOut) {
      await db.productUnavailable.upsert({
        where: { outletId_productId: { outletId: outlet.id, productId } },
        create: { outletId: outlet.id, productId },
        update: {},
      });
    } else {
      await db.productUnavailable.deleteMany({ where: { outletId: outlet.id, productId } });
    }
    publish(channels.outlet(outlet.id), { type: "menu.updated" });
    revalidatePath("/dashboard/stock");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

// ───────── POS ─────────

const posOrderSchema = z.object({
  type: z.enum(["DINE_IN", "TAKEAWAY"]),
  tableId: z.string().nullable().optional(),
  customerName: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
  discount: z.number().int().min(0).default(0),
  lines: z.array(cartLineSchema).min(1, "Keranjang masih kosong."),
});

export async function createPosOrder(input: z.input<typeof posOrderSchema>): Promise<Result<{ orderId: string; total: number }>> {
  try {
    const { user, outlet } = await ctx(["OWNER", "KASIR", "PELAYAN"]);
    const data = posOrderSchema.parse(input);
    if (data.discount > 0 && user.role === "PELAYAN") throw new OrderError("Pelayan tidak bisa memberi diskon.");
    if (data.type === "DINE_IN" && !data.tableId) throw new OrderError("Pilih meja untuk pesanan dine-in.");
    const order = await createOrder({
      outletId: outlet.id,
      tableId: data.type === "DINE_IN" ? data.tableId : null,
      type: data.type,
      source: "POS",
      lines: data.lines,
      customerName: data.customerName,
      note: data.note,
      cashierId: user.id,
      discount: data.discount,
    });
    return { ok: true, data: { orderId: order.id, total: order.total } };
  } catch (e) {
    return fail(e);
  }
}

const paySchema = z.object({
  orderId: z.string(),
  method: z.enum(["CASH", "QRIS_STATIC", "CARD", "TRANSFER"]),
  amount: z.number().int().positive(),
  cashReceived: z.number().int().nullable().optional(),
  reference: z.string().max(60).nullable().optional(),
  label: z.string().max(40).nullable().optional(),
  items: z.array(z.object({ itemId: z.string(), quantity: z.number().int().positive() })).optional(),
});

export async function payOrder(input: z.input<typeof paySchema>): Promise<Result<{ paid: boolean; change: number }>> {
  try {
    const { user, outlet } = await ctx(["OWNER", "KASIR"]);
    const data = paySchema.parse(input);
    const order = await db.order.findUnique({ where: { id: data.orderId } });
    if (!order || order.outletId !== outlet.id) throw new OrderError("Pesanan tidak ditemukan.");
    const shift = await openShiftFor(user.id, outlet.id);
    if (!shift) throw new OrderError("Buka shift kasir terlebih dahulu.");
    const updated = await addManualPayment({ ...data, shiftId: shift.id, userId: user.id });
    // Pesanan QR "bayar di kasir" yang dibayar otomatis masuk dapur (lihat recalcPayment)
    revalidatePath("/pos");
    return {
      ok: true,
      data: { paid: updated?.paymentStatus === "PAID", change: data.method === "CASH" ? (data.cashReceived ?? data.amount) - data.amount : 0 },
    };
  } catch (e) {
    return fail(e);
  }
}

export async function startStaffOnlinePayment(
  orderId: string,
  amount?: number,
  label?: string
): Promise<Result<{ paymentId: string; token: string; demo: boolean; redirectUrl: string | null }>> {
  try {
    const { user, outlet } = await ctx(["OWNER", "KASIR"]);
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order || order.outletId !== outlet.id) throw new OrderError("Pesanan tidak ditemukan.");
    const shift = await openShiftFor(user.id, outlet.id);
    if (!shift) throw new OrderError("Buka shift kasir terlebih dahulu.");
    const p = await createGatewayPayment({ orderId, amount, label, shiftId: shift.id, userId: user.id });
    return { ok: true, data: { paymentId: p.id, token: p.snapToken!, demo: !isMidtransEnabled(), redirectUrl: p.snapRedirectUrl } };
  } catch (e) {
    return fail(e);
  }
}

// ───────── Shift ─────────

export async function openShift(openingCash: number): Promise<Result> {
  try {
    const { user, outlet } = await ctx(["OWNER", "KASIR"]);
    if (await openShiftFor(user.id, outlet.id)) throw new OrderError("Shift Anda masih terbuka.");
    if (!Number.isFinite(openingCash) || openingCash < 0) throw new OrderError("Modal awal tidak valid.");
    await db.shift.create({ data: { outletId: outlet.id, userId: user.id, openingCash: Math.round(openingCash) } });
    revalidatePath("/pos");
    revalidatePath("/dashboard/shifts");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function closeShift(closingCash: number, note?: string): Promise<Result<{ shiftId: string }>> {
  try {
    const { user, outlet } = await ctx(["OWNER", "KASIR"]);
    const shift = await openShiftFor(user.id, outlet.id);
    if (!shift) throw new OrderError("Tidak ada shift yang terbuka.");
    const summary = await shiftSummary(shift.id);
    await db.shift.update({
      where: { id: shift.id },
      data: { closedAt: new Date(), closingCash: Math.round(closingCash), expectedCash: summary?.expectedCash ?? shift.openingCash, note: note || null },
    });
    revalidatePath("/pos");
    revalidatePath("/dashboard/shifts");
    return { ok: true, data: { shiftId: shift.id } };
  } catch (e) {
    return fail(e);
  }
}

// ───────── Data untuk dialog pembayaran ─────────

export async function getOrderForPayment(orderId: string) {
  const { outlet } = await ctx(["OWNER", "KASIR", "PELAYAN"]);
  const o = await db.order.findFirst({
    where: { id: orderId, outletId: outlet.id },
    include: { items: { orderBy: { id: "asc" } }, payments: { orderBy: { createdAt: "asc" } }, table: { select: { name: true } } },
  });
  if (!o) return null;
  const paid = o.payments.filter((p) => p.state === "SUCCESS").reduce((s, p) => s + p.amount, 0);
  return {
    id: o.id,
    code: o.code,
    queueNumber: o.queueNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    tableName: o.table?.name ?? null,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    subtotal: o.subtotal,
    discount: o.discount,
    serviceCharge: o.serviceCharge,
    tax: o.tax,
    total: o.total,
    paid,
    remaining: Math.max(0, o.total - paid),
    successCount: o.payments.filter((p) => p.state === "SUCCESS").length,
    items: o.items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      paidQty: i.paidQty,
      unitPrice: i.unitPrice,
      modifiers: (i.modifiers as { option: string }[]).map((m) => m.option),
    })),
    payments: o.payments.map((p) => ({ id: p.id, method: p.method, amount: p.amount, state: p.state, label: p.label, changeAmount: p.changeAmount })),
  };
}
export type PaymentOrder = NonNullable<Awaited<ReturnType<typeof getOrderForPayment>>>;

// ───────── Bayar gabungan per meja ─────────

const tablePaySchema = z.object({
  orderIds: z.array(z.string()).min(1).max(30),
  method: z.enum(["CASH", "QRIS_STATIC", "CARD", "TRANSFER"]),
  cashReceived: z.number().int().nullable().optional(),
  reference: z.string().max(60).nullable().optional(),
});

export async function payOrdersTogether(input: z.input<typeof tablePaySchema>): Promise<Result<{ change: number; total: number }>> {
  try {
    const { user, outlet } = await ctx(["OWNER", "KASIR"]);
    const data = tablePaySchema.parse(input);
    const shift = await openShiftFor(user.id, outlet.id);
    if (!shift) throw new OrderError("Buka shift kasir terlebih dahulu.");
    const orders = await db.order.findMany({
      where: { id: { in: data.orderIds }, outletId: outlet.id, status: { not: "CANCELLED" } },
      include: { payments: { where: { state: "SUCCESS" } } },
      orderBy: { createdAt: "asc" },
    });
    const due = orders
      .map((o) => ({ id: o.id, remaining: o.total - o.payments.reduce((s, p) => s + p.amount, 0) }))
      .filter((o) => o.remaining > 0);
    if (!due.length) throw new OrderError("Semua tagihan sudah lunas.");
    const total = due.reduce((s, o) => s + o.remaining, 0);
    const cash = data.method === "CASH" ? data.cashReceived ?? total : null;
    if (cash !== null && cash < total) throw new OrderError("Uang diterima kurang dari total tagihan.");
    const change = cash !== null ? cash - total : 0;
    for (const [i, o] of due.entries()) {
      const last = i === due.length - 1;
      await addManualPayment({
        orderId: o.id,
        method: data.method,
        amount: o.remaining,
        // Kembalian dicatat di pesanan terakhir agar rekap kas tetap akurat
        cashReceived: cash !== null ? o.remaining + (last ? change : 0) : null,
        reference: data.reference ?? null,
        label: due.length > 1 ? "Gabungan meja" : null,
        shiftId: shift.id,
        userId: user.id,
      });
    }
    revalidatePath("/pos");
    return { ok: true, data: { change, total } };
  } catch (e) {
    return fail(e);
  }
}

// ───────── Ubah item pesanan (sebelum dibayar) ─────────

export async function adjustOrderItem(itemId: string, quantity: number): Promise<Result> {
  try {
    const { outlet } = await ctx(["OWNER", "KASIR"]);
    const item = await db.orderItem.findUnique({ where: { id: itemId }, include: { order: { include: { items: true, outlet: true } } } });
    const order = item?.order;
    if (!item || !order || order.outletId !== outlet.id) throw new OrderError("Item tidak ditemukan.");
    if (order.paymentStatus !== "UNPAID") throw new OrderError("Pesanan yang sudah dibayar (sebagian) tidak bisa diubah.");
    if (["COMPLETED", "CANCELLED"].includes(order.status)) throw new OrderError("Pesanan sudah selesai / dibatalkan.");
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > item.quantity) throw new OrderError("Jumlah tidak valid.");
    if (quantity === 0 && order.items.length === 1) throw new OrderError("Ini item terakhir. Batalkan pesanan jika tidak jadi.");
    await db.$transaction(async (tx) => {
      if (quantity === 0) await tx.orderItem.delete({ where: { id: itemId } });
      else await tx.orderItem.update({ where: { id: itemId }, data: { quantity, lineTotal: item.unitPrice * quantity } });
      const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
      await tx.order.update({ where: { id: order.id }, data: computeTotals(subtotal, order.outlet, order.discount) });
      // Transaksi online lama nominalnya sudah tidak cocok
      await tx.payment.updateMany({ where: { orderId: order.id, state: "PENDING" }, data: { state: "FAILED" } });
    });
    publish(channels.outlet(outlet.id), { type: "order.updated", orderId: order.id });
    publish(channels.order(order.id), { type: "order.updated", orderId: order.id });
    revalidatePath("/dashboard/orders");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
