import Link from "next/link";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requireOutlet, requireUser } from "@/lib/session";
import { appBaseUrl } from "@/lib/url";
import { cn } from "@/lib/utils";
import { QR_CARD_QR_OPTIONS, TableQrCard } from "@/components/shared/table-qr-card";
import { PrintCardsButton } from "./print-cards-button";

export const metadata = { title: "Cetak QR meja" };
export const dynamic = "force-dynamic";

type Search = Promise<{ layout?: string; ids?: string; takeaway?: string }>;

export default async function PrintQrPage({ searchParams }: { searchParams: Search }) {
  await requireUser(["OWNER", "KASIR", "PELAYAN"]);
  const outlet = await requireOutlet();
  const base = await appBaseUrl();
  const sp = await searchParams;
  const layout = sp.layout === "a4" ? "a4" : "a6";
  const ids = sp.ids?.split(",").filter(Boolean);
  const takeawayOnly = sp.takeaway === "1";

  const cards = takeawayOnly
    ? [{ id: "takeaway", name: null, area: null, qr: await QRCode.toDataURL(`${base}/m/${outlet.slug}`, QR_CARD_QR_OPTIONS) }]
    : await Promise.all(
        (
          await db.diningTable.findMany({
            where: { outletId: outlet.id, isActive: true, ...(ids?.length ? { id: { in: ids } } : {}) },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          })
        ).map(async (t) => ({ id: t.id, name: t.name, area: t.area, qr: await QRCode.toDataURL(`${base}/t/${t.qrToken}`, QR_CARD_QR_OPTIONS) }))
      );

  // A4 memuat 4 kartu A6 (2 × 2) per lembar
  const sheets = layout === "a4" ? Array.from({ length: Math.ceil(cards.length / 4) }, (_, i) => cards.slice(i * 4, i * 4 + 4)) : cards.map((c) => [c]);
  const query = (l: string) => `?${new URLSearchParams({ layout: l, ...(sp.ids ? { ids: sp.ids } : {}), ...(takeawayOnly ? { takeaway: "1" } : {}) })}`;

  return (
    <div className="min-h-dvh bg-[#e9e4d6] print:bg-white">
      <style>{`
        @page { size: ${layout === "a4" ? "A4 portrait" : "105mm 148mm"}; margin: 0; }
        .qr-sheet, .qr-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print { .qr-sheet { box-shadow: none !important; margin: 0 !important; break-after: page; } .qr-sheet:last-child { break-after: auto; } }
      `}</style>

      <div className="no-print sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto">
            <p className="font-semibold">Cetak kartu QR {takeawayOnly ? "takeaway" : "meja"}</p>
            <p className="text-xs text-muted-foreground">
              {cards.length} kartu · {layout === "a4" ? `${sheets.length} lembar A4, 4 kartu per lembar (potong di garis)` : "1 kartu per halaman A6 (105 × 148 mm)"}
            </p>
          </div>
          <div className="flex rounded-xl border bg-card p-1 text-sm">
            {[
              { k: "a6", l: "A6 · stand meja" },
              { k: "a4", l: "A4 · 4 per lembar" },
            ].map((o) => (
              <Link
                key={o.k}
                href={query(o.k)}
                className={cn("rounded-lg px-3 py-1.5 font-medium transition", layout === o.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
              >
                {o.l}
              </Link>
            ))}
          </div>
          <PrintCardsButton />
        </div>
        <p className="mx-auto max-w-5xl px-4 pb-3 text-xs text-muted-foreground">
          Tips: di jendela cetak pilih skala <b>100% / Actual size</b> dan nyalakan <b>Background graphics</b> agar warna hijau ikut tercetak. Pilih &ldquo;Save as PDF&rdquo; untuk dikirim ke percetakan.
        </p>
      </div>

      {cards.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">Belum ada meja aktif untuk dicetak.</p>
      ) : (
        <div className="flex flex-col items-center gap-8 py-8 print:block print:p-0">
          {sheets.map((sheet, i) =>
            layout === "a4" ? (
              <div key={i} className="qr-sheet grid grid-cols-2 bg-white shadow-xl" style={{ width: "210mm", height: "297mm", gridTemplateRows: "148.5mm 148.5mm" }}>
                {sheet.map((c) => (
                  <div key={c.id} className="grid place-items-center" style={{ outline: "0.2mm dashed #c9c2ad", outlineOffset: "-0.1mm" }}>
                    <TableQrCard name={c.name} area={c.area} qr={c.qr} />
                  </div>
                ))}
              </div>
            ) : (
              <div key={i} className="qr-sheet shadow-xl">
                <TableQrCard name={sheet[0].name} area={sheet[0].area} qr={sheet[0].qr} />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
