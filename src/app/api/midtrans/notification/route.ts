import { db } from "@/lib/db";
import { applyGatewayState } from "@/server/orders";
import { mapMidtransState, verifySignature, type MidtransStatus } from "@/server/midtrans";

export const runtime = "nodejs";

/**
 * Webhook Midtrans (Payment Notification URL).
 * Set di dashboard sandbox: https://<domain-publik>/api/midtrans/notification
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as MidtransStatus | null;
  if (!body?.order_id) return Response.json({ message: "invalid payload" }, { status: 400 });
  if (!verifySignature(body)) return Response.json({ message: "invalid signature" }, { status: 403 });

  const payment = await db.payment.findUnique({ where: { gatewayOrderId: body.order_id } });
  if (!payment) return Response.json({ message: "ok (unknown order)" });
  if (Number(body.gross_amount) !== payment.amount) {
    return Response.json({ message: "amount mismatch" }, { status: 400 });
  }
  await applyGatewayState(payment.id, mapMidtransState(body), JSON.parse(JSON.stringify(body)), body.payment_type);
  return Response.json({ message: "ok" });
}
