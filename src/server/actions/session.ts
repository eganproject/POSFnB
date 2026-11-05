"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertUser, OUTLET_COOKIE } from "@/lib/session";

export async function switchOutlet(outletId: string) {
  const user = await assertUser(["OWNER"]);
  const outlet = await db.outlet.findUnique({ where: { id: outletId } });
  if (!outlet || !user) return;
  (await cookies()).set(OUTLET_COOKIE, outlet.id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}
