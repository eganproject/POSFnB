"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderSource, OrderStatus, Role } from "@prisma/client";
import { formatDistanceToNowStrict } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArrowLeft, Bell, ChefHat, ClipboardList, Minus, Plus, Receipt, Save, Search, ShoppingBag, Trash2, UtensilsCrossed, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import type { MenuCategory, MenuProduct } from "@/server/menu";
import { cn, formatRupiah, pad } from "@/lib/utils";
import { addLine, estimateTotals, lineKey, modifierText, setLineQty, type CartLine } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { ProductImage } from "@/components/shared/product-image";
import { ProductOptions } from "@/components/menu/product-options";
import { OrderStatusBadge } from "@/components/shared/status-badge";
import { LiveAlerts } from "@/components/staff/live-alerts";
import { createPosOrder } from "@/server/actions/staff";
import { PaymentDialog } from "./payment-dialog";
import { TablePayDialog } from "./table-pay-dialog";
import { ShiftGate, ShiftChip } from "./shift";

type Table = { id: string; name: string; area: string | null; capacity: number; busy: boolean };
type OpenBill = {
  id: string;
  queueNumber: number;
  tableName: string | null;
  customerName: string | null;
  status: OrderStatus;
  source: OrderSource;
  total: number;
  remaining: number;
  createdAt: string;
};

export function PosApp(props: {
  user: { name: string; role: Role };
  outlet: { id: string; name: string; taxRate: number; serviceRate: number; maxDiscountPercent: number };
  categories: MenuCategory[];
  tables: Table[];
  openBills: OpenBill[];
  shift: { id: string; openedAt: string; openingCash: number } | null;
  initialOrderId: string | null;
  requestCount: number;
  payment: { demo: boolean; online: boolean; clientKey: string; isProduction: boolean };
}) {
  const { user, outlet, categories, tables, openBills, shift } = props;
  const router = useRouter();
  const canPay = user.role !== "PELAYAN";
  const canDiscount = user.role !== "PELAYAN";

  const [cat, setCat] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [type, setType] = useState<"DINE_IN" | "TAKEAWAY">("TAKEAWAY");
  const [tableId, setTableId] = useState<string | null>(null);
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [panel, setPanel] = useState<"cart" | "bills">("cart");
  const [tablePicker, setTablePicker] = useState(false);
  const [optionsFor, setOptionsFor] = useState<{ product: MenuProduct; emoji: string | null } | null>(null);
  const [payOrderId, setPayOrderId] = useState<string | null>(props.initialOrderId);
  const [saving, setSaving] = useState<"save" | "pay" | null>(null);
  const [mobileCart, setMobileCart] = useState(false);
  const [payTable, setPayTable] = useState<{ name: string; bills: OpenBill[] } | null>(null);

  useEffect(() => {
    if (props.initialOrderId) router.replace("/pos", { scroll: false });
  }, [props.initialOrderId, router]);

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .filter((c) => cat === "all" || c.id === cat)
      .flatMap((c) => c.products.map((p) => ({ p, emoji: p.emoji })))
      .filter(({ p }) => !q || p.name.toLowerCase().includes(q));
  }, [categories, cat, query]);

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const totals = estimateTotals(subtotal, outlet, discount);
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const table = tables.find((t) => t.id === tableId);

  const add = (product: MenuProduct, emoji: string | null) => {
    if (product.soldOut) return toast.error(`${product.name} sedang habis`);
    if (product.groups.length) return setOptionsFor({ product, emoji });
    setLines((ls) =>
      addLine(ls, {
        key: lineKey(product.id, [], ""),
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity: 1,
        optionIds: [],
        modifiers: [],
        note: "",
        imageUrl: product.imageUrl,
        emoji,
      })
    );
  };

  const reset = () => {
    setLines([]);
    setCustomer("");
    setDiscount(0);
    setDiscountReason("");
    setTableId(null);
  };

  // Kasir dibatasi persentase diskon outlet; owner bebas
  const maxDiscount = user.role === "OWNER" ? subtotal : Math.floor((subtotal * outlet.maxDiscountPercent) / 100);

  const submit = async (andPay: boolean) => {
    if (!lines.length) return;
    if (discount > maxDiscount) return toast.error(`Diskon kasir maksimal ${outlet.maxDiscountPercent}% dari subtotal`);
    if (discount > 0 && discountReason.trim().length < 3) return toast.error("Isi alasan diskon");
    if (type === "DINE_IN" && !tableId) {
      setTablePicker(true);
      return toast.error("Pilih meja dulu");
    }
    setSaving(andPay ? "pay" : "save");
    const res = await createPosOrder({
      type,
      tableId,
      customerName: customer || null,
      discount,
      discountReason: discount > 0 ? discountReason.trim() : null,
      lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, optionIds: l.optionIds, note: l.note || null })),
    });
    setSaving(null);
    if (!res.ok) return toast.error(res.error);
    reset();
    setMobileCart(false);
    router.refresh();
    if (andPay) setPayOrderId(res.data.orderId);
    else toast.success("Pesanan dikirim ke dapur sebagai open bill");
  };

  const billGroups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; bills: OpenBill[] }>();
    for (const b of openBills) {
      const key = b.tableName ?? `takeaway-${b.id}`;
      if (!map.has(key)) map.set(key, { key, name: b.tableName ?? "Takeaway", bills: [] });
      map.get(key)!.bills.push(b);
    }
    return [...map.values()];
  }, [openBills]);

  const panelBody = (
    <>
          <div className="grid grid-cols-2 gap-1 border-b p-2">
            {[
              { k: "cart" as const, label: "Pesanan baru", icon: ShoppingBag, badge: count },
              { k: "bills" as const, label: "Tagihan terbuka", icon: Receipt, badge: openBills.length },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setPanel(t.k)}
                className={cn("flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition", panel === t.k ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}
              >
                <t.icon className="size-4" /> {t.label}
                {t.badge > 0 && <span className={cn("rounded-full px-1.5 text-[11px]", panel === t.k ? "bg-background/20" : "bg-muted")}>{t.badge}</span>}
              </button>
            ))}
          </div>

          {panel === "cart" ? (
            <>
              <div className="space-y-3 border-b p-4">
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                  {(["TAKEAWAY", "DINE_IN"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setType(t);
                        if (t === "DINE_IN" && !tableId) setTablePicker(true);
                      }}
                      className={cn("rounded-lg py-2 text-sm font-semibold transition", type === t ? "bg-card shadow-sm" : "text-muted-foreground")}
                    >
                      {t === "TAKEAWAY" ? "🛍️ Takeaway" : "🪑 Dine-in"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {type === "DINE_IN" && (
                    <Button variant="outline" className={cn("shrink-0", !table && "border-primary text-primary")} onClick={() => setTablePicker(true)}>
                      {table ? table.name : "Pilih meja"}
                    </Button>
                  )}
                  <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nama customer (opsional)" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {lines.length === 0 ? (
                  <div className="grid h-full place-items-center p-8 text-center text-muted-foreground">
                    <div className="space-y-2">
                      <UtensilsCrossed className="mx-auto size-10 opacity-40" />
                      <p className="text-sm">Pilih menu di sebelah kiri untuk mulai</p>
                    </div>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {lines.map((l) => (
                      <li key={l.key} className="flex gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{l.name}</p>
                          {l.modifiers.length > 0 && <p className="text-xs text-muted-foreground">{modifierText(l.modifiers)}</p>}
                          {l.note && <p className="text-xs italic text-primary">“{l.note}”</p>}
                          <p className="mt-1 text-sm font-bold tabular">{formatRupiah(l.unitPrice * l.quantity)}</p>
                        </div>
                        <div className="flex items-center gap-1 self-center">
                          <button onClick={() => setLines((ls) => setLineQty(ls, l.key, l.quantity - 1))} className="grid size-8 place-items-center rounded-lg border hover:bg-muted">
                            {l.quantity === 1 ? <Trash2 className="size-3.5 text-destructive" /> : <Minus className="size-3.5" />}
                          </button>
                          <span className="w-7 text-center text-sm font-bold tabular">{l.quantity}</span>
                          <button onClick={() => setLines((ls) => setLineQty(ls, l.key, l.quantity + 1))} className="grid size-8 place-items-center rounded-lg border hover:bg-muted">
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-3 border-t p-4">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal ({count} item)</span>
                    <span className="tabular text-foreground">{formatRupiah(totals.subtotal)}</span>
                  </div>
                  {canDiscount && (
                    <div className="flex items-center justify-between gap-2 text-muted-foreground">
                      <span>Diskon</span>
                      <div className="flex items-center gap-1">
                        {[0, 10, 20].filter((pct) => user.role === "OWNER" || pct <= outlet.maxDiscountPercent).map((pct) => (
                          <button
                            key={pct}
                            onClick={() => setDiscount(Math.round((subtotal * pct) / 100))}
                            className="rounded-md border px-1.5 py-0.5 text-[11px] font-semibold hover:bg-muted"
                          >
                            {pct}%
                          </button>
                        ))}
                        <Input
                          value={discount ? String(discount) : ""}
                          onChange={(e) => setDiscount(Math.min(maxDiscount, Number(e.target.value.replace(/\D/g, "")) || 0))}
                          placeholder="0"
                          inputMode="numeric"
                          className="h-7 w-24 text-right text-xs"
                        />
                      </div>
                    </div>
                  )}
                  {canDiscount && discount > 0 && (
                    <Input
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="Alasan diskon (wajib), mis. member, promo"
                      maxLength={120}
                      className="h-8 text-xs"
                    />
                  )}
                  {totals.serviceCharge > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Service {outlet.serviceRate}%</span>
                      <span className="tabular text-foreground">{formatRupiah(totals.serviceCharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pajak {outlet.taxRate}%</span>
                    <span className="tabular text-foreground">{formatRupiah(totals.tax)}</span>
                  </div>
                  <div className="flex justify-between pt-1 text-lg font-extrabold">
                    <span>Total</span>
                    <span className="tabular">{formatRupiah(lines.length ? totals.total : 0)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {lines.length > 0 && (
                    <Button variant="ghost" size="icon" className="h-12 w-12 shrink-0 text-destructive" onClick={reset} aria-label="Kosongkan">
                      <X />
                    </Button>
                  )}
                  <Button variant="outline" size="lg" className="h-12 flex-1" disabled={!lines.length} loading={saving === "save"} onClick={() => submit(false)}>
                    <Save /> Open bill
                  </Button>
                  {canPay && (
                    <Button size="lg" className="h-12 flex-[1.4]" disabled={!lines.length} loading={saving === "pay"} onClick={() => submit(true)}>
                      <Wallet /> Bayar
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-3">
              {openBills.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">Semua tagihan sudah lunas 🎉</p>
              ) : (
                <div className="space-y-4">
                  {billGroups.map((g) => (
                    <div key={g.key} className={cn(g.bills.length > 1 && "rounded-2xl border border-dashed p-2")}>
                      {g.bills.length > 1 && (
                        <div className="mb-2 flex items-center justify-between gap-2 px-1">
                          <p className="text-sm font-semibold">
                            {g.name} <span className="font-normal text-muted-foreground">· {g.bills.length} tagihan</span>
                          </p>
                          {canPay && (
                            <Button size="sm" variant="success" onClick={() => setPayTable({ name: g.name, bills: g.bills })}>
                              Bayar semua {formatRupiah(g.bills.reduce((s, b) => s + b.remaining, 0))}
                            </Button>
                          )}
                        </div>
                      )}
                      <ul className="space-y-2">
                        {g.bills.map((b) => (
                        <li key={b.id}>
                          <button
                            onClick={() => (canPay ? setPayOrderId(b.id) : router.push(`/dashboard/orders?id=${b.id}`))}
                            className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-primary hover:bg-primary/5"
                          >
                            <span className="grid size-11 place-items-center rounded-xl bg-muted font-bold tabular">#{pad(b.queueNumber)}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                {b.tableName ?? "Takeaway"} · {b.customerName || "Tanpa nama"}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <OrderStatusBadge status={b.status} />
                                <span>{b.source === "QR" ? "QR" : "Kasir"}</span>·
                                <span>{formatDistanceToNowStrict(new Date(b.createdAt), { locale: localeId })}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold tabular">{formatRupiah(b.remaining)}</p>
                              {b.remaining !== b.total && <p className="text-[11px] text-muted-foreground line-through tabular">{formatRupiah(b.total)}</p>}
                            </div>
                          </button>
                        </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
    </>
  );

  return (
    <div className="flex h-dvh flex-col bg-muted/40">
      <LiveAlerts />
      {/* Topbar */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4">
        <Button asChild variant="ghost" size="icon" aria-label="Kembali">
          <Link href={user.role === "OWNER" ? "/dashboard" : "/dashboard/orders"}>
            <ArrowLeft />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-lg">🍽️</span>
          <div className="leading-tight">
            <p className="font-bold">Kasir</p>
            <p className="text-xs text-muted-foreground">{outlet.name}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {props.requestCount > 0 && (
            <Button asChild variant="outline" size="sm" className="border-warning text-[oklch(0.5_0.12_70)]">
              <Link href="/dashboard/orders">
                <Bell /> {props.requestCount} panggilan
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link href="/dashboard/orders"><ClipboardList /> Pesanan</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link href="/kitchen"><ChefHat /> Dapur</Link>
          </Button>
          {canPay && <ShiftChip shift={shift} />}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Produk */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="space-y-3 border-b bg-card/60 p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari menu…" className="h-11 pl-10" />
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {[{ id: "all", name: "Semua", icon: "✨" }, ...categories].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
                    cat === c.id ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-card hover:bg-muted"
                  )}
                >
                  <span>{c.icon}</span> {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-28 md:pb-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {products.map(({ p, emoji }) => {
                const inCart = lines.filter((l) => l.productId === p.id).reduce((s, l) => s + l.quantity, 0);
                return (
                  <button
                    key={p.id}
                    onClick={() => add(p, emoji)}
                    disabled={p.soldOut}
                    className={cn(
                      "group relative flex flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]",
                      inCart > 0 && "ring-2 ring-primary",
                      p.soldOut && "opacity-50"
                    )}
                  >
                    <ProductImage src={p.imageUrl} name={p.name} emoji={emoji} className="aspect-[16/10]" emojiClassName="text-4xl transition group-hover:scale-110" />
                    {inCart > 0 && (
                      <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow">{inCart}</span>
                    )}
                    {p.soldOut && <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">HABIS</span>}
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
                      <p className="mt-auto text-sm font-bold text-primary tabular">{formatRupiah(p.price)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {products.length === 0 && <p className="py-20 text-center text-muted-foreground">Menu tidak ditemukan</p>}
          </div>
        </section>

        {/* Panel kanan */}
        <aside className="hidden w-[340px] shrink-0 flex-col border-l bg-card md:flex lg:w-[380px] xl:w-[420px]">
          {panelBody}
        </aside>
      </div>

      {/* Keranjang versi HP */}
      <div className="fixed inset-x-0 bottom-0 z-30 p-3 pb-safe md:hidden">
        <button
          onClick={() => setMobileCart(true)}
          className="flex w-full items-center gap-3 rounded-2xl bg-foreground p-2 pl-3 text-background shadow-2xl shadow-black/25"
        >
          <span className="relative grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-foreground">{count}</span>
            )}
          </span>
          <span className="flex-1 text-left">
            <span className="block text-xs text-background/60">{count ? `${count} item` : `${openBills.length} tagihan terbuka`}</span>
            <span className="block font-bold tabular">{count ? formatRupiah(totals.total) : "Lihat pesanan"}</span>
          </span>
          <span className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold">{count ? "Checkout" : "Buka"}</span>
        </button>
      </div>
      <Drawer open={mobileCart} onOpenChange={setMobileCart}>
        <DrawerContent className="h-[90dvh]">
          <DrawerTitle className="sr-only">Keranjang</DrawerTitle>
          <div className="flex min-h-0 flex-1 flex-col">{panelBody}</div>
        </DrawerContent>
      </Drawer>

      {/* Pilih meja */}
      <Dialog open={tablePicker} onOpenChange={setTablePicker}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pilih meja</DialogTitle>
            <DialogDescription>Meja oranye sedang terisi (ada pesanan aktif / belum lunas).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {tables.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTableId(t.id);
                  setType("DINE_IN");
                  setTablePicker(false);
                }}
                className={cn(
                  "rounded-2xl border p-3 text-left transition hover:border-primary",
                  t.busy && "border-primary/40 bg-primary/8",
                  tableId === t.id && "ring-2 ring-primary"
                )}
              >
                <p className="font-bold">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.area ?? "—"} · {t.capacity} org
                </p>
                <p className={cn("mt-1 text-[11px] font-semibold", t.busy ? "text-primary" : "text-success")}>{t.busy ? "Terisi" : "Kosong"}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Varian */}
      <Dialog open={!!optionsFor} onOpenChange={(o) => !o && setOptionsFor(null)}>
        <DialogContent className="flex max-h-[90dvh] max-w-md flex-col">
          {optionsFor && (
            <>
              <DialogHeader>
                <DialogTitle>{optionsFor.product.name}</DialogTitle>
                <DialogDescription>{formatRupiah(optionsFor.product.price)}</DialogDescription>
              </DialogHeader>
              <ProductOptions
                compact
                key={optionsFor.product.id}
                product={optionsFor.product}
                emoji={optionsFor.emoji}
                onAdd={(line) => {
                  setLines((ls) => addLine(ls, line));
                  setOptionsFor(null);
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {canPay && shift && (
        <PaymentDialog
          orderId={payOrderId}
          onClose={() => {
            setPayOrderId(null);
            router.refresh();
          }}
          config={props.payment}
        />
      )}
      {canPay && shift && (
        <TablePayDialog
          table={payTable}
          onClose={() => {
            setPayTable(null);
            router.refresh();
          }}
        />
      )}
      {canPay && !shift && <ShiftGate />}
    </div>
  );
}
