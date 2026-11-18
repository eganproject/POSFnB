import QRCode from "qrcode";
import { appBaseUrl } from "@/lib/url";
import { db } from "@/lib/db";
import { requireOutlet, requireUser } from "@/lib/session";
import { PageHeader } from "@/components/staff/page-header";
import { QR_CARD_QR_OPTIONS } from "@/components/shared/table-qr-card";
import { TablesManager } from "./tables-manager";

export const metadata = { title: "Meja & QR" };
export const dynamic = "force-dynamic";


export default async function TablesPage() {
  const user = await requireUser(["OWNER", "KASIR", "PELAYAN"]);
  const outlet = await requireOutlet();
  const base = await appBaseUrl();
  const tables = await db.diningTable.findMany({
    where: { outletId: outlet.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      orders: { where: { status: { in: ["PENDING", "CONFIRMED", "PREPARING", "READY"] } }, select: { id: true } },
    },
  });
  const withQr = await Promise.all(
    tables.map(async (t) => ({
      id: t.id,
      name: t.name,
      area: t.area,
      capacity: t.capacity,
      isActive: t.isActive,
      token: t.qrToken,
      url: `${base}/t/${t.qrToken}`,
      qr: await QRCode.toDataURL(`${base}/t/${t.qrToken}`, QR_CARD_QR_OPTIONS),
      activeOrders: t.orders.length,
    }))
  );
  const takeawayUrl = `${base}/m/${outlet.slug}`;
  return (
    <div className="space-y-6">
      <PageHeader title="Meja & QR" description="Setiap meja punya kartu QR unik. Customer scan, menu terbuka dengan nomor meja otomatis." />
      <TablesManager
        canEdit={user.role === "OWNER"}
        outletId={outlet.id}
        tables={withQr}
        takeaway={{ url: takeawayUrl, qr: await QRCode.toDataURL(takeawayUrl, QR_CARD_QR_OPTIONS) }}
        localhostWarning={base.includes("localhost")}
      />
    </div>
  );
}
