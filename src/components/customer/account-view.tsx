"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { cn, formatRupiah, initials, pad } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { OrderStatusBadge } from "@/components/shared/status-badge";
import { claimDeviceOrders, updateCustomerProfile } from "@/server/actions/account";
import { SignOutButton } from "./sign-out-button";

type AccountOrder = {
  id: string;
  queueNumber: number;
  createdLabel: string;
  pickupLabel: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  outletName: string;
  tableName: string | null;
  items: string[];
  reorderHref: string | null;
};

const ACTIVE: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY"];

function deviceOrderIds() {
  const ids: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("orders:")) continue;
      const list = JSON.parse(localStorage.getItem(key) || "[]") as { id: string; at: number }[];
      list.filter((o) => Date.now() - o.at < 24 * 3600_000).forEach((o) => ids.push(o.id));
    }
  } catch {
    /* ignore */
  }
  return ids.slice(0, 30);
}

export function AccountView({
  customer,
  stats,
  orders,
  children,
}: {
  customer: { id: string; name: string; email: string; image: string | null; phone: string | null };
  stats: { orders: number; spent: number; visits: number; favourites: { name: string; qty: number }[] };
  orders: AccountOrder[];
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, start] = useTransition();
  const [tab, setTab] = useState<"all" | "active">("all");

  // Pesanan yang dibuat di HP ini sebelum login ikut masuk riwayat
  useEffect(() => {
    const ids = deviceOrderIds().filter((id) => !orders.some((o) => o.id === id));
    if (!ids.length) return;
    claimDeviceOrders(ids).then((r) => {
      if (r.ok && r.data?.claimed) {
        toast.success(`${r.data.claimed} pesanan dari perangkat ini ditambahkan ke riwayat`);
        router.refresh();
      }
    });
    // hanya sekali saat halaman dibuka
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simpan nama & WA untuk isi otomatis di keranjang
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("customer") || "{}");
      localStorage.setItem("customer", JSON.stringify({ name: saved.name || customer.name, phone: customer.phone || saved.phone || "" }));
    } catch {
      /* ignore */
    }
  }, [customer.name, customer.phone]);

  const activeOrders = orders.filter((o) => ACTIVE.includes(o.status));
  const list = tab === "active" ? activeOrders : orders;

  return (
    <div className="-mt-4 space-y-6 px-4">
      {/* Profil */}
      <section className="rounded-3xl border bg-card p-5 shadow-lg shadow-olive-deep/5">
        <div className="flex items-center gap-3.5">
          {customer.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={customer.image} alt="" referrerPolicy="no-referrer" className="size-14 rounded-2xl object-cover" />
          ) : (
            <span className="grid size-14 place-items-center rounded-2xl bg-cream text-lg font-bold text-olive-deep">{initials(customer.name)}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{customer.name}</p>
            <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
            {customer.phone && <p className="text-xs text-muted-foreground">WA {customer.phone}</p>}
          </div>
          <button onClick={() => setEditing((e) => !e)} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Ubah profil">
            <Pencil className="size-4" />
          </button>
        </div>
        {editing && (
          <form
            className="mt-4 grid gap-3 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              start(async () => {
                const r = await updateCustomerProfile({ name: String(f.get("name")), phone: String(f.get("phone") || "") });
                if (!r.ok) return void toast.error(r.error);
                toast.success("Profil disimpan");
                setEditing(false);
                router.refresh();
              });
            }}
          >
            <Field label="Nama (dipanggil saat pesanan siap)"><Input name="name" defaultValue={customer.name} maxLength={60} required /></Field>
            <Field label="No. WhatsApp"><Input name="phone" defaultValue={customer.phone ?? ""} inputMode="tel" maxLength={20} placeholder="08…" /></Field>
            <Button type="submit" loading={saving}>Simpan</Button>
          </form>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Kunjungan", String(stats.visits)],
            ["Pesanan", String(stats.orders)],
            ["Total belanja", formatRupiah(stats.spent)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-muted/60 px-2 py-3">
              <p className="truncate text-sm font-bold tabular">{v}</p>
              <p className="text-[11px] text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
        {stats.favourites.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Favoritmu: {stats.favourites.map((f) => `${f.name} (${f.qty}×)`).join(", ")}
          </p>
        )}
      </section>

      {children}

      {/* Riwayat */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-olive-deep">Riwayat pesanan</h2>
          <div className="flex rounded-full bg-muted p-1 text-xs font-semibold">
            {(
              [
                ["all", "Semua"],
                ["active", `Berjalan${activeOrders.length ? ` (${activeOrders.length})` : ""}`],
              ] as const
            ).map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} className={cn("rounded-full px-3 py-1.5 transition", tab === v ? "bg-card shadow-sm" : "text-muted-foreground")}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {tab === "active" ? "Tidak ada pesanan yang sedang berjalan." : "Belum ada pesanan. Pesanan yang kamu buat saat masuk akan muncul di sini."}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {list.map((o) => (
              <li key={o.id} className="rounded-2xl border bg-card p-3.5">
                <Link href={`/order/${o.id}`} className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary tabular">#{pad(o.queueNumber)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{o.outletName}</span>
                      <OrderStatusBadge status={o.status} />
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {o.createdLabel} · {o.tableName ? o.tableName : o.pickupLabel ? `Takeaway, ambil ${o.pickupLabel}` : "Takeaway"}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-sm text-foreground/80">{o.items.join(", ")}</span>
                  </span>
                  <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground" />
                </Link>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-bold tabular">{formatRupiah(o.total)}</span>
                  {o.reorderHref && (
                    <Link href={o.reorderHref} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground">
                      <RotateCcw className="size-3.5" /> Pesan lagi
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-center">
        <SignOutButton className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted" />
      </div>
    </div>
  );
}
