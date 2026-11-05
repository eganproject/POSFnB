"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, MapPin, Plus, Receipt, Search, ShoppingBag, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import type { MenuCategory, MenuProduct } from "@/server/menu";
import { cn, formatRupiah } from "@/lib/utils";
import { lineKey } from "@/lib/cart";
import { recentOrders, useCart } from "@/hooks/use-cart";
import { ProductImage } from "@/components/shared/product-image";
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
  const [orders, setOrders] = useState<{ id: string }[]>([]);
  const [bump, setBump] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOrders(recentOrders(outlet.id)), [outlet.id]);

  const featured = useMemo(
    () => categories.flatMap((c) => c.products.filter((p) => p.isFeatured && !p.soldOut).map((p) => ({ p, emoji: c.icon }))),
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
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[oklch(0.6_0.19_38)] via-primary to-[oklch(0.75_0.16_65)] px-5 pb-16 pt-6 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 size-40 rounded-full bg-black/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">Selamat datang di</p>
            <h1 className="text-2xl font-extrabold tracking-tight">{outlet.name}</h1>
            {outlet.address && (
              <p className="flex items-center gap-1 text-xs text-white/80">
                <MapPin className="size-3.5" /> {outlet.address}
              </p>
            )}
          </div>
          {orders.length > 0 && (
            <Link
              href={`/order/${orders[0].id}`}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold backdrop-blur transition hover:bg-white/25"
            >
              <Receipt className="size-4" /> Pesanan saya
            </Link>
          )}
        </div>
      </header>

      {/* Info meja */}
      <div className="relative z-10 -mt-10 px-4">
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-lg shadow-black/5">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-xl">
            {table ? "🪑" : "🛍️"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{table ? "Kamu memesan untuk" : "Pesanan"}</p>
            <p className="truncate font-bold">
              {table ? `${table.name}${table.area ? ` · ${table.area}` : ""}` : "Bawa pulang (Takeaway)"}
            </p>
          </div>
          {table && (
            <Button variant="secondary" size="sm" className="h-9 rounded-full" onClick={() => handleCall("CALL_WAITER")}>
              <Bell /> Panggil
            </Button>
          )}
        </div>
      </div>

      {/* Search + kategori sticky */}
      <div className="sticky top-0 z-20 mt-4 space-y-3 bg-background/90 px-4 pb-2 pt-3 backdrop-blur-lg">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari menu favoritmu…"
            className="h-11 w-full rounded-full border bg-card pl-10 pr-10 text-sm shadow-xs outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted">
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
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition",
                activeCat === c.id ? "border-foreground bg-foreground text-background" : "bg-card text-foreground/80 hover:bg-muted"
              )}
            >
              <span>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Favorit */}
      {!query && featured.length > 0 && (
        <section className="mt-3 space-y-3">
          <h2 className="flex items-center gap-2 px-4 text-lg font-bold">
            <Sparkles className="size-5 text-primary" /> Paling favorit
          </h2>
          <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {featured.map(({ p, emoji }) => (
              <button
                key={p.id}
                onClick={() => openProduct(p, emoji)}
                className="group w-40 shrink-0 snap-start overflow-hidden rounded-2xl border bg-card text-left shadow-xs transition hover:shadow-md"
              >
                <ProductImage src={p.imageUrl} name={p.name} emoji={emoji} className="aspect-[4/3]" emojiClassName="text-5xl transition group-hover:scale-110" />
                <div className="space-y-1 p-3">
                  <p className="line-clamp-1 text-sm font-semibold">{p.name}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-primary tabular">{formatRupiah(p.price)}</p>
                    <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Plus className="size-4" />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Daftar menu */}
      <main className="mt-4 space-y-7 px-4">
        {filtered.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-4xl">🔍</p>
            <p className="mt-2 font-medium">Menu “{query}” tidak ditemukan</p>
          </div>
        )}
        {filtered.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-32 space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span>{c.icon}</span> {c.name}
              <span className="text-sm font-medium text-muted-foreground">({c.products.length})</span>
            </h2>
            <div className="divide-y rounded-2xl border bg-card">
              {c.products.map((p) => {
                const inCart = qtyInCart(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => openProduct(p, c.icon)}
                    disabled={p.soldOut}
                    className="flex w-full gap-3.5 p-3.5 text-left transition first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/40 disabled:cursor-not-allowed"
                  >
                    <div className={cn("min-w-0 flex-1 space-y-1", p.soldOut && "opacity-50")}>
                      <p className="font-semibold leading-snug">{p.name}</p>
                      {p.description && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{p.description}</p>}
                      <p className="pt-1 font-bold tabular">{formatRupiah(p.price)}</p>
                    </div>
                    <div className="relative shrink-0">
                      <ProductImage
                        src={p.imageUrl}
                        name={p.name}
                        emoji={c.icon}
                        className={cn("size-24 rounded-xl", p.soldOut && "grayscale")}
                      />
                      {p.soldOut ? (
                        <span className="absolute inset-x-0 bottom-0 rounded-b-xl bg-black/60 py-1 text-center text-[11px] font-bold uppercase tracking-wide text-white">
                          Habis
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "absolute -bottom-2 left-1/2 flex h-8 -translate-x-1/2 items-center gap-1 rounded-full border-2 border-card px-3 text-xs font-bold shadow-md",
                            inCart ? "bg-foreground text-background" : "bg-primary text-primary-foreground"
                          )}
                        >
                          {inCart ? `${inCart}×` : <><Plus className="size-3.5" strokeWidth={3} /> Tambah</>}
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
            <Button variant="outline" className="h-12" onClick={() => handleCall("CALL_WAITER")}>
              <Bell /> Panggil pelayan
            </Button>
            <Button variant="outline" className="h-12" onClick={() => handleCall("REQUEST_BILL")}>
              <Receipt /> Minta bill
            </Button>
          </div>
        )}
        <p className="pb-4 pt-2 text-center text-xs text-muted-foreground">
          Harga belum termasuk pajak {outlet.taxRate}%{outlet.serviceRate ? ` & service ${outlet.serviceRate}%` : ""}
        </p>
      </main>

      {/* Floating cart */}
      {cart.hydrated && cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl px-4 pb-safe">
          <button
            key={bump}
            onClick={() => setCartOpen(true)}
            className="flex w-full animate-pop items-center gap-3 rounded-2xl bg-foreground p-2 pl-3 text-background shadow-2xl shadow-black/25"
          >
            <span className="relative grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShoppingBag className="size-5" />
              <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-foreground">
                {cart.count}
              </span>
            </span>
            <span className="flex-1 text-left">
              <span className="block text-xs text-background/60">{cart.count} item</span>
              <span className="block font-bold tabular">{formatRupiah(cart.subtotal)}</span>
            </span>
            <span className="flex items-center gap-1 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold">
              Keranjang <ChevronRight className="size-4" />
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
                  className="aspect-[16/9] rounded-2xl"
                  emojiClassName="text-7xl"
                />
                <div className="space-y-1 py-4">
                  <DrawerTitle className="text-xl font-bold">{selected.product.name}</DrawerTitle>
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
