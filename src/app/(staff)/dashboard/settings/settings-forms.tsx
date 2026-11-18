"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, CreditCard, ExternalLink, KeyRound, PlugZap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/misc";
import { saveGoogleSettings, saveMidtransSettings, testMidtransConnection } from "@/server/actions/settings";

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
  google,
  updatedAt,
}: {
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
          <Field label="Client Key" hint="Boleh publik, dipakai untuk membuka jendela bayar Snap.">
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
