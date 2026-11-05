import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapMidtransState, verifySignature } from "@/server/midtrans";

describe("midtrans", () => {
  it("memetakan status transaksi", () => {
    expect(mapMidtransState({ transaction_status: "settlement" })).toBe("SUCCESS");
    expect(mapMidtransState({ transaction_status: "capture", fraud_status: "accept" })).toBe("SUCCESS");
    expect(mapMidtransState({ transaction_status: "capture", fraud_status: "challenge" })).toBe("PENDING");
    expect(mapMidtransState({ transaction_status: "expire" })).toBe("EXPIRED");
    expect(mapMidtransState({ transaction_status: "deny" })).toBe("FAILED");
    expect(mapMidtransState({ transaction_status: "pending" })).toBe("PENDING");
  });
  it("memverifikasi signature SHA-512", () => {
    process.env.MIDTRANS_SERVER_KEY = "SB-test";
    const n = { order_id: "A-1", status_code: "200", gross_amount: "41580.00", transaction_status: "settlement" };
    const signature_key = crypto.createHash("sha512").update(`A-1200${"41580.00"}SB-test`).digest("hex");
    expect(verifySignature({ ...n, signature_key })).toBe(true);
    expect(verifySignature({ ...n, signature_key: "palsu" })).toBe(false);
    expect(verifySignature({ ...n })).toBe(false);
  });
});
