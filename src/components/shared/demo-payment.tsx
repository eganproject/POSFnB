"use client";
import { useState } from "react";
import { FlaskConical, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/utils";
import { simulatePayment } from "@/server/actions/customer";
import { toast } from "sonner";

/** Pengganti Snap saat MIDTRANS key belum diisi */
export function DemoPaymentDialog({
  open,
  onOpenChange,
  paymentId,
  amount,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  paymentId: string | null;
  amount: number;
  onDone?: (success: boolean) => void;
}) {
  const [loading, setLoading] = useState<"ok" | "fail" | null>(null);
  const run = async (success: boolean) => {
    if (!paymentId) return;
    setLoading(success ? "ok" : "fail");
    const res = await simulatePayment(paymentId, success);
    setLoading(null);
    if (!res.ok) return toast.error(res.error);
    onOpenChange(false);
    onDone?.(success);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-5 text-primary" /> Simulasi pembayaran
          </DialogTitle>
          <DialogDescription>
            Mode demo aktif karena key Midtrans belum diisi di <code>.env</code>. Pilih hasil pembayaran.
          </DialogDescription>
        </DialogHeader>
        <div className="grid place-items-center gap-3 rounded-2xl bg-muted/60 p-6">
          <div className="grid size-40 place-items-center rounded-2xl border-4 border-dashed border-foreground/20 bg-card">
            <QrCode className="size-24 text-foreground/70" />
          </div>
          <p className="text-sm text-muted-foreground">Total tagihan</p>
          <p className="text-2xl font-extrabold tabular">{formatRupiah(amount)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" loading={loading === "fail"} onClick={() => run(false)}>
            Gagal
          </Button>
          <Button variant="success" loading={loading === "ok"} onClick={() => run(true)}>
            Bayar berhasil
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
