"use client";
import { toast } from "sonner";
import { useRealtime, type RealtimeMessage } from "@/hooks/use-realtime";

let audioCtx: AudioContext | null = null;
/** Bunyi notifikasi singkat tanpa file audio */
export function chime(times = 2) {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = i % 2 ? 1320 : 880;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.17);
    }
  } catch {
    /* browser memblokir audio sebelum interaksi */
  }
}

/** Notifikasi global staf: pesanan baru & panggilan meja */
export function LiveAlerts({ notifyOrders = true }: { notifyOrders?: boolean }) {
  useRealtime(
    "/api/stream/outlet",
    (msg: RealtimeMessage) => {
      if (msg.type === "request.created") {
        chime(3);
        toast.warning(
          msg.kind === "REQUEST_BILL" ? `🧾 ${msg.tableName} minta bill` : `🛎️ ${msg.tableName} memanggil pelayan`,
          { duration: 10000 }
        );
      } else if (msg.type === "order.created" && notifyOrders && msg.source === "QR") {
        chime(2);
        toast.info("📱 Pesanan QR baru masuk", { duration: 5000 });
      }
    }
  );
  return null;
}
