"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronRight, Plus, Receipt, Search, ShoppingBag, Star, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import type { MenuCategory, MenuProduct } from "@/server/menu";
import { cn, formatRupiah } from "@/lib/utils";
import { lineKey } from "@/lib/cart";
import { recentOrders, useCart, type RememberedOrder } from "@/hooks/use-cart";
import { usePathname, useRouter } from "next/navigation";
import { ProductImage } from "@/components/shared/product-image";
import { BrandMark } from "@/components/shared/brand-mark";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { ProductOptions } from "@/components/menu/product-options";
import { Button } from "@/components/ui/button";
import { CartSheet } from "./cart-sheet";
import { callStaff, getDeviceOrders } from "@/server/actions/customer";
import { isActiveOrder, type OrderSummary } from "@/lib/order-summary";
import { useRealtime } from "@/hooks/use-realtime";
import { OrderSummaryCard } from "./order-summary-card";
import { AccountSheet, CustomerAvatar, InfoSheet, clock, useOpenStatus } from "./menu-nav";

export type MenuOutlet = {
  id: string;
  name: string;
  address: string | null;
  taxRate: number;
  serviceRate: number;
  /** Pembayaran online (Midtrans / demo) tersedia */
  onlinePay: boolean;
  slug: string;
  openTime: string;
  closeTime: string;
  timeZone: string;
  takeawayEnabled: boolean;
};

export type ReorderItem = {
  productId: string;
  quantity: number;
  note: string;
  modifiers: { group: string; option: string }[];
};

export type PickupConfig = { enabled: boolean; openTime: string; closeTime: string; leadMinutes: number; timeZone: string };
export type MenuCustomer = { name: string; image: string | null; phone: string | null };

/** Cocokkan item pesanan lama dengan menu saat ini (harga & stok terbaru) */
function buildReorderLines(items: ReorderItem[], categories: MenuCategory[]) {
  const products = new Map(categories.flatMap((c) => c.products.map((p) => [p.id, p] as const)));
  const lines = [];
  let skipped = 0;
  for (const it of items) {
    const p = products.get(it.productId);
    if (!p || p.soldOut) {
      skipped++;
      continue;
    }
    const optionIds: string[] = [];
    const modifiers: { group: string; option: string; priceDelta: number }[] = [];
    let ok = true;
    for (const g of p.groups) {
      const picked = it.modifiers
        .filter((m) => m.group === g.name)
        .map((m) => g.options.find((o) => o.name === m.option && o.isAvailable))
        .filter((o): o is NonNullable<typeof o> => Boolean(o));
      if (picked.length < g.minSelect || picked.length > g.maxSelect) ok = false;
      picked.forEach((o) => {
        optionIds.push(o.id);
        modifiers.push({ group: g.name, option: o.name, priceDelta: o.priceDelta });
      });
    }
    if (!ok) {
      skipped++;
      continue;
    }
    lines.push({
      key: lineKey(p.id, optionIds, it.note),
      productId: p.id,
      name: p.name,
      unitPrice: p.price + modifiers.reduce((s, m) => s + m.priceDelta, 0),
      quantity: Math.min(99, it.quantity),
      optionIds,
      modifiers,
      note: it.note,
      imageUrl: p.imageUrl,
      emoji: p.emoji,
    });
  }
  return { lines, skipped };
}

export function MenuApp({
  outlet,
  table,
  categories,
  customer = null,
  googleEnabled = false,
  reorder = null,
  pickup = null,
}: {
  outlet: MenuOutlet;
  table: { name: string; area: string | null; token: string } | null;
  categories: MenuCategory[];
  customer?: MenuCustomer | null;
  googleEnabled?: boolean;
  reorder?: ReorderItem[] | null;
  pickup?: PickupConfig | null;
}) {
  const cart = useCart(`cart:${outlet.id}:${table?.token ?? "takeaway"}`);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState(categories[0]?.id);
  const [selected, setSelected] = useState<{ product: MenuProduct; emoji: string | null } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orders, setOrders] = useState<RememberedOrder[]>([]);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const isOpen = useOpenStatus(outlet);
  const router = useRouter();
  const pathname = usePathname();
  const [bump, setBump] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);
  const reorderDone = useRef(false);

  useEffect(() => setOrders(recentOrders(outlet.id)), [outlet.id]);

  // Ringkasan pesanan (status, item, total, bayar) + pembaruan realtime
  const [summaries, setSummaries] = useState<OrderSummary[] | null>(null);
  const orderIds = orders.map((o) => o.id).join(",");
  const loadSummaries = useCallback(() => {
    if (!orderIds) return;
    getDeviceOrders(orderIds.split(",")).then((r) => r.ok && setSummaries(r.data));
  }, [orderIds]);
  useEffect(loadSummaries, [loadSummaries]);
  useEffect(() => {
    if (ordersOpen) loadSummaries();
  }, [ordersOpen, loadSummaries]);
  const activeIds = (summaries ?? []).filter((o) => isActiveOrder(o.status)).map((o) => o.id).join(",");
  useRealtime(
    activeIds ? `/api/stream/orders?ids=${activeIds}` : null,
    (msg) => {
      if (msg.type === "items.ready" && msg.items?.length) {
        toast.success(msg.allReady ? `Pesanan #${msg.queueNumber} sudah siap! 🎉` : `${msg.items.join(", ")} sudah siap 🎉`);
      }
      loadSummaries();
    },
    { refresh: false }
  );
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && loadSummaries();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadSummaries]);
  const activeCount = summaries?.filter((o) => isActiveOrder(o.status)).length ?? 0;
  const anyReady = summaries?.some((o) => o.status === "READY") ?? false;

  // "Pesan lagi" dari riwayat akun: isi keranjang lalu buka
  useEffect(() => {
    if (!reorder || !cart.hydrated || reorderDone.current) return;
    reorderDone.current = true;
    const { lines, skipped } = buildReorderLines(reorder, categories);
    lines.forEach((l) => cart.add(l));
    if (lines.length) {
      toast.success(`${lines.length} menu dari pesanan sebelumnya masuk keranjang`);
      setCartOpen(true);
    }
    if (skipped) toast.warning(`${skipped} menu sudah tidak tersedia atau berubah pilihannya`);
    router.replace(pathname, { scroll: false });
  }, [reorder, cart, categories, router, pathname]);

  const featured = useMemo(
    () =>
      categories
        .flatMap((c) => c.products.filter((p) => p.isFeatured && !p.soldOut).map((p) => ({ p, emoji: p.emoji })))
        .sort((a, b) => Number(!!b.p.imageUrl) - Number(!!a.p.imageUrl)),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((c) => ({
        ...c,
        products: c.products.filter(
          (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
        ),
      }))
      .filter((c) => c.products.length);
  }, [categories, query]);

  // Scrollspy kategori
  useEffect(() => {
    const sections = filtered.map((c) => document.getElementById(`cat-${c.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveCat(visible[0].target.id.replace("cat-", ""));
      },
      { rootMargin: "-120px 0px -60% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [filtered]);

  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>(`[data-cat="${activeCat}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCat]);

  const qtyInCart = (productId: string) =>
    cart.lines.filter((l) => l.productId === productId).reduce((s, l) => s + l.quantity, 0);

  const openProduct = (product: MenuProduct, emoji: string | null) => {
    if (product.soldOut) return;
    if (product.groups.length === 0) {
      cart.add({
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
      });
      setBump((b) => b + 1);
      toast.success(`${product.name} ditambahkan`, { duration: 1200 });
      return;
    }
    setSelected({ product, emoji });
  };

  /** Tutup lembar akun dulu, lalu buka lembar lain agar animasinya tidak bertumpuk */
  const switchSheet = (open: () => void) => {
    setAccountOpen(false);
    setTimeout(open, 280);
  };

  const handleCall = async (type: "CALL_WAITER" | "REQUEST_BILL") => {
    if (!table) return;
    const res = await callStaff(table.token, type);
    if (res.ok) toast.success(type === "CALL_WAITER" ? "Pelayan segera datang 🙌" : "Permintaan bill dikirim ke kasir");
    else toast.error(res.error);
  };

  return (
    <div className="mx-auto min-h-dvh max-w-xl bg-background pb-32">
      {/* Kepala halaman */}
      <header className="bg-olive px-5 pb-14 pt-5 text-cream">
        <div className="flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            aria-label="Info kafe: jam buka, lokasi, Instagram"
            className="flex min-w-0 items-center gap-3 rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-cream/60"
          >
            <BrandMark className="size-9 shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-[1.75rem] leading-none tracking-wide">{outlet.name}</h1>
              <p className="mt-1.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-cream/75">
                {isOpen !== null && <span className={cn("size-1.5 shrink-0 rounded-full", isOpen ? "bg-[oklch(0.82_0.13_150)]" : "bg-cream/50")} />}
                <span className="truncate">
                  {isOpen === false ? `Tutup · buka ${clock(outlet.openTime)}` : `Buka s.d. ${clock(outlet.closeTime)}`} ·{" "}
                  <span className="border-b border-cream/45">Info kafe</span>
                </span>
              </p>
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {orders.length > 0 && (
              <button
                onClick={() => (orders.length === 1 ? router.push(`/order/${orders[0].id}`) : setOrdersOpen(true))}
                className="relative flex h-10 shrink-0 items-center rounded-full bg-cream/15 px-3.5 text-xs font-semibold transition hover:bg-cream/25 active:bg-cream/25"
                aria-label={`Pesanan saya${activeCount ? `, ${activeCount} sedang berjalan` : ""}`}
              >
                Pesanan
                {activeCount > 0 ? (
                  <span
                    className={cn(
                      "absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10.5px] font-bold ring-2 ring-olive",
                      anyReady ? "animate-pulse bg-[oklch(0.8_0.14_150)] text-[oklch(0.3_0.07_150)]" : "bg-honey text-white"
                    )}
                  >
                    {activeCount}
                  </span>
                ) : (
                  orders.length > 1 && <span className="ml-1 text-cream/70">({orders.length})</span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              aria-label={customer ? "Akun saya" : "Akun dan info"}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-cream/15 transition hover:bg-cream/25 active:bg-cream/25"
            >
              {customer ? <CustomerAvatar customer={customer} /> : <UserRound className="size-[18px]" />}
            </button>
          </div>
        </div>
      </header>

      {/* Info meja */}
      <div className="relative z-10 -mt-9 px-4">
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-lg shadow-olive-deep/10">
          <div className="grid h-12 min-w-12 shrink-0 place-items-center rounded-xl bg-cream px-2 text-olive-deep">
            {table ? (
              <span className="font-display text-2xl leading-none">{table.name.replace(/^\D+/, "") || table.name.slice(0, 2)}</span>
            ) : (
              <ShoppingBag className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{table ? "Pesananmu diantar ke" : "Pesanan"}</p>
            <p className="truncate font-bold">
              {table ? `${table.name}${table.area ? ` · ${table.area}` : ""}` : "Bawa pulang (takeaway)"}
            </p>
          </div>
          {table && (
            <Button variant="secondary" size="sm" className="h-10 rounded-full px-4" onClick={() => handleCall("CALL_WAITER")}>
              <Bell /> Panggil
            </Button>
          )}
        </div>
      </div>

      {/* Pencarian + kategori (menempel di atas) */}
      <div className="sticky top-0 z-20 mt-3 space-y-2.5 border-b border-transparent bg-background/95 px-4 pb-2.5 pt-3 backdrop-blur-lg">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kopi, pasta, nasi goreng…"
            aria-label="Cari menu"
            className="h-12 w-full rounded-full border bg-card pl-11 pr-11 text-[15px] outline-none transition placeholder:text-muted-foreground/80 focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Hapus pencarian"
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div ref={navRef} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {filtered.map((c) => (
            <button
              key={c.id}
              data-cat={c.id}
              onClick={() => {
                document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiveCat(c.id);
              }}
              className={cn(
                "h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition",
                activeCat === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/75 hover:bg-muted"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Favorit */}
      {!query && featured.length > 0 && (
        <section className="mt-4 space-y-3">
          <div className="flex items-baseline justify-between px-4">
            <h2 className="font-display text-[1.7rem] leading-none text-olive-deep">House favourites</h2>
            <span className="text-xs text-muted-foreground">geser →</span>
          </div>
          <div className="no-scrollbar flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
            {featured.map(({ p, emoji }) => (
              <button
                key={p.id}
                onClick={() => openProduct(p, emoji)}
                className="group w-44 shrink-0 snap-start text-left"
              >
                <div className="relative">
                  <ProductImage src={p.imageUrl} name={p.name} emoji={emoji} className="aspect-[4/3] rounded-2xl" emojiClassName="text-5xl" />
                  <span className="absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-card text-olive-deep shadow-md transition group-active:scale-90">
                    <Plus className="size-5" />
                  </span>
                </div>
                <p className="mt-2 line-clamp-1 font-semibold leading-snug">{p.name}</p>
                <p className="text-sm tabular text-muted-foreground">{formatRupiah(p.price)}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Daftar menu */}
      <main className="mt-6 space-y-8 px-4">
        {filtered.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <Search className="mx-auto size-8 opacity-50" />
            <p className="mt-3 font-medium">Menu “{query}” tidak ditemukan</p>
            <button onClick={() => setQuery("")} className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Lihat semua menu
            </button>
          </div>
        )}
        {filtered.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-36">
            <h2 className="flex items-baseline gap-2.5 border-b border-olive/25 pb-2">
              <span className="font-display text-[1.7rem] leading-none text-olive-deep">{c.name}</span>
              <span className="text-xs font-medium text-muted-foreground">{c.products.length} menu</span>
            </h2>
            <div className="divide-y divide-border/70">
              {c.products.map((p) => {
                const inCart = qtyInCart(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => openProduct(p, p.emoji)}
                    disabled={p.soldOut}
                    className="group flex w-full items-center gap-3.5 py-3.5 text-left disabled:cursor-not-allowed"
                  >
                    <div className={cn("min-w-0 flex-1", p.soldOut && "opacity-50")}>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold leading-snug">
                        {p.name}
                        {p.isFeatured && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-honey/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[oklch(0.47_0.1_70)]">
                            <Star className="size-2.5 fill-current" /> Favorit
                          </span>
                        )}
                      </p>
                      {p.description && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{p.description}</p>}
                      <p className="mt-1.5 font-semibold tabular">
                        {p.groups.some((g) => g.options.some((o) => o.priceDelta > 0) && g.minSelect > 0) && (
                          <span className="font-normal text-muted-foreground">mulai </span>
                        )}
                        {formatRupiah(p.price)}
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <ProductImage
                        src={p.imageUrl}
                        name={p.name}
                        emoji={p.emoji}
                        className={cn("size-[5.5rem] rounded-2xl", p.soldOut && "grayscale")}
                      />
                      {p.soldOut ? (
                        <span className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-black/60 py-1 text-center text-[11px] font-bold uppercase tracking-wide text-white">
                          Habis
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "absolute -bottom-1.5 -right-1.5 grid h-9 min-w-9 place-items-center rounded-full border-2 border-background px-2 text-sm font-bold shadow-sm transition group-active:scale-90",
                            inCart ? "bg-honey text-white" : "bg-primary text-primary-foreground"
                          )}
                        >
                          {inCart ? `${inCart}×` : <Plus className="size-4" strokeWidth={2.5} />}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {table && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="outline" className="h-12 rounded-full" onClick={() => handleCall("CALL_WAITER")}>
              <Bell /> Panggil pelayan
            </Button>
            <Button variant="outline" className="h-12 rounded-full" onClick={() => handleCall("REQUEST_BILL")}>
              <Receipt /> Minta bill
            </Button>
          </div>
        )}
        <p className="pb-4 pt-1 text-center text-xs text-muted-foreground">
          Harga belum termasuk pajak {outlet.taxRate}%{outlet.serviceRate ? ` & service ${outlet.serviceRate}%` : ""}
        </p>
      </main>

      {/* Keranjang mengambang */}
      {cart.hydrated && cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl px-4 pb-safe">
          <button
            key={bump}
            onClick={() => setCartOpen(true)}
            className="flex w-full animate-pop items-center gap-3 rounded-2xl bg-olive-deep p-2.5 pl-3 text-cream shadow-2xl shadow-olive-deep/40"
          >
            <span className="relative grid size-11 place-items-center rounded-xl bg-cream text-olive-deep">
              <ShoppingBag className="size-5" />
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-honey px-1 text-[11px] font-bold text-white">
                {cart.count}
              </span>
            </span>
            <span className="flex-1 text-left">
              <span className="block text-xs text-cream/65">{cart.count} item{table ? ` · ${table.name}` : ""}</span>
              <span className="block text-[17px] font-bold tabular">{formatRupiah(cart.subtotal)}</span>
            </span>
            <span className="flex items-center gap-1 rounded-xl bg-cream/10 px-4 py-3 text-sm font-semibold">
              Lihat pesanan <ChevronRight className="size-4" />
            </span>
          </button>
        </div>
      )}

      {/* Detail produk */}
      <Drawer open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DrawerContent>
          {selected && (
            <>
              <ProductOptions
                key={selected.product.id}
                product={selected.product}
                emoji={selected.emoji}
                header={<div className="-mb-2 pt-3">
                <ProductImage
                  src={selected.product.imageUrl}
                  name={selected.product.name}
                  emoji={selected.emoji}
                  className={selected.product.imageUrl ? "aspect-[16/10] rounded-2xl" : "aspect-[16/7] rounded-2xl"}
                  emojiClassName="text-7xl"
                />
                <div className="space-y-1 py-4">
                  <DrawerTitle className="font-serif text-[1.7rem] font-semibold leading-tight">{selected.product.name}</DrawerTitle>
                  <DrawerDescription className="text-sm text-muted-foreground">
                    {selected.product.description}
                  </DrawerDescription>
                  <p className="pt-1 text-lg font-bold text-primary tabular">{formatRupiah(selected.product.price)}</p>
                </div>
              </div>}
                onAdd={(line) => {
                  cart.add(line);
                  setSelected(null);
                  setBump((b) => b + 1);
                  toast.success(`${line.name} ditambahkan`, { duration: 1200 });
                }}
              />
            </>
          )}
        </DrawerContent>
      </Drawer>

      <Drawer open={ordersOpen} onOpenChange={setOrdersOpen}>
        <DrawerContent>
          <div className="space-y-3 px-5 pb-safe pt-3">
            <div>
              <DrawerTitle className="text-xl font-bold">Pesanan saya</DrawerTitle>
              <DrawerDescription className="text-sm text-muted-foreground">
                {activeCount ? `${activeCount} sedang berjalan · status diperbarui otomatis` : "Pesanan dari perangkat ini hari ini"}
              </DrawerDescription>
            </div>
            <div className="-mx-5 max-h-[70dvh] space-y-2.5 overflow-y-auto px-5 pb-4">
              {summaries === null
                ? orders.map((o) => <div key={o.id} className="h-36 animate-pulse rounded-2xl bg-muted" />)
                : summaries.map((o) => <OrderSummaryCard key={o.id} order={o} onNavigate={() => setOrdersOpen(false)} />)}
              {summaries?.length === 0 && (
                <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada pesanan hari ini.</p>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <AccountSheet
        open={accountOpen}
        onOpenChange={setAccountOpen}
        outlet={outlet}
        customer={customer}
        googleEnabled={googleEnabled}
        isTable={!!table}
        pathname={pathname}
        ordersCount={orders.length}
        activeCount={activeCount}
        onOpenOrders={() => switchSheet(() => setOrdersOpen(true))}
        onOpenInfo={() => switchSheet(() => setInfoOpen(true))}
      />
      <InfoSheet open={infoOpen} onOpenChange={setInfoOpen} outlet={outlet} />

      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        cart={cart}
        outlet={outlet}
        table={table}
        customer={customer}
        googleEnabled={googleEnabled}
        pickup={table ? null : pickup}
      />
    </div>
  );
}
