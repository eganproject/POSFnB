import "server-only";
import crypto from "node:crypto";
import type { PaymentState } from "@prisma/client";
import { getMidtransConfig, saveChannelStatus, type ChannelStatusMap, type MidtransConfig } from "./settings";
import {
  CASHIER_CHANNELS,
  CHANNEL_INFO,
  actionFromCharge,
  channelErrorMessage,
  isActionUsable,
  parseMidtransTime,
  type CoreAction,
  type CoreChannel,
  type MidtransMode,
} from "@/lib/payment-channels";

const snapUrl = (prod: boolean) =>
  prod ? "https://app.midtrans.com/snap/v1/transactions" : "https://app.sandbox.midtrans.com/snap/v1/transactions";
const coreUrl = (prod: boolean) => (prod ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com");

/** Key Midtrans diambil dari Pengaturan (dashboard) atau .env. Kosong = mode demo. */
export async function isMidtransEnabled() {
  return (await getMidtransConfig()).enabled;
}

/**
 * Mode demo (simulasi bayar tanpa Midtrans) hanya boleh dipakai saat development.
 * Di server produksi, mode ini mati kecuali ALLOW_DEMO_PAYMENT="true" diisi dengan sengaja
 * (misalnya untuk server demo yang tidak menerima uang sungguhan).
 */
export async function isDemoPaymentAllowed() {
  if (await isMidtransEnabled()) return false;
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_PAYMENT === "true";
}

/** Pembayaran online tersedia jika Midtrans aktif, atau mode demo diizinkan */
export async function isOnlinePaymentAvailable() {
  return (await isMidtransEnabled()) || (await isDemoPaymentAllowed());
}

export type ChannelOption = { id: CoreChannel; available: boolean; note: string | null };

export type PaymentClientConfig = {
  demo: boolean;
  online: boolean;
  /** snap = popup Midtrans, core = layar bayar sendiri */
  mode: MidtransMode;
  clientKey: string;
  isProduction: boolean;
  /** Kanal Core API untuk pelanggan */
  channels: ChannelOption[];
  /** Kanal Core API untuk kasir (QR di layar) */
  cashierChannels: ChannelOption[];
};

/** Kanal yang ditolak Midtrans saat cek terakhir ditandai tidak tersedia */
export function channelOptions(list: CoreChannel[], status: ChannelStatusMap): ChannelOption[] {
  return list.map((id) => {
    const st = status[id];
    return { id, available: !st || st.ok, note: st && !st.ok ? st.message : null };
  });
}

/** Data untuk layar bayar di browser (client key boleh publik) */
export async function getPaymentClientConfig(): Promise<PaymentClientConfig> {
  const c = await getMidtransConfig();
  const channels = channelOptions(c.coreChannels, c.channelStatus);
  return {
    demo: !c.enabled,
    online: await isOnlinePaymentAvailable(),
    mode: c.mode,
    clientKey: c.clientKey,
    isProduction: c.isProduction,
    channels,
    cashierChannels: channelOptions(
      CASHIER_CHANNELS.filter((ch) => c.coreChannels.includes(ch)),
      c.channelStatus
    ),
  };
}

/** @deprecated nama lama, dipertahankan untuk kompatibilitas */
export const getSnapClientConfig = getPaymentClientConfig;

function authHeader(serverKey: string) {
  return "Basic " + Buffer.from(`${serverKey}:`).toString("base64");
}

export type SnapParams = {
  orderId: string;
  amount: number;
  itemName: string;
  customerName?: string | null;
  customerPhone?: string | null;
  finishUrl: string;
};

export async function createSnapTransaction(p: SnapParams) {
  const cfg = await getMidtransConfig();
  const res = await fetch(snapUrl(cfg.isProduction), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(cfg.serverKey),
    },
    body: JSON.stringify({
      transaction_details: { order_id: p.orderId, gross_amount: p.amount },
      item_details: [{ id: "ORDER", price: p.amount, quantity: 1, name: p.itemName.slice(0, 50) }],
      customer_details: {
        first_name: p.customerName || "Customer",
        phone: p.customerPhone || undefined,
      },
      callbacks: { finish: p.finishUrl },
      expiry: { unit: "minutes", duration: 30 },
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    token?: string;
    redirect_url?: string;
    error_messages?: string[];
  };
  if (!res.ok || !json.token) {
    throw new Error(json.error_messages?.join(", ") || `Midtrans error (${res.status})`);
  }
  return { token: json.token, redirectUrl: json.redirect_url ?? null };
}

export class ChargeError extends Error {
  constructor(
    message: string,
    public inactive = false
  ) {
    super(message);
  }
}

export type CoreChargeParams = {
  orderId: string;
  amount: number;
  channel: CoreChannel;
  itemName: string;
  customerName?: string | null;
  customerPhone?: string | null;
  /** Halaman kembali setelah bayar di aplikasi e-wallet */
  callbackUrl: string;
};

/** Isi permintaan charge Core API untuk satu kanal */
export function coreChargeBody(p: CoreChargeParams) {
  const info = CHANNEL_INFO[p.channel];
  const base = {
    transaction_details: { order_id: p.orderId, gross_amount: p.amount },
    item_details: [{ id: "ORDER", price: p.amount, quantity: 1, name: p.itemName.slice(0, 50) }],
    customer_details: { first_name: (p.customerName || "Customer").slice(0, 50), phone: p.customerPhone || undefined },
    custom_expiry: { expiry_duration: info.expiryMinutes, unit: "minute" },
  };
  switch (p.channel) {
    case "qris":
      return { ...base, payment_type: "qris", qris: { acquirer: "gopay" } };
    case "gopay":
      return { ...base, payment_type: "gopay", gopay: { enable_callback: true, callback_url: p.callbackUrl } };
    case "shopeepay":
      return { ...base, payment_type: "shopeepay", shopeepay: { callback_url: p.callbackUrl } };
    case "mandiri_bill":
      return { ...base, payment_type: "echannel", echannel: { bill_info1: "Pembayaran", bill_info2: p.itemName.slice(0, 18) } };
    default:
      return { ...base, payment_type: "bank_transfer", bank_transfer: { bank: p.channel.replace("_va", "") } };
  }
}

/**
 * Buat transaksi Core API (tanpa popup). Melempar ChargeError dengan pesan yang bisa
 * ditampilkan ke pelanggan, termasuk saat kanal belum diaktifkan di akun Midtrans.
 */
export async function createCoreCharge(p: CoreChargeParams, cfgIn?: MidtransConfig): Promise<{ action: CoreAction; expiresAt: Date; raw: unknown }> {
  const cfg = cfgIn ?? (await getMidtransConfig());
  let res: Response;
  try {
    res = await fetch(`${coreUrl(cfg.isProduction)}/v2/charge`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: authHeader(cfg.serverKey) },
      body: JSON.stringify(coreChargeBody(p)),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ChargeError("Tidak bisa menghubungi Midtrans. Periksa koneksi lalu coba lagi.");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    status_code?: string;
    status_message?: string;
    validation_messages?: string[];
    expiry_time?: string;
  };
  const code = json.status_code ?? String(res.status);
  if (code !== "201" && code !== "200") {
    const err = channelErrorMessage(p.channel, code, json.validation_messages?.join(", ") || json.status_message);
    if (err.inactive) {
      await saveChannelStatus({ [p.channel]: { ok: false, message: err.message, at: new Date().toISOString() } }).catch(() => null);
    }
    throw new ChargeError(err.message, err.inactive);
  }
  const action = actionFromCharge(p.channel, json);
  if (!isActionUsable(action)) {
    throw new ChargeError(`Midtrans tidak mengirim data pembayaran ${CHANNEL_INFO[p.channel].label}. Coba metode lain.`);
  }
  const expiresAt = parseMidtransTime(json.expiry_time) ?? new Date(Date.now() + CHANNEL_INFO[p.channel].expiryMinutes * 60_000);
  return { action, expiresAt, raw: json };
}

/** Data palsu untuk mode demo, supaya tampilan Core API tetap bisa dicoba tanpa key */
export function demoCoreAction(channel: CoreChannel, orderId: string): CoreAction {
  const digits = crypto.createHash("sha256").update(orderId).digest("hex").replace(/\D/g, "").padEnd(16, "7").slice(0, 16);
  const info = CHANNEL_INFO[channel];
  switch (info.kind) {
    case "qris":
      return { channel, qrString: `DEMO-QRIS-${orderId}`, demo: true };
    case "ewallet":
      return { channel, qrString: `DEMO-${channel.toUpperCase()}-${orderId}`, deeplink: "#demo", demo: true };
    case "va":
      return { channel, bank: channel.replace("_va", ""), vaNumber: `8808${digits.slice(0, 12)}`, demo: true };
    case "bill":
      return { channel, bank: "mandiri", billerCode: "70012", billKey: digits.slice(0, 12), demo: true };
  }
}

export type MidtransStatus = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key?: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type?: string;
  transaction_id?: string;
  [key: string]: unknown;
};

export async function getTransactionStatus(orderId: string): Promise<MidtransStatus | null> {
  const cfg = await getMidtransConfig();
  const res = await fetch(`${coreUrl(cfg.isProduction)}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Accept: "application/json", Authorization: authHeader(cfg.serverKey) },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as MidtransStatus | null;
  if (!json || json.status_code === "404") return null;
  return json;
}

/**
 * Matikan transaksi Snap yang masih pending di Midtrans agar customer tidak bisa
 * menyelesaikannya lagi (mis. setelah pindah ke bayar di kasir). Best effort.
 */
export async function expireTransaction(orderId: string) {
  const cfg = await getMidtransConfig();
  if (!cfg.enabled) return;
  const call = async (action: "expire" | "cancel") => {
    const res = await fetch(`${coreUrl(cfg.isProduction)}/v2/${encodeURIComponent(orderId)}/${action}`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: authHeader(cfg.serverKey) },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { status_code?: string };
    return json.status_code ?? String(res.status);
  };
  try {
    const code = await call("expire");
    // 404 = transaksi belum dibuat (Snap belum dipilih metodenya); 407 = sudah kedaluwarsa
    if (["200", "404", "407", "412"].includes(code)) return;
    // Beberapa kanal Core API (GoPay/QRIS) menolak expire, coba cancel
    await call("cancel");
  } catch (e) {
    console.error("Gagal expire transaksi Midtrans", orderId, e);
  }
}

export function verifySignature(n: MidtransStatus, serverKey: string) {
  const key = serverKey;
  if (!key) return false;
  const expected = crypto
    .createHash("sha512")
    .update(`${n.order_id}${n.status_code}${n.gross_amount}${key}`)
    .digest("hex");
  if (typeof n.signature_key !== "string" || n.signature_key.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(n.signature_key));
}

export function mapMidtransState(n: Pick<MidtransStatus, "transaction_status" | "fraud_status">): PaymentState {
  switch (n.transaction_status) {
    case "capture":
      return n.fraud_status === "challenge" ? "PENDING" : "SUCCESS";
    case "settlement":
      return "SUCCESS";
    case "pending":
      return "PENDING";
    case "expire":
      return "EXPIRED";
    case "deny":
    case "cancel":
    case "failure":
      return "FAILED";
    default:
      return "PENDING";
  }
}
