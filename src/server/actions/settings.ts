"use server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertUser } from "@/lib/session";
import { encryptSecret, getMidtransConfig, invalidateAppConfig, readSettingsRow, saveChannelStatus, type ChannelStatusMap } from "@/server/settings";
import { CHANNEL_INFO, CORE_CHANNELS, type CoreChannel } from "@/lib/payment-channels";

export type SettingsResult = { ok: true } | { ok: false; error: string };

const opt = (max: number) => z.string().trim().max(max).optional();

const midtransSchema = z.object({
  serverKey: opt(200), // kosong = tidak diubah
  clientKey: opt(200),
  isProduction: z.boolean(),
  clear: z.boolean().optional(),
});

const googleSchema = z.object({
  clientId: opt(300),
  clientSecret: opt(300), // kosong = tidak diubah
  clear: z.boolean().optional(),
});

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Data tidak valid." };
  if (e instanceof Error) return { ok: false, error: e.message };
  return { ok: false, error: "Terjadi kesalahan." };
}

async function upsert(data: Parameters<typeof db.appSettings.upsert>[0]["update"], userId: string) {
  await db.appSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...(data as object), updatedById: userId },
    update: { ...data, updatedById: userId },
  });
  invalidateAppConfig();
  revalidatePath("/", "layout");
}

export async function saveMidtransSettings(input: z.input<typeof midtransSchema>): Promise<SettingsResult> {
  try {
    const me = await assertUser(["OWNER"]);
    const d = midtransSchema.parse(input);
    if (d.clear) {
      await upsert({ midtransServerKey: null, midtransClientKey: null, midtransIsProduction: null, midtransChannelStatus: Prisma.DbNull }, me.id);
      return { ok: true };
    }
    const row = await readSettingsRow();
    const serverKey = d.serverKey || null;
    const clientKey = d.clientKey || null;
    if (!serverKey && !row?.midtransServerKey) throw new Error("Server Key wajib diisi.");
    if (!clientKey) throw new Error("Client Key wajib diisi.");
    if (serverKey && /^(SB-)?Mid-client-/.test(serverKey)) throw new Error("Yang diisi di Server Key sepertinya Client Key. Cek lagi di dashboard Midtrans.");
    if (/^(SB-)?Mid-server-/.test(clientKey)) throw new Error("Client Key tidak boleh berisi Server Key.");
    const sandboxKey = (serverKey ?? clientKey).startsWith("SB-");
    if (d.isProduction && sandboxKey) throw new Error("Key sandbox (diawali SB-) tidak bisa dipakai di mode Production.");
    await upsert(
      {
        ...(serverKey ? { midtransServerKey: encryptSecret(serverKey) } : {}),
        midtransClientKey: clientKey,
        midtransIsProduction: d.isProduction,
        // Akun / mode bisa berbeda: hasil cek kanal lama tidak berlaku lagi
        midtransChannelStatus: Prisma.DbNull,
      },
      me.id
    );
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveGoogleSettings(input: z.input<typeof googleSchema>): Promise<SettingsResult> {
  try {
    const me = await assertUser(["OWNER"]);
    const d = googleSchema.parse(input);
    if (d.clear) {
      await upsert({ googleClientId: null, googleClientSecret: null }, me.id);
      return { ok: true };
    }
    const row = await readSettingsRow();
    const clientId = d.clientId || null;
    const clientSecret = d.clientSecret || null;
    if (!clientId) throw new Error("Client ID wajib diisi.");
    if (!clientId.endsWith(".apps.googleusercontent.com")) throw new Error("Client ID Google biasanya berakhiran .apps.googleusercontent.com");
    if (!clientSecret && !row?.googleClientSecret) throw new Error("Client Secret wajib diisi.");
    await upsert(
      {
        googleClientId: clientId,
        ...(clientSecret ? { googleClientSecret: encryptSecret(clientSecret) } : {}),
      },
      me.id
    );
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const modeSchema = z.object({
  mode: z.enum(["snap", "core"]),
  channels: z.array(z.enum(CORE_CHANNELS)).max(CORE_CHANNELS.length),
});

/** Pilih tampilan bayar: Snap (popup Midtrans) atau Core API (layar bayar sendiri) + kanal yang ditawarkan */
export async function saveMidtransMode(input: z.input<typeof modeSchema>): Promise<SettingsResult> {
  try {
    const me = await assertUser(["OWNER"]);
    const d = modeSchema.parse(input);
    if (d.mode === "core" && d.channels.length === 0) throw new Error("Pilih minimal satu metode bayar untuk mode Core API.");
    await upsert({ midtransMode: d.mode, midtransCoreChannels: CORE_CHANNELS.filter((c) => d.channels.includes(c)) }, me.id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export type ChannelCheck = { channel: CoreChannel; ok: boolean; message: string; inactive: boolean };

/**
 * Cek kanal Core API satu per satu dengan transaksi uji Rp10.000 yang langsung dibatalkan.
 * Kanal yang ditolak Midtrans (belum diaktifkan) otomatis disembunyikan dari pelanggan.
 */
export async function checkMidtransChannels(channels?: CoreChannel[]): Promise<{ ok: boolean; message: string; results: ChannelCheck[] }> {
  await assertUser(["OWNER"]);
  const cfg = await getMidtransConfig();
  if (!cfg.enabled) return { ok: false, message: "Key Midtrans belum diisi. Mode demo tidak perlu dicek.", results: [] };
  const { createCoreCharge, expireTransaction, ChargeError } = await import("@/server/midtrans");
  const list = (channels?.length ? channels : cfg.coreChannels).filter((c) => (CORE_CHANNELS as readonly string[]).includes(c));
  const at = new Date().toISOString();
  const results = await Promise.all(
    list.map(async (channel): Promise<ChannelCheck> => {
      const orderId = `CEK-${channel.toUpperCase().replace(/_/g, "")}-${Date.now().toString(36)}`;
      try {
        await createCoreCharge(
          { orderId, amount: 10_000, channel, itemName: "Cek metode bayar", callbackUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000" },
          cfg
        );
        await expireTransaction(orderId);
        return { channel, ok: true, inactive: false, message: `${CHANNEL_INFO[channel].label} aktif.` };
      } catch (e) {
        return { channel, ok: false, inactive: e instanceof ChargeError && e.inactive, message: e instanceof Error ? e.message : "Gagal dicek." };
      }
    })
  );
  const status: ChannelStatusMap = {};
  // Hanya kanal yang jelas belum aktif yang disembunyikan; gangguan sesaat tidak menyembunyikan kanal
  for (const r of results) status[r.channel] = { ok: r.ok || !r.inactive, message: r.message, at };
  await saveChannelStatus(status);
  revalidatePath("/", "layout");
  const bad = results.filter((r) => !r.ok);
  return {
    ok: bad.length === 0,
    message: bad.length
      ? `${bad.length} metode belum bisa dipakai.${bad.some((b) => b.inactive) ? " Metode yang belum aktif disembunyikan dari pelanggan." : ""}`
      : "Semua metode yang dipilih aktif.",
    results,
  };
}

/** Cek apakah Server Key yang aktif diterima Midtrans (tanpa membuat transaksi) */
export async function testMidtransConnection(): Promise<{ ok: boolean; message: string }> {
  await assertUser(["OWNER"]);
  const cfg = await getMidtransConfig();
  if (!cfg.enabled) return { ok: false, message: "Key Midtrans belum diisi. Aplikasi berjalan di mode demo." };
  const base = cfg.isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
  try {
    const res = await fetch(`${base}/v2/cek-koneksi-${Date.now()}/status`, {
      headers: { Accept: "application/json", Authorization: "Basic " + Buffer.from(`${cfg.serverKey}:`).toString("base64") },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { status_code?: string; status_message?: string };
    // 404 = key diterima, transaksi uji memang tidak ada
    if (json.status_code === "404") {
      const how = cfg.mode === "core" ? "Mode Core API: tekan “Cek metode aktif” untuk memastikan tiap metode bisa dipakai." : "Mode Snap (popup Midtrans).";
      return { ok: true, message: `Terhubung ke Midtrans ${cfg.isProduction ? "Production" : "Sandbox"}. Server Key valid. ${how}` };
    }
    if (json.status_code === "401") return { ok: false, message: "Server Key ditolak Midtrans (401). Cek lagi key dan mode Sandbox/Production." };
    return { ok: false, message: json.status_message || `Respons Midtrans: ${res.status}` };
  } catch {
    return { ok: false, message: "Tidak bisa menghubungi Midtrans dari server." };
  }
}
