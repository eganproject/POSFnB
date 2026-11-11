"use client";
import { useSyncExternalStore } from "react";

export type StaffAlert = { id: string; kind: "bill" | "waiter" | "order"; title: string; at: number; read: boolean };

/** Riwayat notifikasi staf selama tab terbuka (tidak disimpan ke server) */
let alerts: StaffAlert[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function pushAlert(a: Omit<StaffAlert, "id" | "at" | "read">) {
  alerts = [{ ...a, id: Math.random().toString(36).slice(2), at: Date.now(), read: false }, ...alerts].slice(0, 20);
  emit();
}

export function markAllRead() {
  if (!alerts.some((a) => !a.read)) return;
  alerts = alerts.map((a) => ({ ...a, read: true }));
  emit();
}

export function clearAlerts() {
  alerts = [];
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const EMPTY: StaffAlert[] = [];

export function useAlerts() {
  return useSyncExternalStore(subscribe, () => alerts, () => EMPTY);
}
