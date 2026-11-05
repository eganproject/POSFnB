"use client";
import { useOptimistic, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import type { MenuCategory } from "@/server/menu";
import { cn, formatRupiah } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { ProductImage } from "@/components/shared/product-image";
import { toggleSoldOut } from "@/server/actions/staff";

export function StockList({ categories }: { categories: MenuCategory[] }) {
  const [q, setQ] = useState("");
  const [, start] = useTransition();
  const initial = Object.fromEntries(categories.flatMap((c) => c.products.map((p) => [p.id, p.soldOut])));
  const [state, setOptimistic] = useOptimistic(initial, (s: Record<string, boolean>, u: { id: string; v: boolean }) => ({ ...s, [u.id]: u.v }));
  const soldCount = Object.values(state).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari menu" className="pl-9" />
        </div>
        <span className="rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">{soldCount} menu habis</span>
      </div>
      {categories.map((c) => {
        const products = c.products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
        if (!products.length) return null;
        return (
          <section key={c.id} className="space-y-2">
            <h2 className="font-semibold">
              {c.icon} {c.name}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => {
                const sold = state[p.id];
                return (
                  <label key={p.id} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border bg-card p-3 transition", sold && "border-destructive/40 bg-destructive/5")}>
                    <ProductImage src={p.imageUrl} name={p.name} emoji={p.emoji} className={cn("size-12 shrink-0 rounded-xl", sold && "grayscale")} emojiClassName="text-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className={cn("text-xs", sold ? "font-semibold text-destructive" : "text-muted-foreground")}>{sold ? "Habis" : formatRupiah(p.price)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{sold ? "Habis" : "Tersedia"}</span>
                    <Switch
                      checked={!sold}
                      onCheckedChange={(available) =>
                        start(async () => {
                          setOptimistic({ id: p.id, v: !available });
                          const r = await toggleSoldOut(p.id, !available);
                          if (!r.ok) toast.error(r.error);
                          else toast.success(`${p.name} ${available ? "tersedia lagi" : "ditandai habis"}`);
                        })
                      }
                    />
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
