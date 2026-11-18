import type { OrderStatus, PaymentStatus } from "@prisma/client";

/** Ringkasan pesanan untuk daftar pelanggan (sheet "Pesanan saya" & riwayat /akun) */
export type OrderSummary = {
  id: string;
  queueNumber: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  /** Perlu dibayar online sekarang (Midtrans) */
  needsOnlinePay: boolean;
  /** Bayar di kasir & belum lunas */
  payAtCashier: boolean;
  total: number;
  createdAt: string;
  createdLabel: string;
  /** "Meja 03", "Takeaway · ambil 14:30", "Takeaway" */
  place: string;
  outletName: string;
  items: { name: string; quantity: number }[];
  /** Progres item dapur: jumlah item (baris) yang sudah siap/diantar dari total */
  itemsDone: number;
  itemsTotal: number;
  reorderHref?: string | null;
};

export const ACTIVE_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY"];

export const isActiveOrder = (s: OrderStatus) => ACTIVE_STATUSES.includes(s);

/** Urutan tampil: yang paling butuh perhatian pelanggan di atas */
const PRIORITY: Record<OrderStatus, number> = { READY: 0, PENDING: 1, PREPARING: 2, CONFIRMED: 3, COMPLETED: 4, CANCELLED: 4 };

/** Aktif dulu (Siap → Menunggu → Disiapkan → Diterima), lalu selesai/batal; terbaru di atas */
export function sortOrderSummaries<T extends { status: OrderStatus; createdAt: string }>(list: T[]) {
  return [...list].sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status] || b.createdAt.localeCompare(a.createdAt));
}
