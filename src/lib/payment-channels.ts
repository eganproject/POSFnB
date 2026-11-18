/**
 * Kanal pembayaran Midtrans Core API (dipakai server & browser).
 * Satu tempat untuk label, kelompok, instruksi bayar, dan cara membaca respons Midtrans.
 */
import type { PaymentMethod } from "@prisma/client";

export type MidtransMode = "snap" | "core";

export const CORE_CHANNELS = [
  "qris",
  "gopay",
  "shopeepay",
  "bca_va",
  "bni_va",
  "bri_va",
  "mandiri_bill",
  "permata_va",
  "cimb_va",
] as const;
export type CoreChannel = (typeof CORE_CHANNELS)[number];

export type ChannelKind = "qris" | "ewallet" | "va" | "bill";

export type ChannelInfo = {
  id: CoreChannel;
  label: string;
  short: string;
  kind: ChannelKind;
  /** Warna aksen badge (CSS) */
  color: string;
  desc: string;
  /** Lama berlaku transaksi (menit) */
  expiryMinutes: number;
};

export const CHANNEL_INFO: Record<CoreChannel, ChannelInfo> = {
  qris: { id: "qris", label: "QRIS", short: "QRIS", kind: "qris", color: "#c8102e", desc: "Scan dari semua e-wallet & m-banking", expiryMinutes: 15 },
  gopay: { id: "gopay", label: "GoPay", short: "GoPay", kind: "ewallet", color: "#00aed6", desc: "Langsung buka aplikasi Gojek / GoPay", expiryMinutes: 15 },
  shopeepay: { id: "shopeepay", label: "ShopeePay", short: "ShopeePay", kind: "ewallet", color: "#ee4d2d", desc: "Langsung buka aplikasi Shopee", expiryMinutes: 15 },
  bca_va: { id: "bca_va", label: "BCA Virtual Account", short: "BCA", kind: "va", color: "#0060af", desc: "Transfer dari BCA mobile, KlikBCA, ATM", expiryMinutes: 60 },
  bni_va: { id: "bni_va", label: "BNI Virtual Account", short: "BNI", kind: "va", color: "#f15a23", desc: "Transfer dari BNI Mobile, ATM, bank lain", expiryMinutes: 60 },
  bri_va: { id: "bri_va", label: "BRI Virtual Account", short: "BRI", kind: "va", color: "#00529c", desc: "Transfer dari BRImo, ATM, bank lain", expiryMinutes: 60 },
  mandiri_bill: { id: "mandiri_bill", label: "Mandiri Bill Payment", short: "Mandiri", kind: "bill", color: "#003d79", desc: "Bayar lewat Livin' by Mandiri / ATM", expiryMinutes: 60 },
  permata_va: { id: "permata_va", label: "Permata Virtual Account", short: "Permata", kind: "va", color: "#e4002b", desc: "Transfer dari PermataMobile X, ATM, bank lain", expiryMinutes: 60 },
  cimb_va: { id: "cimb_va", label: "CIMB Niaga Virtual Account", short: "CIMB", kind: "va", color: "#7a0019", desc: "Transfer dari OCTO Mobile, ATM, bank lain", expiryMinutes: 60 },
};

export const DEFAULT_CORE_CHANNELS: CoreChannel[] = ["qris", "gopay", "shopeepay", "bca_va", "bni_va", "bri_va", "mandiri_bill"];

/** Kanal yang cocok untuk kasir (pelanggan berdiri di depan layar) */
export const CASHIER_CHANNELS: CoreChannel[] = ["qris", "gopay", "shopeepay"];

export function isCoreChannel(v: unknown): v is CoreChannel {
  return typeof v === "string" && (CORE_CHANNELS as readonly string[]).includes(v);
}

/** Saring & urutkan daftar kanal yang disimpan owner; kosong = default */
export function normalizeChannels(list: readonly string[] | null | undefined): CoreChannel[] {
  const picked = (list ?? []).filter(isCoreChannel);
  const unique = [...new Set(picked)];
  return unique.length ? CORE_CHANNELS.filter((c) => unique.includes(c)) : [...DEFAULT_CORE_CHANNELS];
}

/** Data yang ditampilkan di layar bayar Core API (disimpan di Payment.gatewayAction) */
export type CoreAction = {
  channel: CoreChannel;
  /** Isi QR (QRIS) untuk dirender sendiri */
  qrString?: string | null;
  /** URL gambar QR dari Midtrans (GoPay) */
  qrUrl?: string | null;
  /** Link buka aplikasi e-wallet (HP) */
  deeplink?: string | null;
  bank?: string | null;
  vaNumber?: string | null;
  billerCode?: string | null;
  billKey?: string | null;
  demo?: boolean;
};

type ChargeResponse = {
  payment_type?: string;
  qr_string?: string;
  actions?: { name: string; method?: string; url: string }[];
  va_numbers?: { bank: string; va_number: string }[];
  permata_va_number?: string;
  bill_key?: string;
  biller_code?: string;
  expiry_time?: string;
};

/** Ubah respons charge Midtrans menjadi data tampilan */
export function actionFromCharge(channel: CoreChannel, r: ChargeResponse): CoreAction {
  const action = (name: string) => r.actions?.find((a) => a.name === name)?.url ?? null;
  const info = CHANNEL_INFO[channel];
  switch (info.kind) {
    case "qris":
      return { channel, qrString: r.qr_string ?? null, qrUrl: action("generate-qr-code") };
    case "ewallet":
      return {
        channel,
        qrString: r.qr_string ?? null,
        qrUrl: action("generate-qr-code"),
        deeplink: action("deeplink-redirect"),
      };
    case "va": {
      const bank = channel.replace("_va", "");
      const va = channel === "permata_va" ? r.permata_va_number : r.va_numbers?.find((v) => v.bank === bank)?.va_number ?? r.va_numbers?.[0]?.va_number;
      return { channel, bank, vaNumber: va ?? null };
    }
    case "bill":
      return { channel, bank: "mandiri", billerCode: r.biller_code ?? null, billKey: r.bill_key ?? null };
  }
}

/** Apakah data tampilan cukup untuk dibayar (respons Midtrans tidak kosong) */
export function isActionUsable(a: CoreAction) {
  switch (CHANNEL_INFO[a.channel].kind) {
    case "qris":
      return Boolean(a.qrString || a.qrUrl);
    case "ewallet":
      return Boolean(a.deeplink || a.qrUrl || a.qrString);
    case "va":
      return Boolean(a.vaNumber);
    case "bill":
      return Boolean(a.billKey && a.billerCode);
  }
}

/** Waktu kedaluwarsa Midtrans ("2026-11-18 17:15:00", zona WIB) → Date */
export function parseMidtransTime(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Kanal spesifik dari notifikasi / status Midtrans (Snap maupun Core API),
 * mis. bank_transfer + va_numbers[bni] → "bni_va".
 */
export function channelFromStatus(n: {
  payment_type?: string;
  va_numbers?: unknown;
  permata_va_number?: unknown;
  issuer?: unknown;
}): string | null {
  const type = n.payment_type;
  if (!type) return null;
  if (type === "bank_transfer") {
    if (n.permata_va_number) return "permata_va";
    const banks = Array.isArray(n.va_numbers) ? (n.va_numbers as { bank?: string }[]) : [];
    return banks[0]?.bank ? `${banks[0].bank}_va` : "bank_transfer";
  }
  if (type === "echannel") return "mandiri_bill";
  return type;
}

const EXTRA_LABEL: Record<string, string> = {
  credit_card: "Kartu kredit",
  bank_transfer: "Virtual Account",
  echannel: "Mandiri Bill",
  cstore: "Indomaret / Alfamart",
  akulaku: "Akulaku",
  kredivo: "Kredivo",
  dana: "DANA",
  ovo: "OVO",
  demo: "Simulasi",
  demo_qris: "Simulasi",
};

/** Label kanal online, mis. "QRIS", "BNI VA" */
export function channelLabel(channel: string | null | undefined): string | null {
  if (!channel) return null;
  if (isCoreChannel(channel)) {
    const info = CHANNEL_INFO[channel];
    return info.kind === "va" ? `${info.short} VA` : info.label;
  }
  return EXTRA_LABEL[channel] ?? channel.replace(/_/g, " ").toUpperCase();
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Tunai",
  MIDTRANS: "Online (Midtrans)",
  QRIS_STATIC: "QRIS (EDC)",
  CARD: "Kartu Debit/Kredit",
  TRANSFER: "Transfer Bank",
};

/** Label pembayaran lengkap untuk struk, laporan, riwayat: "Online · QRIS" */
export function paymentLabel(p: { method: PaymentMethod; gatewayChannel?: string | null; gatewayType?: string | null }) {
  if (p.method !== "MIDTRANS") return METHOD_LABEL[p.method];
  const ch = channelLabel(p.gatewayChannel ?? p.gatewayType);
  return ch ? `Online · ${ch}` : METHOD_LABEL.MIDTRANS;
}

/** Langkah bayar per kanal (ditampilkan di layar bayar) */
export function payInstructions(channel: CoreChannel): { title: string; steps: string[] }[] {
  const info = CHANNEL_INFO[channel];
  switch (info.kind) {
    case "qris":
      return [
        {
          title: "Cara bayar",
          steps: [
            "Buka aplikasi e-wallet atau m-banking (GoPay, OVO, DANA, ShopeePay, LinkAja, BCA, dll).",
            "Pilih menu Scan / Bayar QRIS, lalu arahkan kamera ke QR.",
            "Pastikan nama merchant & nominal sesuai, lalu konfirmasi.",
          ],
        },
      ];
    case "ewallet":
      return [
        {
          title: "Dari HP ini",
          steps: [`Ketuk tombol Buka ${info.label}.`, "Periksa nominal di aplikasi, lalu konfirmasi dengan PIN.", "Kembali ke halaman ini, status berubah otomatis."],
        },
        {
          title: "Dari HP lain",
          steps: [`Buka aplikasi ${channel === "gopay" ? "Gojek / GoPay" : "Shopee"} lalu pilih Scan.`, "Scan QR di layar ini dan konfirmasi pembayaran."],
        },
      ];
    case "bill":
      return [
        {
          title: "Livin' by Mandiri",
          steps: ["Pilih Bayar → E-commerce / Multipayment.", "Cari penyedia jasa Midtrans (kode biller di atas).", "Masukkan Kode Bayar, periksa nominal, lalu konfirmasi."],
        },
        {
          title: "ATM Mandiri",
          steps: ["Pilih Bayar/Beli → Lainnya → Multi Payment.", "Masukkan kode perusahaan (kode biller), lalu Kode Bayar.", "Periksa detail lalu konfirmasi."],
        },
      ];
    case "va": {
      const app: Record<string, string> = { bca_va: "BCA mobile", bni_va: "BNI Mobile Banking", bri_va: "BRImo", permata_va: "PermataMobile X", cimb_va: "OCTO Mobile" };
      return [
        {
          title: app[channel] ?? "Mobile banking",
          steps: ["Pilih Transfer → Virtual Account.", "Masukkan nomor Virtual Account di atas.", "Pastikan nama & nominal sesuai, lalu masukkan PIN."],
        },
        {
          title: "ATM / bank lain",
          steps: [
            `Di ATM ${info.short}: Transfer → Virtual Account → masukkan nomor VA.`,
            "Dari bank lain: Transfer antar bank / online, pilih bank tujuan " + info.short + ", masukkan nomor VA sebagai rekening tujuan.",
            "Nominal harus sama persis, lalu konfirmasi.",
          ],
        },
      ];
    }
  }
}

/** Pesan jelas bila Midtrans menolak kanal (belum diaktifkan di akun) */
export function channelErrorMessage(channel: CoreChannel, statusCode: string | undefined, message: string | undefined) {
  const label = CHANNEL_INFO[channel].label;
  const text = (message ?? "").toLowerCase();
  if (statusCode === "402" || text.includes("not activated") || text.includes("not active") || text.includes("not enabled")) {
    return { inactive: true, message: `${label} belum aktif di akun Midtrans outlet ini. Pilih metode lain.` };
  }
  if (statusCode === "401") return { inactive: false, message: "Server Key Midtrans ditolak. Hubungi pemilik outlet." };
  return { inactive: false, message: `${label} sedang tidak bisa dipakai (${message || `kode ${statusCode ?? "?"}`}). Coba metode lain.` };
}
