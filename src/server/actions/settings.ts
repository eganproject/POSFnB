"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertUser } from "@/lib/session";
import { encryptSecret, invalidateAppConfig, readSettingsRow } from "@/server/settings";

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
      await upsert({ midtransServerKey: null, midtransClientKey: null, midtransIsProduction: null }, me.id);
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

/** Cek apakah Server Key yang aktif diterima Midtrans (tanpa membuat transaksi) */
export async function testMidtransConnection(): Promise<{ ok: boolean; message: string }> {
  await assertUser(["OWNER"]);
  const { getMidtransConfig } = await import("@/server/settings");
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
    if (json.status_code === "404") return { ok: true, message: `Terhubung ke Midtrans ${cfg.isProduction ? "Production" : "Sandbox"}. Server Key valid.` };
    if (json.status_code === "401") return { ok: false, message: "Server Key ditolak Midtrans (401). Cek lagi key dan mode Sandbox/Production." };
    return { ok: false, message: json.status_message || `Respons Midtrans: ${res.status}` };
  } catch {
    return { ok: false, message: "Tidak bisa menghubungi Midtrans dari server." };
  }
}
