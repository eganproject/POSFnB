import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requireOutlet, requireUser } from "@/lib/session";
import { appBaseUrl } from "@/lib/url";
import { PrintButton } from "@/app/receipt/[id]/print-button";

export const metadata = { title: "Cetak QR meja" };

export default async function PrintQrPage() {
  await requireUser(["OWNER", "KASIR", "PELAYAN"]);
  const outlet = await requireOutlet();
  const base = await appBaseUrl();
  const tables = await db.diningTable.findMany({ where: { outletId: outlet.id, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const cards = await Promise.all(
    tables.map(async (t) => ({ ...t, qr: await QRCode.toDataURL(`${base}/t/${t.qrToken}`, { margin: 1, width: 400, color: { dark: "#1f1512" } }) }))
  );
  return (
    <div className="min-h-dvh bg-white p-6 print:p-0">
      <div className="no-print mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{cards.length} kartu QR · ukuran pas untuk kertas A4 (3 kolom)</p>
        <PrintButton />
      </div>
      <div className="grid grid-cols-3 gap-4 print:gap-3">
        {cards.map((t) => (
          <div key={t.id} className="flex break-inside-avoid flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-neutral-300 p-4 text-center text-black">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{outlet.name}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.qr} alt={t.name} className="size-40" />
            <p className="text-xl font-extrabold">{t.name}</p>
            <p className="text-xs text-neutral-600">Scan untuk lihat menu & pesan langsung dari meja 🍽️</p>
          </div>
        ))}
      </div>
    </div>
  );
}
