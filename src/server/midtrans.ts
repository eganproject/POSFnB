import "server-only";
import crypto from "node:crypto";
import type { PaymentState } from "@prisma/client";

const isProd = process.env.MIDTRANS_IS_PRODUCTION === "true";
const SNAP_URL = isProd
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";
const CORE_URL = isProd ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";

export function isMidtransEnabled() {
  return Boolean(process.env.MIDTRANS_SERVER_KEY && process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY);
}

function authHeader() {
  const key = process.env.MIDTRANS_SERVER_KEY ?? "";
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

export type SnapParams = {
  orderId: string;
  amount: number;
  itemName: string;
  customerName?: string | null;
  customerPhone?: string | null;
  finishUrl: string;
};

export async function createSnapTransaction(p: SnapParams) {
  const res = await fetch(SNAP_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      transaction_details: { order_id: p.orderId, gross_amount: p.amount },
      item_details: [{ id: "ORDER", price: p.amount, quantity: 1, name: p.itemName.slice(0, 50) }],
      customer_details: {
        first_name: p.customerName || "Customer",
        phone: p.customerPhone || undefined,
      },
      callbacks: { finish: p.finishUrl },
      expiry: { unit: "minutes", duration: 30 },
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    token?: string;
    redirect_url?: string;
    error_messages?: string[];
  };
  if (!res.ok || !json.token) {
    throw new Error(json.error_messages?.join(", ") || `Midtrans error (${res.status})`);
  }
  return { token: json.token, redirectUrl: json.redirect_url ?? null };
}

export type MidtransStatus = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key?: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type?: string;
  transaction_id?: string;
  [key: string]: unknown;
};

export async function getTransactionStatus(orderId: string): Promise<MidtransStatus | null> {
  const res = await fetch(`${CORE_URL}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Accept: "application/json", Authorization: authHeader() },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as MidtransStatus | null;
  if (!json || json.status_code === "404") return null;
  return json;
}

export function verifySignature(n: MidtransStatus) {
  const key = process.env.MIDTRANS_SERVER_KEY ?? "";
  const expected = crypto
    .createHash("sha512")
    .update(`${n.order_id}${n.status_code}${n.gross_amount}${key}`)
    .digest("hex");
  return Boolean(n.signature_key) && expected === n.signature_key;
}

export function mapMidtransState(n: Pick<MidtransStatus, "transaction_status" | "fraud_status">): PaymentState {
  switch (n.transaction_status) {
    case "capture":
      return n.fraud_status === "challenge" ? "PENDING" : "SUCCESS";
    case "settlement":
      return "SUCCESS";
    case "pending":
      return "PENDING";
    case "expire":
      return "EXPIRED";
    case "deny":
    case "cancel":
    case "failure":
      return "FAILED";
    default:
      return "PENDING";
  }
}
