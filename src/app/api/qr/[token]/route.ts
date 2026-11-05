import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { token } = await params;
  const table = await db.diningTable.findUnique({ where: { qrToken: token } });
  if (!table) return new Response("Not found", { status: 404 });
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const png = await QRCode.toBuffer(`${base}/t/${token}`, {
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#1f1512", light: "#ffffff" },
  });
  const download = new URL(request.url).searchParams.get("download");
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=60",
      ...(download ? { "Content-Disposition": `attachment; filename="QR-${table.name.replace(/\s+/g, "-")}.png"` } : {}),
    },
  });
}
