import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getMenuForOutlet } from "@/server/menu";
import { MenuApp } from "@/components/customer/menu-app";
import { ClosedNotice } from "@/components/customer/closed-notice";
import { getCurrentCustomer } from "@/lib/session";
import { isGoogleLoginEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const table = await db.diningTable.findUnique({ where: { qrToken: token }, include: { outlet: true } });
  return { title: table ? `${table.outlet.name} · ${table.name}` : "Menu" };
}

export default async function TableMenuPage({ params }: Props) {
  const { token } = await params;
  const table = await db.diningTable.findUnique({ where: { qrToken: token }, include: { outlet: true } });
  if (!table) notFound();
  if (!table.isActive || !table.outlet.isActive) return <ClosedNotice name={table.outlet.name} />;
  const [categories, customer, googleEnabled] = await Promise.all([getMenuForOutlet(table.outletId), getCurrentCustomer(), isGoogleLoginEnabled()]);
  return (
    <MenuApp
      outlet={{
        id: table.outlet.id,
        name: table.outlet.name,
        address: table.outlet.address,
        taxRate: table.outlet.taxRate,
        serviceRate: table.outlet.serviceRate,
      }}
      table={{ name: table.name, area: table.area, token: table.qrToken }}
      categories={categories}
      customer={customer ? { name: customer.name, image: customer.image, phone: customer.phone } : null}
      googleEnabled={googleEnabled}
    />
  );
}
