/** Pilihan nominal uang tunai cepat (uang pas + pembulatan pecahan umum) */
export function quickCash(amount: number) {
  const opts = new Set<number>([amount]);
  for (const step of [5000, 10000, 20000, 50000, 100000]) opts.add(Math.ceil(amount / step) * step);
  opts.add(Math.max(100000, Math.ceil(amount / 100000) * 100000));
  return [...opts].sort((a, b) => a - b).slice(0, 5);
}

export type SplitOrder = {
  total: number;
  subtotal: number;
  remaining: number;
  successCount: number;
  items: { id: string; quantity: number; paidQty: number; unitPrice: number }[];
};

/** Nominal yang dibayar untuk satu bagian split bill */
export function splitAmount(
  order: SplitOrder,
  mode: "full" | "equal" | "items",
  people: number,
  picked: Record<string, number>
) {
  if (order.remaining <= 0) return 0;
  if (mode === "full") return order.remaining;
  if (mode === "equal") {
    const left = Math.max(1, people - order.successCount);
    if (left === 1) return order.remaining;
    return Math.min(order.remaining, Math.ceil(order.remaining / left / 100) * 100);
  }
  const itemsSubtotal = order.items.reduce((s, i) => s + (picked[i.id] ?? 0) * i.unitPrice, 0);
  if (itemsSubtotal === 0) return 0;
  const allPicked = order.items.every((i) => (picked[i.id] ?? 0) === i.quantity - i.paidQty);
  if (allPicked) return order.remaining;
  // Pajak, service & diskon dibagi proporsional terhadap subtotal
  return Math.min(order.remaining, Math.round((itemsSubtotal * order.total) / Math.max(1, order.subtotal)));
}

export type MoneyInput = {
  total: number;
  status: string;
  paymentStatus: string;
  payments: { state: string; amount: number }[];
  refunds: { amount: number }[];
};

/**
 * Posisi uang satu pesanan.
 * - paid: total pembayaran sukses
 * - refunded: total yang sudah dikembalikan
 * - refundDue: uang customer yang harus dikembalikan (pesanan batal yang sudah dibayar,
 *   atau pembayaran dobel / telat yang membuat lebih bayar)
 */
export function moneyState(o: MoneyInput) {
  const paid = o.payments.filter((p) => p.state === "SUCCESS").reduce((s, p) => s + p.amount, 0);
  const refunded = o.refunds.reduce((s, r) => s + r.amount, 0);
  const net = paid - refunded;
  const kept = o.status === "CANCELLED" ? 0 : o.total;
  // Pesanan lama berstatus "Refund" tanpa catatan refund dianggap sudah beres
  const legacyRefunded = o.paymentStatus === "REFUNDED" && o.refunds.length === 0;
  const refundDue = legacyRefunded ? 0 : Math.max(0, net - kept);
  const cancelled = o.status === "CANCELLED";
  let paymentStatus: "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";
  if (legacyRefunded || (cancelled && paid > 0 && net <= 0)) paymentStatus = "REFUNDED";
  else if (net <= 0 && !(o.total === 0 && !cancelled)) paymentStatus = "UNPAID";
  else if (net >= o.total) paymentStatus = "PAID";
  else paymentStatus = "PARTIAL";
  return { paid, refunded, net, refundDue, remaining: Math.max(0, kept - net), paymentStatus };
}
