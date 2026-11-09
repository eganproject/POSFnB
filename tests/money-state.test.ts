import { afterEach, describe, expect, it } from "vitest";
import { moneyState } from "@/lib/payment-math";
import { isDemoPaymentAllowed, isOnlinePaymentAvailable } from "@/server/midtrans";

const ok = (amount: number) => ({ state: "SUCCESS", amount });

describe("moneyState", () => {
  it("pesanan normal: lunas, sebagian, belum bayar", () => {
    expect(moneyState({ total: 100, status: "CONFIRMED", paymentStatus: "UNPAID", payments: [], refunds: [] })).toMatchObject({ paymentStatus: "UNPAID", remaining: 100, refundDue: 0 });
    expect(moneyState({ total: 100, status: "CONFIRMED", paymentStatus: "UNPAID", payments: [ok(40), { state: "FAILED", amount: 60 }], refunds: [] })).toMatchObject({ paymentStatus: "PARTIAL", remaining: 60 });
    expect(moneyState({ total: 100, status: "CONFIRMED", paymentStatus: "UNPAID", payments: [ok(100)], refunds: [] })).toMatchObject({ paymentStatus: "PAID", remaining: 0, refundDue: 0 });
  });
  it("pembayaran dobel terdeteksi sebagai lebih bayar", () => {
    const m = moneyState({ total: 100, status: "CONFIRMED", paymentStatus: "PAID", payments: [ok(100), ok(100)], refunds: [] });
    expect(m).toMatchObject({ paymentStatus: "PAID", refundDue: 100 });
    const after = moneyState({ total: 100, status: "CONFIRMED", paymentStatus: "PAID", payments: [ok(100), ok(100)], refunds: [{ amount: 100 }] });
    expect(after).toMatchObject({ paymentStatus: "PAID", refundDue: 0 });
  });
  it("pesanan batal yang sudah dibayar perlu refund, lalu berstatus Refund", () => {
    const m = moneyState({ total: 100, status: "CANCELLED", paymentStatus: "PAID", payments: [ok(100)], refunds: [] });
    expect(m).toMatchObject({ paymentStatus: "PAID", refundDue: 100, remaining: 0 });
    const done = moneyState({ total: 100, status: "CANCELLED", paymentStatus: "PAID", payments: [ok(100)], refunds: [{ amount: 100 }] });
    expect(done).toMatchObject({ paymentStatus: "REFUNDED", refundDue: 0 });
  });
  it("pesanan lama berstatus Refund tanpa catatan dianggap beres", () => {
    expect(moneyState({ total: 100, status: "CANCELLED", paymentStatus: "REFUNDED", payments: [ok(100)], refunds: [] })).toMatchObject({ paymentStatus: "REFUNDED", refundDue: 0 });
  });
  it("pesanan gratis (diskon 100%) dianggap lunas, kecuali dibatalkan", () => {
    expect(moneyState({ total: 0, status: "CONFIRMED", paymentStatus: "UNPAID", payments: [], refunds: [] }).paymentStatus).toBe("PAID");
    expect(moneyState({ total: 0, status: "CANCELLED", paymentStatus: "UNPAID", payments: [], refunds: [] }).paymentStatus).toBe("UNPAID");
  });
});

describe("mode demo pembayaran", () => {
  const env = { ...process.env };
  const set = (vars: Record<string, string | undefined>) => {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
      else (process.env as Record<string, string | undefined>)[k] = v;
    }
  };
  afterEach(() => {
    process.env = { ...env };
  });
  it("aktif saat development tanpa key", () => {
    set({ NODE_ENV: "development", MIDTRANS_SERVER_KEY: undefined, NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: undefined, ALLOW_DEMO_PAYMENT: undefined });
    expect(isDemoPaymentAllowed()).toBe(true);
  });
  it("mati di produksi tanpa key, dan pembayaran online tidak tersedia", () => {
    set({ NODE_ENV: "production", MIDTRANS_SERVER_KEY: undefined, NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: undefined, ALLOW_DEMO_PAYMENT: undefined });
    expect(isDemoPaymentAllowed()).toBe(false);
    expect(isOnlinePaymentAvailable()).toBe(false);
  });
  it("hanya menyala di produksi jika diizinkan eksplisit", () => {
    set({ NODE_ENV: "production", MIDTRANS_SERVER_KEY: undefined, NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: undefined, ALLOW_DEMO_PAYMENT: "true" });
    expect(isDemoPaymentAllowed()).toBe(true);
  });
  it("mati jika key Midtrans terisi", () => {
    set({ NODE_ENV: "development", MIDTRANS_SERVER_KEY: "SB-x", NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "SB-y" });
    expect(isDemoPaymentAllowed()).toBe(false);
    expect(isOnlinePaymentAvailable()).toBe(true);
  });
});
