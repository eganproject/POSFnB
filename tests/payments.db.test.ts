/**
 * Tes integrasi pembayaran ke database sungguhan.
 * Jalankan dengan database lokal yang sudah di-seed:  TEST_DATABASE=1 pnpm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  addManualPayment,
  applyGatewayState,
  createGatewayPayment,
  createOrder,
  ordersNeedingRefund,
  payOrdersBatch,
  recordRefund,
  setOrderStatus,
} from "@/server/orders";

const enabled = process.env.TEST_DATABASE === "1";

describe.skipIf(!enabled)("pembayaran (database)", () => {
  let outletId = "";
  let productId = "";
  let userId = "";
  let shiftId = "";

  beforeAll(async () => {
    const outlet = await db.outlet.findFirstOrThrow({ where: { isActive: true } });
    outletId = outlet.id;
    const product = await db.product.findFirstOrThrow({ where: { isActive: true, modifierGroups: { none: { minSelect: { gt: 0 } } }, unavailable: { none: {} } } });
    productId = product.id;
    const owner = await db.user.findFirstOrThrow({ where: { role: "OWNER" } });
    userId = owner.id;
    const shift = await db.shift.create({ data: { outletId, userId, openingCash: 0 } });
    shiftId = shift.id;
  });
  afterAll(async () => {
    await db.shift.update({ where: { id: shiftId }, data: { closedAt: new Date() } });
    await db.$disconnect();
  });

  const newOrder = (extra: Partial<Parameters<typeof createOrder>[0]> = {}) =>
    createOrder({ outletId, type: "TAKEAWAY", source: "POS", lines: [{ productId, quantity: 2, optionIds: [] }], ...extra });

  it("dua kasir membayar bersamaan: hanya satu yang tercatat", async () => {
    const order = await newOrder();
    const pay = () => addManualPayment({ orderId: order.id, method: "CASH", amount: order.total, cashReceived: order.total, shiftId, userId });
    const results = await Promise.allSettled([pay(), pay(), pay()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const payments = await db.payment.findMany({ where: { orderId: order.id, state: "SUCCESS" } });
    expect(payments).toHaveLength(1);
  });

  it("bayar gabungan meja: semua atau tidak sama sekali", async () => {
    const a = await newOrder();
    const b = await newOrder();
    await expect(
      payOrdersBatch({ outletId, orderIds: [a.id, b.id], method: "CASH", cashReceived: a.total, shiftId, userId })
    ).rejects.toThrow();
    expect(await db.payment.count({ where: { orderId: { in: [a.id, b.id] } } })).toBe(0);
    const res = await payOrdersBatch({ outletId, orderIds: [a.id, b.id], method: "CASH", cashReceived: a.total + b.total + 5000, shiftId, userId });
    expect(res.change).toBe(5000);
    const orders = await db.order.findMany({ where: { id: { in: [a.id, b.id] } } });
    expect(orders.every((o) => o.paymentStatus === "PAID")).toBe(true);
  });

  it("diskon kasir dibatasi persentase outlet", async () => {
    await expect(newOrder({ discount: 999_999, maxDiscountPercent: 20 })).rejects.toThrow(/maksimal 20%/);
    const owner = await newOrder({ discount: 1000, discountReason: "promo", maxDiscountPercent: null });
    expect(owner.discount).toBe(1000);
    expect(owner.discountReason).toBe("promo");
  });

  it("pesanan lunas yang dibatalkan muncul di refund, lalu beres setelah refund dicatat", async () => {
    const order = await newOrder();
    await addManualPayment({ orderId: order.id, method: "CASH", amount: order.total, cashReceived: order.total, shiftId, userId });
    await expect(setOrderStatus(order.id, "CANCELLED", { role: "KASIR", reason: "x" })).rejects.toThrow(/owner/);
    await setOrderStatus(order.id, "CANCELLED", { role: "OWNER", reason: "Customer batal", userId });
    let due = (await ordersNeedingRefund(outletId)).find((x) => x.order.id === order.id);
    expect(due?.money.refundDue).toBe(order.total);
    await expect(recordRefund({ orderId: order.id, outletId, amount: order.total + 1, method: "CASH", reason: "tes", userId })).rejects.toThrow();
    await recordRefund({ orderId: order.id, outletId, amount: order.total, method: "CASH", reason: "dikembalikan tunai", userId });
    due = (await ordersNeedingRefund(outletId)).find((x) => x.order.id === order.id);
    expect(due).toBeUndefined();
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("REFUNDED");
    expect(await db.auditLog.count({ where: { orderId: order.id, action: { in: ["ORDER_CANCEL", "REFUND"] } } })).toBe(2);
  });

  it("pembayaran online yang masuk telat untuk pesanan batal ditandai perlu refund", async () => {
    const order = await newOrder();
    const p = await createGatewayPayment({ orderId: order.id });
    await setOrderStatus(order.id, "CANCELLED", { role: "KASIR", reason: "tidak jadi", userId });
    // Webhook Midtrans datang belakangan (dua kali, seperti retry)
    await Promise.all([applyGatewayState(p.id, "SUCCESS", { late: true }), applyGatewayState(p.id, "SUCCESS", { late: true })]);
    const due = (await ordersNeedingRefund(outletId)).find((x) => x.order.id === order.id);
    expect(due?.money.refundDue).toBe(order.total);
    expect(await db.auditLog.count({ where: { orderId: order.id, action: "OVERPAID" } })).toBe(1);
  });
});
