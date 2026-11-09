import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";

/** Login Google aktif hanya jika kredensial OAuth diisi di .env */
export const googleAuthEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // Akun staf dibuat oleh owner dari dashboard, bukan daftar mandiri
    disableSignUp: true,
    minPasswordLength: 6,
  },
  socialProviders: googleAuthEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          // Hanya email yang sudah didaftarkan owner yang boleh masuk.
          // Akun Google asing ditolak (error=signup_disabled), tidak dibuatkan user baru.
          disableSignUp: true,
          prompt: "select_account",
        },
      }
    : undefined,
  account: {
    accountLinking: {
      enabled: true,
      // Google sudah memverifikasi kepemilikan email, jadi akun Google boleh
      // otomatis ditautkan ke user staf dengan email yang sama. Peran (owner/kasir/dapur)
      // tetap mengikuti data user yang dibuat owner.
      trustedProviders: ["google"],
      // User staf dibuat owner tanpa verifikasi email, jadi jangan wajibkan emailVerified lokal.
      requireLocalEmailVerified: false,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 },
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "KASIR" },
      outletId: { type: "string", input: false, required: false },
      isActive: { type: "boolean", input: false, defaultValue: true },
    },
  },
  databaseHooks: {
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

export type AuthSession = typeof auth.$Infer.Session;
