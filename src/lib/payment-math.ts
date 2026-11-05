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
