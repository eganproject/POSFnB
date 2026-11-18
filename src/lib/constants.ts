import type { OrderStatus, PaymentMethod, PaymentStatus, Role } from "@prisma/client";

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  KASIR: "Kasir",
  DAPUR: "Dapur",
  PELAYAN: "Pelayan",
  CUSTOMER: "Pelanggan",
};

/** Peran yang bisa dipilih owner saat menambah staf */
export const STAFF_ROLES = ["OWNER", "KASIR", "DAPUR", "PELAYAN"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Menunggu",
  CONFIRMED: "Diterima",
  PREPARING: "Dimasak",
  READY: "Siap",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Belum bayar",
  PARTIAL: "Bayar sebagian",
  PAID: "Lunas",
  REFUNDED: "Refund",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Tunai",
  MIDTRANS: "Online (Midtrans)",
  QRIS_STATIC: "QRIS (EDC)",
  CARD: "Kartu Debit/Kredit",
  TRANSFER: "Transfer Bank",
};

/** Halaman yang boleh diakses tiap role */
export const ROLE_HOME: Record<Role, string> = {
  OWNER: "/dashboard",
  KASIR: "/pos",
  DAPUR: "/kitchen",
  PELAYAN: "/dashboard/orders",
  CUSTOMER: "/akun",
};
