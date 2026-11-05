import "server-only";
import { db } from "@/lib/db";

/** Data menu untuk tampilan customer / POS */
export async function getMenuForOutlet(outletId: string) {
  const [categories, unavailable] = await Promise.all([
    db.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        products: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            modifierGroups: {
              orderBy: { sortOrder: "asc" },
              include: { options: { orderBy: { sortOrder: "asc" } } },
            },
          },
        },
      },
    }),
    db.productUnavailable.findMany({ where: { outletId }, select: { productId: true } }),
  ]);
  const soldOut = new Set(unavailable.map((u) => u.productId));
  return categories
    .filter((c) => c.products.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      products: c.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        imageUrl: p.imageUrl,
        emoji: p.emoji ?? c.icon,
        isFeatured: p.isFeatured,
        soldOut: soldOut.has(p.id),
        groups: p.modifierGroups.map((g) => ({
          id: g.id,
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: g.options.map((o) => ({
            id: o.id,
            name: o.name,
            priceDelta: o.priceDelta,
            isDefault: o.isDefault,
            isAvailable: o.isAvailable,
          })),
        })),
      })),
    }));
}

export type MenuCategory = Awaited<ReturnType<typeof getMenuForOutlet>>[number];
export type MenuProduct = MenuCategory["products"][number];
