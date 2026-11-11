"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethod } from "@prisma/client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Lock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn, formatRupiah } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { MoneyInput } from "../../pos/shift";
import { closeShift, openShift } from "@/server/actions/staff";

type Current = {
  openedAt: string;
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  totalSales: number;
  expectedCash: number;
  byMethod: { method: PaymentMethod; amount: number; count: number }[];
} | null;

export function ShiftView({ current, history }: { current: Current; history: { id: string; user: string; openedAt: string; closedAt: string; openingCash: number; expectedCash: number; closingCash: number; totalSales: number; note: string | null }[] }) {
  const router = useRouter();
  const [counted, setCounted] = useState(0);
  const [note, setNote] = useState("");
  const [opening, setOpening] = useState(500000);
  const [loading, setLoading] = useState(false);
  const diff = current ? counted - current.expectedCash : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-primary" /> Shift saya
          </CardTitle>
          <CardDescription>{current ? `Dibuka ${format(new Date(current.openedAt), "EEEE, d MMM HH:mm", { locale: localeId })}` : "Belum ada shift yang terbuka"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {current ? (
            <>
              <div className="space-y-2 rounded-2xl bg-muted/60 p-4 text-sm">
                <Line l="Modal awal" v={current.openingCash} />
                {current.byMethod.map((m) => (
                  <Line key={m.method} l={`${PAYMENT_METHOD_LABEL[m.method]} (${m.count})`} v={m.amount} />
                ))}
                <div className="flex justify-between border-t border-dashed pt-2 font-semibold">
                  <span>Total penjualan</span>
                  <span className="tabular">{formatRupiah(current.totalSales)}</span>
                </div>
                {current.cashRefunds > 0 && <Line l="Refund tunai (keluar dari laci)" v={-current.cashRefunds} />}
                <div className="flex justify-between font-bold text-primary">
                  <span>Kas seharusnya di laci</span>
                  <span className="tabular">{formatRupiah(current.expectedCash)}</span>
                </div>
              </div>
              <Field label="Uang kas yang dihitung">
                <MoneyInput value={counted} onChange={setCounted} className="h-12 pl-10 text-lg font-semibold" />
              </Field>
              {counted > 0 && (
                <p className={cn("rounded-xl px-4 py-3 text-sm font-semibold", diff === 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                  {diff === 0 ? "✓ Kas sesuai" : `Selisih ${diff > 0 ? "+" : ""}${formatRupiah(diff)}`}
                </p>
              )}
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" rows={2} />
              <Button
                size="lg"
                variant="dark"
                className="w-full"
                loading={loading}
                onClick={async () => {
                  setLoading(true);
                  const r = await closeShift(counted, note);
                  setLoading(false);
                  if (!r.ok) return toast.error(r.error);
                  toast.success("Shift ditutup");
                  router.refresh();
                }}
              >
                <Lock /> Tutup shift
              </Button>
            </>
          ) : (
            <>
              <Field label="Modal awal">
                <MoneyInput value={opening} onChange={setOpening} className="h-12 pl-10 text-lg font-semibold" />
              </Field>
              <Button
                size="lg"
                className="w-full"
                loading={loading}
                onClick={async () => {
                  setLoading(true);
                  const r = await openShift(opening);
                  setLoading(false);
                  if (!r.ok) return toast.error(r.error);
                  toast.success("Shift dibuka");
                  router.refresh();
                }}
              >
                Buka shift
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat shift</CardTitle>
          <CardDescription>30 shift terakhir</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState icon={<Wallet />} title="Belum ada riwayat shift" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 font-medium">Kasir / waktu</th>
                    <th className="py-2 text-right font-medium">Penjualan</th>
                    <th className="py-2 text-right font-medium">Kas seharusnya</th>
                    <th className="py-2 text-right font-medium">Selisih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {history.map((h) => {
                    const d = h.closingCash - h.expectedCash;
                    return (
                      <tr key={h.id} className="transition-colors hover:bg-muted/40">
                        <td className="py-2.5">
                          <p className="font-medium">{h.user}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(h.openedAt), "d MMM HH:mm", { locale: localeId })} – {format(new Date(h.closedAt), "HH:mm")}
                          </p>
                        </td>
                        <td className="py-2.5 text-right tabular">{formatRupiah(h.totalSales)}</td>
                        <td className="py-2.5 text-right tabular">{formatRupiah(h.expectedCash)}</td>
                        <td className={cn("py-2.5 text-right font-semibold tabular", d === 0 ? "text-success" : "text-destructive")}>
                          {d === 0 ? "Sesuai" : `${d > 0 ? "+" : ""}${formatRupiah(d)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Line({ l, v }: { l: string; v: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{l}</span>
      <span className="tabular text-foreground">{formatRupiah(v)}</span>
    </div>
  );
}
