import type { OrderItemStatus, OrderStatus, OrderType } from "@prisma/client";

/**
 * Aturan alur status pesanan & status per item.
 *
 * Satu sumber kebenaran:
 *  - Dapur & pelayan mengubah status ITEM (Antre → Disiapkan → Siap → Diantar).
 *  - Status PESANAN untuk tahap dapur (Diterima/Dimasak/Siap/Selesai) SELALU
 *    diturunkan dari item lewat `deriveOrderStatus`, tidak pernah diisi bebas.
 *  - PENDING (menunggu bayar/konfirmasi) dan CANCELLED adalah keputusan level
 *    pesanan; selama itu status item tidak dipakai untuk menurunkan status.
 *
 * File ini murni (tanpa database) supaya bisa dites.
 */

export const ITEM_STATUSES: OrderItemStatus[] = ["QUEUED", "PREPARING", "READY", "SERVED"];
const RANK: Record<OrderItemStatus, number> = { QUEUED: 0, PREPARING: 1, READY: 2, SERVED: 3 };

/** Transisi item yang sah (maju satu langkah, lompat Antre→Siap, atau mundur satu langkah untuk koreksi). */
export const ITEM_TRANSITIONS: Record<OrderItemStatus, OrderItemStatus[]> = {
  QUEUED: ["PREPARING", "READY"],
  PREPARING: ["READY", "QUEUED"],
  READY: ["SERVED", "PREPARING"],
  SERVED: ["READY"],
};

/** Status pesanan yang mengizinkan perubahan status item */
export const KITCHEN_ORDER_STATUSES: OrderStatus[] = ["CONFIRMED", "PREPARING", "READY"];

export class FlowError extends Error {}

export function canItemTransition(from: OrderItemStatus, to: OrderItemStatus) {
  return ITEM_TRANSITIONS[from].includes(to);
}

/** Validasi satu perubahan item terhadap status pesanannya. Melempar FlowError bila tidak sah. */
export function assertItemChange(orderStatus: OrderStatus, from: OrderItemStatus, to: OrderItemStatus) {
  if (orderStatus === "PENDING") throw new FlowError("Pesanan belum dikonfirmasi, belum bisa diproses dapur.");
  if (orderStatus === "CANCELLED") throw new FlowError("Pesanan sudah dibatalkan.");
  if (orderStatus === "COMPLETED") throw new FlowError("Pesanan sudah selesai.");
  if (from === to) return false;
  if (!canItemTransition(from, to)) throw new FlowError("Status item tidak bisa diubah ke tahap tersebut.");
  return true;
}

/**
 * Turunkan status pesanan dari status item-itemnya.
 *  - PENDING / CANCELLED dipertahankan (keputusan level pesanan).
 *  - Semua Diantar                → COMPLETED
 *  - Semua Siap/Diantar           → READY
 *  - Semua Antre                  → CONFIRMED
 *  - Selain itu (ada yang jalan)  → PREPARING
 * Pesanan tanpa item (seharusnya tidak terjadi) dipertahankan apa adanya.
 */
export function deriveOrderStatus(current: OrderStatus, items: { status: OrderItemStatus }[]): OrderStatus {
  if (current === "PENDING" || current === "CANCELLED") return current;
  if (!items.length) return current;
  if (items.every((i) => i.status === "SERVED")) return "COMPLETED";
  if (items.every((i) => i.status === "READY" || i.status === "SERVED")) return "READY";
  if (items.every((i) => i.status === "QUEUED")) return "CONFIRMED";
  return "PREPARING";
}

/**
 * Aksi level pesanan (tombol "Mulai masak", "Tandai siap", "Sudah diantar", "Kembalikan")
 * diterjemahkan menjadi perubahan status item. Mengembalikan item yang berubah.
 */
export function itemChangesForOrderAction<T extends { id: string; status: OrderItemStatus }>(
  current: OrderStatus,
  target: OrderStatus,
  items: T[]
): { id: string; from: OrderItemStatus; to: OrderItemStatus }[] {
  const changes: { id: string; from: OrderItemStatus; to: OrderItemStatus }[] = [];
  const move = (pred: (s: OrderItemStatus) => boolean, to: OrderItemStatus) => {
    for (const i of items) if (pred(i.status) && i.status !== to) changes.push({ id: i.id, from: i.status, to });
  };
  if (current === target) return [];
  const forward = ORDER_RANK[target] > ORDER_RANK[current];
  switch (target) {
    case "CONFIRMED":
      if (current === "PENDING") return []; // konfirmasi: item tetap Antre
      // Mundur ke antrean hanya bila belum ada item yang Siap/Diantar
      if (items.some((i) => RANK[i.status] >= RANK.READY)) {
        throw new FlowError("Sebagian item sudah siap. Kembalikan per item dari layar dapur.");
      }
      move((s) => s === "PREPARING", "QUEUED");
      return changes;
    case "PREPARING":
      if (forward) move((s) => s === "QUEUED", "PREPARING");
      else move((s) => s === "READY", "PREPARING"); // dari READY: item siap dikembalikan, yang sudah diantar tetap
      return changes;
    case "READY":
      move((s) => RANK[s] < RANK.READY, "READY");
      return changes;
    case "COMPLETED":
      move((s) => s !== "SERVED", "SERVED");
      return changes;
    default:
      return [];
  }
}

const ORDER_RANK: Record<OrderStatus, number> = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY: 3, COMPLETED: 4, CANCELLED: 5 };

/** Transisi status pesanan yang boleh diminta lewat aksi level pesanan */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "READY", "COMPLETED", "CANCELLED"],
  PREPARING: ["READY", "CONFIRMED", "CANCELLED"],
  READY: ["COMPLETED", "PREPARING"],
  COMPLETED: [],
  CANCELLED: [],
};

type OrderStamps = { confirmedAt: Date | null; preparingAt: Date | null; readyAt: Date | null; completedAt: Date | null };

/**
 * Cap waktu pesanan setelah status berubah dari `prev` ke `next`.
 * Maju: isi cap tahap yang dilewati (yang masih kosong). Mundur: kosongkan cap tahap yang dibatalkan,
 * agar estimasi waktu & tampilan pelanggan tidak memakai waktu yang sudah tidak berlaku.
 */
export function orderStampsFor(prev: OrderStatus, next: OrderStatus, current: OrderStamps, now = new Date()): Partial<OrderStamps> {
  if (prev === next || next === "CANCELLED" || next === "PENDING") return {};
  const steps: [OrderStatus, keyof OrderStamps][] = [
    ["CONFIRMED", "confirmedAt"],
    ["PREPARING", "preparingAt"],
    ["READY", "readyAt"],
    ["COMPLETED", "completedAt"],
  ];
  const out: Partial<OrderStamps> = {};
  for (const [status, key] of steps) {
    if (ORDER_RANK[status] <= ORDER_RANK[next]) {
      if (!current[key]) out[key] = now;
    } else if (current[key]) {
      out[key] = null;
    }
  }
  return out;
}

type ItemStamps = { startedAt: Date | null; readyAt: Date | null; servedAt: Date | null };

/** Cap waktu item setelah berpindah status (sama seperti pesanan: maju mengisi, mundur mengosongkan). */
export function itemStampsFor(to: OrderItemStatus, current: ItemStamps, now = new Date()): Partial<ItemStamps> {
  const steps: [OrderItemStatus, keyof ItemStamps][] = [
    ["PREPARING", "startedAt"],
    ["READY", "readyAt"],
    ["SERVED", "servedAt"],
  ];
  const out: Partial<ItemStamps> = {};
  for (const [status, key] of steps) {
    if (RANK[status] <= RANK[to]) {
      if (!current[key]) out[key] = now;
    } else if (current[key]) {
      out[key] = null;
    }
  }
  return out;
}

/** Ringkasan progres item untuk tampilan ("1 dari 2 siap") */
export function itemProgress(items: { status: OrderItemStatus }[]) {
  const total = items.length;
  const served = items.filter((i) => i.status === "SERVED").length;
  const ready = items.filter((i) => i.status === "READY").length;
  const preparing = items.filter((i) => i.status === "PREPARING").length;
  return {
    total,
    /** Sudah siap atau sudah diantar */
    done: ready + served,
    /** Siap tapi belum diantar: perlu diantar pelayan / diambil */
    toServe: ready,
    served,
    preparing,
    queued: total - ready - served - preparing,
    /** Sebagian siap, sebagian belum */
    partial: ready + served > 0 && ready + served < total,
  };
}

export const ITEM_STATUS_LABEL: Record<OrderItemStatus, string> = {
  QUEUED: "Antre",
  PREPARING: "Disiapkan",
  READY: "Siap",
  SERVED: "Diantar",
};

export function itemStatusLabel(status: OrderItemStatus, type?: OrderType) {
  if (status === "SERVED" && type === "TAKEAWAY") return "Diambil";
  return ITEM_STATUS_LABEL[status];
}
