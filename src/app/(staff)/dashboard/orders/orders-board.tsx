"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { OrderSource, OrderStatus, OrderType, PaymentMethod, PaymentState, PaymentStatus, Role } from "@prisma/client";
import { formatDistanceToNowStrict, format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Bell, Check, ChefHat, CreditCard, HandPlatter, Printer, QrCode, Receipt, Search, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { cn, formatRupiah, pad } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, SheetContent } from "@/components/ui/dialog";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { resolveRequest, updateOrderStatus } from "@/server/actions/staff";

export type BoardOrder = {
  id: string;
  code: string;
  queueNumber: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  payPreference: PaymentMethod | null;
  source: OrderSource;
  type: OrderType;
  customerName: string | null;
  note: string | null;
  tableName: string | null;
  total: number;
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  paid: number;
  createdAt: string;
  cancelReason: string | null;
  items: { id: string; name: string; quantity: number; lineTotal: number; note: string | null; modifiers: string[] }[];
  payments: { id: string; method: PaymentMethod; amount: number; state: PaymentState; label: string | null; createdAt: string }[];
};

const TABS = [
  { key: "action", label: "Perlu konfirmasi" },
  { key: "active", label: "Sedang berjalan" },
  { key: "unpaid", label: "Belum bayar" },
  { key: "done", label: "Selesai" },
  { key: "cancelled", label: "Batal" },
  { key: "all", label: "Semua" },
] as const;

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; icon: typeof Check }>> = {
  PENDING: { to: "CONFIRMED", label: "Terima & kirim ke dapur", icon: Check },
  CONFIRMED: { to: "PREPARING", label: "Mulai masak", icon: ChefHat },
  PREPARING: { to: "READY", label: "Tandai siap", icon: HandPlatter },
  READY: { to: "COMPLETED", label: "Sudah diantar / diambil", icon: Check },
};

export function OrdersBoard({
  tab,
  q,
  date,
  role,
  counts,
  orders,
  selected,
  requests,
}: {
  tab: string;
  q: string;
  date: string;
  role: Role;
  counts: { action: number; active: number; unpaid: number };
  orders: BoardOrder[];
  selected: BoardOrder | null;
  requests: { id: string; type: string; tableName: string; createdAt: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(q);

  const href = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { tab, q: q || undefined, date, ...params };
    Object.entries(merged).forEach(([k, v]) => v && sp.set(k, v));
    return `${pathname}?${sp.toString()}`;
  };

  return (
    <div className="space-y-5">
      {requests.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3">
          <span className="flex items-center gap-2 px-1 text-sm font-semibold">
            <Bell className="size-4 animate-bounce" /> Panggilan meja
          </span>
          {requests.map((r) => (
            <RequestChip key={r.id} r={r} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {TABS.map((t) => {
            const count = (counts as Record<string, number>)[t.key];
            return (
              <Link
                key={t.key}
                href={href({ tab: t.key, id: undefined })}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                  tab === t.key ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted"
                )}
              >
                {t.label}
                {count ? (
                  <span className={cn("grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold", t.key === "action" ? "bg-primary text-primary-foreground" : tab === t.key ? "bg-background/20" : "bg-muted")}>
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(href({ q: search || undefined, id: undefined }));
          }}
        >
          {["done", "cancelled", "all"].includes(tab) && (
            <Input type="date" value={date} onChange={(e) => router.push(href({ date: e.target.value }))} className="w-40" />
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode / nama" className="w-52 pl-9" />
          </div>
        </form>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title={tab === "action" ? "Tidak ada pesanan yang perlu dikonfirmasi" : "Belum ada pesanan"}
          description="Pesanan baru akan muncul otomatis di sini."
          className="bg-card"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} href={href({ id: o.id })} />
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && router.push(href({ id: undefined }), { scroll: false })}>
        {selected && <OrderDetail order={selected} role={role} />}
      </Dialog>
    </div>
  );
}

function RequestChip({ r }: { r: { id: string; type: string; tableName: string; createdAt: string } }) {
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-2 rounded-full bg-card py-1 pl-3 pr-1 text-sm shadow-xs">
      <b>{r.tableName}</b>
      <span className="text-muted-foreground">{r.type === "REQUEST_BILL" ? "minta bill" : "panggil pelayan"}</span>
      <span className="text-xs text-muted-foreground">{formatDistanceToNowStrict(new Date(r.createdAt), { locale: localeId })}</span>
      <Button size="icon-sm" variant="success" className="size-7 rounded-full" loading={pending} onClick={() => start(async () => void (await resolveRequest(r.id)))}>
        {!pending && <Check />}
      </Button>
    </span>
  );
}

function OrderCard({ order: o, href }: { order: BoardOrder; href: string }) {
  const minutes = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
  const late = ["CONFIRMED", "PREPARING"].includes(o.status) && minutes >= 20;
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md",
        o.status === "PENDING" && "border-primary/50 ring-2 ring-primary/15"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl bg-muted text-lg font-extrabold tabular">#{pad(o.queueNumber)}</span>
          <div>
            <p className="font-semibold">{o.tableName ?? "Takeaway"}</p>
            <p className="text-xs text-muted-foreground">{o.customerName || "Tanpa nama"}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <OrderStatusBadge status={o.status} />
          <span className={cn("text-xs tabular", late ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {minutes < 1 ? "baru saja" : `${minutes} mnt`}
          </span>
        </div>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">
        {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
      </p>
      <div className="mt-auto flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="gap-1">
            {o.source === "QR" ? <QrCode /> : <ShoppingBag />} {o.source === "QR" ? "QR" : "Kasir"}
          </Badge>
          <PaymentStatusBadge status={o.paymentStatus} />
        </div>
        <span className="font-bold tabular">{formatRupiah(o.total)}</span>
      </div>
    </Link>
  );
}

function OrderDetail({ order: o, role }: { order: BoardOrder; role: Role }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const next = NEXT[o.status];
  const remaining = o.total - o.paid;
  const canPay = role === "OWNER" || role === "KASIR";

  const run = (status: OrderStatus, why?: string) =>
    start(async () => {
      const res = await updateOrderStatus(o.id, status, why);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Status pesanan diperbarui");
        setCancelOpen(false);
        router.refresh();
      }
    });

  return (
    <SheetContent aria-describedby={undefined}>
      <div className="border-b p-5 pr-12">
        <div className="flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-xl font-extrabold text-primary tabular">#{pad(o.queueNumber)}</span>
          <div className="space-y-1">
            <DialogTitle className="text-lg font-bold">
              {o.tableName ?? "Takeaway"} · {o.customerName || "Tanpa nama"}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <OrderStatusBadge status={o.status} />
              <PaymentStatusBadge status={o.paymentStatus} />
              <span>{o.code}</span>·<span>{format(new Date(o.createdAt), "d MMM, HH:mm", { locale: localeId })}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {o.status === "PENDING" && (
          <div className="rounded-xl bg-warning/15 p-3 text-sm">
            {o.payPreference === "MIDTRANS"
              ? "Customer memilih bayar online, tapi belum menyelesaikan pembayaran."
              : "Customer memilih bayar di kasir. Terima pesanan agar dapur mulai memasak."}
          </div>
        )}
        {o.cancelReason && <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">Alasan batal: {o.cancelReason}</div>}
        <ul className="space-y-3">
          {o.items.map((i) => (
            <li key={i.id} className="flex gap-3 text-sm">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold">{i.quantity}×</span>
              <div className="flex-1">
                <p className="font-semibold">{i.name}</p>
                {i.modifiers.length > 0 && <p className="text-xs text-muted-foreground">{i.modifiers.join(", ")}</p>}
                {i.note && <p className="text-xs italic text-primary">“{i.note}”</p>}
              </div>
              <span className="tabular">{formatRupiah(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {o.note && <p className="rounded-xl bg-muted p-3 text-sm">📝 {o.note}</p>}
        <div className="space-y-1.5 rounded-xl bg-muted/60 p-4 text-sm">
          <Row l="Subtotal" v={o.subtotal} />
          {o.discount > 0 && <Row l="Diskon" v={-o.discount} />}
          {o.serviceCharge > 0 && <Row l="Service" v={o.serviceCharge} />}
          {o.tax > 0 && <Row l="Pajak" v={o.tax} />}
          <div className="flex justify-between border-t border-dashed pt-2 font-bold">
            <span>Total</span>
            <span className="tabular">{formatRupiah(o.total)}</span>
          </div>
          {o.payments.map((p) => (
            <div key={p.id} className={cn("flex justify-between text-xs", p.state === "SUCCESS" ? "text-success" : "text-muted-foreground line-through")}>
              <span>
                {PAYMENT_METHOD_LABEL[p.method]}
                {p.label ? ` · ${p.label}` : ""} {p.state !== "SUCCESS" && `(${p.state.toLowerCase()})`}
              </span>
              <span className="tabular">{formatRupiah(p.amount)}</span>
            </div>
          ))}
          {remaining > 0 && o.status !== "CANCELLED" && (
            <div className="flex justify-between font-semibold text-destructive">
              <span>Sisa tagihan</span>
              <span className="tabular">{formatRupiah(remaining)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 border-t p-5">
        {next && (
          <Button size="lg" className="w-full" loading={pending} onClick={() => run(next.to)}>
            <next.icon /> {next.label}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          {canPay && remaining > 0 && o.status !== "CANCELLED" && (
            <Button asChild variant="success">
              <Link href={`/pos?order=${o.id}`}>
                <CreditCard /> Bayar
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <a href={`/receipt/${o.id}?print=1`} target="_blank" rel="noreferrer">
              <Printer /> Cetak struk
            </a>
          </Button>
          {!["COMPLETED", "CANCELLED"].includes(o.status) && role !== "DAPUR" && (
            <Button variant="ghost" className="text-destructive" onClick={() => setCancelOpen(true)}>
              <X /> Batalkan
            </Button>
          )}
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Batalkan pesanan #{pad(o.queueNumber)}?</DialogTitle>
            <DialogDescription>
              {o.paymentStatus !== "UNPAID" ? "Pesanan sudah dibayar dan akan ditandai refund." : "Customer akan melihat status dibatalkan."}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan (mis. stok habis)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Kembali</Button>
            <Button variant="destructive" loading={pending} onClick={() => run("CANCELLED", reason || undefined)}>
              Ya, batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SheetContent>
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
