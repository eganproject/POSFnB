import { afterEach, describe, expect, it, vi } from "vitest";

const saved: unknown[] = [];
vi.mock("@/server/settings", () => ({
  getMidtransConfig: vi.fn(),
  saveChannelStatus: vi.fn(async (u: unknown) => {
    saved.push(u);
  }),
}));

import { ChargeError, coreChargeBody, createCoreCharge } from "@/server/midtrans";
import type { MidtransConfig } from "@/server/settings";

const cfg: MidtransConfig = {
  serverKey: "SB-Mid-server-test",
  clientKey: "SB-Mid-client-test",
  isProduction: false,
  enabled: true,
  source: "settings",
  mode: "core",
  coreChannels: ["qris", "gopay", "bni_va"],
  channelStatus: {},
};
const params = { orderId: "251118-ABCD-X1", amount: 41580, itemName: "Warm Hour #12", callbackUrl: "https://pos.test/order/1" };

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  saved.length = 0;
});

describe("charge Core API", () => {
  it("menyusun body per kanal", () => {
    expect(coreChargeBody({ ...params, channel: "qris" })).toMatchObject({ payment_type: "qris", custom_expiry: { expiry_duration: 15 } });
    expect(coreChargeBody({ ...params, channel: "gopay" })).toMatchObject({ payment_type: "gopay", gopay: { enable_callback: true } });
    expect(coreChargeBody({ ...params, channel: "bni_va" })).toMatchObject({ payment_type: "bank_transfer", bank_transfer: { bank: "bni" } });
    expect(coreChargeBody({ ...params, channel: "permata_va" })).toMatchObject({ bank_transfer: { bank: "permata" } });
    expect(coreChargeBody({ ...params, channel: "mandiri_bill" })).toMatchObject({ payment_type: "echannel" });
    expect(coreChargeBody({ ...params, channel: "qris" }).transaction_details).toEqual({ order_id: params.orderId, gross_amount: 41580 });
  });

  it("mengembalikan data QR & waktu kedaluwarsa", async () => {
    const fetch = mockFetch({ status_code: "201", payment_type: "qris", qr_string: "000201...", expiry_time: "2026-11-18 17:15:00" });
    const r = await createCoreCharge({ ...params, channel: "qris" }, cfg);
    expect(r.action.qrString).toBe("000201...");
    expect(r.expiresAt.toISOString()).toBe("2026-11-18T10:15:00.000Z");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.sandbox.midtrans.com/v2/charge");
    expect((init.headers as Record<string, string>).Authorization).toBe("Basic " + Buffer.from("SB-Mid-server-test:").toString("base64"));
  });

  it("kanal belum aktif → pesan jelas & kanal ditandai tidak aktif", async () => {
    mockFetch({ status_code: "402", status_message: "Payment channel is not activated." });
    const err = await createCoreCharge({ ...params, channel: "gopay" }, cfg).catch((e) => e);
    expect(err).toBeInstanceOf(ChargeError);
    expect(err.inactive).toBe(true);
    expect(err.message).toMatch(/GoPay belum aktif/);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ gopay: { ok: false } });
  });

  it("respons tanpa nomor VA dianggap gagal (tidak menampilkan tagihan kosong)", async () => {
    mockFetch({ status_code: "201", payment_type: "bank_transfer", va_numbers: [] });
    await expect(createCoreCharge({ ...params, channel: "bni_va" }, cfg)).rejects.toThrow(/tidak mengirim data/);
    expect(saved).toHaveLength(0);
  });

  it("gagal jaringan → pesan ramah", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("ECONNRESET"))));
    await expect(createCoreCharge({ ...params, channel: "qris" }, cfg)).rejects.toThrow(/Tidak bisa menghubungi Midtrans/);
  });
});
