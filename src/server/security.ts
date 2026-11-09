import "server-only";
import { verifyPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { isDemoPaymentAllowed, isMidtransEnabled } from "@/server/midtrans";

export const PLACEHOLDER_SECRETS = ["ganti-dengan-string-acak-minimal-32-karakter", "changeme", "secret"];
const DEMO_PASSWORD = "password123";

/** Masalah konfigurasi yang berbahaya bila aplikasi dipakai sungguhan / online */
export function configProblems() {
  const problems: string[] = [];
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  if (!secret || secret.length < 32 || PLACEHOLDER_SECRETS.includes(secret)) {
    problems.push("BETTER_AUTH_SECRET masih kosong / contoh. Isi dengan string acak minimal 32 karakter (openssl rand -base64 32).");
  }
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !(process.env.BETTER_AUTH_URL ?? "").startsWith("https://")) {
    problems.push("BETTER_AUTH_URL belum memakai https:// domain Anda.");
  }
  if (isProd && isDemoPaymentAllowed()) {
    problems.push("Mode demo pembayaran aktif (ALLOW_DEMO_PAYMENT=true). Siapa pun bisa menandai pesanan lunas tanpa membayar.");
  }
  if (isProd && !isMidtransEnabled()) {
    problems.push("Key Midtrans belum diisi, jadi pembayaran online customer dimatikan (hanya bayar di kasir).");
  }
  if (isProd && process.env.MIDTRANS_IS_PRODUCTION !== "true" && isMidtransEnabled()) {
    problems.push("Midtrans masih mode sandbox (MIDTRANS_IS_PRODUCTION bukan true): pembayaran customer tidak sungguhan.");
  }
  return problems;
}

const g = globalThis as unknown as { __demoAcc?: { at: number; emails: string[] } };

/** Akun aktif yang masih memakai password demo "password123" (hasil di-cache 5 menit) */
export async function accountsWithDemoPassword() {
  if (g.__demoAcc && Date.now() - g.__demoAcc.at < 5 * 60_000) return g.__demoAcc.emails;
  const accounts = await db.account.findMany({
    where: { providerId: "credential", password: { not: null }, user: { isActive: true } },
    select: { password: true, user: { select: { email: true } } },
    take: 200,
  });
  const emails: string[] = [];
  for (const a of accounts) {
    if (a.password && (await verifyPassword({ hash: a.password, password: DEMO_PASSWORD }).catch(() => false))) {
      emails.push(a.user.email);
    }
  }
  g.__demoAcc = { at: Date.now(), emails };
  return emails;
}

/** Hapus cache setelah password diganti */
export function resetDemoPasswordCache() {
  g.__demoAcc = undefined;
}
