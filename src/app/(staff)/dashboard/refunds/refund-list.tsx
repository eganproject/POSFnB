"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";
import { formatRupiah, pad } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { refundOrder } from "@/server/actions/staff";

type Due = {
  id: string;
  code: string;
  queueNumber: number;
  createdAt: string;
  customerName: string | null;
  tableName: string | null;
  status: string;
  cancelReason: string | null;
  total: number;
  paid: number;
  refunded: number;
  refundDue: number;
  methods: PaymentMethod[];
};

type Hist = { id: string; createdAt: string; queueNumber: number; code: string; amount: number; method: PaymentMethod; reason: string; user: string };

const METHODS: PaymentMethod[] = ["CASH", "MIDTRANS", "TRANSFER", "QRIS_STATIC", "CARD"];

export function RefundList({ due, history }: { due: Due[]; history: Hist[] }) {
  const [edit, setEdit] = useState<Due | null>(null);

  return (
    <div className="space-y-6">
      {due.length === 0 ? (
        <EmptyState icon={<Undo2 />} title="Tidak ada yang perlu direfund" description="Pesanan batal yang sudah dibayar dan pembayaran dobel akan muncul di sini." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {due.map((o) => (
            <Card key={o.id} className="border-destructive/40">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      #{pad(o.queueNumber)} · {o.tableName ?? "Takeaway"} · {o.customerName || "Tanpa nama"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.code} · {o.createdAt}
                    </p>
                  </div>
                  <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                    {o.status === "CANCELLED" ? "Dibatalkan" : "Lebih bayar"}
                  </span>
                </div>
                {o.cancelReason && <p className="text-sm text-muted-foreground">Alasan batal: {o.cancelReason}</p>}
                <div className="space-y-1 text-sm">
                  <Row l="Total pesanan" v={o.total} />
                  <Row l={`Sudah dibayar (${o.methods.map((m) => PAYMENT_METHOD_LABEL[m]).join(" + ")})`} v={o.paid} />
                  {o.refunded > 0 && <Row l="Sudah direfund" v={o.refunded} />}
                  <div className="flex justify-between font-bold text-destructive">
                    <span>Harus dikembalikan</span>
                    <span className="tabular">{formatRupiah(o.refundDue)}</span>
                  </div>
                </div>
                <Button className="w-full" onClick={() => setEdit(o)}>
                  <Undo2 /> Catat refund
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat refund</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada refund.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Waktu</th>
                    <th className="py-2 pr-3 font-medium">Pesanan</th>
                    <th className="py-2 pr-3 font-medium">Cara</th>
                    <th className="py-2 pr-3 font-medium">Catatan</th>
                    <th className="py-2 pr-3 font-medium">Oleh</th>
                    <th className="py-2 text-right font-medium">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t">
                      <td className="py-2.5 pr-3 whitespace-nowrap">{h.createdAt}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">#{pad(h.queueNumber)}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{PAYMENT_METHOD_LABEL[h.method]}</td>
                      <td className="py-2.5 pr-3">{h.reason}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{h.user}</td>
                      <td className="py-2.5 text-right tabular">{formatRupiah(h.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {edit && <RefundDialog order={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function RefundDialog({ order, onClose }: { order: Due; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(order.refundDue);
  const [method, setMethod] = useState<PaymentMethod>(order.methods.includes("MIDTRANS") ? "MIDTRANS" : "CASH");
  const [reason, setReason] = useState("");

  const submit = () =>
    start(async () => {
      const res = await refundOrder({ orderId: order.id, amount, method, reason });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Refund dicatat");
      onClose();
      router.refresh();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Catat refund #{pad(order.queueNumber)}</DialogTitle>
          <DialogDescription>
            Kembalikan uangnya dulu (tunai dari laci, transfer, atau lewat dashboard Midtrans), lalu catat di sini.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nominal" hint={`Maksimal ${formatRupiah(order.refundDue)}`}>
            <Input
              inputMode="numeric"
              value={amount ? String(amount) : ""}
              onChange={(e) => setAmount(Math.min(order.refundDue, Number(e.target.value.replace(/\D/g, "")) || 0))}
            />
          </Field>
          <Field label="Dikembalikan lewat" hint={method === "CASH" ? "Mengurangi kas shift Anda yang sedang dibuka" : undefined}>
            <NativeSelect value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Catatan">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Mis. refund via dashboard Midtrans, no. ref 123" rows={2} maxLength={200} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button loading={pending} disabled={amount <= 0 || reason.trim().length < 3} onClick={submit}>
            Simpan refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ l, v }: { l: string; v: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{l}</span>
      <span className="tabular text-foreground">{formatRupiah(v)}</span>
    </div>
  );
}
