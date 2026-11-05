import { channels, sseResponse } from "@/lib/events";
import { getActiveOutlet, getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const outlet = await getActiveOutlet();
  if (!outlet) return new Response("No outlet", { status: 404 });
  return sseResponse(request, [channels.outlet(outlet.id)]);
}
