import { db } from "@/lib/db";
import { applyGatewayState } from "@/server/orders";
import { getTransactionStatus, isMidtransEnabled, mapMidtransState } from "@/server/midtrans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cek status transaksi langsung ke Midtrans.
 * Penting untuk development lokal karena webhook tidak bisa menjangkau localhost.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = await db.payment.findUnique({ where: { id } });
  if (!payment || payment.method !== "MIDTRANS" || !payment.gatewayOrderId) {
    return Response.json({ state: "UNKNOWN" }, { status: 404 });
  }
  if (payment.state !== "PENDING" || !isMidtransEnabled()) {
    return Response.json({ state: payment.state });
  }
  try {
    const status = await getTransactionStatus(payment.gatewayOrderId);
    if (!status) return Response.json({ state: payment.state });
    if (Number(status.gross_amount) !== payment.amount) return Response.json({ state: payment.state });
    const state = mapMidtransState(status);
    // Transaksi yang belum dipilih metodenya di Snap tetap pending
    if (state !== payment.state) {
      await applyGatewayState(payment.id, state, JSON.parse(JSON.stringify(status)), status.payment_type);
    }
    return Response.json({ state });
  } catch (e) {
    console.error("sync midtrans", e);
    return Response.json({ state: payment.state });
  }
}
