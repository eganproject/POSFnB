import { EventEmitter } from "node:events";

/**
 * Event bus in-process untuk realtime (SSE).
 * Cukup untuk satu instance server (development lokal / single node).
 */
export type RealtimeEvent =
  | { type: "order.created"; orderId: string; source?: string }
  | { type: "order.updated"; orderId: string; status?: string }
  | { type: "payment.updated"; orderId: string }
  | { type: "request.created"; requestId: string; tableName: string; kind: string }
  | { type: "request.resolved"; requestId: string }
  | { type: "menu.updated" };

const g = globalThis as unknown as { __posBus?: EventEmitter };
const bus = g.__posBus ?? new EventEmitter();
bus.setMaxListeners(1000);
g.__posBus = bus;

export function publish(channel: string, event: RealtimeEvent) {
  bus.emit(channel, event);
}

export function subscribe(channel: string, listener: (e: RealtimeEvent) => void) {
  bus.on(channel, listener);
  return () => {
    bus.off(channel, listener);
  };
}

export const channels = {
  outlet: (outletId: string) => `outlet:${outletId}`,
  order: (orderId: string) => `order:${orderId}`,
};

/** Buat Response SSE dari daftar channel */
export function sseResponse(request: Request, channelList: string[]) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown, event?: string) => {
        try {
          controller.enqueue(
            encoder.encode(`${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          /* stream closed */
        }
      };
      send({ type: "ready" });
      const unsubs = channelList.map((ch) => subscribe(ch, (e) => send(e)));
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* ignore */
        }
      }, 20000);
      cleanup = () => {
        clearInterval(ping);
        unsubs.forEach((u) => u());
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
