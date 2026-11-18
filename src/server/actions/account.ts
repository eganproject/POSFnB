"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";

export type AccountResult = { ok: true; data?: { claimed?: number } } | { ok: false; error: string };

const profileSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi.").max(60),
  phone: z.string().trim().max(20).regex(/^[+\d]*$/, "No. WhatsApp hanya angka.").optional().nullable(),
});

export async function updateCustomerProfile(input: z.input<typeof profileSchema>): Promise<AccountResult> {
  const me = await getCurrentCustomer();
  if (!me) return { ok: false, error: "Silakan masuk dulu." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  await db.user.update({ where: { id: me.id }, data: { name: parsed.data.name, phone: parsed.data.phone || null } });
  revalidatePath("/akun");
  return { ok: true };
}

/**
 * Tautkan pesanan yang dibuat di perangkat ini sebelum login (disimpan di localStorage)
 * ke akun pelanggan. Hanya pesanan tanpa pemilik & maksimal 24 jam terakhir.
 */
export async function claimDeviceOrders(orderIds: string[]): Promise<AccountResult> {
  const me = await getCurrentCustomer();
  if (!me) return { ok: false, error: "Silakan masuk dulu." };
  const ids = z.array(z.string().min(10).max(40)).max(30).safeParse(orderIds);
  if (!ids.success || ids.data.length === 0) return { ok: true, data: { claimed: 0 } };
  const res = await db.order.updateMany({
    where: { id: { in: ids.data }, customerId: null, source: "QR", createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
    data: { customerId: me.id },
  });
  if (res.count) revalidatePath("/akun");
  return { ok: true, data: { claimed: res.count } };
}
