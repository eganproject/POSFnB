import "server-only";
import { z } from "zod";
import type { Outlet } from "@prisma/client";
import { db } from "@/lib/db";

export const cartLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  optionIds: z.array(z.string()).max(30).default([]),
  note: z.string().trim().max(200).optional().nullable(),
});
export type CartLineInput = z.infer<typeof cartLineSchema>;

export type ModifierSnapshot = { group: string; option: string; priceDelta: number };

export type PricedLine = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  modifiers: ModifierSnapshot[];
  note: string | null;
  lineTotal: number;
};

export class OrderError extends Error {}

/**
 * Hitung ulang harga di server dari data menu — harga dari client tidak pernah dipercaya.
 */
export async function priceLines(outletId: string, lines: CartLineInput[]): Promise<PricedLine[]> {
  if (lines.length === 0) throw new OrderError("Keranjang masih kosong.");
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const [products, unavailable] = await Promise.all([
    db.product.findMany({
      where: { id: { in: productIds } },
      include: { modifierGroups: { include: { options: true } }, category: true },
    }),
    db.productUnavailable.findMany({ where: { outletId, productId: { in: productIds } } }),
  ]);
  const soldOut = new Set(unavailable.map((u) => u.productId));
  const byId = new Map(products.map((p) => [p.id, p]));

  return lines.map((line) => {
    const product = byId.get(line.productId);
    if (!product || !product.isActive || !product.category.isActive) {
      throw new OrderError("Ada menu yang sudah tidak tersedia. Silakan perbarui keranjang.");
    }
    if (soldOut.has(product.id)) throw new OrderError(`${product.name} sedang habis.`);

    const chosen = new Set(line.optionIds);
    const modifiers: ModifierSnapshot[] = [];
    let unitPrice = product.price;
    const knownOptionIds = new Set<string>();

    for (const group of [...product.modifierGroups].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const picked = group.options.filter((o) => chosen.has(o.id));
      group.options.forEach((o) => knownOptionIds.add(o.id));
      if (picked.length < group.minSelect) {
        throw new OrderError(`Pilih ${group.name} untuk ${product.name}.`);
      }
      if (picked.length > group.maxSelect) {
        throw new OrderError(`Maksimal ${group.maxSelect} pilihan ${group.name} untuk ${product.name}.`);
      }
      for (const opt of picked.sort((a, b) => a.sortOrder - b.sortOrder)) {
        if (!opt.isAvailable) throw new OrderError(`${opt.name} sedang habis.`);
        unitPrice += opt.priceDelta;
        modifiers.push({ group: group.name, option: opt.name, priceDelta: opt.priceDelta });
      }
    }
    for (const id of chosen) {
      if (!knownOptionIds.has(id)) throw new OrderError("Pilihan menu tidak valid. Silakan ulangi.");
    }

    return {
      productId: product.id,
      name: product.name,
      unitPrice,
      quantity: line.quantity,
      modifiers,
      note: line.note?.trim() || null,
      lineTotal: unitPrice * line.quantity,
    };
  });
}

export function computeTotals(
  subtotal: number,
  outlet: Pick<Outlet, "taxRate" | "serviceRate">,
  discount = 0
) {
  const safeDiscount = Math.min(Math.max(0, Math.round(discount)), subtotal);
  const base = subtotal - safeDiscount;
  const serviceCharge = Math.round((base * outlet.serviceRate) / 100);
  const tax = Math.round(((base + serviceCharge) * outlet.taxRate) / 100);
  return { subtotal, discount: safeDiscount, serviceCharge, tax, total: base + serviceCharge + tax };
}
