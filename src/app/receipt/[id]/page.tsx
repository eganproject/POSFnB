import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatRupiah, pad } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { PrintButton } from "./print-button";

export const metadata = { title: "Struk" };
export const dynamic = "force-dynamic";

const TZ = process.env.APP_TIMEZONE || "Asia/Jakarta";
const fmt = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }) {
  const { id } = await params;
  const { print } = await searchParams;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      outlet: true,
      table: { select: { name: true } },
      items: { orderBy: { id: "asc" } },
      payments: { where: { state: "SUCCESS" }, orderBy: { createdAt: "asc" } },
      cashier: { select: { name: true } },
    },
  });
  if (!order) notFound();
  const paid = order.payments.reduce((s, p) => s + p.amount, 0);
  const change = order.payments.reduce((s, p) => s + (p.changeAmount ?? 0), 0);

  return (
    <div className="min-h-dvh bg-muted/50 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[80mm] justify-center gap-2">
        <PrintButton auto={print === "1"} />
      </div>
      <article className="mx-auto w-[80mm] bg-white p-4 font-mono text-[12px] leading-relaxed text-black shadow-lg print:shadow-none">
        <header className="text-center">
          <p className="text-base font-bold">{order.outlet.name}</p>
          {order.outlet.address && <p>{order.outlet.address}</p>}
          {order.outlet.phone && <p>Telp {order.outlet.phone}</p>}
        </header>
        <Dash />
        <div className="space-y-0.5">
          <Row l="No. pesanan" r={`#${pad(order.queueNumber)}`} />
          <Row l="Kode" r={order.code} />
          <Row l="Tanggal" r={fmt(order.createdAt)} />
          <Row l="Tipe" r={order.table ? `Dine-in · ${order.table.name}` : "Takeaway"} />
          {order.customerName && <Row l="Customer" r={order.customerName} />}
          {order.cashier && <Row l="Kasir" r={order.cashier.name} />}
        </div>
        <Dash />
        <ul className="space-y-1.5">
          {order.items.map((i) => {
            const mods = (i.modifiers as { option: string; priceDelta: number }[]) ?? [];
            return (
              <li key={i.id}>
                <p className="font-semibold">{i.name}</p>
                {mods.length > 0 && <p className="pl-2 text-[11px]">+ {mods.map((m) => m.option).join(", ")}</p>}
                {i.note && <p className="pl-2 text-[11px] italic">* {i.note}</p>}
                <Row l={`  ${i.quantity} x ${formatRupiah(i.unitPrice)}`} r={formatRupiah(i.lineTotal)} />
              </li>
            );
          })}
        </ul>
        <Dash />
        <div className="space-y-0.5">
          <Row l="Subtotal" r={formatRupiah(order.subtotal)} />
          {order.discount > 0 && <Row l="Diskon" r={`-${formatRupiah(order.discount)}`} />}
          {order.serviceCharge > 0 && <Row l={`Service ${order.outlet.serviceRate}%`} r={formatRupiah(order.serviceCharge)} />}
          {order.tax > 0 && <Row l={`Pajak ${order.outlet.taxRate}%`} r={formatRupiah(order.tax)} />}
          <div className="flex justify-between pt-1 text-sm font-bold">
            <span>TOTAL</span>
            <span>{formatRupiah(order.total)}</span>
          </div>
        </div>
        <Dash />
        <div className="space-y-0.5">
          {order.payments.map((p) => (
            <Row key={p.id} l={`${PAYMENT_METHOD_LABEL[p.method]}${p.label ? ` (${p.label})` : ""}`} r={formatRupiah(p.cashReceived ?? p.amount)} />
          ))}
          {change > 0 && <Row l="Kembalian" r={formatRupiah(change)} />}
          {paid < order.total && order.status !== "CANCELLED" && <Row l="BELUM DIBAYAR" r={formatRupiah(order.total - paid)} />}
          {order.status === "CANCELLED" && <p className="text-center font-bold">*** DIBATALKAN ***</p>}
        </div>
        <Dash />
        <footer className="space-y-1 text-center">
          <p className="font-semibold">{paid >= order.total ? "LUNAS" : ""}</p>
          <p>{order.outlet.receiptFooter || "Terima kasih atas kunjungan Anda!"}</p>
          <p className="text-[10px]">Powered by Santap POS</p>
        </footer>
      </article>
    </div>
  );
}

function Row({ l, r }: { l: string; r: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="whitespace-pre">{l}</span>
      <span className="text-right">{r}</span>
    </div>
  );
}
function Dash() {
  return <div className="my-2 border-t border-dashed border-black" />;
}
