"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatRupiah } from "@/lib/utils";

const compact = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : String(v);

function TooltipBox({ active, payload, label, labelFormat }: { active?: boolean; payload?: { value: number; dataKey: string; payload: Record<string, number> }[]; label?: string | number; labelFormat?: (l: string | number) => string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{labelFormat ? labelFormat(label!) : label}</p>
      <p className="tabular">Pendapatan: <b>{formatRupiah(p.revenue)}</b></p>
      <p className="tabular text-muted-foreground">{p.orders} pesanan</p>
    </div>
  );
}

export function RevenueChart({ data, height = 260 }: { data: { date: string; revenue: number; orders: number }[]; height?: number }) {
  const fmt = (d: string | number) => format(new Date(`${d}T00:00:00`), "EEE, d MMM", { locale: localeId });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} tickMargin={8} stroke="var(--muted-foreground)"
          tickFormatter={(d) => format(new Date(`${d}T00:00:00`), "d/M")} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} fontSize={11} width={44} stroke="var(--muted-foreground)" tickFormatter={compact} />
        <Tooltip content={<TooltipBox labelFormat={fmt} />} cursor={{ stroke: "var(--primary)", strokeDasharray: 4 }} />
        <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5} fill="url(#rev)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HourChart({ data }: { data: { hour: number; orders: number; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" tickFormatter={(h) => `${h}`} />
        <YAxis tickLine={false} axisLine={false} fontSize={11} width={30} stroke="var(--muted-foreground)" allowDecimals={false} />
        <Tooltip content={<TooltipBox labelFormat={(h) => `Jam ${h}:00`} />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="orders" fill="var(--primary)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
