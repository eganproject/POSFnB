"use client";
import { useEffect, useState } from "react";

const fmtTime = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });
const fmtDate = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "short" });

/** Jam kecil di top bar — dirender setelah mount agar tidak beda dengan HTML server */
export function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="h-9 w-36" />;
  return (
    <span className="hidden items-center gap-2 rounded-xl px-2 text-sm text-muted-foreground xl:flex">
      <span className="capitalize">{fmtDate.format(now)}</span>
      <span className="size-1 rounded-full bg-border" />
      <span className="font-semibold text-foreground tabular">{fmtTime.format(now).replace(".", ":")}</span>
    </span>
  );
}
