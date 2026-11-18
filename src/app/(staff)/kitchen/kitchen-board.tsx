"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderItemStatus, OrderSource, OrderType, Role } from "@prisma/client";
import { ArrowLeft, Check, CheckCheck, ChefHat, Flame, HandPlatter, Maximize, PackageX, Play, Undo2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { cn, pad } from "@/lib/utils";
import { useRealtime } from "@/hooks/use-realtime";
import { chime } from "@/components/staff/live-alerts";
import { Button } from "@/components/ui/button";
import { updateItemStatus, updateOrderStatus } from "@/server/actions/staff";
import { itemProgress, itemStatusLabel } from "@/lib/order-flow";

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
  items: { id: string; name: string; quantity: number; note: string | null; status: OrderItemStatus; modifiers: string[] }[];
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

/** Mundur satu langkah (koreksi salah tekan) */
const BACK: Partial<Record<OrderItemStatus, OrderItemStatus>> = { PREPARING: "QUEUED", READY: "PREPARING", SERVED: "READY" };

const ITEM_TONE: Record<OrderItemStatus, string> = {
  QUEUED: "bg-sky-500/15 text-sky-300",
  PREPARING: "bg-primary/20 text-primary",
  READY: "bg-emerald-500/20 text-emerald-300",
  SERVED: "bg-muted text-muted-foreground",
};

function KitchenTicket({ order: o, now }: { order: KOrder; now: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const minutes = Math.max(0, Math.floor((now - new Date(o.since).getTime()) / 60000));
  const urgency = o.status === "READY" ? "ok" : minutes >= 20 ? "late" : minutes >= 10 ? "warn" : "ok";
  const p = itemProgress(o.items);

  const move = (to: "PREPARING" | "READY" | "COMPLETED" | "CONFIRMED") =>
    start(async () => {
      const r = await updateOrderStatus(o.id, to);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });

  const setItem = (id: string, expected: OrderItemStatus, to: OrderItemStatus) =>
    start(async () => {
      const r = await updateItemStatus({ orderId: o.id, itemIds: [id], expected, to });
      if (!r.ok) toast.error(r.error);
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
      <ul className="divide-y divide-border/60">
        {o.items.map((i) => {
          const back = BACK[i.status];
          return (
            <li key={i.id} className={cn("flex items-start gap-3 px-4 py-2.5", i.status === "SERVED" && "opacity-45")}>
              <div className="min-w-0 flex-1">
                <p className={cn("font-semibold", i.status === "SERVED" && "line-through")}>
                  <span className="mr-1.5 text-primary">{i.quantity}×</span>
                  {i.name}
                </p>
                {i.modifiers.length > 0 && <p className="text-sm text-muted-foreground">{i.modifiers.join(" · ")}</p>}
                {i.note && <p className="mt-0.5 rounded-md bg-warning/20 px-2 py-0.5 text-sm font-medium text-warning">⚠ {i.note}</p>}
                <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", ITEM_TONE[i.status])}>
                  {itemStatusLabel(i.status, o.type)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {back && (
                  <button
                    onClick={() => setItem(i.id, i.status, back)}
                    aria-label={`Kembalikan ${i.name} ke ${itemStatusLabel(back, o.type)}`}
                    title={`Kembalikan ke ${itemStatusLabel(back, o.type)}`}
                    className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                  >
                    <Undo2 className="size-4" />
                  </button>
                )}
                {i.status === "QUEUED" && (
                  <>
                    <button
                      onClick={() => setItem(i.id, "QUEUED", "READY")}
                      aria-label={`${i.name} langsung siap`}
                      title="Langsung siap"
                      className="grid size-9 place-items-center rounded-lg bg-muted text-emerald-400 hover:bg-muted/70"
                    >
                      <Check className="size-4" />
                    </button>
                    <Button size="sm" className="h-9" onClick={() => setItem(i.id, "QUEUED", "PREPARING")}>
                      <Play /> Mulai
                    </Button>
                  </>
                )}
                {i.status === "PREPARING" && (
                  <Button size="sm" variant="success" className="h-9" onClick={() => setItem(i.id, "PREPARING", "READY")}>
                    <HandPlatter /> Siap
                  </Button>
                )}
                {i.status === "READY" && (
                  <Button size="sm" variant="outline" className="h-9" onClick={() => setItem(i.id, "READY", "SERVED")}>
                    <Check /> {o.type === "TAKEAWAY" ? "Diambil" : "Diantar"}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {o.note && <p className="mx-4 mb-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-warning">📝 {o.note}</p>}
      <div className="flex gap-2 p-3">
        {o.status === "CONFIRMED" && (
          <Button className="flex-1" size="lg" onClick={() => move("PREPARING")}>
            <ChefHat /> {p.total > 1 ? "Mulai semua" : "Mulai masak"}
          </Button>
        )}
        {o.status === "PREPARING" && (
          <>
            {p.done === 0 && (
              <Button variant="secondary" size="icon" className="h-12 w-12" onClick={() => move("CONFIRMED")} aria-label="Kembalikan ke antrean">
                <Undo2 />
              </Button>
            )}
            <Button variant="success" className="flex-1" size="lg" onClick={() => move("READY")}>
              <CheckCheck /> {p.total > 1 ? "Semua siap" : "Tandai siap"}
            </Button>
          </>
        )}
        {o.status === "READY" && (
          <>
            <Button variant="secondary" size="icon" className="h-12 w-12" onClick={() => move("PREPARING")} aria-label="Kembalikan">
              <Undo2 />
            </Button>
            <Button variant="outline" className="flex-1" size="lg" onClick={() => move("COMPLETED")}>
              <CheckCheck /> {p.toServe > 1 ? "Semua sudah diantar" : "Sudah diantar"}
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
