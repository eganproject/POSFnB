"use client";
import { useCallback, useEffect, useState } from "react";
import { addLine, setLineQty, type CartLine } from "@/lib/cart";

/** Keranjang tersimpan di localStorage per outlet + meja */
export function useCart(storageKey: string) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines, hydrated, storageKey]);

  const add = useCallback((line: CartLine) => setLines((prev) => addLine(prev, line)), []);
  const setQty = useCallback((key: string, qty: number) => setLines((prev) => setLineQty(prev, key, qty)), []);
  const clear = useCallback(() => setLines([]), []);

  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  return { lines, add, setQty, clear, count, subtotal, hydrated };
}

/** Riwayat pesanan customer di perangkat ini */
export function rememberOrder(outletId: string, orderId: string) {
  try {
    const key = `orders:${outletId}`;
    const list: { id: string; at: number }[] = JSON.parse(localStorage.getItem(key) || "[]");
    const next = [{ id: orderId, at: Date.now() }, ...list.filter((o) => o.id !== orderId)].slice(0, 10);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function recentOrders(outletId: string): { id: string; at: number }[] {
  try {
    const list: { id: string; at: number }[] = JSON.parse(localStorage.getItem(`orders:${outletId}`) || "[]");
    return list.filter((o) => Date.now() - o.at < 1000 * 60 * 60 * 12);
  } catch {
    return [];
  }
}
