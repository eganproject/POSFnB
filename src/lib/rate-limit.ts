import "server-only";
import { headers } from "next/headers";

const g = globalThis as unknown as { __rl?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__rl ??= new Map<string, number[]>());

/**
 * Pembatas request sederhana (in-memory, sliding window) untuk aksi publik
 * seperti membuat pesanan atau memanggil pelayan.
 */
export async function rateLimit(action: string, limit: number, windowMs = 60_000) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const key = `${action}:${ip}`;
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return true;
}
