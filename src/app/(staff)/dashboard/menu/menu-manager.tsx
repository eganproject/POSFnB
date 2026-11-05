"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Layers, MoreVertical, Pencil, Plus, Search, Star, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { cn, formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, Switch } from "@/components/ui/misc";
import { ProductImage } from "@/components/shared/product-image";
import { deleteCategory, deleteProduct, moveCategory, saveCategory, toggleProductActive } from "@/server/actions/admin";

type Cat = {
  id: string;
  name: string;
  icon: string | null;
  isActive: boolean;
  products: { id: string; name: string; price: number; imageUrl: string | null; emoji: string | null; isActive: boolean; isFeatured: boolean; groups: number; description: string | null }[];
};

const EMOJIS = ["🍛", "🍜", "🍝", "🍟", "🍗", "🥗", "🍲", "🍔", "🍕", "🍣", "☕", "🧋", "🍹", "🥤", "🍨", "🍰", "🍩", "🥐", "🍤", "🌶️"];

export function MenuManager({ categories, selected }: { categories: Cat[]; selected: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [editCat, setEditCat] = useState<Partial<Cat> | null>(null);
  const [icon, setIcon] = useState("🍛");
  const [pending, start] = useTransition();

  const current = categories.find((c) => c.id === selected);
  const products = (current ? [current] : categories)
    .flatMap((c) => c.products.map((p) => ({ ...p, cat: c })))
    .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  const total = categories.reduce((s, c) => s + c.products.length, 0);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else {
        if (msg) toast.success(msg);
        router.refresh();
      }
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-semibold text-muted-foreground">Kategori</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIcon("🍛");
              setEditCat({ isActive: true });
            }}
          >
            <Plus /> Baru
          </Button>
        </div>
        <nav className="space-y-1 rounded-2xl border bg-card p-2">
          <Link href="/dashboard/menu" className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition", selected === "all" ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
            <span>✨</span> <span className="flex-1">Semua menu</span>
            <span className="text-xs text-muted-foreground">{total}</span>
          </Link>
          {categories.map((c, i) => (
            <div key={c.id} className={cn("group flex items-center rounded-xl transition", selected === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              <Link href={`/dashboard/menu?category=${c.id}`} className={cn("flex flex-1 items-center gap-2.5 px-3 py-2 text-sm font-medium", !c.isActive && "opacity-50")}>
                <span>{c.icon}</span> <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.products.length}</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="mr-1 rounded-lg p-1 opacity-0 transition hover:bg-card group-hover:opacity-100 data-[state=open]:opacity-100">
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setIcon(c.icon ?? "🍛");
                      setEditCat(c);
                    }}
                  >
                    <Pencil /> Ubah
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={i === 0} onSelect={() => act(() => moveCategory(c.id, -1))}><ArrowUp /> Naikkan</DropdownMenuItem>
                  <DropdownMenuItem disabled={i === categories.length - 1} onSelect={() => act(() => moveCategory(c.id, 1))}><ArrowDown /> Turunkan</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onSelect={() => confirm(`Hapus kategori ${c.name}?`) && act(() => deleteCategory(c.id), "Kategori dihapus")}>
                    <Trash2 className="!text-destructive" /> Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </nav>
      </aside>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari menu" className="pl-9" />
          </div>
          <Button asChild disabled={!categories.length}>
            <Link href={`/dashboard/menu/new${current ? `?category=${current.id}` : ""}`}>
              <Plus /> Tambah menu
            </Link>
          </Button>
        </div>

        {categories.length === 0 ? (
          <EmptyState icon={<Layers />} title="Belum ada kategori" description="Buat kategori dulu, misalnya Makanan, Minuman, Dessert." className="bg-card" action={<Button onClick={() => setEditCat({ isActive: true })}><Plus /> Buat kategori</Button>} />
        ) : products.length === 0 ? (
          <EmptyState icon={<UtensilsCrossed />} title="Belum ada menu" className="bg-card" />
        ) : (
          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            {products.map((p) => (
              <div key={p.id} className={cn("flex items-center gap-4 p-3 pr-4 transition hover:bg-muted/30", !p.isActive && "opacity-60")}>
                <ProductImage src={p.imageUrl} name={p.name} emoji={p.emoji ?? p.cat.icon} className="size-16 shrink-0 rounded-xl" emojiClassName="text-2xl" />
                <Link href={`/dashboard/menu/${p.id}`} className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{p.name}</span>
                    {p.isFeatured && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{p.description || "—"}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {selected === "all" && <Badge variant="secondary">{p.cat.icon} {p.cat.name}</Badge>}
                    {p.groups > 0 && <Badge variant="info">{p.groups} grup pilihan</Badge>}
                  </div>
                </Link>
                <p className="hidden w-28 text-right font-semibold tabular sm:block">{formatRupiah(p.price)}</p>
                <Switch checked={p.isActive} onCheckedChange={(v) => act(() => toggleProductActive(p.id, v), v ? "Menu diaktifkan" : "Menu disembunyikan")} title="Tampilkan di menu" />
                <DropdownMenu>
                  <DropdownMenuTrigger className="rounded-lg p-1.5 hover:bg-muted">
                    <MoreVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => router.push(`/dashboard/menu/${p.id}`)}><Pencil /> Ubah</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onSelect={() => confirm(`Hapus ${p.name}? Riwayat penjualan tetap aman.`) && act(() => deleteProduct(p.id), "Menu dihapus")}>
                      <Trash2 className="!text-destructive" /> Hapus
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!editCat} onOpenChange={(o) => !o && setEditCat(null)}>
        <DialogContent className="max-w-md">
          {editCat && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                start(async () => {
                  const r = await saveCategory({ id: editCat.id, name: String(f.get("name")), icon, isActive: f.get("active") === "on" });
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Kategori disimpan");
                  setEditCat(null);
                  router.refresh();
                });
              }}
            >
              <DialogHeader>
                <DialogTitle>{editCat.id ? "Ubah kategori" : "Kategori baru"}</DialogTitle>
              </DialogHeader>
              <Field label="Nama">
                <Input name="name" defaultValue={editCat.name} required autoFocus placeholder="Mis. Minuman Dingin" />
              </Field>
              <Field label="Ikon">
                <div className="flex flex-wrap gap-1.5">
                  {EMOJIS.map((e) => (
                    <button type="button" key={e} onClick={() => setIcon(e)} className={cn("grid size-10 place-items-center rounded-xl border text-xl transition", icon === e ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted")}>
                      {e}
                    </button>
                  ))}
                </div>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={editCat.isActive ?? true} className="size-4 accent-[var(--primary)]" /> Tampilkan kategori
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditCat(null)}>Batal</Button>
                <Button type="submit" loading={pending}>Simpan</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
