import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/staff/page-header";
import { MenuManager } from "./menu-manager";

export const metadata = { title: "Menu" };

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  await requireUser(["OWNER"]);
  const { category } = await searchParams;
  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      products: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { modifierGroups: true } } },
      },
    },
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Menu" description="Kelola kategori, menu, varian & add-on. Perubahan langsung tampil di menu customer." />
      <MenuManager
        selected={category ?? "all"}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          isActive: c.isActive,
          products: c.products.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            imageUrl: p.imageUrl,
            emoji: p.emoji,
            isActive: p.isActive,
            isFeatured: p.isFeatured,
            groups: p._count.modifierGroups,
            description: p.description,
          })),
        }))}
      />
    </div>
  );
}
