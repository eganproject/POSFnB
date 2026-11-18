import { db } from "@/lib/db";
import { channels, sseResponse } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** SSE untuk beberapa pesanan sekaligus (daftar "Pesanan saya" pelanggan) */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => /^[a-z0-9]{10,40}$/i.test(id))
    .slice(0, 10);
  if (!ids.length) return new Response("Bad request", { status: 400 });
  const found = await db.order.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (!found.length) return new Response("Not found", { status: 404 });
  return sseResponse(request, found.map((o) => channels.order(o.id)));
}
