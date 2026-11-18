"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FlaskConical,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TimerOff,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn, formatRupiah } from "@/lib/utils";
import { CHANNEL_INFO, isCoreChannel, payInstructions, type CoreAction, type CoreChannel } from "@/lib/payment-channels";
import type { OnlinePaymentView } from "@/lib/payment-view";
import { simulatePayment } from "@/server/actions/customer";

export type ChannelOption = { id: CoreChannel; available: boolean; note: string | null };
type StartResult = { ok: true; data: OnlinePaymentView } | { ok: false; error: string };

/** Logo teks sederhana per kanal (tanpa aset pihak ketiga) */
export function ChannelBadge({ channel, className }: { channel: CoreChannel; className?: string }) {
  const info = CHANNEL_INFO[channel];
  return (
    <span
      className={cn("grid h-9 min-w-12 shrink-0 place-items-center rounded-lg px-2 text-[11px] font-black tracking-tight text-white shadow-sm", className)}
      style={{ background: info.color }}
      aria-hidden
    >
      {info.short}
    </span>
  );
}

function useCountdown(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (!expiresAt) return { left: null as number | null, label: "" };
  const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const label = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return { left, label };
}

function useQrDataUrl(text: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!text) {
      setUrl(null);
      return;
    }
    QRCode.toDataURL(text, { margin: 1, width: 560, errorCorrectionLevel: "M", color: { dark: "#1f2418", light: "#ffffff" } })
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [text]);
  return url;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)), []);
  return mobile;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          toast.success(`${label} disalin`);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Tidak bisa menyalin, salin manual ya");
        }
      }}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition",
        done ? "border-success/40 bg-success/10 text-success" : "bg-card hover:bg-muted"
      )}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {done ? "Tersalin" : "Salin"}
    </button>
  );
}

/** Pilihan metode bayar Core API */
export function ChannelPicker({
  channels,
  onPick,
  busy,
  compact,
}: {
  channels: ChannelOption[];
  onPick: (c: CoreChannel) => void;
  busy: CoreChannel | null;
  compact?: boolean;
}) {
  const groups = useMemo(() => {
    const by = (kinds: string[]) => channels.filter((c) => kinds.includes(CHANNEL_INFO[c.id].kind));
    return [
      { key: "qris", title: "Scan QR", icon: QrCode, items: by(["qris"]) },
      { key: "ewallet", title: "E-wallet", icon: Wallet, items: by(["ewallet"]) },
      { key: "va", title: "Transfer bank (Virtual Account)", icon: Building2, items: by(["va", "bill"]) },
    ].filter((g) => g.items.length);
  }, [channels]);

  if (!channels.length) {
    return <p className="rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground">Belum ada metode bayar online yang aktif. Silakan bayar di kasir.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key} className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <g.icon className="size-3.5" /> {g.title}
          </p>
          <div className={cn("grid grid-cols-1 gap-2", g.key === "ewallet" && !compact && "sm:grid-cols-2")}>
            {g.items.map((c) => {
              const info = CHANNEL_INFO[c.id];
              const featured = c.id === "qris" && !compact;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!c.available || busy !== null}
                  onClick={() => onPick(c.id)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition",
                    "hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed",
                    featured && "border-primary/40 bg-primary/5 p-4",
                    !c.available && "opacity-55"
                  )}
                >
                  <ChannelBadge channel={c.id} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {info.label}
                      {featured && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Disarankan</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{c.available ? info.desc : c.note ?? "Belum aktif"}</span>
                  </span>
                  {busy === c.id ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <ChevronDown className="size-4 -rotate-90 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Pembayaran aman diproses Midtrans
      </p>
    </div>
  );
}

function QrBox({ src, alt, size = "md" }: { src: string | null; alt: string; size?: "md" | "lg" }) {
  return (
    <div className={cn("relative mx-auto grid aspect-square place-items-center rounded-3xl border-[6px] border-white bg-white shadow-lg ring-1 ring-black/5", size === "lg" ? "w-full max-w-80" : "w-full max-w-64")}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full rounded-2xl object-contain" />
      ) : (
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

function Instructions({ channel }: { channel: CoreChannel }) {
  const blocks = payInstructions(channel);
  return (
    <div className="divide-y overflow-hidden rounded-2xl border bg-card">
      {blocks.map((b, i) => (
        <details key={b.title} open={i === 0} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
            {b.title}
            <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
          </summary>
          <ol className="space-y-2 px-4 pb-4 text-sm text-muted-foreground">
            {b.steps.map((s, n) => (
              <li key={n} className="flex gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{n + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}

/** Tampilan detail tagihan untuk kanal yang dipilih */
function PaymentDetail({ view, action, variant }: { view: OnlinePaymentView; action: CoreAction; variant: "customer" | "cashier" }) {
  const info = CHANNEL_INFO[action.channel];
  const mobile = useIsMobile();
  const [showQr, setShowQr] = useState(false);
  // QRIS: render dari qr_string. GoPay: qr_string bila ada. ShopeePay di desktop: QR dari deeplink.
  const qrText = action.qrString ?? (info.kind === "ewallet" && !action.qrUrl ? action.deeplink : null);
  const qrData = useQrDataUrl(qrText);
  const qrSrc = qrData ?? action.qrUrl ?? null;

  if (info.kind === "qris" || (info.kind === "ewallet" && (variant === "cashier" || !mobile || showQr || !action.deeplink))) {
    return (
      <div className="space-y-4">
        <div className="space-y-3 rounded-3xl bg-gradient-to-b from-primary/10 to-transparent p-4 text-center">
          <QrBox src={qrSrc} alt={`QR ${info.label}`} size={variant === "cashier" ? "lg" : "md"} />
          <p className="text-sm font-medium">
            {info.kind === "qris"
              ? "Scan dengan aplikasi e-wallet atau m-banking apa saja"
              : `Scan dengan aplikasi ${action.channel === "gopay" ? "Gojek / GoPay" : "Shopee"}${action.channel === "shopeepay" ? " atau kamera HP" : ""}`}
          </p>
          {info.kind === "qris" && (
            <div className="flex flex-wrap justify-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
              {["GoPay", "OVO", "DANA", "ShopeePay", "LinkAja", "BCA", "Mandiri", "BRI"].map((x) => (
                <span key={x} className="rounded-full border bg-card px-2 py-0.5">{x}</span>
              ))}
            </div>
          )}
          {variant === "customer" && qrData && (
            <a href={qrData} download={`qris-${view.paymentId.slice(-6)}.png`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              <Download className="size-3.5" /> Simpan QR ke galeri
            </a>
          )}
          {info.kind === "ewallet" && mobile && action.deeplink && variant === "customer" && (
            <button type="button" onClick={() => setShowQr(false)} className="block w-full text-xs font-semibold text-primary hover:underline">
              Bayar dari HP ini saja
            </button>
          )}
        </div>
        {variant === "customer" && <Instructions channel={action.channel} />}
      </div>
    );
  }

  if (info.kind === "ewallet") {
    return (
      <div className="space-y-4">
        <div className="space-y-3 rounded-3xl bg-gradient-to-b from-primary/10 to-transparent p-5 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl text-lg font-black text-white shadow-lg" style={{ background: info.color }}>
            <Smartphone className="size-8" />
          </span>
          <p className="text-sm text-muted-foreground">Kamu akan diarahkan ke aplikasi {info.label} untuk konfirmasi.</p>
          <Button asChild size="xl" className="w-full text-white" style={{ background: info.color }}>
            <a
              href={action.deeplink!}
              onClick={(e) => {
                if (action.demo) {
                  e.preventDefault();
                  toast.info(`Mode demo: di toko sungguhan tombol ini membuka aplikasi ${info.label}.`);
                }
              }}
            >
              Buka {info.label} <ExternalLink />
            </a>
          </Button>
          <button type="button" onClick={() => setShowQr(true)} className="text-xs font-semibold text-primary hover:underline">
            Bayar pakai HP lain? Tampilkan QR
          </button>
        </div>
        <Instructions channel={action.channel} />
      </div>
    );
  }

  // Virtual Account & Mandiri Bill
  const rows =
    info.kind === "bill"
      ? [
          { label: "Kode perusahaan (biller)", value: action.billerCode ?? "-" },
          { label: "Kode bayar", value: action.billKey ?? "-" },
        ]
      : [{ label: "Nomor Virtual Account", value: action.vaNumber ?? "-" }];
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: info.color }}>
          <Building2 className="size-5" />
          <span className="font-bold">{info.label}</span>
        </div>
        <div className="space-y-4 p-4">
          {rows.map((r) => (
            <div key={r.label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <div className="flex items-center justify-between gap-3">
                <p className="flex min-w-0 flex-wrap gap-x-2 font-mono text-[22px] font-extrabold tracking-wide tabular">
                  {(r.value.match(/.{1,4}/g) ?? [r.value]).map((part, i) => (
                    <span key={i} className="whitespace-nowrap">{part}</span>
                  ))}
                </p>
                <CopyButton value={r.value} label={r.label} />
              </div>
            </div>
          ))}
          <div className="space-y-1 border-t border-dashed pt-3">
            <p className="text-xs text-muted-foreground">Nominal transfer (harus persis)</p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-extrabold tabular">{formatRupiah(view.amount)}</p>
              <CopyButton value={String(view.amount)} label="Nominal" />
            </div>
          </div>
        </div>
      </div>
      <Instructions channel={action.channel} />
    </div>
  );
}

/**
 * Layar bayar Core API (tanpa popup Midtrans): pilih metode → QR / deeplink / nomor VA,
 * hitung mundur, dan status otomatis (cek ke Midtrans tiap beberapa detik).
 */
export function CorePayment({
  amount,
  channels,
  initial,
  start,
  onPaid,
  onChange,
  variant = "customer",
  demo,
}: {
  amount: number;
  channels: ChannelOption[];
  /** Tagihan Core API yang masih pending (lanjutkan setelah halaman dimuat ulang) */
  initial: OnlinePaymentView | null;
  start: (channel: CoreChannel) => Promise<StartResult>;
  onPaid: () => void;
  /** Dipanggil saat tagihan gagal / kedaluwarsa / diganti (mis. untuk refresh data) */
  onChange?: () => void;
  variant?: "customer" | "cashier";
  demo: boolean;
}) {
  const [view, setView] = useState<OnlinePaymentView | null>(initial?.mode === "core" && initial.action ? initial : null);
  const [busy, setBusy] = useState<CoreChannel | null>(null);
  const [state, setState] = useState<"PENDING" | "SUCCESS" | "FAILED" | "EXPIRED">("PENDING");
  const [simulating, setSimulating] = useState<"ok" | "fail" | null>(null);
  const { left, label: countdown } = useCountdown(view?.expiresAt ?? null);
  const paidRef = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Tagihan baru dari server (mis. setelah refresh) menggantikan tampilan
  useEffect(() => {
    if (initial?.mode === "core" && initial.action && initial.paymentId !== view?.paymentId) {
      setView(initial);
      setState("PENDING");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.paymentId]);

  const pick = useCallback(
    async (channel: CoreChannel) => {
      setBusy(channel);
      const r = await start(channel);
      setBusy(null);
      if (!r.ok) {
        toast.error(r.error);
        onChangeRef.current?.();
        return;
      }
      setState("PENDING");
      setView(r.data);
    },
    [start]
  );

  const check = useCallback(async () => {
    if (!view || paidRef.current) return;
    const res = await fetch(`/api/payments/${view.paymentId}/sync`, { method: "POST" })
      .then((r) => r.json() as Promise<{ state?: string }>)
      .catch(() => null);
    const s = res?.state;
    if (s === "SUCCESS") {
      paidRef.current = true;
      setState("SUCCESS");
      onPaidRef.current();
    } else if (s === "FAILED" || s === "EXPIRED") {
      setState(s);
      onChangeRef.current?.();
    }
  }, [view]);

  // Status otomatis: cek berkala selama tagihan aktif (webhook juga memperbarui server)
  useEffect(() => {
    if (!view || state !== "PENDING") return;
    const first = setTimeout(check, 1500);
    const t = setInterval(check, demo ? 6000 : 4000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [view, state, check, demo]);

  // Waktu habis → pastikan status di server ikut diperbarui
  useEffect(() => {
    if (left === 0 && state === "PENDING") {
      check();
      setState("EXPIRED");
    }
  }, [left, state, check]);

  const simulate = async (ok: boolean) => {
    if (!view) return;
    setSimulating(ok ? "ok" : "fail");
    const r = await simulatePayment(view.paymentId, ok);
    setSimulating(null);
    if (!r.ok) return toast.error(r.error);
    if (ok) {
      paidRef.current = true;
      setState("SUCCESS");
      onPaidRef.current();
    } else {
      setState("FAILED");
      onChangeRef.current?.();
    }
  };

  const action = view?.action && isCoreChannel(view.action.channel) ? view.action : null;

  if (!view || !action) {
    return (
      <div className="space-y-4">
        <div className={cn("flex items-end justify-between gap-3", variant === "cashier" && "hidden")}>
          <div>
            <p className="text-sm text-muted-foreground">Total yang harus dibayar</p>
            <p className="text-2xl font-extrabold tabular">{formatRupiah(amount)}</p>
          </div>
          <p className="text-xs font-semibold text-muted-foreground">Pilih metode bayar</p>
        </div>
        <ChannelPicker channels={channels} onPick={pick} busy={busy} compact={variant === "cashier"} />
      </div>
    );
  }

  const info = CHANNEL_INFO[action.channel];
  if (state === "SUCCESS") {
    return (
      <div className="grid place-items-center gap-2 rounded-3xl bg-success/10 p-8 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-success text-white animate-pop">
          <Check className="size-8" />
        </span>
        <p className="text-lg font-bold">Pembayaran diterima</p>
        <p className="text-sm text-muted-foreground">
          {formatRupiah(view.amount)} via {info.label}
        </p>
      </div>
    );
  }

  const ended = state === "FAILED" || state === "EXPIRED";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setView(null)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Ganti metode
        </button>
        <div className="flex items-center gap-2">
          <ChannelBadge channel={action.channel} className="h-7 text-[10px]" />
          <span className="text-sm font-semibold">{info.label}</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-foreground px-4 py-3 text-background">
        <div>
          <p className="text-[11px] text-background/60">Total bayar</p>
          <p className="text-xl font-extrabold tabular">{formatRupiah(view.amount)}</p>
        </div>
        {!ended && left !== null && (
          <div className="text-right">
            <p className="text-[11px] text-background/60">Bayar sebelum</p>
            <p className={cn("font-mono text-lg font-bold tabular", left < 120 && "text-honey")}>{countdown}</p>
          </div>
        )}
      </div>

      {ended ? (
        <div className="grid place-items-center gap-3 rounded-3xl border border-dashed p-6 text-center">
          <TimerOff className="size-10 text-muted-foreground" />
          <div>
            <p className="font-bold">{state === "EXPIRED" ? "Waktu pembayaran habis" : "Tagihan ini sudah tidak berlaku"}</p>
            <p className="text-sm text-muted-foreground">Buat tagihan baru untuk melanjutkan. Jangan bayar ke kode lama.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => pick(action.channel)} loading={busy === action.channel}>
              <RefreshCw /> Buat ulang {info.short}
            </Button>
            <Button variant="outline" onClick={() => setView(null)}>
              Metode lain
            </Button>
          </div>
        </div>
      ) : (
        <>
          <PaymentDetail view={view} action={action} variant={variant} />
          <div className="flex items-center justify-center gap-2 rounded-full bg-muted/70 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Menunggu pembayaran, status diperbarui otomatis
          </div>
          {variant === "customer" && !demo && (
            <button type="button" onClick={check} className="block w-full text-center text-xs font-semibold text-primary hover:underline">
              Sudah bayar? Cek status sekarang
            </button>
          )}
        </>
      )}

      {demo && !ended && (
        <div className="space-y-2 rounded-2xl border border-dashed border-honey/60 bg-honey/10 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[oklch(0.45_0.1_70)]">
            <FlaskConical className="size-3.5" /> Mode demo: kode di atas tidak bisa dibayar sungguhan.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" loading={simulating === "fail"} onClick={() => simulate(false)}>
              Simulasi gagal
            </Button>
            <Button size="sm" variant="success" loading={simulating === "ok"} onClick={() => simulate(true)}>
              Simulasi berhasil
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
