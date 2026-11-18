import { describe, expect, it } from "vitest";
import { canOrderAsap, formatClock, isValidPickup, pickupSlots } from "@/lib/pickup";

const TZ = "Asia/Jakarta";
const hours = { openTime: "08:00", closeTime: "22:00", leadMinutes: 15 };
// 2026-11-18 10:07 WIB = 03:07 UTC
const at = (hhmmWib: string, day = 18) => {
  const [h, m] = hhmmWib.split(":").map(Number);
  return new Date(Date.UTC(2026, 10, day, h - 7, m));
};

describe("jam ambil takeaway", () => {
  it("slot dimulai dari kelipatan 15 menit setelah waktu siap", () => {
    const slots = pickupSlots(at("10:07"), hours, TZ);
    expect(formatClock(slots[0], TZ)).toBe("10:30");
    expect(formatClock(slots.at(-1)!, TZ)).toBe("22:00");
  });
  it("sebelum buka, slot pertama = jam buka", () => {
    const slots = pickupSlots(at("06:00"), hours, TZ);
    expect(formatClock(slots[0], TZ)).toBe("08:00");
    expect(canOrderAsap(at("06:00"), hours, TZ)).toBe(false);
  });
  it("menjelang tutup tidak bisa pesan secepatnya", () => {
    expect(canOrderAsap(at("21:50"), hours, TZ)).toBe(false);
    expect(canOrderAsap(at("21:40"), hours, TZ)).toBe(true);
    expect(pickupSlots(at("21:50"), hours, TZ)).toHaveLength(0);
  });
  it("jam tutup lewat tengah malam", () => {
    const late = { openTime: "16:00", closeTime: "02:00", leadMinutes: 15 };
    expect(canOrderAsap(at("00:30", 19), late, TZ)).toBe(true);
    expect(canOrderAsap(at("03:00", 19), late, TZ)).toBe(false);
    expect(formatClock(pickupSlots(at("23:50"), late, TZ)[0], TZ)).toBe("00:15");
  });
  it("validasi jam ambil di server", () => {
    const now = at("10:07");
    expect(isValidPickup(at("10:30"), now, hours, TZ)).toBe(true);
    expect(isValidPickup(at("10:10"), now, hours, TZ)).toBe(false);
    expect(isValidPickup(at("23:00"), now, hours, TZ)).toBe(false);
    expect(isValidPickup(new Date("x"), now, hours, TZ)).toBe(false);
  });
});
