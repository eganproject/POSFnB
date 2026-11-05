import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ProductForm } from "./product-form";

export const metadata = { title: "Ubah menu" };

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ category?: string }> }) {
  await requireUser(["OWNER"]);
  const { id } = await params;
  const { category } = await searchParams;
  const categories = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, icon: true } });
  if (id === "new") {
    return <ProductForm categories={categories} initial={{ categoryId: category ?? categories[0]?.id ?? "", name: "", description: "", price: 0, imageUrl: "", emoji: "", isActive: true, isFeatured: false, groups: [] }} />;
  }
  const p = await db.product.findUnique({
    where: { id },
    include: { modifierGroups: { orderBy: { sortOrder: "asc" }, include: { options: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!p) notFound();
  return (
    <ProductForm
      categories={categories}
      initial={{
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        description: p.description ?? "",
        price: p.price,
        imageUrl: p.imageUrl ?? "",
        emoji: p.emoji ?? "",
        isActive: p.isActive,
        isFeatured: p.isFeatured,
        groups: p.modifierGroups.map((g) => ({
          id: g.id,
          key: g.id,
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: g.options.map((o) => ({ id: o.id, key: o.id, name: o.name, priceDelta: o.priceDelta, isDefault: o.isDefault, isAvailable: o.isAvailable })),
        })),
      }}
    />
  );
}
