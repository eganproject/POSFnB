import { db } from "@/lib/db";
import { getActiveOutlet, getCurrentUser } from "@/lib/session";
import { PAYMENT_METHOD_LABEL, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Ekspor transaksi ke CSV (bisa dibuka di Excel / Google Sheets) */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") return new Response("Unauthorized", { status: 401 });
  const outlet = await getActiveOutlet();
  if (!outlet) return new Response("No outlet", { status: 404 });
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return new Response("Bad range", { status: 400 });

  const orders = await db.order.findMany({
    where: { outletId: outlet.id, businessDate: { gte: from, lte: to } },
    include: { table: { select: { name: true } }, payments: { where: { state: "SUCCESS" } }, items: true, cashier: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const header = ["Tanggal", "Waktu", "No", "Kode", "Sumber", "Tipe", "Meja", "Customer", "Item", "Subtotal", "Diskon", "Service", "Pajak", "Total", "Status", "Pembayaran", "Metode", "Kasir"];
  const rows = orders.map((o) => [
    o.businessDate,
    new Intl.DateTimeFormat("id-ID", { timeZone: process.env.APP_TIMEZONE || "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(o.createdAt),
    o.queueNumber,
    o.code,
    o.source === "QR" ? "QR" : "Kasir",
    o.type === "DINE_IN" ? "Dine-in" : "Takeaway",
    o.table?.name ?? "",
    o.customerName ?? "",
    o.items.map((i) => `${i.quantity}x ${i.name}`).join(" | "),
    o.subtotal,
    o.discount,
    o.serviceCharge,
    o.tax,
    o.total,
    ORDER_STATUS_LABEL[o.status],
    PAYMENT_STATUS_LABEL[o.paymentStatus],
    [...new Set(o.payments.map((p) => PAYMENT_METHOD_LABEL[p.method]))].join(" + "),
    o.cashier?.name ?? "",
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="penjualan-${outlet.slug}-${from}_${to}.csv"`,
    },
  });
}
