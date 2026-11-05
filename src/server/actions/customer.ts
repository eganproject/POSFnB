"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { channels, publish } from "@/lib/events";
import { cartLineSchema, OrderError } from "@/server/pricing";
import { applyGatewayState, createGatewayPayment, createOrder } from "@/server/orders";
import { isMidtransEnabled } from "@/server/midtrans";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof OrderError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Data tidak valid." };
  console.error(e);
  return { ok: false, error: e instanceof Error ? e.message : "Terjadi kesalahan. Coba lagi." };
}

const placeOrderSchema = z.object({
  outletId: z.string().min(1),
  tableToken: z.string().nullable().optional(),
  customerName: z.string().trim().min(1, "Nama wajib diisi.").max(60),
  customerPhone: z.string().trim().max(20).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
  payMethod: z.enum(["ONLINE", "CASHIER"]),
  lines: z.array(cartLineSchema).min(1, "Keranjang masih kosong.").max(50),
});

export async function placeOrder(
  input: z.input<typeof placeOrderSchema>
): Promise<ActionResult<{ orderId: string }>> {
  try {
    const data = placeOrderSchema.parse(input);
    let tableId: string | null = null;
    if (data.tableToken) {
      const table = await db.diningTable.findUnique({ where: { qrToken: data.tableToken } });
      if (!table || !table.isActive || table.outletId !== data.outletId) {
        throw new OrderError("QR meja tidak valid. Silakan scan ulang.");
      }
      tableId = table.id;
    }
    const order = await createOrder({
      outletId: data.outletId,
      tableId,
      type: tableId ? "DINE_IN" : "TAKEAWAY",
      source: "QR",
      lines: data.lines,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      note: data.note,
      payPreference: data.payMethod === "ONLINE" ? "MIDTRANS" : null,
    });
    if (data.payMethod === "ONLINE") {
      try {
        await createGatewayPayment({ orderId: order.id });
      } catch (e) {
        // Pesanan tetap tersimpan; customer bisa coba bayar lagi dari halaman pesanan
        console.error("Gagal membuat transaksi Midtrans", e);
      }
    }
    return { ok: true, data: { orderId: order.id } };
  } catch (e) {
    return fail(e);
  }
}

/** Ambil / buat token Snap untuk sisa tagihan */
export async function startOnlinePayment(
  orderId: string
): Promise<ActionResult<{ paymentId: string; token: string; demo: boolean; redirectUrl: string | null }>> {
  try {
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderError("Pesanan tidak ditemukan.");
    if (order.payPreference !== "MIDTRANS") {
      await db.order.update({ where: { id: orderId }, data: { payPreference: "MIDTRANS" } });
    }
    const payment = await createGatewayPayment({ orderId });
    return {
      ok: true,
      data: {
        paymentId: payment.id,
        token: payment.snapToken!,
        demo: !isMidtransEnabled(),
        redirectUrl: payment.snapRedirectUrl,
      },
    };
  } catch (e) {
    return fail(e);
  }
}

export async function switchToCashier(orderId: string): Promise<ActionResult> {
  try {
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "PENDING") throw new OrderError("Pesanan tidak bisa diubah.");
    await db.order.update({ where: { id: orderId }, data: { payPreference: null } });
    await db.payment.updateMany({ where: { orderId, state: "PENDING", method: "MIDTRANS" }, data: { state: "FAILED" } });
    publish(channels.outlet(order.outletId), { type: "order.updated", orderId });
    publish(channels.order(orderId), { type: "order.updated", orderId });
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** Hanya untuk MODE DEMO (tanpa key Midtrans) */
export async function simulatePayment(paymentId: string, success: boolean): Promise<ActionResult> {
  try {
    if (isMidtransEnabled()) throw new OrderError("Simulasi hanya tersedia di mode demo.");
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.method !== "MIDTRANS") throw new OrderError("Pembayaran tidak ditemukan.");
    await applyGatewayState(paymentId, success ? "SUCCESS" : "FAILED", { simulated: true }, "demo_qris");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function callStaff(
  tableToken: string,
  type: "CALL_WAITER" | "REQUEST_BILL",
  note?: string
): Promise<ActionResult> {
  try {
    const table = await db.diningTable.findUnique({ where: { qrToken: tableToken } });
    if (!table) throw new OrderError("Meja tidak ditemukan.");
    const recent = await db.serviceRequest.findFirst({
      where: { tableId: table.id, type, resolvedAt: null, createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) } },
    });
    if (recent) return { ok: true, data: undefined };
    const req = await db.serviceRequest.create({
      data: { outletId: table.outletId, tableId: table.id, type, note: note?.slice(0, 120) || null },
    });
    publish(channels.outlet(table.outletId), {
      type: "request.created",
      requestId: req.id,
      tableName: table.name,
      kind: type,
    });
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
