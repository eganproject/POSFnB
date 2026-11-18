/**
 * Tes integrasi status per item ke database sungguhan.
 * Jalankan dengan database lokal yang sudah di-migrate & di-seed:
 *   TEST_DATABASE=1 DATABASE_URL=... pnpm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { channels, subscribe, type RealtimeEvent } from "@/lib/events";
import { OrderError, recalcPayment, resyncOrderStatus, setItemStatus, setOrderStatus } from "@/server/orders";

const enabled = process.env.TEST_DATABASE === "1";

describe.skipIf(!enabled)("status per item (database)", () => {
  let outletId = "";
  const created: string[] = [];

  beforeAll(async () => {
    outletId = (await db.outlet.findFirstOrThrow({ where: { isActive: true } })).id;
  });
  afterAll(async () => {
    await db.order.deleteMany({ where: { id: { in: created } } });
    await db.$disconnect();
  });

  async function makeOrder(status: OrderStatus = "CONFIRMED", names = ["Latte", "Croissant"]) {
    const n = Math.floor(Math.random() * 1e9);
    const o = await db.order.create({
      data: {
        code: `T-${n}`,
        queueNumber: 900000 + (n % 99999),
        businessDate: "2099-01-01",
        outletId,
        type: "DINE_IN",
        source: "POS",
        status,
        confirmedAt: status === "PENDING" ? null : new Date(),
        subtotal: names.length * 10000,
        total: names.length * 10000,
        items: { create: names.map((name) => ({ name, unitPrice: 10000, quantity: 1, lineTotal: 10000 })) },
      },
      include: { items: { orderBy: { id: "asc" } } },
    });
    created.push(o.id);
    return o;
  }
  const load = (id: string) => db.order.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { id: "asc" } } } });

  it("item pertama siap duluan: pesanan tetap Dimasak, lalu Siap saat semua siap, Selesai saat semua diantar", async () => {
    const o = await makeOrder();
    const [a, b] = o.items;
    await setItemStatus({ orderId: o.id, itemIds: [a.id], to: "PREPARING" });
    expect((await load(o.id)).status).toBe("PREPARING");
    await setItemStatus({ orderId: o.id, itemIds: [a.id], to: "READY" });
    let cur = await load(o.id);
    expect(cur.status).toBe("PREPARING");
    expect(cur.readyAt).toBeNull();
    expect(cur.items[0]).toMatchObject({ status: "READY" });
    expect(cur.items[0].readyAt).not.toBeNull();
    expect(cur.items[1]).toMatchObject({ status: "QUEUED" });

    // Item siap duluan langsung diantar
    await setItemStatus({ orderId: o.id, itemIds: [a.id], to: "SERVED" });
    expect((await load(o.id)).status).toBe("PREPARING");

    await setItemStatus({ orderId: o.id, itemIds: [b.id], to: "READY" });
    cur = await load(o.id);
    expect(cur.status).toBe("READY");
    expect(cur.readyAt).not.toBeNull();

    await setItemStatus({ orderId: o.id, itemIds: [b.id], to: "SERVED" });
    cur = await load(o.id);
    expect(cur.status).toBe("COMPLETED");
    expect(cur.completedAt).not.toBeNull();

    // Pesanan selesai bersifat final
    await expect(setItemStatus({ orderId: o.id, itemIds: [b.id], to: "READY" })).rejects.toBeInstanceOf(OrderError);
  });

  it("aksi level pesanan menggerakkan semua item & koreksi mundur mengosongkan cap waktu", async () => {
    const o = await makeOrder();
    await setOrderStatus(o.id, "PREPARING");
    let cur = await load(o.id);
    expect(cur.items.map((i) => i.status)).toEqual(["PREPARING", "PREPARING"]);
    await setOrderStatus(o.id, "READY");
    cur = await load(o.id);
    expect(cur.status).toBe("READY");
    expect(cur.items.every((i) => i.status === "READY")).toBe(true);
    await setOrderStatus(o.id, "PREPARING");
    cur = await load(o.id);
    expect(cur.status).toBe("PREPARING");
    expect(cur.readyAt).toBeNull();
    expect(cur.items.every((i) => i.status === "PREPARING" && i.readyAt === null)).toBe(true);
    await setOrderStatus(o.id, "CONFIRMED");
    expect((await load(o.id)).items.every((i) => i.status === "QUEUED" && i.startedAt === null)).toBe(true);
  });

  it("kembali ke antrean ditolak bila sebagian item sudah siap", async () => {
    const o = await makeOrder();
    await setItemStatus({ orderId: o.id, itemIds: [o.items[0].id], to: "READY" });
    await expect(setOrderStatus(o.id, "CONFIRMED")).rejects.toThrow(/sudah siap/);
    expect((await load(o.id)).items[0].status).toBe("READY");
  });

  it("pesanan PENDING (belum bayar/konfirmasi) tidak bisa diproses per item; lunas → Diterima dengan item Antre", async () => {
    const o = await makeOrder("PENDING");
    await expect(setItemStatus({ orderId: o.id, itemIds: [o.items[0].id], to: "PREPARING" })).rejects.toThrow(/belum dikonfirmasi/);
    await db.payment.create({ data: { orderId: o.id, method: "CASH", state: "SUCCESS", amount: o.total } });
    await recalcPayment(o.id);
    const cur = await load(o.id);
    expect(cur.status).toBe("CONFIRMED");
    expect(cur.items.every((i) => i.status === "QUEUED")).toBe(true);
  });

  it("pesanan batal: item tidak bisa diubah lagi", async () => {
    const o = await makeOrder();
    await setItemStatus({ orderId: o.id, itemIds: [o.items[0].id], to: "PREPARING" });
    await setOrderStatus(o.id, "CANCELLED", { reason: "tes" });
    await expect(setItemStatus({ orderId: o.id, itemIds: [o.items[0].id], to: "READY" })).rejects.toThrow(/dibatalkan/);
    expect((await load(o.id)).status).toBe("CANCELLED");
  });

  it("status yang dilihat staf sudah berubah → ditolak, tidak menimpa", async () => {
    const o = await makeOrder();
    await setItemStatus({ orderId: o.id, itemIds: [o.items[0].id], to: "READY", expected: "QUEUED" });
    await expect(setItemStatus({ orderId: o.id, itemIds: [o.items[0].id], to: "PREPARING", expected: "QUEUED" })).rejects.toThrow(/staf lain/);
  });

  it("dua staf menekan bersamaan: hasil akhir tetap konsisten dengan item", async () => {
    const o = await makeOrder("CONFIRMED", ["A", "B", "C", "D"]);
    await Promise.all(o.items.map((i) => setItemStatus({ orderId: o.id, itemIds: [i.id], to: "READY" })));
    const cur = await load(o.id);
    expect(cur.items.every((i) => i.status === "READY")).toBe(true);
    expect(cur.status).toBe("READY");
  });

  it("item yang belum siap dihapus → status pesanan dihitung ulang jadi Siap", async () => {
    const o = await makeOrder();
    await setItemStatus({ orderId: o.id, itemIds: [o.items[0].id], to: "READY" });
    const synced = await db.$transaction(async (tx) => {
      await tx.orderItem.delete({ where: { id: o.items[1].id } });
      return resyncOrderStatus(tx, o.id);
    });
    expect(synced?.status).toBe("READY");
    expect((await load(o.id)).status).toBe("READY");
  });

  it("item siap sebagian mengirim event items.ready ke pelanggan", async () => {
    const o = await makeOrder();
    const events: RealtimeEvent[] = [];
    const off = subscribe(channels.order(o.id), (e) => events.push(e));
    await setItemStatus({ orderId: o.id, itemIds: [o.items[0].id], to: "READY" });
    off();
    const ready = events.find((e) => e.type === "items.ready");
    expect(ready).toMatchObject({ type: "items.ready", allReady: false, items: ["1× Latte"] });
  });
});
