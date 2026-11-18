import type { Prisma } from "@prisma/client";
import { pickupLabel } from "@/lib/pickup-label";
import type { OrderSummary } from "@/lib/order-summary";
import { itemProgress } from "@/lib/order-flow";

const TZ = process.env.APP_TIMEZONE || "Asia/Jakarta";

export const orderSummaryInclude = {
  outlet: { select: { name: true, slug: true, takeawayEnabled: true, isActive: true } },
  table: { select: { name: true } },
  items: { select: { name: true, quantity: true, status: true }, orderBy: { id: "asc" } },
} satisfies Prisma.OrderInclude;

type Row = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>;

export function toOrderSummary(o: Row, { withDate = false }: { withDate?: boolean } = {}): OrderSummary {
  const unpaid = o.paymentStatus === "UNPAID" || o.paymentStatus === "PARTIAL";
  const open = o.status !== "CANCELLED";
  const pickup = pickupLabel(o.pickupAt);
  // Gabungkan item bernama sama (beda varian) agar ringkasan tetap pendek
  const merged = new Map<string, number>();
  for (const i of o.items) merged.set(i.name, (merged.get(i.name) ?? 0) + i.quantity);
  const progress = itemProgress(o.items);
  return {
    id: o.id,
    queueNumber: o.queueNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    needsOnlinePay: open && unpaid && o.payPreference === "MIDTRANS",
    payAtCashier: open && unpaid && o.payPreference !== "MIDTRANS",
    total: o.total,
    createdAt: o.createdAt.toISOString(),
    createdLabel: withDate
      ? o.createdAt.toLocaleString("id-ID", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : o.createdAt.toLocaleTimeString("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }),
    place: o.table ? o.table.name : pickup ? `Takeaway · ambil ${pickup}` : "Takeaway",
    outletName: o.outlet.name,
    items: [...merged].map(([name, quantity]) => ({ name, quantity })),
    itemsDone: progress.done,
    itemsTotal: progress.total,
    reorderHref: o.outlet.isActive && o.outlet.takeawayEnabled ? `/m/${o.outlet.slug}?reorder=${o.id}` : null,
  };
}
