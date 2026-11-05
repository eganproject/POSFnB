"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export type RealtimeMessage = { type: string; orderId?: string; status?: string; tableName?: string; kind?: string };

/**
 * Berlangganan SSE. Default: refresh data server component (debounce) saat ada event.
 */
export function useRealtime(
  url: string | null,
  onMessage?: (msg: RealtimeMessage) => void,
  { refresh = true }: { refresh?: boolean } = {}
) {
  const router = useRouter();
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    if (!url) return;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      es = new EventSource(url);
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as RealtimeMessage;
          if (msg.type === "ready") return;
          handler.current?.(msg);
          if (refresh) {
            clearTimeout(timer);
            timer = setTimeout(() => router.refresh(), 250);
          }
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        es?.close();
        if (!closed) retry = setTimeout(connect, 3000);
      };
    };
    connect();
    // Saat tab kembali aktif, segarkan data (mis. HP sempat terkunci)
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      closed = true;
      clearTimeout(timer);
      clearTimeout(retry);
      es?.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [url, refresh, router]);
}
