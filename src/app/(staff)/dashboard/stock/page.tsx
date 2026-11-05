import { requireOutlet, requireUser } from "@/lib/session";
import { getMenuForOutlet } from "@/server/menu";
import { PageHeader } from "@/components/staff/page-header";
import { StockList } from "./stock-list";

export const metadata = { title: "Stok menu" };

export default async function StockPage() {
  await requireUser();
  const outlet = await requireOutlet();
  const categories = await getMenuForOutlet(outlet.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Stok menu" description={`Tandai menu yang habis di ${outlet.name}. Customer & kasir langsung melihat perubahan.`} />
      <StockList categories={categories} />
    </div>
  );
}
