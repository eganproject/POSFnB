import "server-only";
import { cache } from "react";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "./auth";
import { db } from "./db";
import { ROLE_HOME } from "./constants";

export const OUTLET_COOKIE = "pos_outlet";

export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, outletId: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Wajib login; opsional batasi role. Untuk halaman (redirect). */
export async function requireUser(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

/** Untuk server action / route handler (throw, bukan redirect). */
export async function assertUser(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sesi berakhir, silakan login ulang.");
  if (roles && !roles.includes(user.role)) throw new Error("Anda tidak punya akses untuk aksi ini.");
  return user;
}

/** Outlet aktif: staf terkunci ke outlet-nya, owner bisa memilih (cookie). */
export const getActiveOutlet = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "OWNER" && user.outletId) {
    return db.outlet.findUnique({ where: { id: user.outletId } });
  }
  const jar = await cookies();
  const chosen = jar.get(OUTLET_COOKIE)?.value;
  if (chosen) {
    const outlet = await db.outlet.findUnique({ where: { id: chosen } });
    if (outlet) return outlet;
  }
  return db.outlet.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
});

export async function requireOutlet() {
  const outlet = await getActiveOutlet();
  if (!outlet) redirect("/dashboard/outlets?empty=1");
  return outlet;
}

/** Pastikan user boleh mengakses outlet tertentu */
export function canAccessOutlet(user: CurrentUser, outletId: string) {
  return user.role === "OWNER" || user.outletId === outletId;
}
