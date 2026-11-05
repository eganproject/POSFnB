"use client";
import { useRouter } from "next/navigation";
import { cn, shiftDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function RangePicker({ from, to, today }: { from: string; to: string; today: string }) {
  const router = useRouter();
  const go = (f: string, t: string) => router.push(`/dashboard/reports?from=${f}&to=${t}`);
  const monthStart = `${today.slice(0, 8)}01`;
  const presets = [
    { label: "Hari ini", f: today, t: today },
    { label: "7 hari", f: shiftDate(today, -6), t: today },
    { label: "30 hari", f: shiftDate(today, -29), t: today },
    { label: "Bulan ini", f: monthStart, t: today },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl bg-muted p-1">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => go(p.f, p.t)}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", from === p.f && to === p.t ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Input type="date" value={from} max={to} onChange={(e) => e.target.value && go(e.target.value, to)} className="w-[9.5rem]" />
        <span className="text-muted-foreground">–</span>
        <Input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && go(from, e.target.value)} className="w-[9.5rem]" />
      </div>
    </div>
  );
}
