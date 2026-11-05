import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ROLE_HOME } from "@/lib/constants";
import { LoginForm } from "./login-form";

export const metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const { next } = await searchParams;
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
            <p className="text-sm text-muted-foreground">Gunakan email & password yang diberikan owner.</p>
          </div>
          <LoginForm next={next} showDemo={process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGIN === "true"} />
        </div>
      </main>
    </div>
  );
}
