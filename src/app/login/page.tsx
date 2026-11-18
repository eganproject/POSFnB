import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { ROLE_HOME } from "@/lib/constants";
import { isGoogleLoginEnabled } from "@/lib/auth";
import { SignOutButton } from "@/components/customer/sign-out-button";
import { BRAND, BRAND_PHOTOS } from "@/lib/brand";
import { BrandMark } from "@/components/shared/brand-mark";
import { LoginForm } from "./login-form";

const GOOGLE_ERRORS: Record<string, string> = {
  signup_disabled: "Email Google ini belum terdaftar sebagai staf. Minta owner menambahkan email Anda terlebih dahulu.",
  account_not_linked: "Akun Google tidak bisa ditautkan ke akun staf ini. Coba masuk dengan email & password.",
  unable_to_create_session: "Akun Anda dinonaktifkan. Hubungi owner.",
  email_not_found: "Akun Google tidak memberikan alamat email.",
  access_denied: "Login Google dibatalkan.",
};

export const metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const user = await getSessionUser();
  if (user && user.role !== "CUSTOMER") redirect(ROLE_HOME[user.role]);
  const googleAuthEnabled = await isGoogleLoginEnabled();
  const { next, error } = await searchParams;
  const errorMessage = error ? (GOOGLE_ERRORS[error] ?? "Gagal masuk dengan Google. Silakan coba lagi.") : undefined;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-olive p-12 text-cream lg:flex lg:flex-col lg:justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND_PHOTOS.interior[0]} alt="" className="absolute inset-0 size-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-t from-olive-deep via-olive-deep/70 to-olive/60" />
        <div className="relative flex items-center gap-3">
          <BrandMark className="size-10" />
          <span className="font-display text-3xl leading-none tracking-wide">{BRAND.shortName}</span>
        </div>
        <div className="relative space-y-6">
          <h1 className="max-w-md font-display text-5xl leading-[1.05]">Selamat bertugas di Warm Hour.</h1>
          <ul className="space-y-3 text-cream/85">
            {[
              "Tamu pesan & bayar sendiri lewat QR meja",
              "Pesanan masuk bar dan dapur secara realtime",
              "Kasir cepat dengan split bill & cetak struk",
              "Laporan penjualan & shift otomatis",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full bg-cream/20 text-xs">✓</span> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-cream/60">
          © {new Date().getFullYear()} {BRAND.name} · sistem oleh {BRAND.poweredBy}
        </p>
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-olive-deep lg:hidden">
              <BrandMark className="size-9" /> <span className="font-display text-2xl leading-none tracking-wide">{BRAND.shortName}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Masuk ke akun staf</h2>
            <p className="text-sm text-muted-foreground">{googleAuthEnabled
                ? "Gunakan email & password dari owner, atau akun Google dengan email yang sudah didaftarkan."
                : "Gunakan email & password yang diberikan owner."}</p>
          </div>
          {user?.role === "CUSTOMER" && (
            <div role="alert" className="space-y-3 rounded-xl border border-honey/40 bg-honey/10 px-4 py-3 text-sm">
              <p>
                Anda masuk sebagai <b>pelanggan</b> ({user.email}). Akun ini bukan akun staf. Minta owner mendaftarkan email ini
                sebagai staf, atau keluar lalu masuk dengan akun staf.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/akun" className="rounded-full border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">Ke akun pelanggan</Link>
                <SignOutButton className="rounded-full border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted" redirectTo="/login" />
              </div>
            </div>
          )}
          {errorMessage && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
          <LoginForm next={next} googleEnabled={googleAuthEnabled} showDemo={process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGIN === "true"} />
        </div>
      </main>
    </div>
  );
}
