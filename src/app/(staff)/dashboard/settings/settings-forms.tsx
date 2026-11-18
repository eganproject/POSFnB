"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppWindow, Check, Copy, CreditCard, ExternalLink, KeyRound, LayoutTemplate, ListChecks, PlugZap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/misc";
import { checkMidtransChannels, saveGoogleSettings, saveMidtransMode, saveMidtransSettings, testMidtransConnection } from "@/server/actions/settings";
import { CHANNEL_INFO, CORE_CHANNELS, type CoreChannel, type MidtransMode } from "@/lib/payment-channels";
import { ChannelBadge } from "@/components/shared/core-payment";
import { cn } from "@/lib/utils";

type ChannelStatus = { ok: boolean; message: string; at: string };

type Source = "settings" | "env" | "none";

const SOURCE_BADGE: Record<Source, { label: string; variant: "success" | "info" | "secondary" }> = {
  settings: { label: "Aktif · dari Pengaturan", variant: "success" },
  env: { label: "Aktif · dari file .env", variant: "info" },
  none: { label: "Belum diatur", variant: "secondary" },
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border bg-muted/50 py-1.5 pl-3 pr-1.5">
        <code className="min-w-0 flex-1 truncate text-xs">{value}</code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(value).catch(() => null);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
          aria-label={`Salin ${label}`}
        >
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, desc, source, children }: { icon: typeof KeyRound; title: string; desc: React.ReactNode; source: Source; children: React.ReactNode }) {
  const b = SOURCE_BADGE[source];
  return (
    <section className="rounded-2xl border bg-card shadow-xs">
      <header className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
          <div>
            <h2 className="font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </div>
        </div>
        <Badge variant={b.variant} className="self-start">{b.label}</Badge>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function SettingsForms({
  midtrans,
  paymentMode,
  google,
  updatedAt,
}: {
  paymentMode: {
    mode: MidtransMode;
    modeFromSettings: boolean;
    channels: CoreChannel[];
    status: Partial<Record<CoreChannel, ChannelStatus>>;
    keysReady: boolean;
    isProduction: boolean;
  };
  midtrans: {
    source: Source;
    isProduction: boolean;
    storedServerKeyMasked: string | null;
    storedServerKeyBroken: boolean;
    storedClientKey: string;
    storedIsProduction: boolean;
    webhookUrl: string;
    finishUrl: string;
  };
  google: {
    source: Source;
    storedClientId: string;
    storedSecretMasked: string | null;
    storedSecretBroken: boolean;
    redirectUri: string;
    origin: string;
  };
  updatedAt: string | null;
}) {
  const router = useRouter();
  const [prod, setProd] = useState(midtrans.storedIsProduction);
  const [savingMid, startMid] = useTransition();
  const [savingGoogle, startGoogle] = useTransition();
  const [testing, startTest] = useTransition();

  const brokenNote = (
    <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      Secret tersimpan tidak bisa dibaca (BETTER_AUTH_SECRET di server berubah). Isi ulang lalu simpan.
    </p>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Section
        icon={CreditCard}
        title="Pembayaran online (Midtrans)"
        source={midtrans.source}
        desc={
          midtrans.source === "none"
            ? "Belum ada key, jadi pembayaran online berjalan di mode demo (simulasi)."
            : `Mode ${midtrans.isProduction ? "Production (uang asli)" : "Sandbox (uji coba)"}.`
        }
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            startMid(async () => {
              const r = await saveMidtransSettings({
                serverKey: String(f.get("serverKey") || ""),
                clientKey: String(f.get("clientKey") || ""),
                isProduction: prod,
              });
              if (!r.ok) return void toast.error(r.error);
              toast.success("Key Midtrans disimpan dan langsung aktif");
              (e.target as HTMLFormElement).querySelector<HTMLInputElement>("input[name=serverKey]")!.value = "";
              router.refresh();
            });
          }}
        >
          {midtrans.storedServerKeyBroken && brokenNote}
          <Field
            label="Server Key"
            hint={midtrans.storedServerKeyMasked ? `Tersimpan: ${midtrans.storedServerKeyMasked}. Kosongkan jika tidak ingin mengganti.` : "Rahasia. Disimpan terenkripsi dan tidak pernah ditampilkan utuh."}
          >
            <Input name="serverKey" type="password" autoComplete="off" placeholder={midtrans.storedServerKeyMasked ?? "SB-Mid-server-…"} />
          </Field>
          <Field label="Client Key" hint="Boleh publik, dipakai untuk membuka jendela bayar Snap (tidak dipakai di mode Core API).">
            <Input name="clientKey" defaultValue={midtrans.storedClientKey} autoComplete="off" placeholder="SB-Mid-client-…" required />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
            <span>
              Mode Production
              <span className="block text-xs text-muted-foreground">Matikan untuk Sandbox (key diawali SB-)</span>
            </span>
            <Switch checked={prod} onCheckedChange={setProd} />
          </label>
          <div className="grid gap-3 rounded-xl bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              Isi di dashboard Midtrans → Settings → <b>Payment</b> → Notification URL:
            </p>
            <CopyRow label="Payment Notification URL" value={midtrans.webhookUrl} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={savingMid}><ShieldCheck /> Simpan</Button>
            <Button
              type="button"
              variant="outline"
              loading={testing}
              onClick={() =>
                startTest(async () => {
                  const r = await testMidtransConnection();
                  (r.ok ? toast.success : toast.error)(r.message);
                })
              }
            >
              <PlugZap /> Uji koneksi
            </Button>
            {(midtrans.storedServerKeyMasked || midtrans.storedClientKey) && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={savingMid}
                onClick={() =>
                  startMid(async () => {
                    const r = await saveMidtransSettings({ isProduction: false, clear: true });
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Key Midtrans dihapus dari Pengaturan");
                    router.refresh();
                  })
                }
              >
                Hapus key
              </Button>
            )}
          </div>
          <a href="https://dashboard.sandbox.midtrans.com/settings/config_info" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            Ambil key di dashboard Midtrans <ExternalLink className="size-3" />
          </a>
        </form>
      </Section>

      <PaymentModeSection {...paymentMode} />

      <Section
        icon={KeyRound}
        title="Login Google"
        source={google.source}
        desc={
          google.source === "none"
            ? "Belum diatur, jadi tombol “Masuk dengan Google” disembunyikan."
            : "Pelanggan bisa masuk untuk melihat riwayat pesanan. Staf terdaftar juga bisa masuk dengan Google."
        }
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            startGoogle(async () => {
              const r = await saveGoogleSettings({
                clientId: String(f.get("clientId") || ""),
                clientSecret: String(f.get("clientSecret") || ""),
              });
              if (!r.ok) return void toast.error(r.error);
              toast.success("Login Google disimpan dan langsung aktif");
              (e.target as HTMLFormElement).querySelector<HTMLInputElement>("input[name=clientSecret]")!.value = "";
              router.refresh();
            });
          }}
        >
          {google.storedSecretBroken && brokenNote}
          <Field label="Client ID">
            <Input name="clientId" defaultValue={google.storedClientId} autoComplete="off" placeholder="1234…apps.googleusercontent.com" required />
          </Field>
          <Field
            label="Client Secret"
            hint={google.storedSecretMasked ? `Tersimpan: ${google.storedSecretMasked}. Kosongkan jika tidak ingin mengganti.` : "Rahasia. Disimpan terenkripsi dan tidak pernah ditampilkan utuh."}
          >
            <Input name="clientSecret" type="password" autoComplete="off" placeholder={google.storedSecretMasked ?? "GOCSPX-…"} />
          </Field>
          <div className="grid gap-3 rounded-xl bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              Saat membuat OAuth Client (Web application) di Google Cloud Console, isi dua nilai ini:
            </p>
            <CopyRow label="Authorized JavaScript origins" value={google.origin} />
            <CopyRow label="Authorized redirect URIs" value={google.redirectUri} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={savingGoogle}><ShieldCheck /> Simpan</Button>
            {(google.storedClientId || google.storedSecretMasked) && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={savingGoogle}
                onClick={() =>
                  startGoogle(async () => {
                    const r = await saveGoogleSettings({ clear: true });
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Login Google dihapus dari Pengaturan");
                    router.refresh();
                  })
                }
              >
                Hapus
              </Button>
            )}
          </div>
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            Buka Google Cloud Console → Credentials <ExternalLink className="size-3" />
          </a>
        </form>
      </Section>

      <p className="text-xs text-muted-foreground xl:col-span-2">
        Nilai di halaman ini lebih diutamakan daripada file .env. Jika dihapus, aplikasi kembali memakai .env.
        {updatedAt && ` Terakhir diubah ${new Date(updatedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}.`}
      </p>
    </div>
  );
}

const MODES: { v: MidtransMode; title: string; icon: typeof AppWindow; desc: string; points: string[] }[] = [
  {
    v: "snap",
    title: "Snap (popup Midtrans)",
    icon: AppWindow,
    desc: "Jendela bayar bawaan Midtrans. Paling mudah, semua metode yang aktif di akun langsung muncul.",
    points: ["Tampilan dari Midtrans", "Kartu kredit, paylater, dll ikut tersedia"],
  },
  {
    v: "core",
    title: "Core API (tampilan sendiri)",
    icon: LayoutTemplate,
    desc: "Layar bayar bergaya outlet di aplikasi ini, tanpa popup. QR, tombol buka e-wallet, dan nomor VA tampil langsung.",
    points: ["QRIS + hitung mundur", "GoPay / ShopeePay buka aplikasi di HP, QR di layar kasir", "Virtual Account dengan tombol salin & cara bayar"],
  },
];

function PaymentModeSection({
  mode: initialMode,
  modeFromSettings,
  channels: initialChannels,
  status,
  keysReady,
  isProduction,
}: {
  mode: MidtransMode;
  modeFromSettings: boolean;
  channels: CoreChannel[];
  status: Partial<Record<CoreChannel, ChannelStatus>>;
  keysReady: boolean;
  isProduction: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<MidtransMode>(initialMode);
  const [channels, setChannels] = useState<CoreChannel[]>(initialChannels);
  const [saving, startSave] = useTransition();
  const [checking, startCheck] = useTransition();
  const dirty = mode !== initialMode || channels.join() !== initialChannels.join();
  const toggle = (c: CoreChannel) => setChannels((list) => (list.includes(c) ? list.filter((x) => x !== c) : CORE_CHANNELS.filter((x) => x === c || list.includes(x))));

  return (
    <section className="rounded-2xl border bg-card shadow-xs xl:col-span-2">
      <header className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><LayoutTemplate className="size-5" /></span>
          <div>
            <h2 className="font-bold">Tampilan pembayaran online</h2>
            <p className="text-sm text-muted-foreground">Berlaku untuk pelanggan (menu QR & takeaway) dan kasir (QRIS / E-wallet).</p>
          </div>
        </div>
        <Badge variant={modeFromSettings ? "success" : "secondary"} className="self-start">
          {initialMode === "core" ? "Core API" : "Snap"}{modeFromSettings ? "" : " · bawaan"}
        </Badge>
      </header>
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="grid content-start gap-3">
          {MODES.map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => setMode(m.v)}
              className={cn(
                "flex gap-3 rounded-2xl border p-4 text-left transition",
                mode === m.v ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/60"
              )}
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", mode === m.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <m.icon className="size-5" />
              </span>
              <span className="space-y-1">
                <span className="flex items-center gap-2 font-semibold">
                  {m.title}
                  {mode === m.v && <Check className="size-4 text-primary" />}
                </span>
                <span className="block text-xs text-muted-foreground">{m.desc}</span>
                <span className="flex flex-wrap gap-1 pt-1">
                  {m.points.map((p) => (
                    <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{p}</span>
                  ))}
                </span>
              </span>
            </button>
          ))}
          {!keysReady && (
            <p className="rounded-xl bg-honey/15 px-3 py-2 text-xs text-[oklch(0.45_0.1_70)]">
              Key Midtrans belum diisi: kedua mode berjalan sebagai simulasi (mode demo) sehingga tampilannya tetap bisa dicoba.
            </p>
          )}
        </div>

        <div className={cn("space-y-3", mode !== "core" && "pointer-events-none opacity-50")} aria-disabled={mode !== "core"}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Metode yang ditawarkan (Core API)</p>
            <span className="text-xs text-muted-foreground">{channels.length} dipilih</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {CORE_CHANNELS.map((c) => {
              const st = status[c];
              const on = channels.includes(c);
              return (
                <label key={c} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition", on ? "border-primary/50 bg-primary/5" : "hover:bg-muted/60")}>
                  <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={on} onChange={() => toggle(c)} />
                  <ChannelBadge channel={c} className="h-7 min-w-10 text-[10px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{CHANNEL_INFO[c].label}</span>
                    {st && (
                      <span className={cn("block truncate text-[11px]", st.ok ? "text-success" : "text-destructive")} title={st.message}>
                        {st.ok ? "✓ Aktif" : `✕ ${st.message}`}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Di kasir hanya QRIS, GoPay, dan ShopeePay yang ditampilkan (QR di layar). Metode yang ditolak Midtrans saat dicek atau saat dipakai
            otomatis disembunyikan sampai dicek ulang.
          </p>
          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Aktifkan di dashboard Midtrans {isProduction ? "Production" : "Sandbox"}</p>
            <p>Settings → Payment → aktifkan metode yang dipilih (QRIS, GoPay, ShopeePay, Bank Transfer per bank, Mandiri Bill). Di Production, setiap metode perlu disetujui Midtrans dulu.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
          <Button
            loading={saving}
            disabled={!dirty}
            onClick={() =>
              startSave(async () => {
                const r = await saveMidtransMode({ mode, channels });
                if (!r.ok) return void toast.error(r.error);
                toast.success(mode === "core" ? "Mode Core API aktif. Pelanggan & kasir memakai layar bayar baru." : "Mode Snap aktif.");
                router.refresh();
              })
            }
          >
            <ShieldCheck /> Simpan tampilan
          </Button>
          <Button
            variant="outline"
            loading={checking}
            disabled={!keysReady || mode !== "core" || dirty}
            title={dirty ? "Simpan dulu sebelum cek" : undefined}
            onClick={() =>
              startCheck(async () => {
                const r = await checkMidtransChannels();
                (r.ok ? toast.success : toast.error)(r.message);
                router.refresh();
              })
            }
          >
            <ListChecks /> Cek metode aktif
          </Button>
          <span className="text-xs text-muted-foreground">
            {keysReady ? "Cek membuat transaksi uji Rp10.000 per metode lalu langsung dibatalkan." : "Isi key Midtrans untuk bisa cek metode."}
          </span>
        </div>
      </div>
    </section>
  );
}
