"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/utils";
import { openShift } from "@/server/actions/staff";

export function ShiftChip({ shift }: { shift: { openedAt: string } | null }) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href="/dashboard/shifts">
        <span className={shift ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-destructive"} />
        {shift ? `Shift sejak ${format(new Date(shift.openedAt), "HH:mm")}` : "Shift tertutup"}
      </Link>
    </Button>
  );
}

export function MoneyInput({ value, onChange, ...props }: { value: number; onChange: (v: number) => void } & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">Rp</span>
      <Input
        inputMode="numeric"
        value={value ? new Intl.NumberFormat("id-ID").format(value) : ""}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        className="pl-10 font-semibold tabular"
        placeholder="0"
        {...props}
      />
    </div>
  );
}

/** Wajib buka shift sebelum menerima pembayaran */
export function ShiftGate() {
  const router = useRouter();
  const [cash, setCash] = useState(500000);
  const [loading, setLoading] = useState(false);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-5 rounded-3xl bg-card p-6 shadow-2xl animate-fade-up">
        <div className="space-y-2 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Wallet className="size-7" />
          </span>
          <h2 className="text-xl font-bold">Buka shift kasir</h2>
          <p className="text-sm text-muted-foreground">Masukkan modal awal (uang kembalian) di laci kas.</p>
        </div>
        <Field label="Modal awal">
          <MoneyInput value={cash} onChange={setCash} className="h-12 pl-10 text-lg font-semibold" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[200000, 300000, 500000, 1000000].map((v) => (
            <button key={v} onClick={() => setCash(v)} className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-muted">
              {formatRupiah(v)}
            </button>
          ))}
        </div>
        <Button
          size="lg"
          className="w-full"
          loading={loading}
          onClick={async () => {
            setLoading(true);
            const r = await openShift(cash);
            setLoading(false);
            if (!r.ok) return toast.error(r.error);
            toast.success("Shift dibuka. Selamat bekerja!");
            router.refresh();
          }}
        >
          Mulai shift
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/dashboard/orders">Nanti saja</Link>
        </Button>
      </div>
    </div>
  );
}
