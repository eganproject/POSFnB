import { requireOutlet, requireUser } from "@/lib/session";
import { listCustomers } from "@/server/customers";
import { PageHeader } from "@/components/staff/page-header";
import { CustomerList } from "./customer-list";

export const metadata = { title: "Pelanggan" };
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requireUser(["OWNER"]);
  const outlet = await requireOutlet();
  const customers = await listCustomers(outlet.id);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pelanggan"
        description={`Pelanggan yang masuk dengan Google dan tamu yang mengisi nomor WhatsApp saat memesan di ${outlet.name}. Angka belanja hanya menghitung pesanan yang sudah dibayar.`}
      />
      <CustomerList customers={customers} now={Date.now()} />
    </div>
  );
}
