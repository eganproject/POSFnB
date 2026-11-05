export type CartModifier = { group: string; option: string; priceDelta: number };

export type CartLine = {
  key: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  optionIds: string[];
  modifiers: CartModifier[];
  note: string;
  imageUrl?: string | null;
  emoji?: string | null;
};

export function lineKey(productId: string, optionIds: string[], note: string) {
  return [productId, [...optionIds].sort().join(","), note.trim().toLowerCase()].join("|");
}

export function addLine(lines: CartLine[], line: CartLine) {
  const idx = lines.findIndex((l) => l.key === line.key);
  if (idx === -1) return [...lines, line];
  const next = [...lines];
  next[idx] = { ...next[idx], quantity: Math.min(99, next[idx].quantity + line.quantity) };
  return next;
}

export function setLineQty(lines: CartLine[], key: string, qty: number) {
  if (qty <= 0) return lines.filter((l) => l.key !== key);
  return lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(99, qty) } : l));
}

export function estimateTotals(subtotal: number, rates: { taxRate: number; serviceRate: number }, discount = 0) {
  const base = Math.max(0, subtotal - discount);
  const serviceCharge = Math.round((base * rates.serviceRate) / 100);
  const tax = Math.round(((base + serviceCharge) * rates.taxRate) / 100);
  return { subtotal, discount: Math.min(discount, subtotal), serviceCharge, tax, total: base + serviceCharge + tax };
}

export function modifierText(mods: CartModifier[]) {
  return mods.map((m) => m.option).join(", ");
}
