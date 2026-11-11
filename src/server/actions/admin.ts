"use server";
import crypto from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { assertUser } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { channels, publish } from "@/lib/events";
import { resetDemoPasswordCache } from "@/server/security";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Data tidak valid." };
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return { ok: false, error: "Data dengan nama/email tersebut sudah ada." };
    if (e.code === "P2003") return { ok: false, error: "Data masih dipakai, tidak bisa dihapus. Nonaktifkan saja." };
  }
  if (e instanceof Error) return { ok: false, error: e.message };
  return { ok: false, error: "Terjadi kesalahan." };
}
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const owner = () => assertUser(["OWNER"]);
const qrToken = () => crypto.randomBytes(9).toString("base64url");

function menuChanged() {
  revalidatePath("/dashboard/menu");
  revalidatePath("/dashboard/stock");
  revalidatePath("/pos");
  revalidatePath("/t/[token]", "page");
  revalidatePath("/m/[slug]", "page");
}

// ───────── Outlet ─────────

const outletSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Nama outlet minimal 2 huruf").max(60),
  slug: z.string().trim().max(40).optional(),
  address: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  taxRate: z.number().min(0).max(30),
  serviceRate: z.number().min(0).max(30),
  maxDiscountPercent: z.number().int().min(0).max(100),
  receiptFooter: z.string().trim().max(200).optional().nullable(),
  isActive: z.boolean(),
});

export async function saveOutlet(input: z.input<typeof outletSchema>): Promise<Result<{ id: string }>> {
  try {
    await owner();
    const { id, ...d } = outletSchema.parse(input);
    const data = { ...d, slug: slugify(d.slug || d.name) || qrToken().toLowerCase() };
    const outlet = id ? await db.outlet.update({ where: { id }, data }) : await db.outlet.create({ data });
    revalidatePath("/dashboard", "layout");
    return ok({ id: outlet.id });
  } catch (e) {
    return fail(e);
  }
}

// ───────── Meja ─────────

const tableSchema = z.object({
  id: z.string().optional(),
  outletId: z.string(),
  name: z.string().trim().min(1, "Nama meja wajib diisi").max(30),
  area: z.string().trim().max(30).optional().nullable(),
  capacity: z.number().int().min(1).max(50),
  isActive: z.boolean(),
});

export async function saveTable(input: z.input<typeof tableSchema>): Promise<Result> {
  try {
    await owner();
    const { id, ...data } = tableSchema.parse(input);
    if (id) await db.diningTable.update({ where: { id }, data });
    else {
      const count = await db.diningTable.count({ where: { outletId: data.outletId } });
      await db.diningTable.create({ data: { ...data, qrToken: qrToken(), sortOrder: count } });
    }
    revalidatePath("/dashboard/tables");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function bulkCreateTables(outletId: string, prefix: string, from: number, to: number, area?: string): Promise<Result<{ created: number }>> {
  try {
    await owner();
    if (to < from || to - from > 100) throw new Error("Rentang nomor meja tidak valid (maks 100).");
    const existing = new Set((await db.diningTable.findMany({ where: { outletId }, select: { name: true } })).map((t) => t.name));
    const base = await db.diningTable.count({ where: { outletId } });
    const rows = [];
    for (let n = from; n <= to; n++) {
      const name = `${prefix.trim() || "Meja"} ${String(n).padStart(2, "0")}`;
      if (!existing.has(name)) rows.push({ outletId, name, area: area || null, capacity: 4, qrToken: qrToken(), sortOrder: base + rows.length });
    }
    await db.diningTable.createMany({ data: rows });
    revalidatePath("/dashboard/tables");
    return ok({ created: rows.length });
  } catch (e) {
    return fail(e);
  }
}

export async function regenerateTableQr(id: string): Promise<Result> {
  try {
    await owner();
    await db.diningTable.update({ where: { id }, data: { qrToken: qrToken() } });
    revalidatePath("/dashboard/tables");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTable(id: string): Promise<Result> {
  try {
    await owner();
    await db.diningTable.delete({ where: { id } });
    revalidatePath("/dashboard/tables");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

// ───────── Kategori ─────────

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Nama kategori wajib diisi").max(40),
  icon: z.string().trim().max(8).optional().nullable(),
  isActive: z.boolean(),
});

export async function saveCategory(input: z.input<typeof categorySchema>): Promise<Result> {
  try {
    await owner();
    const { id, ...data } = categorySchema.parse(input);
    if (id) await db.category.update({ where: { id }, data });
    else await db.category.create({ data: { ...data, sortOrder: await db.category.count() } });
    menuChanged();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCategory(id: string): Promise<Result> {
  try {
    await owner();
    const count = await db.product.count({ where: { categoryId: id } });
    if (count) throw new Error("Kategori masih berisi menu. Pindahkan / hapus menunya dulu.");
    await db.category.delete({ where: { id } });
    menuChanged();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function moveCategory(id: string, dir: -1 | 1): Promise<Result> {
  try {
    await owner();
    const list = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    const idx = list.findIndex((c) => c.id === id);
    const swap = list[idx + dir];
    if (idx < 0 || !swap) return ok(undefined);
    [list[idx], list[idx + dir]] = [swap, list[idx]];
    await db.$transaction(list.map((c, i) => db.category.update({ where: { id: c.id }, data: { sortOrder: i } })));
    menuChanged();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

// ───────── Produk ─────────

const optionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Nama pilihan wajib diisi").max(40),
  priceDelta: z.number().int().min(-1_000_000).max(10_000_000),
  isDefault: z.boolean(),
  isAvailable: z.boolean(),
});
const groupSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Nama grup pilihan wajib diisi").max(40),
    minSelect: z.number().int().min(0).max(10),
    maxSelect: z.number().int().min(1).max(20),
    options: z.array(optionSchema).min(1, "Setiap grup minimal punya 1 pilihan"),
  })
  .refine((g) => g.maxSelect >= g.minSelect, "Maksimal pilihan harus ≥ minimal")
  .refine((g) => g.options.length >= g.minSelect, "Jumlah pilihan kurang dari minimal yang diwajibkan");

const productSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1, "Pilih kategori"),
  name: z.string().trim().min(2, "Nama menu minimal 2 huruf").max(80),
  description: z.string().trim().max(300).optional().nullable(),
  price: z.number().int().min(0, "Harga tidak valid").max(100_000_000),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  emoji: z.string().trim().max(8).optional().nullable(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  groups: z.array(groupSchema).max(10),
});

export async function saveProduct(input: z.input<typeof productSchema>): Promise<Result<{ id: string }>> {
  try {
    await owner();
    const { id, groups, ...data } = productSchema.parse(input);
    const productId = await db.$transaction(async (tx) => {
      const product = id
        ? await tx.product.update({ where: { id }, data })
        : await tx.product.create({ data: { ...data, sortOrder: await tx.product.count({ where: { categoryId: data.categoryId } }) } });

      // Upsert grup & opsi agar ID tetap stabil (keranjang customer tidak rusak)
      const keepGroups = groups.map((g) => g.id).filter(Boolean) as string[];
      await tx.modifierGroup.deleteMany({ where: { productId: product.id, id: { notIn: keepGroups } } });
      for (const [gi, g] of groups.entries()) {
        const gData = { name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, sortOrder: gi };
        const group = g.id
          ? await tx.modifierGroup.update({ where: { id: g.id, productId: product.id }, data: gData })
          : await tx.modifierGroup.create({ data: { ...gData, productId: product.id } });
        const keepOpts = g.options.map((o) => o.id).filter(Boolean) as string[];
        await tx.modifierOption.deleteMany({ where: { groupId: group.id, id: { notIn: keepOpts } } });
        for (const [oi, o] of g.options.entries()) {
          const oData = { name: o.name, priceDelta: o.priceDelta, isDefault: o.isDefault, isAvailable: o.isAvailable, sortOrder: oi };
          if (o.id) await tx.modifierOption.update({ where: { id: o.id, groupId: group.id }, data: oData });
          else await tx.modifierOption.create({ data: { ...oData, groupId: group.id } });
        }
      }
      return product.id;
    });
    menuChanged();
    return ok({ id: productId });
  } catch (e) {
    return fail(e);
  }
}

export async function deleteProduct(id: string): Promise<Result> {
  try {
    await owner();
    // Riwayat pesanan menyimpan snapshot nama & harga, jadi aman dihapus
    await db.product.delete({ where: { id } });
    menuChanged();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function toggleProductActive(id: string, isActive: boolean): Promise<Result> {
  try {
    await owner();
    await db.product.update({ where: { id }, data: { isActive } });
    menuChanged();
    const outlets = await db.outlet.findMany({ select: { id: true } });
    outlets.forEach((o) => publish(channels.outlet(o.id), { type: "menu.updated" }));
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

// ───────── Pengguna ─────────

const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Nama minimal 2 huruf").max(60),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  role: z.enum(["OWNER", "KASIR", "DAPUR", "PELAYAN"]),
  outletId: z.string().nullable().optional(),
  isActive: z.boolean(),
  password: z.string().max(100).optional(),
});

export async function saveUser(input: z.input<typeof userSchema>): Promise<Result> {
  try {
    const me = await owner();
    const { id, password, ...data } = userSchema.parse(input);
    if (password && password === "password123") throw new Error("Jangan pakai password demo. Pilih password lain.");
    resetDemoPasswordCache();
    if (data.role !== "OWNER" && !data.outletId) throw new Error("Staf harus ditempatkan di salah satu outlet.");
    if (id === me.id && (data.role !== "OWNER" || !data.isActive)) throw new Error("Anda tidak bisa menurunkan role / menonaktifkan akun sendiri.");
    const outletId = data.role === "OWNER" ? null : data.outletId;
    if (id) {
      await db.user.update({ where: { id }, data: { ...data, outletId } });
      if (password) {
        if (password.length < 6) throw new Error("Password minimal 6 karakter");
        await db.account.updateMany({ where: { userId: id, providerId: "credential" }, data: { password: await hashPassword(password) } });
        await db.session.deleteMany({ where: { userId: id } });
      }
      if (!data.isActive) await db.session.deleteMany({ where: { userId: id } });
    } else {
      if (!password || password.length < 6) throw new Error("Password minimal 6 karakter");
      const userId = crypto.randomBytes(16).toString("hex");
      await db.$transaction([
        db.user.create({ data: { id: userId, ...data, outletId, emailVerified: true } }),
        db.account.create({
          data: { id: crypto.randomBytes(16).toString("hex"), userId, accountId: userId, providerId: "credential", password: await hashPassword(password) },
        }),
      ]);
    }
    revalidatePath("/dashboard/users");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
