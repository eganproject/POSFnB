import { describe, expect, it } from "vitest";
import { addLine, estimateTotals, lineKey, setLineQty, type CartLine } from "@/lib/cart";
import { quickCash, splitAmount, type SplitOrder } from "@/lib/payment-math";

describe("estimateTotals", () => {
  it("menghitung service lalu pajak di atas service", () => {
    expect(estimateTotals(36000, { taxRate: 10, serviceRate: 5 })).toEqual({
      subtotal: 36000, discount: 0, serviceCharge: 1800, tax: 3780, total: 41580,
    });
  });
  it("diskon mengurangi dasar pajak & tidak melebihi subtotal", () => {
    expect(estimateTotals(50000, { taxRate: 10, serviceRate: 0 }, 10000).total).toBe(44000);
    expect(estimateTotals(20000, { taxRate: 10, serviceRate: 0 }, 99999)).toMatchObject({ discount: 20000, total: 0 });
  });
  it("diskon negatif diabaikan", () => {
    expect(estimateTotals(10000, { taxRate: 0, serviceRate: 0 }, -500).total).toBe(10000);
  });
});

describe("keranjang", () => {
  const line = (q = 1, opts: string[] = []): CartLine => ({
    key: lineKey("p1", opts, ""), productId: "p1", name: "Kopi", unitPrice: 20000, quantity: q, optionIds: opts, modifiers: [], note: "",
  });
  it("menggabungkan item dengan varian sama, memisahkan varian berbeda", () => {
    let cart = addLine([], line(1, ["a", "b"]));
    cart = addLine(cart, line(2, ["b", "a"]));
    cart = addLine(cart, line(1, ["c"]));
    expect(cart).toHaveLength(2);
    expect(cart[0].quantity).toBe(3);
  });
  it("qty 0 menghapus item & dibatasi 99", () => {
    const cart = [line(5)];
    expect(setLineQty(cart, cart[0].key, 0)).toHaveLength(0);
    expect(setLineQty(cart, cart[0].key, 500)[0].quantity).toBe(99);
  });
});

describe("split bill", () => {
  const order: SplitOrder = {
    total: 110000, subtotal: 100000, remaining: 110000, successCount: 0,
    items: [
      { id: "a", quantity: 2, paidQty: 0, unitPrice: 30000 },
      { id: "b", quantity: 1, paidQty: 0, unitPrice: 40000 },
    ],
  };
  it("bagi rata, orang terakhir membayar sisa persis", () => {
    const first = splitAmount(order, "equal", 3, {});
    expect(first).toBe(36700);
    const after = { ...order, remaining: order.remaining - first * 2, successCount: 2 };
    expect(splitAmount(after, "equal", 3, {})).toBe(110000 - first * 2);
  });
  it("per item proporsional termasuk pajak", () => {
    expect(splitAmount(order, "items", 2, { a: 1 })).toBe(33000);
  });
  it("memilih semua sisa item = sisa tagihan (tanpa selisih pembulatan)", () => {
    expect(splitAmount(order, "items", 2, { a: 2, b: 1 })).toBe(110000);
  });
  it("tidak ada item dipilih = 0", () => {
    expect(splitAmount(order, "items", 2, {})).toBe(0);
  });
});

describe("quickCash", () => {
  it("menyertakan uang pas & pecahan bulat", () => {
    const opts = quickCash(41580);
    expect(opts[0]).toBe(41580);
    expect(opts).toContain(50000);
    expect(opts.every((v) => v >= 41580)).toBe(true);
  });
});
