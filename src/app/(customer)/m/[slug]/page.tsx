import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getMenuForOutlet } from "@/server/menu";
import { MenuApp } from "@/components/customer/menu-app";
import { ClosedNotice } from "@/components/customer/closed-notice";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const outlet = await db.outlet.findUnique({ where: { slug } });
  return { title: outlet ? `${outlet.name} · Takeaway` : "Menu" };
}

/** Menu takeaway (QR di kasir / pintu masuk) */
export default async function TakeawayMenuPage({ params }: Props) {
  const { slug } = await params;
  const outlet = await db.outlet.findUnique({ where: { slug } });
  if (!outlet) notFound();
  if (!outlet.isActive) return <ClosedNotice name={outlet.name} />;
  const categories = await getMenuForOutlet(outlet.id);
  return (
    <MenuApp
      outlet={{ id: outlet.id, name: outlet.name, address: outlet.address, taxRate: outlet.taxRate, serviceRate: outlet.serviceRate }}
      table={null}
      categories={categories}
    />
  );
}
