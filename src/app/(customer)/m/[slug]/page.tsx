import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getMenuForOutlet } from "@/server/menu";
import { MenuApp, type ReorderItem } from "@/components/customer/menu-app";
import { ClosedNotice } from "@/components/customer/closed-notice";
import { getCurrentCustomer } from "@/lib/session";
import { isGoogleLoginEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ reorder?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const outlet = await db.outlet.findUnique({ where: { slug } });
  return { title: outlet ? `${outlet.name} · Takeaway` : "Menu" };
}

/** Menu takeaway: dari QR di kasir / pintu masuk, atau pesan dari rumah lalu ambil di outlet */
export default async function TakeawayMenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { reorder } = await searchParams;
  const outlet = await db.outlet.findUnique({ where: { slug } });
  if (!outlet) notFound();
  if (!outlet.isActive) return <ClosedNotice name={outlet.name} />;
  const [categories, customer, googleEnabled] = await Promise.all([getMenuForOutlet(outlet.id), getCurrentCustomer(), isGoogleLoginEnabled()]);

  // "Pesan lagi" dari riwayat: hanya pesanan milik pelanggan yang login
  let reorderItems: ReorderItem[] | null = null;
  if (reorder && customer) {
    const order = await db.order.findFirst({
      where: { id: reorder, customerId: customer.id },
      include: { items: { orderBy: { id: "asc" } } },
    });
    if (order) {
      reorderItems = order.items
        .filter((i) => i.productId)
        .map((i) => ({
          productId: i.productId!,
          quantity: i.quantity,
          note: i.note ?? "",
          modifiers: (i.modifiers as { group: string; option: string }[]).map((m) => ({ group: m.group, option: m.option })),
        }));
    }
  }

  return (
    <MenuApp
      outlet={{ id: outlet.id, name: outlet.name, address: outlet.address, taxRate: outlet.taxRate, serviceRate: outlet.serviceRate }}
      table={null}
      categories={categories}
      customer={customer ? { name: customer.name, image: customer.image, phone: customer.phone } : null}
      googleEnabled={googleEnabled}
      reorder={reorderItems}
      pickup={{
        enabled: outlet.takeawayEnabled,
        openTime: outlet.openTime,
        closeTime: outlet.closeTime,
        leadMinutes: outlet.takeawayLeadMinutes,
        timeZone: process.env.APP_TIMEZONE || "Asia/Jakarta",
      }}
    />
  );
}
