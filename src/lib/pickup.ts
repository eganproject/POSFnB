/**
 * Slot jam ambil pesanan takeaway. Dipakai di client (pilihan jam) dan server (validasi),
 * jadi tidak boleh bergantung pada modul server.
 */

export type PickupHours = {
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm" (lebih kecil dari openTime = tutup lewat tengah malam)
  leadMinutes: number;
};

export const SLOT_STEP_MINUTES = 15;
const MIN = 60_000;

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Selisih (ms) zona waktu terhadap UTC pada saat tertentu, mis. WIB = +7 jam */
function tzOffsetMs(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Awal hari (00:00 waktu lokal) untuk tanggal lokal dari `at`, digeser `dayOffset` hari */
function localMidnight(at: Date, timeZone: string, dayOffset = 0) {
  const offset = tzOffsetMs(at, timeZone);
  const local = new Date(at.getTime() + offset);
  const midnightLocalAsUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset);
  return midnightLocalAsUtc - tzOffsetMs(new Date(midnightLocalAsUtc - offset), timeZone);
}

/** Jendela jam buka (ms epoch) yang relevan untuk saat ini: kemarin (bila lewat tengah malam), hari ini, besok */
function openWindows(now: Date, hours: PickupHours, timeZone: string) {
  const open = toMinutes(hours.openTime);
  let close = toMinutes(hours.closeTime);
  if (close <= open) close += 24 * 60;
  return [-1, 0].map((d) => {
    const base = localMidnight(now, timeZone, d);
    return { start: base + open * MIN, end: base + close * MIN };
  });
}

/** Apakah outlet sedang buka dan masih sempat menyiapkan pesanan "secepatnya" */
export function canOrderAsap(now: Date, hours: PickupHours, timeZone: string) {
  const t = now.getTime();
  return openWindows(now, hours, timeZone).some((w) => t >= w.start && t + hours.leadMinutes * MIN <= w.end);
}

/** Daftar jam ambil yang bisa dipilih (hari ini / sampai tutup), kelipatan 15 menit */
export function pickupSlots(now: Date, hours: PickupHours, timeZone: string, limit = 64) {
  const earliest = now.getTime() + hours.leadMinutes * MIN;
  const step = SLOT_STEP_MINUTES * MIN;
  const slots: number[] = [];
  for (const w of openWindows(now, hours, timeZone)) {
    let t = Math.max(w.start, Math.ceil(earliest / step) * step);
    // selaraskan ke kelipatan 15 menit sejak jam buka
    t = w.start + Math.ceil((t - w.start) / step) * step;
    for (; t <= w.end && slots.length < limit; t += step) slots.push(t);
  }
  return [...new Set(slots)].sort((a, b) => a - b).map((t) => new Date(t));
}

/** Validasi jam ambil dari client (toleransi 5 menit untuk jeda isi form) */
export function isValidPickup(pickupAt: Date, now: Date, hours: PickupHours, timeZone: string) {
  const t = pickupAt.getTime();
  if (Number.isNaN(t)) return false;
  if (t < now.getTime() + (hours.leadMinutes - 5) * MIN) return false;
  if (t > now.getTime() + 24 * 60 * MIN) return false;
  return openWindows(now, hours, timeZone).some((w) => t >= w.start && t <= w.end);
}

export function formatClock(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}
