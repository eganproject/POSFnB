"use client";
import { useMemo, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import type { MenuProduct } from "@/server/menu";
import { lineKey, type CartLine } from "@/lib/cart";
import { cn, formatRupiah } from "@/lib/utils";
import { Textarea } from "@/components/ui/input";
import { QtyStepper } from "@/components/ui/qty";
import { Button } from "@/components/ui/button";

function defaultSelection(product: MenuProduct) {
  const sel: Record<string, string[]> = {};
  for (const g of product.groups) {
    const defaults = g.options.filter((o) => o.isDefault && o.isAvailable).map((o) => o.id);
    if (defaults.length) sel[g.id] = defaults.slice(0, g.maxSelect);
    else if (g.minSelect > 0) {
      const first = g.options.find((o) => o.isAvailable);
      sel[g.id] = first ? [first.id] : [];
    } else sel[g.id] = [];
  }
  return sel;
}

/** Pilihan varian/add-on + catatan + qty. Dipakai di menu customer & POS. */
export function ProductOptions({
  product,
  emoji,
  onAdd,
  compact,
  header,
}: {
  header?: ReactNode;
  product: MenuProduct;
  emoji?: string | null;
  onAdd: (line: CartLine) => void;
  compact?: boolean;
}) {
  const [selection, setSelection] = useState<Record<string, string[]>>(() => defaultSelection(product));
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);

  const toggle = (groupId: string, optionId: string, max: number) => {
    setSelection((prev) => {
      const current = prev[groupId] ?? [];
      if (max === 1) return { ...prev, [groupId]: [optionId] };
      if (current.includes(optionId)) return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      if (current.length >= max) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const { unitPrice, modifiers, optionIds, missing } = useMemo(() => {
    let price = product.price;
    const mods: CartLine["modifiers"] = [];
    const ids: string[] = [];
    const miss: string[] = [];
    for (const g of product.groups) {
      const picked = g.options.filter((o) => selection[g.id]?.includes(o.id));
      if (picked.length < g.minSelect) miss.push(g.name);
      for (const o of picked) {
        price += o.priceDelta;
        mods.push({ group: g.name, option: o.name, priceDelta: o.priceDelta });
        ids.push(o.id);
      }
    }
    return { unitPrice: price, modifiers: mods, optionIds: ids, missing: miss };
  }, [product, selection]);

  const submit = () => {
    if (missing.length) return;
    onAdd({
      key: lineKey(product.id, optionIds, note),
      productId: product.id,
      name: product.name,
      unitPrice,
      quantity: qty,
      optionIds,
      modifiers,
      note: note.trim(),
      imageUrl: product.imageUrl,
      emoji,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("flex-1 space-y-6 overflow-y-auto", compact ? "px-1" : "px-5")}>
        {header}
        {product.groups.map((g) => {
          const required = g.minSelect > 0;
          const picked = selection[g.id] ?? [];
          return (
            <section key={g.id} className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <h4 className="font-semibold">{g.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {g.maxSelect === 1 ? "Pilih 1" : `Pilih hingga ${g.maxSelect}`}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    required
                      ? missing.includes(g.name)
                        ? "bg-destructive/10 text-destructive"
                        : "bg-success/12 text-success"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {required ? (missing.includes(g.name) ? "Wajib" : "✓ Terpilih") : "Opsional"}
                </span>
              </div>
              <div className="grid gap-2">
                {g.options.map((o) => {
                  const active = picked.includes(o.id);
                  const disabled = !o.isAvailable || (!active && g.maxSelect > 1 && picked.length >= g.maxSelect);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(g.id, o.id, g.maxSelect)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition",
                        active ? "border-primary bg-primary/6 ring-1 ring-primary" : "hover:bg-muted/60",
                        disabled && "opacity-45"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center border-2 transition",
                          g.maxSelect === 1 ? "rounded-full" : "rounded-md",
                          active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                        )}
                      >
                        {active && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className="flex-1 font-medium">
                        {o.name}
                        {!o.isAvailable && <span className="ml-1 text-xs text-muted-foreground">(habis)</span>}
                      </span>
                      {o.priceDelta !== 0 && (
                        <span className="text-muted-foreground tabular">+{formatRupiah(o.priceDelta)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        <section className="space-y-2 pb-2">
          <h4 className="font-semibold">
            Catatan <span className="text-xs font-normal text-muted-foreground">(opsional)</span>
          </h4>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            placeholder="Contoh: tanpa bawang, saus dipisah"
            rows={2}
          />
        </section>
      </div>
      <div className={cn("flex items-center gap-3 border-t pt-4", compact ? "px-1" : "px-5 pb-safe")}>
        <QtyStepper value={qty} onChange={setQty} min={1} size="lg" />
        <Button size="xl" className="flex-1" disabled={missing.length > 0} onClick={submit}>
          {missing.length ? `Pilih ${missing[0]}` : <>Tambah · {formatRupiah(unitPrice * qty)}</>}
        </Button>
      </div>
    </div>
  );
}
