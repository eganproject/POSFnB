import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { normalizeChannels, type CoreChannel, type MidtransMode } from "@/lib/payment-channels";

/**
 * Pengaturan integrasi (Midtrans & Google) yang bisa diubah owner dari dashboard.
 * Urutan prioritas: nilai di Pengaturan (database) → nilai di .env → kosong (mode demo / tombol Google disembunyikan).
 * Secret (server key Midtrans, client secret Google) disimpan terenkripsi AES-256-GCM.
 */

export type ConfigSource = "settings" | "env" | "none";

export type MidtransConfig = {
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
  enabled: boolean;
  source: ConfigSource;
  /** snap = popup Midtrans, core = tampilan bayar sendiri (Core API) */
  mode: MidtransMode;
  /** Kanal Core API yang ditawarkan, urut */
  coreChannels: CoreChannel[];
  /** Hasil cek kanal terakhir (kanal yang ditolak Midtrans disembunyikan) */
  channelStatus: ChannelStatusMap;
};

export type ChannelStatus = { ok: boolean; message: string; at: string };
export type ChannelStatusMap = Partial<Record<CoreChannel, ChannelStatus>>;

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  enabled: boolean;
  source: ConfigSource;
};

export type AppConfig = { midtrans: MidtransConfig; google: GoogleConfig };

// ───────── Enkripsi secret ─────────

function encryptionKey() {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET belum diisi di .env, secret tidak bisa disimpan dengan aman.");
  return crypto.createHash("sha256").update(`posfnb-settings:${secret}`).digest();
}

export function encryptSecret(plain: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${data.toString("base64url")}`;
}

/** null jika gagal didekripsi (mis. BETTER_AUTH_SECRET diganti) */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [v, iv, tag, data] = stored.split(":");
    if (v !== "v1" || !iv || !tag || !data) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Tampilkan sebagian saja, mis. "SB-Mid-server-••••••Xy9Z" */
export function maskSecret(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 8) return "••••••";
  return `${value.slice(0, Math.min(14, Math.floor(value.length / 3)))}••••••${value.slice(-4)}`;
}

// ───────── Baca konfigurasi (dengan cache singkat) ─────────

const CACHE_MS = 30_000;
const g = globalThis as unknown as { __appConfig?: { at: number; value: Promise<AppConfig> } };

export function readSettingsRow() {
  return db.appSettings.findUnique({ where: { id: 1 } });
}

async function loadConfig(): Promise<AppConfig> {
  let row: Awaited<ReturnType<typeof readSettingsRow>> = null;
  try {
    row = await readSettingsRow();
  } catch (e) {
    // Tabel belum ada (migrasi belum dijalankan) → pakai .env
    console.error("Gagal membaca AppSettings, memakai .env", e);
  }

  const dbServerKey = decryptSecret(row?.midtransServerKey);
  const dbClientKey = row?.midtransClientKey || null;
  const envServerKey = process.env.MIDTRANS_SERVER_KEY || "";
  const envClientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";
  const envProd = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const envMode = process.env.MIDTRANS_MODE?.toLowerCase() === "core" ? "core" : "snap";
  const extra = {
    mode: row?.midtransMode === "core" || row?.midtransMode === "snap" ? row.midtransMode : envMode,
    coreChannels: normalizeChannels(row?.midtransCoreChannels),
    channelStatus: (row?.midtransChannelStatus ?? {}) as ChannelStatusMap,
  } as const;
  const midtrans: MidtransConfig =
    dbServerKey && dbClientKey
      ? { serverKey: dbServerKey, clientKey: dbClientKey, isProduction: row?.midtransIsProduction ?? envProd, enabled: true, source: "settings", ...extra }
      : envServerKey && envClientKey
        ? { serverKey: envServerKey, clientKey: envClientKey, isProduction: envProd, enabled: true, source: "env", ...extra }
        : { serverKey: "", clientKey: "", isProduction: false, enabled: false, source: "none", ...extra };

  const dbGoogleId = row?.googleClientId || null;
  const dbGoogleSecret = decryptSecret(row?.googleClientSecret);
  const envGoogleId = process.env.GOOGLE_CLIENT_ID || "";
  const envGoogleSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const google: GoogleConfig =
    dbGoogleId && dbGoogleSecret
      ? { clientId: dbGoogleId, clientSecret: dbGoogleSecret, enabled: true, source: "settings" }
      : envGoogleId && envGoogleSecret
        ? { clientId: envGoogleId, clientSecret: envGoogleSecret, enabled: true, source: "env" }
        : { clientId: "", clientSecret: "", enabled: false, source: "none" };

  return { midtrans, google };
}

export function getAppConfig(): Promise<AppConfig> {
  const cached = g.__appConfig;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const value = loadConfig();
  g.__appConfig = { at: Date.now(), value };
  value.catch(() => {
    if (g.__appConfig?.value === value) g.__appConfig = undefined;
  });
  return value;
}

/** Panggil setelah pengaturan disimpan agar langsung berlaku */
export function invalidateAppConfig() {
  g.__appConfig = undefined;
}

export async function getMidtransConfig() {
  return (await getAppConfig()).midtrans;
}

export async function getGoogleConfig() {
  return (await getAppConfig()).google;
}

/** Simpan hasil cek kanal (dipakai untuk menyembunyikan kanal yang belum aktif di Midtrans) */
export async function saveChannelStatus(update: ChannelStatusMap) {
  const row = await readSettingsRow();
  const merged = { ...((row?.midtransChannelStatus ?? {}) as ChannelStatusMap), ...update };
  await db.appSettings.upsert({
    where: { id: 1 },
    create: { id: 1, midtransChannelStatus: merged },
    update: { midtransChannelStatus: merged },
  });
  invalidateAppConfig();
}
