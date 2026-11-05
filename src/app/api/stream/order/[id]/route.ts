import { db } from "@/lib/db";
import { channels, sseResponse } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, select: { id: true } });
  if (!order) return new Response("Not found", { status: 404 });
  return sseResponse(request, [channels.order(order.id)]);
}
