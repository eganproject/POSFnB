import { formatClock } from "./pickup";

/** "14:30" dalam zona waktu bisnis, atau null jika takeaway secepatnya */
export function pickupLabel(pickupAt: Date | null | undefined) {
  return pickupAt ? formatClock(pickupAt, process.env.APP_TIMEZONE || "Asia/Jakarta") : null;
}
