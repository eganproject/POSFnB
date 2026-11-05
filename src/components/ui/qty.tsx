"use client";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QtyStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  size = "md",
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const btn = size === "sm" ? "size-7" : size === "lg" ? "size-11" : "size-9";
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full border bg-card p-0.5", className)}>
      <button
        type="button"
        aria-label="Kurangi"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={cn(btn, "grid place-items-center rounded-full transition hover:bg-muted disabled:opacity-40")}
      >
        <Minus className="size-4" />
      </button>
      <span className={cn("min-w-6 text-center font-semibold tabular", size === "lg" && "text-lg")}>{value}</span>
      <button
        type="button"
        aria-label="Tambah"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={cn(btn, "grid place-items-center rounded-full bg-primary text-primary-foreground transition hover:brightness-105 disabled:opacity-40")}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
