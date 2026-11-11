import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "primary";
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 shadow-xs transition duration-300 hover:-translate-y-0.5 hover:shadow-md",
        tone === "primary" ? "border-transparent bg-gradient-to-br from-primary to-[oklch(0.72_0.17_60)] text-white" : "bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-sm font-medium", tone === "primary" ? "text-white/80" : "text-muted-foreground")}>{label}</p>
        {icon && (
          <span className={cn("grid size-9 place-items-center rounded-xl [&_svg]:size-[18px]", tone === "primary" ? "bg-white/20" : "bg-primary/10 text-primary")}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular">{value}</p>
      {hint && <p className={cn("mt-1 text-xs", tone === "primary" ? "text-white/75" : "text-muted-foreground")}>{hint}</p>}
    </div>
  );
}

export function BarList({ items, format }: { items: { name: string; value: number; sub?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i, idx) => (
        <li key={i.name} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-4 text-xs font-bold text-muted-foreground tabular">{idx + 1}</span>
              <span className="truncate font-medium">{i.name}</span>
            </span>
            <span className="shrink-0 tabular text-muted-foreground">
              {format ? format(i.value) : i.value}
              {i.sub && <span className="ml-1.5 text-xs">{i.sub}</span>}
            </span>
          </div>
          <div className="ml-6 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full origin-left rounded-full bg-gradient-to-r from-primary to-amber-500 animate-[grow-x_0.7s_cubic-bezier(0.2,0.8,0.3,1)_backwards]" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
