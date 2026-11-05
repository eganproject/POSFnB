"use client";
import { useEffect, useState } from "react";
import { Banknote, CheckCircle2, CreditCard, Landmark, Printer, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatRupiah, pad } from "@/lib/utils";
import { payOrdersTogether } from "@/server/actions/staff";
import { MoneyInput } from "./shift";
import { quickCash } from "@/lib/payment-math";

type Bill = { id: string; queueNumber: number; customerName: string | null; remaining: number };
type Method = "CASH" | "QRIS_STATIC" | "CARD" | "TRANSFER";

const METHODS: { v: Method; label: string; icon: typeof Banknote }[] = [
  { v: "CASH", label: "Tunai", icon: Banknote },
  { v: "QRIS_STATIC", label: "QRIS EDC", icon: QrCode },
  { v: "CARD", label: "Kartu", icon: CreditCard },
  { v: "TRANSFER", label: "Transfer", icon: Landmark },
];

/** Bayar semua tagihan terbuka satu meja sekaligus */
export function TablePayDialog({ table, onClose }: { table: { name: string; bills: Bill[] } | null; onClose: () => void }) {
  const total = table?.bills.reduce((s, b) => s + b.remaining, 0) ?? 0;
  const [method, setMethod] = useState<Method>("CASH");
  const [cash, setCash] = useState(total);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ change: number } | null>(null);

  useEffect(() => {
    setMethod("CASH");
    setCash(total);
    setReference("");
    setDone(null);
  }, [table, total]);

  const submit = async () => {
    if (!table) return;
    setLoading(true);
    const r = await payOrdersTogether({
      orderIds: table.bills.map((b) => b.id),
      method,
      cashReceived: method === "CASH" ? cash : null,
      reference: reference || null,
    });
    setLoading(false);
    if (!r.ok) return toast.error(r.error);
    setDone({ change: r.data.change });
  };

  return (
    <Dialog open={!!table} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {table && done ? (
          <div className="space-y-5 text-center">
            <CheckCircle2 className="mx-auto size-16 text-success animate-pop" />
            <div>
              <DialogTitle className="text-xl font-bold">{table.name} lunas</DialogTitle>
              <DialogDescription>{table.bills.length} pesanan · {formatRupiah(total)}</DialogDescription>
            </div>
            {done.change > 0 && (
              <div className="rounded-2xl bg-success/10 p-4">
                <p className="text-sm text-muted-foreground">Kembalian</p>
                <p className="text-3xl font-extrabold text-success tabular">{formatRupiah(done.change)}</p>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {table.bills.map((b) => (
                <Button key={b.id} variant="outline" size="sm" onClick={() => window.open(`/receipt/${b.id}?print=1`, "_blank", "width=420,height=700")}>
                  <Printer /> Struk #{pad(b.queueNumber)}
                </Button>
              ))}
            </div>
            <Button className="w-full" size="lg" onClick={onClose}>Selesai</Button>
          </div>
        ) : table ? (
          <>
            <DialogHeader>
              <DialogTitle>Bayar semua · {table.name}</DialogTitle>
              <DialogDescription>Gabungkan {table.bills.length} tagihan terbuka di meja ini.</DialogDescription>
            </DialogHeader>
            <ul className="divide-y rounded-xl border text-sm">
              {table.bills.map((b) => (
                <li key={b.id} className="flex justify-between px-3 py-2">
                  <span>#{pad(b.queueNumber)} · {b.customerName || "Tanpa nama"}</span>
                  <span className="tabular">{formatRupiah(b.remaining)}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-2xl bg-foreground p-4 text-background">
              <p className="text-xs text-background/60">Total</p>
              <p className="text-3xl font-extrabold tabular">{formatRupiah(total)}</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map((m) => (
                <button key={m.v} onClick={() => setMethod(m.v)} className={cn("flex flex-col items-center gap-1 rounded-xl border p-2 text-xs font-semibold transition", method === m.v ? "border-primary bg-primary/6 ring-1 ring-primary" : "hover:bg-muted")}>
                  <m.icon className={cn("size-5", method === m.v ? "text-primary" : "text-muted-foreground")} />
                  {m.label}
                </button>
              ))}
            </div>
            {method === "CASH" ? (
              <div className="space-y-2">
                <MoneyInput value={cash} onChange={setCash} className="h-12 pl-10 text-lg font-semibold" />
                <div className="flex flex-wrap gap-1.5">
                  {quickCash(total).map((v) => (
                    <button key={v} onClick={() => setCash(v)} className={cn("rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted", cash === v && "border-primary text-primary")}>
                      {v === total ? "Uang pas" : formatRupiah(v)}
                    </button>
                  ))}
                </div>
                <p className="flex justify-between rounded-xl bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">
                  <span>Kembalian</span>
                  <span className="tabular">{formatRupiah(Math.max(0, cash - total))}</span>
                </p>
              </div>
            ) : (
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="No. referensi (opsional)" />
            )}
            <Button size="xl" className="w-full" loading={loading} disabled={method === "CASH" && cash < total} onClick={submit}>
              {method === "CASH" && cash < total ? "Uang kurang" : `Terima ${formatRupiah(total)}`}
            </Button>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
