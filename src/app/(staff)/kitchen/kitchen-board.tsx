"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderItemStatus, OrderSource, OrderType, Role } from "@prisma/client";
import { ArrowLeft, Check, CheckCheck, ChefHat, Flame, HandPlatter, Maximize, PackageX, Play, Undo2, Volume2, VolumeX, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn, pad } from "@/lib/utils";
import { useRealtime } from "@/hooks/use-realtime";
import { chime } from "@/components/staff/live-alerts";
import { Button } from "@/components/ui/button";
import { updateItemStatus, updateOrderStatus } from "@/server/actions/staff";
import { itemProgress, itemStatusLabel, nextItemStep, prevItemStep } from "@/lib/order-flow";

type KOrder = {
  id: string;
  queueNumber: number;
  status: "CONFIRMED" | "PREPARING" | "READY";
  type: OrderType;
  source: OrderSource;
  tableName: string | null;
  /** Jam ambil takeaway terjadwal, mis. "14:30" */
  pickupLabel?: string | null;
  customerName: string | null;
  note: string | null;
  since: string;
  readyAt: string | null;
  items: { id: string; name: string; quantity: number; note: string | null; status: OrderItemStatus; quickReady: boolean; modifiers: string[] }[];
};

const COLUMNS = [
  { key: "CONFIRMED", title: "Antrean baru", icon: Flame, accent: "bg-sky-500" },
  { key: "PREPARING", title: "Sedang dibuat", icon: ChefHat, accent: "bg-primary" },
  { key: "READY", title: "Siap diantar", icon: HandPlatter, accent: "bg-emerald-500" },
] as const;

function useNow(interval = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

export function KitchenBoard({ outletName, orders, role }: { outletName: string; orders: KOrder[]; role: Role }) {
  const [sound, setSound] = useState(true);
  const known = useRef<Set<string> | null>(null);
  const now = useNow();
  useRealtime("/api/stream/outlet");

  // Rekap item yang belum selesai, berguna untuk masak sekaligus (batch)
  const recap = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (o.status === "READY") continue;
      for (const i of o.items) if (i.status === "QUEUED" || i.status === "PREPARING") map.set(i.name, (map.get(i.name) ?? 0) + i.quantity);
    }
    return [...map.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
  }, [orders]);

  useEffect(() => {
    const ids = new Set(orders.filter((o) => o.status === "CONFIRMED").map((o) => o.id));
    if (known.current) {
      const fresh = [...ids].filter((id) => !known.current!.has(id));
      if (fresh.length) {
        if (sound) chime(3);
        toast.info(`${fresh.length} pesanan baru masuk dapur`);
      }
    }
    known.current = new Set([...(known.current ?? []), ...ids]);
  }, [orders, sound]);

  return (
    <div className="dark flex h-dvh flex-col bg-background text-foreground">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
        {role !== "DAPUR" && (
          <Button asChild variant="ghost" size="icon">
            <Link href={role === "OWNER" ? "/dashboard" : "/pos"}>
              <ArrowLeft />
            </Link>
          </Button>
        )}
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-lg">👨‍🍳</span>
        <div className="leading-tight">
          <p className="font-bold">Layar Dapur</p>
          <p className="text-xs text-muted-foreground">{outletName}</p>
        </div>
        <p className="ml-4 hidden text-xs text-muted-foreground lg:block">
          Ketuk item untuk lanjut ke tahap berikutnya · tekan lama untuk koreksi
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/stock">
              <PackageX /> Stok habis
            </Link>
          </Button>
          <Button variant="secondary" size="icon-sm" onClick={() => setSound((s) => !s)} aria-label="Suara">
            {sound ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button variant="secondary" size="icon-sm" onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Layar penuh">
            <Maximize />
          </Button>
          {role === "DAPUR" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => import("@/components/staff/sidebar").then((m) => m.signOut())}
            >
              Keluar
            </Button>
          )}
        </div>
      </header>
      {recap.length > 0 && (
        <div className="no-scrollbar flex shrink-0 items-center gap-2 overflow-x-auto border-b px-4 py-2.5">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total dimasak</span>
          {recap.map((r) => (
            <span key={r.name} className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
              <b className="text-primary tabular">{r.qty}×</b> {r.name}
            </span>
          ))}
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-x-auto p-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.key);
          return (
            <section key={col.key} className="flex min-h-0 min-w-72 flex-col rounded-2xl bg-card/60">
              <div className="flex items-center gap-2 p-3">
                <span className={cn("grid size-8 place-items-center rounded-lg text-white", col.accent)}>
                  <col.icon className="size-4" />
                </span>
                <h2 className="font-bold">{col.title}</h2>
                <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-sm font-bold tabular">{list.length}</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-3 pt-0">
                {list.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Kosong</p>}
                {list.map((o) => (
                  <KitchenTicket key={o.id} order={o} now={now} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const ITEM_TONE: Record<OrderItemStatus, string> = {
  QUEUED: "bg-sky-500/15 text-sky-300",
  PREPARING: "bg-primary/20 text-primary",
  READY: "bg-emerald-500/20 text-emerald-300",
  SERVED: "bg-muted text-muted-foreground",
};

/** Tampilan tombol "langkah berikutnya" di sisi kanan baris item */
const NEXT_UI: Record<OrderItemStatus, { label: (t: OrderType) => string; icon: typeof Check; cls: string }> = {
  QUEUED: { label: () => "Mulai", icon: Play, cls: "bg-primary text-primary-foreground" },
  PREPARING: { label: () => "Siap", icon: HandPlatter, cls: "bg-success text-white" },
  READY: { label: (t) => (t === "TAKEAWAY" ? "Diambil" : "Diantar"), icon: Check, cls: "border-2 border-emerald-500/60 text-emerald-300" },
  SERVED: { label: () => "", icon: Check, cls: "" },
};

const LONG_PRESS_MS = 550;

function KitchenTicket({ order: o, now }: { order: KOrder; now: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fixing, setFixing] = useState<string | null>(null);
  const minutes = Math.max(0, Math.floor((now - new Date(o.since).getTime()) / 60000));
  const urgency = o.status === "READY" ? "ok" : minutes >= 20 ? "late" : minutes >= 10 ? "warn" : "ok";
  const p = itemProgress(o.items);

  const move = (to: "PREPARING" | "READY" | "COMPLETED" | "CONFIRMED") =>
    start(async () => {
      const r = await updateOrderStatus(o.id, to);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });

  const setItem = (item: KOrder["items"][number], from: OrderItemStatus, to: OrderItemStatus, { undoable = true } = {}) =>
    start(async () => {
      const r = await updateItemStatus({ orderId: o.id, itemIds: [item.id], expected: from, to });
      if (!r.ok) toast.error(r.error);
      else if (undoable) {
        toast.success(`#${pad(o.queueNumber)} · ${item.name}: ${itemStatusLabel(to, o.type)}`, {
          duration: 5000,
          action: { label: "Urungkan", onClick: () => setItem(item, to, from, { undoable: false }) },
        });
      }
      setFixing(null);
      router.refresh();
    });

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border-2 bg-card shadow-lg transition animate-fade-up",
        urgency === "late" ? "border-destructive" : urgency === "warn" ? "border-warning" : "border-transparent",
        pending && "pointer-events-none opacity-60"
      )}
    >
      <div className={cn("flex items-center justify-between px-4 py-3", urgency === "late" ? "bg-destructive/20" : urgency === "warn" ? "bg-warning/15" : "bg-muted/60")}>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black tabular">#{pad(o.queueNumber)}</span>
          <span className="font-semibold">{o.tableName ?? (o.pickupLabel ? `Takeaway · ambil ${o.pickupLabel}` : "Takeaway")}</span>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-bold tabular", urgency === "late" && "text-destructive")}>{minutes}′</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{o.type === "TAKEAWAY" ? "Bungkus" : "Makan di tempat"}</p>
        </div>
      </div>
      {p.total > 1 && o.status !== "CONFIRMED" && (
        <div className="flex items-center gap-2 px-4 pt-2.5 text-xs font-semibold">
          <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="bg-muted-foreground/50" style={{ width: `${(p.served / p.total) * 100}%` }} />
            <span className="bg-emerald-500" style={{ width: `${(p.toServe / p.total) * 100}%` }} />
            <span className="bg-primary/70" style={{ width: `${(p.preparing / p.total) * 100}%` }} />
          </span>
          <span className="tabular text-muted-foreground">
            {p.done}/{p.total} siap{p.toServe > 0 && o.status !== "READY" ? ` · ${p.toServe} perlu diantar` : ""}
          </span>
        </div>
      )}
      <ul className="space-y-1.5 p-2">
        {o.items.map((i) => (
          <ItemRow
            key={i.id}
            item={i}
            type={o.type}
            fixing={fixing === i.id}
            onAdvance={() => {
              const next = nextItemStep(i.status, i.quickReady);
              if (next) setItem(i, i.status, next);
              else toast.info("Sudah diantar. Tekan lama untuk koreksi.");
            }}
            onLongPress={() => (prevItemStep(i.status, i.quickReady) ? setFixing(i.id) : toast.info("Item masih antre, tidak ada yang perlu dikoreksi."))}
            onUndo={() => {
              const back = prevItemStep(i.status, i.quickReady);
              if (back) setItem(i, i.status, back, { undoable: false });
            }}
            onCloseFix={() => setFixing(null)}
          />
        ))}
      </ul>
      {o.note && <p className="mx-4 mb-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-warning">📝 {o.note}</p>}
      <div className="flex gap-2 p-3 pt-1">
        {o.status === "CONFIRMED" && (
          <Button className="flex-1" size="lg" onClick={() => move("PREPARING")}>
            <ChefHat /> {p.total > 1 ? "Mulai semua" : "Mulai masak"}
          </Button>
        )}
        {o.status === "PREPARING" && (
          <Button variant="success" className="flex-1" size="lg" onClick={() => move("READY")}>
            <CheckCheck /> {p.total > 1 ? "Semua siap" : "Tandai siap"}
          </Button>
        )}
        {o.status === "READY" && (
          <Button variant="outline" className="flex-1" size="lg" onClick={() => move("COMPLETED")}>
            <CheckCheck /> {p.toServe > 1 ? "Semua sudah diantar" : "Sudah diantar"}
          </Button>
        )}
      </div>
    </article>
  );
}

/** Satu baris item: ketuk = maju satu tahap, tekan lama = koreksi */
function ItemRow({
  item: i,
  type,
  fixing,
  onAdvance,
  onLongPress,
  onUndo,
  onCloseFix,
}: {
  item: KOrder["items"][number];
  type: OrderType;
  fixing: boolean;
  onAdvance: () => void;
  onLongPress: () => void;
  onUndo: () => void;
  onCloseFix: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const next = nextItemStep(i.status, i.quickReady);
  const back = prevItemStep(i.status, i.quickReady);
  const ui = next ? NEXT_UI[i.status] : null;
  const nextLabel = next === "READY" && i.status === "QUEUED" ? "Siap" : ui?.label(type);
  const NextIcon = next === "READY" && i.status === "QUEUED" ? Zap : ui?.icon;

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  if (fixing && back) {
    return (
      <li className="flex min-h-16 items-center gap-2 rounded-xl border-2 border-warning/60 bg-warning/10 px-3 py-2">
        <p className="min-w-0 flex-1 text-sm">
          Koreksi <b>{i.name}</b>
        </p>
        <Button variant="secondary" className="h-12" onClick={onUndo}>
          <Undo2 /> Kembali ke {itemStatusLabel(back, type)}
        </Button>
        <Button variant="ghost" className="h-12" onClick={onCloseFix}>
          Batal
        </Button>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onPointerDown={() => {
          longPressed.current = false;
          cancel();
          timer.current = setTimeout(() => {
            longPressed.current = true;
            navigator.vibrate?.(30);
            onLongPress();
          }, LONG_PRESS_MS);
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (longPressed.current) return;
          onAdvance();
        }}
        className={cn(
          "flex min-h-16 w-full select-none items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.99]",
          i.status === "SERVED" ? "opacity-45" : "bg-muted/40 hover:bg-muted/70",
          i.status === "READY" && "bg-emerald-500/10 ring-1 ring-emerald-500/40"
        )}
      >
        <div className="min-w-0 flex-1">
          <p className={cn("text-[17px] font-semibold leading-snug", i.status === "SERVED" && "line-through")}>
            <span className="mr-1.5 text-primary">{i.quantity}×</span>
            {i.name}
            {i.quickReady && i.status === "QUEUED" && <Zap className="ml-1.5 inline size-3.5 text-amber-400" aria-label="Langsung siap" />}
          </p>
          {i.modifiers.length > 0 && <p className="text-sm text-muted-foreground">{i.modifiers.join(" · ")}</p>}
          {i.note && <p className="mt-0.5 rounded-md bg-warning/20 px-2 py-0.5 text-sm font-medium text-warning">⚠ {i.note}</p>}
          <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", ITEM_TONE[i.status])}>
            {itemStatusLabel(i.status, type)}
          </span>
        </div>
        {ui && NextIcon && (
          <span className={cn("flex h-12 min-w-24 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold", next === "READY" && i.status === "QUEUED" ? "bg-success text-white" : ui.cls)}>
            <NextIcon className="size-4" /> {nextLabel}
          </span>
        )}
        {!ui && <Check className="mr-3 size-5 shrink-0 text-muted-foreground" />}
      </button>
    </li>
  );
}
