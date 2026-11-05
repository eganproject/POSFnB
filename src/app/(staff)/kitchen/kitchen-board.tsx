"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderSource, OrderType, Role } from "@prisma/client";
import { ArrowLeft, Check, ChefHat, Flame, HandPlatter, Maximize, PackageX, Undo2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { cn, pad } from "@/lib/utils";
import { useRealtime } from "@/hooks/use-realtime";
import { chime } from "@/components/staff/live-alerts";
import { Button } from "@/components/ui/button";
import { toggleItemDone, updateOrderStatus } from "@/server/actions/staff";

type KOrder = {
  id: string;
  queueNumber: number;
  status: "CONFIRMED" | "PREPARING" | "READY";
  type: OrderType;
  source: OrderSource;
  tableName: string | null;
  customerName: string | null;
  note: string | null;
  since: string;
  readyAt: string | null;
  items: { id: string; name: string; quantity: number; note: string | null; isDone: boolean; modifiers: string[] }[];
};

const COLUMNS = [
  { key: "CONFIRMED", title: "Antrean baru", icon: Flame, accent: "bg-sky-500" },
  { key: "PREPARING", title: "Sedang dimasak", icon: ChefHat, accent: "bg-primary" },
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

function KitchenTicket({ order: o, now }: { order: KOrder; now: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const minutes = Math.max(0, Math.floor((now - new Date(o.since).getTime()) / 60000));
  const urgency = o.status === "READY" ? "ok" : minutes >= 20 ? "late" : minutes >= 10 ? "warn" : "ok";
  const allDone = o.items.every((i) => i.isDone);

  const move = (to: "PREPARING" | "READY" | "COMPLETED" | "CONFIRMED") =>
    start(async () => {
      const r = await updateOrderStatus(o.id, to);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });

  const toggle = (id: string, done: boolean) =>
    start(async () => {
      const r = await toggleItemDone(id, done);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border-2 bg-card shadow-lg transition animate-fade-up",
        urgency === "late" ? "border-destructive" : urgency === "warn" ? "border-warning" : "border-transparent",
        pending && "opacity-60"
      )}
    >
      <div className={cn("flex items-center justify-between px-4 py-3", urgency === "late" ? "bg-destructive/20" : urgency === "warn" ? "bg-warning/15" : "bg-muted/60")}>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black tabular">#{pad(o.queueNumber)}</span>
          <span className="font-semibold">{o.tableName ?? "Takeaway"}</span>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-bold tabular", urgency === "late" && "text-destructive")}>{minutes}′</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{o.type === "TAKEAWAY" ? "Bungkus" : "Makan di tempat"}</p>
        </div>
      </div>
      <ul className="divide-y divide-border/60">
        {o.items.map((i) => (
          <li key={i.id}>
            <button
              disabled={o.status === "READY"}
              onClick={() => toggle(i.id, !i.isDone)}
              className={cn("flex w-full gap-3 px-4 py-2.5 text-left transition hover:bg-muted/40", i.isDone && "opacity-40")}
            >
              <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2", i.isDone ? "border-success bg-success text-white" : "border-muted-foreground/40")}>
                {i.isDone && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <div className="flex-1">
                <p className={cn("font-semibold", i.isDone && "line-through")}>
                  <span className="mr-1.5 text-primary">{i.quantity}×</span>
                  {i.name}
                </p>
                {i.modifiers.length > 0 && <p className="text-sm text-muted-foreground">{i.modifiers.join(" · ")}</p>}
                {i.note && <p className="mt-0.5 rounded-md bg-warning/20 px-2 py-0.5 text-sm font-medium text-warning">⚠ {i.note}</p>}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {o.note && <p className="mx-4 mb-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-warning">📝 {o.note}</p>}
      <div className="flex gap-2 p-3">
        {o.status === "CONFIRMED" && (
          <Button className="flex-1" size="lg" onClick={() => move("PREPARING")}>
            <ChefHat /> Mulai masak
          </Button>
        )}
        {o.status === "PREPARING" && (
          <>
            <Button variant="secondary" size="icon" className="h-12 w-12" onClick={() => move("CONFIRMED")} aria-label="Kembalikan">
              <Undo2 />
            </Button>
            <Button variant="success" className="flex-1" size="lg" onClick={() => move("READY")}>
              <HandPlatter /> {allDone ? "Siap diantar" : "Tandai siap"}
            </Button>
          </>
        )}
        {o.status === "READY" && (
          <>
            <Button variant="secondary" size="icon" className="h-12 w-12" onClick={() => move("PREPARING")} aria-label="Kembalikan">
              <Undo2 />
            </Button>
            <Button variant="outline" className="flex-1" size="lg" onClick={() => move("COMPLETED")}>
              <Check /> Sudah diantar
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
