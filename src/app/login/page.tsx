import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ROLE_HOME } from "@/lib/constants";
import { googleAuthEnabled } from "@/lib/auth";
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
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const { next, error } = await searchParams;
  const errorMessage = error ? (GOOGLE_ERRORS[error] ?? "Gagal masuk dengan Google. Silakan coba lagi.") : undefined;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 size-[28rem] rounded-full bg-amber-500/20 blur-3xl" />
        <div className="relative flex items-center gap-2.5 text-lg font-bold">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-xl">🍽️</span> Santap POS
        </div>
        <div className="relative space-y-6">
          <h1 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">
            Kelola restoran lebih ringan, dari meja sampai dapur.
          </h1>
          <ul className="space-y-3 text-sidebar-foreground/80">
            {[
              "Customer pesan & bayar sendiri lewat QR meja",
              "Pesanan masuk dapur secara realtime",
              "Kasir cepat dengan split bill & cetak struk",
              "Laporan penjualan & shift otomatis",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full bg-primary/25 text-xs text-primary">✓</span> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-sidebar-foreground/50">© {new Date().getFullYear()} Santap POS</p>
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-lg font-bold lg:hidden">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-lg">🍽️</span> Santap POS
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Masuk ke akun staf</h2>
            <p className="text-sm text-muted-foreground">{googleAuthEnabled
                ? "Gunakan email & password dari owner, atau akun Google dengan email yang sudah didaftarkan."
                : "Gunakan email & password yang diberikan owner."}</p>
          </div>
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
