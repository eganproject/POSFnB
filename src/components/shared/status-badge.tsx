import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";

const ORDER_VARIANT: Record<OrderStatus, "warning" | "info" | "default" | "success" | "secondary" | "destructive"> = {
  PENDING: "warning",
  CONFIRMED: "info",
  PREPARING: "default",
  READY: "success",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_VARIANT[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const v = status === "PAID" ? "success" : status === "PARTIAL" ? "warning" : status === "REFUNDED" ? "secondary" : "destructive";
  return <Badge variant={v}>{PAYMENT_STATUS_LABEL[status]}</Badge>;
}
