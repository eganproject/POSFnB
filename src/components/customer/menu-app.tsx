"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Plus, Receipt, Search, ShoppingBag, Star, X } from "lucide-react";
import { toast } from "sonner";
import type { MenuCategory, MenuProduct } from "@/server/menu";
import { cn, formatRupiah } from "@/lib/utils";
import { lineKey } from "@/lib/cart";
import { recentOrders, useCart, type RememberedOrder } from "@/hooks/use-cart";
import { useRouter } from "next/navigation";
import { ProductImage } from "@/components/shared/product-image";
import { BrandMark } from "@/components/shared/brand-mark";
import { BRAND } from "@/lib/brand";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { ProductOptions } from "@/components/menu/product-options";
import { Button } from "@/components/ui/button";
import { CartSheet } from "./cart-sheet";
import { callStaff } from "@/server/actions/customer";

export type MenuOutlet = {
  id: string;
  name: string;
  address: string | null;
  taxRate: number;
  serviceRate: number;
};

export function MenuApp({
  outlet,
  table,
  categories,
}: {
  outlet: MenuOutlet;
  table: { name: string; area: string | null; token: string } | null;
  categories: MenuCategory[];
}) {
  const cart = useCart(`cart:${outlet.id}:${table?.token ?? "takeaway"}`);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState(categories[0]?.id);
  const [selected, setSelected] = useState<{ product: MenuProduct; emoji: string | null } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orders, setOrders] = useState<RememberedOrder[]>([]);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const router = useRouter();
  const [bump, setBump] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOrders(recentOrders(outlet.id)), [outlet.id]);

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
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="size-9 shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-[1.75rem] leading-none tracking-wide">{outlet.name}</h1>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-cream/65">{BRAND.tagline}</p>
            </div>
          </div>
          {orders.length > 0 && (
            <button
              onClick={() => (orders.length === 1 ? router.push(`/order/${orders[0].id}`) : setOrdersOpen(true))}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-cream/15 px-3.5 text-xs font-semibold transition hover:bg-cream/25"
            >
              <Receipt className="size-4" /> Pesanan{orders.length > 1 ? ` (${orders.length})` : ""}
            </button>
          )}
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
            placeholder="Cari kopi, matcha, roti…"
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
            <DrawerTitle className="text-xl font-bold">Pesanan saya</DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground">Pesanan dari perangkat ini hari ini</DrawerDescription>
            <ul className="space-y-2 pb-4">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/order/${o.id}`} className="flex items-center gap-3 rounded-2xl border p-3 transition hover:border-primary hover:bg-primary/5">
                    <span className="grid size-11 place-items-center rounded-xl bg-primary/10 font-bold text-primary tabular">
                      {o.no ? `#${String(o.no).padStart(3, "0")}` : <Receipt className="size-5" />}
                    </span>
                    <span className="flex-1 text-sm">
                      <span className="block font-semibold">Pesanan {o.no ? `#${String(o.no).padStart(3, "0")}` : ""}</span>
                      <span className="text-xs text-muted-foreground">
                        Dibuat {new Date(o.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </DrawerContent>
      </Drawer>

      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        cart={cart}
        outlet={outlet}
        table={table}
      />
    </div>
  );
}
