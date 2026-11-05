"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderStatus, PaymentMethod, PaymentStatus, OrderType } from "@prisma/client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArrowLeft, Banknote, Bell, Check, ChefHat, Clock, CreditCard, HandPlatter, PartyPopper, Receipt, UtensilsCrossed, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn, formatRupiah, pad } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { useRealtime } from "@/hooks/use-realtime";
import { useSnap } from "@/hooks/use-snap";
import { Button } from "@/components/ui/button";
import { DemoPaymentDialog } from "@/components/shared/demo-payment";
import { callStaff, startOnlinePayment, switchToCashier } from "@/server/actions/customer";

type TrackerOrder = {
  id: string;
  code: string;
  queueNumber: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  payPreference: PaymentMethod | null;
  type: OrderType;
  customerName: string | null;
  note: string | null;
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  total: number;
  paid: number;
  createdAt: string;
  confirmedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  cancelReason: string | null;
  outlet: { id: string; name: string; slug: string; taxRate: number; serviceRate: number };
  table: { name: string; qrToken: string } | null;
  pendingPaymentId: string | null;
  ahead: number;
  etaMinutes: number | null;
  items: { id: string; name: string; quantity: number; lineTotal: number; note: string | null; modifiers: string[] }[];
  payments: { id: string; method: PaymentMethod; amount: number; gatewayType: string | null }[];
};

const STEPS: { key: OrderStatus; label: string; icon: typeof Check }[] = [
  { key: "PENDING", label: "Dibuat", icon: Receipt },
  { key: "CONFIRMED", label: "Diterima", icon: Check },
  { key: "PREPARING", label: "Dimasak", icon: ChefHat },
  { key: "READY", label: "Siap", icon: HandPlatter },
  { key: "COMPLETED", label: "Selesai", icon: PartyPopper },
];
const ORDER_INDEX: Record<OrderStatus, number> = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY: 3, COMPLETED: 4, CANCELLED: -1 };

export function OrderTracker({
  order,
  autoPay,
  demo,
  clientKey,
  isProduction,
}: {
  order: TrackerOrder;
  autoPay: boolean;
  demo: boolean;
  clientKey: string;
  isProduction: boolean;
}) {
  const router = useRouter();
  const remaining = Math.max(0, order.total - order.paid);
  const needsOnlinePay = order.status !== "CANCELLED" && order.payPreference === "MIDTRANS" && remaining > 0;
  const snap = useSnap(clientKey, isProduction, !demo && needsOnlinePay);
  const [paying, setPaying] = useState(false);
  const [demoPayment, setDemoPayment] = useState<string | null>(null);
  const autoTried = useRef(false);
  const prevStatus = useRef(order.status);

  useRealtime(`/api/stream/order/${order.id}`);

  // Perbarui estimasi waktu secara berkala selama pesanan diproses
  useEffect(() => {
    if (order.status !== "CONFIRMED" && order.status !== "PREPARING") return;
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [order.status, router]);

  // Notifikasi saat status berubah
  useEffect(() => {
    if (prevStatus.current !== order.status) {
      if (order.status === "READY") {
        toast.success("Pesananmu sudah siap! 🎉");
        navigator.vibrate?.([200, 100, 200]);
      } else if (order.status === "CONFIRMED") toast.success("Pesanan diterima dapur");
      prevStatus.current = order.status;
    }
  }, [order.status]);

  // Polling status Midtrans (webhook tidak sampai ke localhost)
  useEffect(() => {
    if (demo || !order.pendingPaymentId || !needsOnlinePay) return;
    const id = order.pendingPaymentId;
    const check = async () => {
      const res = await fetch(`/api/payments/${id}/sync`, { method: "POST" }).then((r) => r.json()).catch(() => null);
      if (res?.state && res.state !== "PENDING") router.refresh();
    };
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [demo, order.pendingPaymentId, needsOnlinePay, router]);

  const pay = useCallback(async () => {
    setPaying(true);
    const res = await startOnlinePayment(order.id);
    if (!res.ok) {
      setPaying(false);
      toast.error(res.error);
      return;
    }
    if (res.data.demo) {
      setPaying(false);
      setDemoPayment(res.data.paymentId);
      return;
    }
    const sync = () => fetch(`/api/payments/${res.data.paymentId}/sync`, { method: "POST" }).finally(() => router.refresh());
    const opened = snap.pay(res.data.token, {
      onSuccess: () => {
        toast.success("Pembayaran berhasil!");
        sync();
      },
      onPending: () => {
        toast.info("Menunggu pembayaran diselesaikan");
        sync();
      },
      onError: () => toast.error("Pembayaran gagal, silakan coba lagi"),
      onClose: () => sync(),
    });
    if (!opened && res.data.redirectUrl) window.location.href = res.data.redirectUrl;
    setPaying(false);
  }, [order.id, snap, router]);

  useEffect(() => {
    if (!autoPay || autoTried.current || !needsOnlinePay) return;
    if (!demo && !snap.ready) return;
    autoTried.current = true;
    router.replace(`/order/${order.id}`, { scroll: false });
    pay();
  }, [autoPay, needsOnlinePay, demo, snap.ready, pay, order.id, router]);

  const idx = ORDER_INDEX[order.status];
  const cancelled = order.status === "CANCELLED";
  const hero = heroFor(order, needsOnlinePay);
  const menuHref = order.table ? `/t/${order.table.qrToken}` : `/m/${order.outlet.slug}`;

  return (
    <div className="mx-auto min-h-dvh max-w-xl bg-background pb-10">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href={menuHref} className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium hover:bg-muted">
          <ArrowLeft className="size-4" /> Menu
        </Link>
        <p className="text-sm font-semibold">{order.outlet.name}</p>
        <Link href={`/receipt/${order.id}`} className="rounded-full px-2 py-1.5 text-sm font-medium text-primary hover:bg-muted">
          Struk
        </Link>
      </div>

      <div className="space-y-4 px-4">
        {/* Kartu status */}
        <section className={cn("relative overflow-hidden rounded-3xl p-6 text-white shadow-xl", hero.bg)}>
          <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-white/75">Nomor pesanan</p>
              <p className="text-5xl font-black tracking-tight tabular">#{pad(order.queueNumber)}</p>
              <p className="text-xs text-white/70">
                {order.code} · {order.table ? order.table.name : "Takeaway"}
              </p>
            </div>
            <div className={cn("grid size-16 place-items-center rounded-2xl bg-white/20 backdrop-blur", !cancelled && order.status !== "COMPLETED" && "animate-pulse-ring")}>
              <hero.icon className="size-8" />
            </div>
          </div>
          <div className="relative mt-5 space-y-1">
            <h1 className="text-xl font-bold">{hero.title}</h1>
            <p className="text-sm text-white/85">{hero.desc}</p>
          </div>
          {(order.status === "CONFIRMED" || order.status === "PREPARING") && order.etaMinutes !== null && (
            <div className="relative mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-white/20 px-3 py-1.5 backdrop-blur">⏱ Estimasi siap ± {order.etaMinutes} menit</span>
              {order.status === "CONFIRMED" && (
                <span className="rounded-full bg-white/20 px-3 py-1.5 backdrop-blur">
                  {order.ahead > 0 ? `${order.ahead} pesanan di depanmu` : "Kamu antrean berikutnya"}
                </span>
              )}
            </div>
          )}
        </section>

        {/* Pembayaran */}
        {needsOnlinePay && (
          <section className="space-y-3 rounded-3xl border-2 border-primary/30 bg-primary/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total yang harus dibayar</p>
                <p className="text-2xl font-extrabold tabular">{formatRupiah(remaining)}</p>
              </div>
              <CreditCard className="size-8 text-primary" />
            </div>
            <Button size="xl" className="w-full" loading={paying} onClick={pay} disabled={!demo && !snap.ready}>
              Bayar sekarang
            </Button>
            {order.status === "PENDING" && (
              <button
                onClick={async () => {
                  const r = await switchToCashier(order.id);
                  if (r.ok) {
                    toast.success("Silakan bayar di kasir");
                    router.refresh();
                  } else toast.error(r.error);
                }}
                className="w-full text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
              >
                Bayar di kasir saja
              </button>
            )}
          </section>
        )}

        {/* Progress */}
        {!cancelled && (
          <section className="rounded-3xl border bg-card p-5">
            <ol className="relative flex justify-between">
              <div className="absolute left-5 right-5 top-5 h-1 rounded-full bg-muted" />
              <div
                className="absolute left-5 top-5 h-1 rounded-full bg-primary transition-all duration-700"
                style={{ width: `calc((100% - 2.5rem) * ${Math.max(0, idx) / (STEPS.length - 1)})` }}
              />
              {STEPS.map((s, i) => {
                const done = i <= idx;
                const current = i === idx;
                const time = [order.createdAt, order.confirmedAt, order.preparingAt, order.readyAt, order.completedAt][i];
                return (
                  <li key={s.key} className="relative z-10 flex w-14 flex-col items-center gap-1.5 text-center">
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-full border-4 border-card transition-all",
                        done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        current && "scale-110 shadow-lg shadow-primary/30"
                      )}
                    >
                      <s.icon className="size-4" />
                    </span>
                    <span className={cn("text-[11px] font-semibold", done ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
                    {time && done && <span className="text-[10px] text-muted-foreground tabular">{format(new Date(time), "HH:mm")}</span>}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Detail */}
        <section className="space-y-3 rounded-3xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Rincian pesanan</h2>
            <span className="text-xs text-muted-foreground">
              {format(new Date(order.createdAt), "d MMM yyyy, HH:mm", { locale: localeId })}
            </span>
          </div>
          <ul className="space-y-3">
            {order.items.map((i) => (
              <li key={i.id} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-bold">{i.quantity}</span>
                <div className="flex-1">
                  <p className="font-medium">{i.name}</p>
                  {i.modifiers.length > 0 && <p className="text-xs text-muted-foreground">{i.modifiers.join(", ")}</p>}
                  {i.note && <p className="text-xs italic text-muted-foreground">“{i.note}”</p>}
                </div>
                <span className="tabular">{formatRupiah(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          {order.note && <p className="rounded-xl bg-muted/60 p-3 text-xs">📝 {order.note}</p>}
          <div className="space-y-1.5 border-t border-dashed pt-3 text-sm">
            <Line label="Subtotal" v={order.subtotal} />
            {order.discount > 0 && <Line label="Diskon" v={-order.discount} />}
            {order.serviceCharge > 0 && <Line label="Service" v={order.serviceCharge} />}
            {order.tax > 0 && <Line label="Pajak" v={order.tax} />}
            <div className="flex justify-between pt-1 text-base font-bold">
              <span>Total</span>
              <span className="tabular">{formatRupiah(order.total)}</span>
            </div>
            {order.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-success">
                <span>Dibayar · {p.gatewayType ? p.gatewayType.replace(/_/g, " ").toUpperCase() : PAYMENT_METHOD_LABEL[p.method]}</span>
                <span className="tabular">{formatRupiah(p.amount)}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" className="h-12">
            <Link href={menuHref}>
              <UtensilsCrossed /> Pesan lagi
            </Link>
          </Button>
          {order.table ? (
            <Button
              variant="outline"
              className="h-12"
              onClick={async () => {
                const r = await callStaff(order.table!.qrToken, "CALL_WAITER");
                if (r.ok) toast.success("Pelayan segera datang 🙌");
                else toast.error(r.error);
              }}
            >
              <Bell /> Panggil pelayan
            </Button>
          ) : (
            <Button asChild variant="outline" className="h-12">
              <Link href={`/receipt/${order.id}`}>
                <Receipt /> Lihat struk
              </Link>
            </Button>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">Halaman ini diperbarui otomatis. Simpan link ini untuk memantau pesanan.</p>
      </div>

      <DemoPaymentDialog
        open={!!demoPayment}
        onOpenChange={(o) => !o && setDemoPayment(null)}
        paymentId={demoPayment}
        amount={remaining}
        onDone={(ok) => {
          if (ok) toast.success("Pembayaran berhasil!");
          else toast.error("Pembayaran gagal");
          router.refresh();
        }}
      />
    </div>
  );
}

function Line({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular text-foreground">{formatRupiah(v)}</span>
    </div>
  );
}

function heroFor(order: TrackerOrder, needsOnlinePay: boolean) {
  const warm = "bg-gradient-to-br from-[oklch(0.6_0.19_38)] via-primary to-[oklch(0.75_0.16_65)]";
  switch (order.status) {
    case "PENDING":
      return needsOnlinePay
        ? { bg: warm, icon: CreditCard, title: "Menunggu pembayaran", desc: "Selesaikan pembayaran agar pesananmu langsung diproses dapur." }
        : { bg: "bg-gradient-to-br from-amber-500 to-orange-500", icon: Banknote, title: "Menunggu konfirmasi", desc: "Staf akan segera mengonfirmasi pesananmu. Pembayaran dilakukan di kasir." };
    case "CONFIRMED":
      return { bg: "bg-gradient-to-br from-sky-500 to-indigo-500", icon: Clock, title: "Pesanan diterima", desc: "Pesananmu sudah masuk antrean dapur." };
    case "PREPARING":
      return { bg: warm, icon: ChefHat, title: "Sedang dimasak", desc: "Chef kami sedang menyiapkan pesananmu dengan sepenuh hati 👨‍🍳" };
    case "READY":
      return {
        bg: "bg-gradient-to-br from-emerald-500 to-teal-500",
        icon: HandPlatter,
        title: "Pesanan siap!",
        desc: order.type === "DINE_IN" ? "Pesanan sedang diantar ke mejamu." : "Silakan ambil pesananmu di counter.",
      };
    case "COMPLETED":
      return { bg: "bg-gradient-to-br from-emerald-600 to-emerald-500", icon: PartyPopper, title: "Selamat menikmati!", desc: "Terima kasih sudah memesan. Sampai jumpa lagi 🧡" };
    case "CANCELLED":
      return { bg: "bg-gradient-to-br from-zinc-600 to-zinc-500", icon: XCircle, title: "Pesanan dibatalkan", desc: order.cancelReason || "Hubungi staf jika ada pertanyaan." };
  }
}
