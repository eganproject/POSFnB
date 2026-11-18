import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { getGoogleConfig, type GoogleConfig } from "@/server/settings";

function buildAuth(google: GoogleConfig) {
  return betterAuth({
    database: prismaAdapter(db, { provider: "postgresql" }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      // Akun staf dibuat oleh owner dari dashboard, bukan daftar mandiri
      disableSignUp: true,
      minPasswordLength: 6,
    },
    socialProviders: google.enabled
      ? {
          google: {
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            // Pelanggan boleh daftar sendiri lewat Google. Akun baru SELALU berperan CUSTOMER
            // (lihat databaseHooks.user.create), jadi tidak pernah mendapat akses staf.
            // Email staf yang sudah didaftarkan owner otomatis tertaut ke akun stafnya.
            prompt: "select_account",
          },
        }
      : undefined,
    account: {
      accountLinking: {
        enabled: true,
        // Google sudah memverifikasi kepemilikan email, jadi akun Google boleh
        // otomatis ditautkan ke user dengan email yang sama. Peran (owner/kasir/dapur)
        // tetap mengikuti data user yang dibuat owner.
        trustedProviders: ["google"],
        // User staf dibuat owner tanpa verifikasi email, jadi jangan wajibkan emailVerified lokal.
        requireLocalEmailVerified: false,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 },
    },
    user: {
      additionalFields: {
        role: { type: "string", input: false, defaultValue: "CUSTOMER" },
        outletId: { type: "string", input: false, required: false },
        isActive: { type: "boolean", input: false, defaultValue: true },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Satu-satunya jalur Better Auth membuat user adalah daftar mandiri lewat Google.
          // Paksa jadi pelanggan apa pun isinya. Staf dibuat owner langsung di database.
          before: async (user) => ({
            data: { ...user, role: "CUSTOMER", outletId: null, isActive: true },
          }),
        },
      },
      session: {
        create: {
          before: async (session) => {
            const user = await db.user.findUnique({ where: { id: session.userId } });
            if (!user?.isActive) return false;
            return { data: session };
          },
        },
      },
    },
    // Batasi percobaan login (brute force)
    rateLimit: { enabled: true, window: 60, max: 60 },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof buildAuth>;
export type AuthSession = Auth["$Infer"]["Session"];

const g = globalThis as unknown as { __auth?: { key: string; auth: Auth } };

/**
 * Instance Better Auth dibuat ulang otomatis saat Client ID/Secret Google
 * diubah dari halaman Pengaturan (tanpa restart server).
 */
export async function getAuth(): Promise<Auth> {
  const google = await getGoogleConfig();
  const key = google.enabled ? `${google.clientId}:${google.clientSecret}` : "off";
  if (g.__auth?.key !== key) g.__auth = { key, auth: buildAuth(google) };
  return g.__auth.auth;
}

export async function isGoogleLoginEnabled() {
  return (await getGoogleConfig()).enabled;
}
