"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PaymentMethod } from "@prisma/client";
import { Banknote, CheckCircle2, CreditCard, Landmark, Printer, QrCode, Smartphone, Users } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QtyStepper } from "@/components/ui/qty";
import { Skeleton } from "@/components/ui/misc";
import { DemoPaymentDialog } from "@/components/shared/demo-payment";
import { cn, formatRupiah, pad } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { useSnap } from "@/hooks/use-snap";
import { getOrderForPayment, payOrder, startStaffOnlinePayment, type PaymentOrder } from "@/server/actions/staff";
import { MoneyInput } from "./shift";

type Mode = "full" | "equal" | "items";
type Method = Exclude<PaymentMethod, "MIDTRANS"> | "MIDTRANS";

const METHODS: { v: Method; label: string; icon: typeof Banknote; desc: string }[] = [
  { v: "CASH", label: "Tunai", icon: Banknote, desc: "Uang fisik" },
  { v: "MIDTRANS", label: "QRIS / E-wallet", icon: Smartphone, desc: "Midtrans" },
  { v: "QRIS_STATIC", label: "QRIS EDC", icon: QrCode, desc: "Mesin EDC" },
  { v: "CARD", label: "Kartu", icon: CreditCard, desc: "Debit / kredit" },
  { v: "TRANSFER", label: "Transfer", icon: Landmark, desc: "Rekening bank" },
];

function quickCash(amount: number) {
  const opts = new Set<number>([amount]);
  for (const step of [5000, 10000, 20000, 50000, 100000]) opts.add(Math.ceil(amount / step) * step);
  opts.add(Math.max(100000, Math.ceil(amount / 100000) * 100000));
  return [...opts].sort((a, b) => a - b).slice(0, 5);
}

export function PaymentDialog({
  orderId,
  onClose,
  config,
}: {
  orderId: string | null;
  onClose: () => void;
  config: { demo: boolean; clientKey: string; isProduction: boolean };
}) {
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [mode, setMode] = useState<Mode>("full");
  const [people, setPeople] = useState(2);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<Method>("CASH");
  const [cash, setCash] = useState(0);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ change: number } | null>(null);
  const [demoPaymentId, setDemoPaymentId] = useState<string | null>(null);
  const [pendingOnline, setPendingOnline] = useState<string | null>(null);
  const snap = useSnap(config.clientKey, config.isProduction, !config.demo && !!orderId);

  const load = useCallback(async () => {
    if (!orderId) return;
    const o = await getOrderForPayment(orderId);
    if (!o) {
      toast.error("Pesanan tidak ditemukan");
      onClose();
      return;
    }
    setOrder(o);
    if (o.remaining <= 0) setDone((d) => d ?? { change: 0 });
  }, [orderId, onClose]);

  useEffect(() => {
    setOrder(null);
    setDone(null);
    setMode("full");
    setPicked({});
    setMethod("CASH");
    setCash(0);
    setReference("");
    setPendingOnline(null);
    load();
  }, [orderId, load]);

  // Cek status transaksi Midtrans selagi menunggu customer scan
  useEffect(() => {
    if (!pendingOnline) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/payments/${pendingOnline}/sync`, { method: "POST" }).then((x) => x.json()).catch(() => null);
      if (r?.state === "SUCCESS") {
        setPendingOnline(null);
        toast.success("Pembayaran online diterima");
        await afterPayment(0);
      } else if (r?.state === "FAILED" || r?.state === "EXPIRED") {
        setPendingOnline(null);
        toast.error("Pembayaran online gagal / kedaluwarsa");
      }
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOnline]);

  const amount = useMemo(() => {
    if (!order) return 0;
    if (mode === "full") return order.remaining;
    if (mode === "equal") {
      const left = Math.max(1, people - order.successCount);
      return Math.min(order.remaining, Math.ceil(order.remaining / left / 100) * 100);
    }
    const itemsSubtotal = order.items.reduce((s, i) => s + (picked[i.id] ?? 0) * i.unitPrice, 0);
    const allPicked = order.items.every((i) => (picked[i.id] ?? 0) === i.quantity - i.paidQty);
    if (allPicked) return order.remaining;
    return Math.min(order.remaining, Math.round((itemsSubtotal * order.total) / Math.max(1, order.subtotal)));
  }, [order, mode, people, picked]);

  useEffect(() => setCash(amount), [amount]);

  const afterPayment = async (change: number) => {
    const o = await getOrderForPayment(orderId!);
    setOrder(o);
    setPicked({});
    if (o && o.remaining <= 0) setDone({ change });
    else if (change > 0) toast.success(`Kembalian ${formatRupiah(change)}`);
  };

  const label = order && mode !== "full" ? `Tamu ${order.successCount + 1}` : null;

  const submit = async () => {
    if (!order || amount <= 0) return;
    setLoading(true);
    if (method === "MIDTRANS") {
      const r = await startStaffOnlinePayment(order.id, amount, label ?? undefined);
      setLoading(false);
      if (!r.ok) return toast.error(r.error);
      if (mode === "items") toast.info("Split per item via online tidak menandai item. Gunakan bagi rata atau tunai/EDC untuk per item.");
      if (r.data.demo) return setDemoPaymentId(r.data.paymentId);
      setPendingOnline(r.data.paymentId);
      const opened = snap.pay(r.data.token, {
        onSuccess: () => afterPayment(0).then(() => setPendingOnline(null)),
        onClose: () => {},
      });
      if (!opened && r.data.redirectUrl) window.open(r.data.redirectUrl, "_blank");
      return;
    }
    const r = await payOrder({
      orderId: order.id,
      method,
      amount,
      cashReceived: method === "CASH" ? cash : null,
      reference: reference || null,
      label,
      items: mode === "items" ? Object.entries(picked).filter(([, q]) => q > 0).map(([itemId, quantity]) => ({ itemId, quantity })) : undefined,
    });
    setLoading(false);
    if (!r.ok) return toast.error(r.error);
    setReference("");
    await afterPayment(r.data.change);
  };

  const printReceipt = () => order && window.open(`/receipt/${order.id}?print=1`, "_blank", "width=420,height=700");
  const change = method === "CASH" ? Math.max(0, cash - amount) : 0;

  return (
    <>
      <Dialog open={!!orderId} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0" aria-describedby={undefined}>
          {!order ? (
            <div className="space-y-3 p-6">
              <DialogTitle className="sr-only">Memuat</DialogTitle>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64" />
            </div>
          ) : done ? (
            <div className="space-y-6 p-8 text-center">
              <CheckCircle2 className="mx-auto size-20 text-success animate-pop" />
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold">Pembayaran lunas</DialogTitle>
                <DialogDescription>
                  Pesanan #{pad(order.queueNumber)} · {formatRupiah(order.total)}
                </DialogDescription>
              </div>
              {done.change > 0 && (
                <div className="mx-auto max-w-xs rounded-2xl bg-success/10 p-4">
                  <p className="text-sm text-muted-foreground">Kembalian</p>
                  <p className="text-3xl font-extrabold text-success tabular">{formatRupiah(done.change)}</p>
                </div>
              )}
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="lg" onClick={printReceipt}>
                  <Printer /> Cetak struk
                </Button>
                <Button size="lg" onClick={onClose}>
                  Selesai
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-[1fr_1.15fr]">
              {/* Ringkasan */}
              <div className="flex max-h-[80dvh] flex-col border-b bg-muted/40 md:border-b-0 md:border-r">
                <div className="border-b p-5">
                  <DialogTitle className="text-lg font-bold">
                    Bayar #{pad(order.queueNumber)}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {order.tableName ?? "Takeaway"} · {order.customerName || "Tanpa nama"}
                  </p>
                </div>
                <ul className="flex-1 space-y-2 overflow-y-auto p-5 text-sm">
                  {order.items.map((i) => {
                    const left = i.quantity - i.paidQty;
                    return (
                      <li key={i.id} className={cn("flex items-center gap-2", left === 0 && "opacity-45")}>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {i.quantity}× {i.name}
                          </p>
                          {i.modifiers.length > 0 && <p className="truncate text-xs text-muted-foreground">{i.modifiers.join(", ")}</p>}
                        </div>
                        {mode === "items" && left > 0 ? (
                          <QtyStepper size="sm" value={picked[i.id] ?? 0} max={left} onChange={(v) => setPicked((p) => ({ ...p, [i.id]: v }))} />
                        ) : (
                          <span className="tabular">{left === 0 && i.paidQty > 0 ? "lunas" : formatRupiah(i.unitPrice * i.quantity)}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="space-y-1 border-t p-5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total tagihan</span>
                    <span className="font-semibold tabular">{formatRupiah(order.total)}</span>
                  </div>
                  {order.payments.filter((p) => p.state === "SUCCESS").map((p) => (
                    <div key={p.id} className="flex justify-between text-xs text-success">
                      <span>{PAYMENT_METHOD_LABEL[p.method]}{p.label ? ` · ${p.label}` : ""}</span>
                      <span className="tabular">−{formatRupiah(p.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1 text-base font-bold">
                    <span>Sisa</span>
                    <span className="tabular">{formatRupiah(order.remaining)}</span>
                  </div>
                </div>
              </div>

              {/* Form bayar */}
              <div className="flex max-h-[80dvh] flex-col">
                <div className="flex-1 space-y-5 overflow-y-auto p-5">
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-sm font-semibold">
                    {([
                      ["full", "Bayar penuh"],
                      ["equal", "Bagi rata"],
                      ["items", "Per item"],
                    ] as const).map(([m, l]) => (
                      <button key={m} onClick={() => setMode(m)} className={cn("rounded-lg py-2 transition", mode === m ? "bg-card shadow-sm" : "text-muted-foreground")}>
                        {l}
                      </button>
                    ))}
                  </div>

                  {mode === "equal" && (
                    <div className="flex items-center justify-between rounded-xl border p-3">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Users className="size-4" /> Jumlah orang
                      </span>
                      <QtyStepper value={people} min={Math.max(2, order.successCount + 1)} max={20} onChange={setPeople} />
                    </div>
                  )}
                  {mode === "items" && <p className="rounded-xl bg-info/10 p-3 text-xs text-info">Pilih item di sebelah kiri. Pajak & service dibagi proporsional.</p>}

                  <div className="rounded-2xl bg-foreground p-4 text-background">
                    <p className="text-xs text-background/60">{label ? `${label} membayar` : "Jumlah dibayar"}</p>
                    <p className="text-3xl font-extrabold tabular">{formatRupiah(amount)}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {METHODS.map((m) => (
                      <button
                        key={m.v}
                        onClick={() => setMethod(m.v)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center transition",
                          method === m.v ? "border-primary bg-primary/6 ring-1 ring-primary" : "hover:bg-muted"
                        )}
                      >
                        <m.icon className={cn("size-5", method === m.v ? "text-primary" : "text-muted-foreground")} />
                        <span className="text-xs font-semibold">{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {method === "CASH" && (
                    <div className="space-y-2">
                      <MoneyInput value={cash} onChange={setCash} className="h-12 pl-10 text-lg font-semibold" />
                      <div className="flex flex-wrap gap-1.5">
                        {quickCash(amount).map((v) => (
                          <button key={v} onClick={() => setCash(v)} className={cn("rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-muted", cash === v && "border-primary text-primary")}>
                            {v === amount ? "Uang pas" : formatRupiah(v)}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between rounded-xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
                        <span>Kembalian</span>
                        <span className="tabular">{formatRupiah(change)}</span>
                      </div>
                    </div>
                  )}
                  {(method === "QRIS_STATIC" || method === "CARD" || method === "TRANSFER") && (
                    <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="No. referensi / approval (opsional)" />
                  )}
                  {method === "MIDTRANS" && (
                    <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                      {pendingOnline
                        ? "⏳ Menunggu customer menyelesaikan pembayaran… status dicek otomatis."
                        : config.demo
                          ? "Mode demo: pembayaran akan disimulasikan."
                          : "Popup Midtrans akan menampilkan QRIS yang bisa discan customer."}
                    </p>
                  )}
                </div>
                <div className="border-t p-5">
                  <Button
                    size="xl"
                    className="w-full"
                    loading={loading}
                    disabled={amount <= 0 || (method === "CASH" && cash < amount) || (method === "MIDTRANS" && !config.demo && !snap.ready)}
                    onClick={submit}
                  >
                    {method === "CASH" && cash < amount ? "Uang kurang" : `Terima ${formatRupiah(amount)}`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <DemoPaymentDialog
        open={!!demoPaymentId}
        onOpenChange={(o) => !o && setDemoPaymentId(null)}
        paymentId={demoPaymentId}
        amount={amount}
        onDone={(ok) => {
          if (ok) afterPayment(0);
          else toast.error("Pembayaran gagal");
        }}
      />
    </>
  );
}
