/**
 * Tes integrasi pembayaran Core API (mode demo, tanpa key Midtrans) ke database sungguhan.
 * Jalankan dengan database lokal yang sudah di-seed:  TEST_DATABASE=1 pnpm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { applyGatewayState, createGatewayPayment, createOrder, setOrderStatus } from "@/server/orders";
import { invalidateAppConfig } from "@/server/settings";

const enabled = process.env.TEST_DATABASE === "1";

describe.skipIf(!enabled)("pembayaran Core API (database)", () => {
  let outletId = "";
  let productId = "";
  let before: { midtransMode: string | null; midtransCoreChannels: string[] } | null = null;

  const setMode = async (mode: string | null, channels: string[] = []) => {
    await db.appSettings.upsert({
      where: { id: 1 },
      create: { id: 1, midtransMode: mode, midtransCoreChannels: channels },
      update: { midtransMode: mode, midtransCoreChannels: channels },
    });
    invalidateAppConfig();
  };

  beforeAll(async () => {
    const row = await db.appSettings.findUnique({ where: { id: 1 } });
    before = row ? { midtransMode: row.midtransMode, midtransCoreChannels: row.midtransCoreChannels } : null;
    const outlet = await db.outlet.findFirstOrThrow({ where: { isActive: true } });
    outletId = outlet.id;
    const product = await db.product.findFirstOrThrow({ where: { isActive: true, modifierGroups: { none: { minSelect: { gt: 0 } } }, unavailable: { none: {} } } });
    productId = product.id;
    await setMode("core", ["qris", "gopay", "shopeepay", "bni_va", "mandiri_bill"]);
  });
  afterAll(async () => {
    await setMode(before?.midtransMode ?? null, before?.midtransCoreChannels ?? []);
    await db.$disconnect();
  });

  const newOrder = (qty = 2) =>
    createOrder({ outletId, type: "TAKEAWAY", source: "QR", payPreference: "MIDTRANS", lines: [{ productId, quantity: qty, optionIds: [] }] });

  it("mode Core API wajib memilih kanal yang diizinkan", async () => {
    const order = await newOrder();
    await expect(createGatewayPayment({ orderId: order.id })).rejects.toThrow(/Pilih metode/);
    await expect(createGatewayPayment({ orderId: order.id, channel: "bca_va" })).rejects.toThrow(/tidak tersedia/);
  });

  it("membuat tagihan QRIS dengan data tampilan & batas waktu, dan memakai ulang bila diminta lagi", async () => {
    const order = await newOrder();
    const p1 = await createGatewayPayment({ orderId: order.id, channel: "qris" });
    expect(p1.gatewayMode).toBe("core");
    expect(p1.gatewayChannel).toBe("qris");
    expect(p1.gatewayAction).toMatchObject({ channel: "qris", demo: true });
    expect(p1.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 10 * 60_000);
    const p2 = await createGatewayPayment({ orderId: order.id, channel: "qris" });
    expect(p2.id).toBe(p1.id);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("klik bersamaan tidak membuat tagihan ganda", async () => {
    const order = await newOrder();
    const results = await Promise.all([1, 2, 3].map(() => createGatewayPayment({ orderId: order.id, channel: "bni_va" })));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    const rows = await db.payment.findMany({ where: { orderId: order.id } });
    expect(rows).toHaveLength(1);
    expect((rows[0].gatewayAction as { vaNumber?: string }).vaNumber).toMatch(/^\d{16}$/);
  });

  it("ganti metode: satu order_id per percobaan, percobaan lama dibatalkan", async () => {
    const order = await newOrder();
    const qris = await createGatewayPayment({ orderId: order.id, channel: "qris" });
    const va = await createGatewayPayment({ orderId: order.id, channel: "mandiri_bill" });
    expect(va.id).not.toBe(qris.id);
    expect(va.gatewayOrderId).not.toBe(qris.gatewayOrderId);
    const rows = await db.payment.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.state)).toEqual(["FAILED", "PENDING"]);
    expect(rows.filter((r) => r.state === "PENDING")).toHaveLength(1);

    // Pembayaran untuk tagihan baru melunasi pesanan & meneruskan ke dapur
    await applyGatewayState(va.id, "SUCCESS", { simulated: true }, "echannel", "mandiri_bill");
    let o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.paymentStatus).toBe("PAID");
    expect(o.status).toBe("CONFIRMED");

    // Tagihan lama ternyata tetap dibayar → tercatat, lebih bayar masuk log untuk direfund
    await applyGatewayState(qris.id, "SUCCESS", { simulated: true }, "qris", "qris");
    const audit = await db.auditLog.findFirst({ where: { orderId: order.id, action: "OVERPAID" } });
    expect(audit).not.toBeNull();
    o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.paymentStatus).toBe("PAID");
  });

  it("notifikasi berulang tidak dicatat dua kali", async () => {
    const order = await newOrder();
    const p = await createGatewayPayment({ orderId: order.id, channel: "gopay" });
    await Promise.all([1, 2, 3].map(() => applyGatewayState(p.id, "SUCCESS", { simulated: true }, "gopay", "gopay")));
    const ok = await db.payment.findMany({ where: { orderId: order.id, state: "SUCCESS" } });
    expect(ok).toHaveLength(1);
    // Status gagal yang datang belakangan tidak membatalkan pembayaran sukses
    await applyGatewayState(p.id, "EXPIRED");
    expect((await db.payment.findUniqueOrThrow({ where: { id: p.id } })).state).toBe("SUCCESS");
  });

  it("split bill per item lewat online menandai item lunas saat berhasil", async () => {
    const order = await newOrder(3);
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const amount = Math.round(order.total / 3);
    const p = await createGatewayPayment({ orderId: order.id, channel: "qris", amount, splitItems: [{ itemId: item.id, quantity: 1 }] });
    expect(p.splitItems).toEqual([{ itemId: item.id, quantity: 1 }]);
    // Item yang sama tapi jumlah berbeda = tagihan lain
    const p2 = await createGatewayPayment({ orderId: order.id, channel: "qris", amount, splitItems: [{ itemId: item.id, quantity: 2 }] });
    expect(p2.id).not.toBe(p.id);
    await applyGatewayState(p2.id, "SUCCESS", { simulated: true }, "qris");
    expect((await db.orderItem.findUniqueOrThrow({ where: { id: item.id } })).paidQty).toBe(2);
    await expect(
      createGatewayPayment({ orderId: order.id, channel: "qris", amount: 1000, splitItems: [{ itemId: item.id, quantity: 2 }] })
    ).rejects.toThrow(/split bill tidak valid/);
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.paymentStatus).toBe("PARTIAL");
  });

  it("pesanan dibatalkan membatalkan tagihan Core API yang masih pending", async () => {
    const order = await newOrder();
    const p = await createGatewayPayment({ orderId: order.id, channel: "shopeepay" });
    await setOrderStatus(order.id, "CANCELLED", { role: "KASIR", reason: "tes batal" });
    expect((await db.payment.findUniqueOrThrow({ where: { id: p.id } })).state).toBe("FAILED");
    await expect(createGatewayPayment({ orderId: order.id, channel: "qris" })).rejects.toThrow(/dibatalkan/);
  });

  it("mode Snap tetap berjalan seperti sebelumnya", async () => {
    await setMode("snap", []);
    const order = await newOrder();
    const p = await createGatewayPayment({ orderId: order.id });
    expect(p.gatewayMode).toBe("snap");
    expect(p.snapToken).toMatch(/^demo-/);
    expect((await createGatewayPayment({ orderId: order.id })).id).toBe(p.id);
    const order2 = await newOrder();
    const many = await Promise.all([1, 2, 3].map(() => createGatewayPayment({ orderId: order2.id })));
    expect(new Set(many.map((m) => m.id)).size).toBe(1);
    expect(await db.payment.count({ where: { orderId: order2.id, state: "PENDING" } })).toBe(1);
    await setMode("core", ["qris", "gopay", "shopeepay", "bni_va", "mandiri_bill"]);
  });
});
