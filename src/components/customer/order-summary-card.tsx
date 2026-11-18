"use client";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { Banknote, Check, ChefHat, ChevronRight, Clock, CreditCard, HandPlatter, PartyPopper, RotateCcw, XCircle } from "lucide-react";
import { cn, formatRupiah, pad } from "@/lib/utils";
import type { OrderSummary } from "@/lib/order-summary";

type Tone = { label: string; hint: string; icon: typeof Check; chip: string; tile: string; bar: string };

/** Teks & warna status dari sudut pandang pelanggan */
function toneFor(o: OrderSummary): Tone {
  switch (o.status) {
    case "PENDING":
      return o.needsOnlinePay
        ? { label: "Menunggu pembayaran", hint: "Bayar agar langsung diproses", icon: CreditCard, chip: "bg-honey/15 text-[oklch(0.5_0.11_70)]", tile: "bg-honey/15 text-[oklch(0.5_0.11_70)]", bar: "bg-honey" }
        : { label: "Menunggu konfirmasi", hint: "Staf akan segera mengonfirmasi", icon: Clock, chip: "bg-honey/15 text-[oklch(0.5_0.11_70)]", tile: "bg-honey/15 text-[oklch(0.5_0.11_70)]", bar: "bg-honey" };
    case "CONFIRMED":
      return { label: "Diterima", hint: "Masuk antrean dapur", icon: Check, chip: "bg-info/12 text-info", tile: "bg-info/12 text-info", bar: "bg-info" };
    case "PREPARING":
      return { label: o.itemsDone > 0 ? `${o.itemsDone} dari ${o.itemsTotal} siap` : "Sedang disiapkan", hint: "Barista sedang membuat pesananmu", icon: ChefHat, chip: "bg-primary/12 text-primary", tile: "bg-primary/12 text-primary", bar: "bg-primary" };
    case "READY":
      return { label: "Siap!", hint: "Sedang diantar / siap diambil", icon: HandPlatter, chip: "bg-success text-white", tile: "bg-success/15 text-success", bar: "bg-success" };
    case "COMPLETED":
      return { label: "Selesai", hint: "Selamat menikmati", icon: PartyPopper, chip: "bg-muted text-muted-foreground", tile: "bg-muted text-muted-foreground", bar: "bg-success/60" };
    case "CANCELLED":
      return { label: "Dibatalkan", hint: "Hubungi staf jika ada pertanyaan", icon: XCircle, chip: "bg-destructive/10 text-destructive", tile: "bg-muted text-muted-foreground", bar: "bg-destructive/40" };
  }
}

const STEP: Record<OrderStatus, number> = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY: 3, COMPLETED: 4, CANCELLED: -1 };
const STEP_LABELS = ["Diterima", "Disiapkan", "Siap", "Selesai"];

/** "2× Montblanc, 1× Dirty Latte +2 lainnya" */
function itemsLine(items: OrderSummary["items"], max = 3) {
  const shown = items.slice(0, max).map((i) => `${i.quantity}× ${i.name}`).join(", ");
  return items.length > max ? `${shown} +${items.length - max} lainnya` : shown;
}

export function OrderSummaryCard({
  order: o,
  showOutlet = false,
  onNavigate,
}: {
  order: OrderSummary;
  showOutlet?: boolean;
  onNavigate?: () => void;
}) {
  const t = toneFor(o);
  const Icon = t.icon;
  const step = STEP[o.status];
  const active = step >= 0 && step < 4;
  const done = o.status === "COMPLETED" || o.status === "CANCELLED";
  const href = `/order/${o.id}`;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card transition",
        o.status === "READY" && "border-success/50 shadow-md shadow-success/10",
        done && "bg-card/70"
      )}
    >
      <Link href={href} onClick={onNavigate} className="block p-3.5 pb-3">
        <div className="flex items-start gap-3">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl text-sm font-bold tabular", t.tile)}>#{pad(o.queueNumber)}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", t.chip, o.status === "READY" && "animate-pulse")}>
                <Icon className="size-3.5" /> {t.label}
              </span>
            </span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">
              {showOutlet ? `${o.outletName} · ` : ""}
              {o.place} · {o.createdLabel}
            </span>
          </span>
          <ChevronRight className="mt-2.5 size-4 shrink-0 text-muted-foreground" />
        </div>

        {/* Progres kecil 4 langkah */}
        {o.status !== "CANCELLED" && (
          <div className="mt-3 grid grid-cols-4 gap-1" aria-label={`Progres: ${t.label}`}>
            {STEP_LABELS.map((l, i) => (
              <span key={l} className="min-w-0">
                <span className={cn("block h-1.5 rounded-full bg-muted", i < step && t.bar)} />
                {active && (
                  <span className={cn("mt-1 block truncate text-[10px] text-muted-foreground", i === step - 1 && "font-semibold text-foreground")}>{l}</span>
                )}
              </span>
            ))}
          </div>
        )}

        <p className={cn("mt-2.5 line-clamp-2 text-sm", done ? "text-muted-foreground" : "text-foreground/85")}>{itemsLine(o.items)}</p>
      </Link>

      <div className="flex items-center justify-between gap-2 border-t px-3.5 py-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-[15px] font-bold tabular">{formatRupiah(o.total)}</span>
          <PayChip o={o} />
        </span>
        {o.needsOnlinePay ? (
          <Link href={`${href}?pay=1`} onClick={onNavigate} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground">
            <CreditCard className="size-3.5" /> Bayar
          </Link>
        ) : done && o.reorderHref && showOutlet ? (
          <Link href={o.reorderHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground">
            <RotateCcw className="size-3.5" /> Pesan lagi
          </Link>
        ) : (
          <Link href={href} onClick={onNavigate} className="shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5">
            Detail
          </Link>
        )}
      </div>
    </div>
  );
}

function PayChip({ o }: { o: OrderSummary }) {
  if (o.status === "CANCELLED" && o.paymentStatus !== "REFUNDED") return null;
  if (o.paymentStatus === "PAID") return <span className="rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-semibold text-success">Lunas</span>;
  if (o.paymentStatus === "REFUNDED") return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Refund</span>;
  if (o.payAtCashier)
    return (
      <span className="inline-flex items-center gap-1 truncate rounded-full bg-honey/15 px-2 py-0.5 text-[11px] font-semibold text-[oklch(0.5_0.11_70)]">
        <Banknote className="size-3" /> Bayar di kasir
      </span>
    );
  return <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">Belum bayar</span>;
}
