import { describe, expect, it } from "vitest";
import type { OrderItemStatus, OrderStatus } from "@prisma/client";
import {
  FlowError,
  ITEM_STATUSES,
  ORDER_TRANSITIONS,
  assertItemChange,
  canItemTransition,
  deriveOrderStatus,
  itemChangesForOrderAction,
  itemProgress,
  itemStampsFor,
  itemStatusLabel,
  orderStampsFor,
} from "@/lib/order-flow";

const items = (...s: OrderItemStatus[]) => s.map((status, i) => ({ id: `i${i}`, status }));
/** Terapkan hasil aksi level pesanan ke daftar item */
const apply = (list: { id: string; status: OrderItemStatus }[], changes: { id: string; to: OrderItemStatus }[]) =>
  list.map((i) => ({ ...i, status: changes.find((c) => c.id === i.id)?.to ?? i.status }));

describe("deriveOrderStatus: status pesanan selalu turunan dari item", () => {
  it("semua antre → Diterima", () => {
    expect(deriveOrderStatus("CONFIRMED", items("QUEUED", "QUEUED"))).toBe("CONFIRMED");
  });
  it("satu item mulai dibuat → Dimasak", () => {
    expect(deriveOrderStatus("CONFIRMED", items("PREPARING", "QUEUED"))).toBe("PREPARING");
  });
  it("satu siap, satu masih antre → tetap Dimasak (bukan Siap)", () => {
    expect(deriveOrderStatus("CONFIRMED", items("READY", "QUEUED"))).toBe("PREPARING");
  });
  it("satu sudah diantar, satu masih antre → Dimasak", () => {
    expect(deriveOrderStatus("PREPARING", items("SERVED", "QUEUED"))).toBe("PREPARING");
  });
  it("Siap hanya bila SEMUA item siap/diantar", () => {
    expect(deriveOrderStatus("PREPARING", items("READY", "READY"))).toBe("READY");
    expect(deriveOrderStatus("PREPARING", items("READY", "SERVED"))).toBe("READY");
    expect(deriveOrderStatus("PREPARING", items("READY", "PREPARING"))).toBe("PREPARING");
  });
  it("Selesai hanya bila SEMUA item diantar", () => {
    expect(deriveOrderStatus("READY", items("SERVED", "SERVED"))).toBe("COMPLETED");
    expect(deriveOrderStatus("READY", items("SERVED", "READY"))).toBe("READY");
  });
  it("item mundur menurunkan status pesanan (koreksi salah tekan)", () => {
    expect(deriveOrderStatus("READY", items("READY", "PREPARING"))).toBe("PREPARING");
    expect(deriveOrderStatus("PREPARING", items("QUEUED", "QUEUED"))).toBe("CONFIRMED");
  });
  it("item baru (antre) di pesanan yang sudah siap → kembali Dimasak", () => {
    expect(deriveOrderStatus("READY", items("READY", "READY", "QUEUED"))).toBe("PREPARING");
  });
  it("PENDING & CANCELLED tidak pernah diubah oleh status item", () => {
    expect(deriveOrderStatus("PENDING", items("READY"))).toBe("PENDING");
    expect(deriveOrderStatus("CANCELLED", items("SERVED"))).toBe("CANCELLED");
  });
  it("pesanan tanpa item dibiarkan", () => {
    expect(deriveOrderStatus("PREPARING", [])).toBe("PREPARING");
  });
  it("tabel lengkap: setiap kombinasi 2 item menghasilkan status yang konsisten", () => {
    for (const a of ITEM_STATUSES)
      for (const b of ITEM_STATUSES) {
        const s = deriveOrderStatus("CONFIRMED", items(a, b));
        const st = [a, b];
        if (st.every((x) => x === "SERVED")) expect(s).toBe("COMPLETED");
        else if (st.every((x) => x === "READY" || x === "SERVED")) expect(s).toBe("READY");
        else if (st.every((x) => x === "QUEUED")) expect(s).toBe("CONFIRMED");
        else expect(s).toBe("PREPARING");
      }
  });
});

describe("transisi item", () => {
  it("maju satu langkah, Antre bisa langsung Siap, mundur satu langkah", () => {
    expect(canItemTransition("QUEUED", "PREPARING")).toBe(true);
    expect(canItemTransition("QUEUED", "READY")).toBe(true);
    expect(canItemTransition("PREPARING", "READY")).toBe(true);
    expect(canItemTransition("READY", "SERVED")).toBe(true);
    expect(canItemTransition("SERVED", "READY")).toBe(true);
    expect(canItemTransition("READY", "PREPARING")).toBe(true);
    expect(canItemTransition("PREPARING", "QUEUED")).toBe(true);
  });
  it("tidak boleh melompat sembarangan", () => {
    expect(canItemTransition("QUEUED", "SERVED")).toBe(false);
    expect(canItemTransition("PREPARING", "SERVED")).toBe(false);
    expect(canItemTransition("SERVED", "QUEUED")).toBe(false);
    expect(canItemTransition("READY", "QUEUED")).toBe(false);
  });
  it("item tidak bisa diubah saat pesanan menunggu, batal, atau selesai", () => {
    for (const o of ["PENDING", "CANCELLED", "COMPLETED"] as OrderStatus[]) {
      expect(() => assertItemChange(o, "QUEUED", "PREPARING")).toThrow(FlowError);
    }
    expect(assertItemChange("CONFIRMED", "QUEUED", "PREPARING")).toBe(true);
    expect(assertItemChange("READY", "READY", "SERVED")).toBe(true);
  });
  it("perubahan ke status yang sama tidak dihitung (aman bila tombol ditekan dua kali)", () => {
    expect(assertItemChange("PREPARING", "READY", "READY")).toBe(false);
  });
});

describe("aksi level pesanan mengubah semua item terkait", () => {
  it("Mulai semua: hanya item Antre yang mulai, item siap tidak mundur", () => {
    const list = items("QUEUED", "READY", "QUEUED");
    const ch = itemChangesForOrderAction("PREPARING", "PREPARING", list);
    expect(ch).toEqual([]); // sudah PREPARING → tidak ada aksi maju dari PREPARING ke PREPARING
    const ch2 = itemChangesForOrderAction("CONFIRMED", "PREPARING", items("QUEUED", "QUEUED"));
    expect(ch2.map((c) => c.to)).toEqual(["PREPARING", "PREPARING"]);
  });
  it("Tandai siap: semua item yang belum siap jadi Siap, yang sudah diantar tetap", () => {
    const list = items("QUEUED", "PREPARING", "SERVED");
    const next = apply(list, itemChangesForOrderAction("PREPARING", "READY", list));
    expect(next.map((i) => i.status)).toEqual(["READY", "READY", "SERVED"]);
    expect(deriveOrderStatus("PREPARING", next)).toBe("READY");
  });
  it("Sudah diantar: semua item jadi Diantar → pesanan Selesai", () => {
    const list = items("READY", "SERVED");
    const next = apply(list, itemChangesForOrderAction("READY", "COMPLETED", list));
    expect(deriveOrderStatus("READY", next)).toBe("COMPLETED");
  });
  it("Langsung selesai dari Diterima (mis. minuman diberikan di counter)", () => {
    const list = items("QUEUED", "QUEUED");
    const next = apply(list, itemChangesForOrderAction("CONFIRMED", "COMPLETED", list));
    expect(deriveOrderStatus("CONFIRMED", next)).toBe("COMPLETED");
  });
  it("Kembalikan dari Siap: item siap kembali Disiapkan, yang sudah diantar tetap", () => {
    const list = items("READY", "SERVED");
    const next = apply(list, itemChangesForOrderAction("READY", "PREPARING", list));
    expect(next.map((i) => i.status)).toEqual(["PREPARING", "SERVED"]);
    expect(deriveOrderStatus("READY", next)).toBe("PREPARING");
  });
  it("Kembalikan ke antrean ditolak bila ada item yang sudah siap (tidak menghapus progres diam-diam)", () => {
    expect(() => itemChangesForOrderAction("PREPARING", "CONFIRMED", items("READY", "PREPARING"))).toThrow(FlowError);
    const list = items("PREPARING", "QUEUED");
    const next = apply(list, itemChangesForOrderAction("PREPARING", "CONFIRMED", list));
    expect(deriveOrderStatus("PREPARING", next)).toBe("CONFIRMED");
  });
  it("Konfirmasi pesanan PENDING tidak mengubah item", () => {
    expect(itemChangesForOrderAction("PENDING", "CONFIRMED", items("QUEUED"))).toEqual([]);
  });
  it("setiap aksi yang diizinkan menghasilkan status pesanan yang sama dengan targetnya", () => {
    const samples: OrderItemStatus[][] = [
      ["QUEUED", "QUEUED"],
      ["PREPARING", "QUEUED"],
      ["READY", "PREPARING"],
      ["READY", "SERVED"],
      ["READY", "READY"],
    ];
    for (const s of samples) {
      const list = items(...s);
      const current = deriveOrderStatus("CONFIRMED", list);
      for (const target of ORDER_TRANSITIONS[current]) {
        if (target === "CANCELLED") continue;
        let changes;
        try {
          changes = itemChangesForOrderAction(current, target, list);
        } catch (e) {
          expect(e).toBeInstanceOf(FlowError);
          continue;
        }
        expect(deriveOrderStatus(current, apply(list, changes))).toBe(target);
      }
    }
  });
});

describe("cap waktu", () => {
  const t0 = new Date("2026-11-18T07:00:00Z");
  const now = new Date("2026-11-18T07:10:00Z");
  it("maju mengisi cap yang kosong tanpa menimpa yang sudah ada", () => {
    expect(orderStampsFor("CONFIRMED", "READY", { confirmedAt: t0, preparingAt: null, readyAt: null, completedAt: null }, now)).toEqual({
      preparingAt: now,
      readyAt: now,
    });
  });
  it("mundur mengosongkan cap tahap yang dibatalkan", () => {
    expect(orderStampsFor("READY", "PREPARING", { confirmedAt: t0, preparingAt: t0, readyAt: t0, completedAt: null }, now)).toEqual({ readyAt: null });
  });
  it("batal tidak menyentuh cap", () => {
    expect(orderStampsFor("PREPARING", "CANCELLED", { confirmedAt: t0, preparingAt: t0, readyAt: null, completedAt: null }, now)).toEqual({});
  });
  it("cap item: Antre → Siap mengisi mulai & siap; Siap → Disiapkan menghapus siap", () => {
    expect(itemStampsFor("READY", { startedAt: null, readyAt: null, servedAt: null }, now)).toEqual({ startedAt: now, readyAt: now });
    expect(itemStampsFor("PREPARING", { startedAt: t0, readyAt: t0, servedAt: null }, now)).toEqual({ readyAt: null });
    expect(itemStampsFor("QUEUED", { startedAt: t0, readyAt: null, servedAt: null }, now)).toEqual({ startedAt: null });
  });
});

describe("tampilan", () => {
  it("progres '1 dari 2 siap' & item yang perlu diantar", () => {
    expect(itemProgress(items("READY", "PREPARING"))).toMatchObject({ total: 2, done: 1, toServe: 1, partial: true });
    expect(itemProgress(items("SERVED", "READY"))).toMatchObject({ done: 2, toServe: 1, served: 1, partial: false });
  });
  it("label Diantar jadi Diambil untuk takeaway", () => {
    expect(itemStatusLabel("SERVED", "DINE_IN")).toBe("Diantar");
    expect(itemStatusLabel("SERVED", "TAKEAWAY")).toBe("Diambil");
  });
});
