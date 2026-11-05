import { db } from "@/lib/db";
import { requireOutlet, requireUser } from "@/lib/session";
import { KitchenBoard } from "./kitchen-board";

export const metadata = { title: "Layar dapur" };
export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const user = await requireUser(["OWNER", "KASIR", "DAPUR"]);
  const outlet = await requireOutlet();
  const orders = await db.order.findMany({
    where: {
      outletId: outlet.id,
      OR: [
        { status: { in: ["CONFIRMED", "PREPARING"] } },
        { status: "READY", readyAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 3) } },
      ],
    },
    include: { items: { orderBy: { id: "asc" } }, table: { select: { name: true } } },
    orderBy: { confirmedAt: "asc" },
  });
  return (
    <KitchenBoard
      outletName={outlet.name}
      role={user.role}
      orders={orders.map((o) => ({
        id: o.id,
        queueNumber: o.queueNumber,
        status: o.status as "CONFIRMED" | "PREPARING" | "READY",
        type: o.type,
        source: o.source,
        tableName: o.table?.name ?? null,
        customerName: o.customerName,
        note: o.note,
        since: (o.confirmedAt ?? o.createdAt).toISOString(),
        readyAt: o.readyAt?.toISOString() ?? null,
        items: o.items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          note: i.note,
          isDone: i.isDone,
          modifiers: (i.modifiers as { option: string }[]).map((m) => m.option),
        })),
      }))}
    />
  );
}
