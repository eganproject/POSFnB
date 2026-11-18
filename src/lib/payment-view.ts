import type { Payment } from "@prisma/client";
import type { CoreAction, MidtransMode } from "./payment-channels";

/** Data pembayaran online yang dikirim ke browser (Snap atau Core API) */
export type OnlinePaymentView = {
  paymentId: string;
  mode: MidtransMode;
  demo: boolean;
  amount: number;
  /** Snap */
  token: string | null;
  redirectUrl: string | null;
  /** Core API */
  channel: string | null;
  action: CoreAction | null;
  expiresAt: string | null;
};

export function toPaymentView(p: Payment, demo: boolean): OnlinePaymentView {
  const mode: MidtransMode = p.gatewayMode === "core" ? "core" : "snap";
  return {
    paymentId: p.id,
    mode,
    demo,
    amount: p.amount,
    token: p.snapToken,
    redirectUrl: p.snapRedirectUrl,
    channel: p.gatewayChannel,
    action: mode === "core" ? ((p.gatewayAction as CoreAction | null) ?? null) : null,
    expiresAt: p.expiresAt?.toISOString() ?? null,
  };
}
