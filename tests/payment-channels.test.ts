import { describe, expect, it } from "vitest";
import {
  actionFromCharge,
  channelErrorMessage,
  channelFromStatus,
  channelLabel,
  isActionUsable,
  normalizeChannels,
  parseMidtransTime,
  paymentLabel,
  DEFAULT_CORE_CHANNELS,
} from "@/lib/payment-channels";

describe("kanal Core API", () => {
  it("membaca respons charge QRIS", () => {
    const a = actionFromCharge("qris", {
      payment_type: "qris",
      qr_string: "00020101021226620014COM.GO-JEK.WWW",
      actions: [{ name: "generate-qr-code", method: "GET", url: "https://api.sandbox.midtrans.com/v2/qris/x/qr-code" }],
    });
    expect(a).toMatchObject({ channel: "qris", qrString: "00020101021226620014COM.GO-JEK.WWW" });
    expect(a.qrUrl).toContain("qr-code");
    expect(isActionUsable(a)).toBe(true);
  });

  it("membaca respons charge GoPay & ShopeePay (deeplink + QR)", () => {
    const gopay = actionFromCharge("gopay", {
      actions: [
        { name: "generate-qr-code", url: "https://api.sandbox.midtrans.com/v2/gopay/x/qr-code" },
        { name: "deeplink-redirect", url: "https://simulator.sandbox.midtrans.com/gopay/partner/app/payment-pin?id=x" },
        { name: "get-status", url: "https://api.sandbox.midtrans.com/v2/x/status" },
      ],
    });
    expect(gopay.deeplink).toContain("payment-pin");
    expect(gopay.qrUrl).toContain("qr-code");
    const shopee = actionFromCharge("shopeepay", { actions: [{ name: "deeplink-redirect", url: "https://wsa.wallet.airpay.co.id/x" }] });
    expect(shopee).toMatchObject({ channel: "shopeepay", deeplink: "https://wsa.wallet.airpay.co.id/x", qrUrl: null });
    expect(isActionUsable(shopee)).toBe(true);
  });

  it("membaca nomor VA per bank, Permata, dan Mandiri Bill", () => {
    expect(actionFromCharge("bni_va", { va_numbers: [{ bank: "bni", va_number: "9888123412341234" }] }).vaNumber).toBe("9888123412341234");
    expect(actionFromCharge("bca_va", { va_numbers: [{ bank: "bca", va_number: "12345678901" }] })).toMatchObject({ bank: "bca", vaNumber: "12345678901" });
    expect(actionFromCharge("permata_va", { permata_va_number: "8562000123" }).vaNumber).toBe("8562000123");
    const bill = actionFromCharge("mandiri_bill", { bill_key: "123456789012", biller_code: "70012" });
    expect(bill).toMatchObject({ billKey: "123456789012", billerCode: "70012" });
    expect(isActionUsable(bill)).toBe(true);
    expect(isActionUsable(actionFromCharge("bri_va", {}))).toBe(false);
  });

  it("memetakan notifikasi Midtrans ke kanal spesifik", () => {
    expect(channelFromStatus({ payment_type: "bank_transfer", va_numbers: [{ bank: "bri", va_number: "1" }] })).toBe("bri_va");
    expect(channelFromStatus({ payment_type: "bank_transfer", permata_va_number: "1" })).toBe("permata_va");
    expect(channelFromStatus({ payment_type: "echannel" })).toBe("mandiri_bill");
    expect(channelFromStatus({ payment_type: "qris" })).toBe("qris");
    expect(channelFromStatus({})).toBeNull();
  });

  it("membaca waktu kedaluwarsa Midtrans sebagai WIB", () => {
    expect(parseMidtransTime("2026-11-18 17:15:00")?.toISOString()).toBe("2026-11-18T10:15:00.000Z");
    expect(parseMidtransTime("bukan tanggal")).toBeNull();
    expect(parseMidtransTime(undefined)).toBeNull();
  });

  it("menyaring daftar kanal pengaturan", () => {
    expect(normalizeChannels([])).toEqual(DEFAULT_CORE_CHANNELS);
    expect(normalizeChannels(["bni_va", "qris", "palsu", "qris"])).toEqual(["qris", "bni_va"]);
  });

  it("memberi label laporan yang jelas", () => {
    expect(paymentLabel({ method: "MIDTRANS", gatewayChannel: "bni_va" })).toBe("Online · BNI VA");
    expect(paymentLabel({ method: "MIDTRANS", gatewayChannel: null, gatewayType: "credit_card" })).toBe("Online · Kartu kredit");
    expect(paymentLabel({ method: "MIDTRANS" })).toBe("Online (Midtrans)");
    expect(paymentLabel({ method: "CASH", gatewayChannel: "qris" })).toBe("Tunai");
    expect(channelLabel("mandiri_bill")).toBe("Mandiri Bill Payment");
  });

  it("menjelaskan kanal yang belum aktif di Midtrans", () => {
    const e = channelErrorMessage("gopay", "402", "Payment channel is not activated.");
    expect(e.inactive).toBe(true);
    expect(e.message).toMatch(/GoPay belum aktif/);
    expect(channelErrorMessage("qris", "500", "Internal").inactive).toBe(false);
  });
});
