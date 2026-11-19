"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, Search, ShoppingBag, UserCheck, UserRound, Users, Wallet, type LucideIcon } from "lucide-react";
import { cn, formatNumber, formatRupiah } from "@/lib/utils";
import type { CustomerKind, CustomerRow } from "@/server/customers";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CustomerAvatar, fmtAgo, fmtDate } from "./shared";

type Sort = "recent" | "spent" | "orders" | "name" | "new";
const SORTS: { v: Sort; label: string }[] = [
  { v: "recent", label: "Terakhir pesan" },
  { v: "spent", label: "Total belanja terbesar" },
  { v: "orders", label: "Pesanan terbanyak" },
  { v: "new", label: "Paling baru bergabung" },
  { v: "name", label: "Nama (A–Z)" },
];
const KINDS: { v: "ALL" | CustomerKind; label: string }[] = [
  { v: "ALL", label: "Semua" },
  { v: "ACCOUNT", label: "Akun Google" },
  { v: "GUEST", label: "Tamu" },
];
const PAGE = 40;
const DAY = 86_400_000;

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

export function CustomerList({ customers, now }: { customers: CustomerRow[]; now: number }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"ALL" | CustomerKind>("ALL");
  const [sort, setSort] = useState<Sort>("recent");
  const [limit, setLimit] = useState(PAGE);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    const out = customers.filter((c) => {
      if (kind !== "ALL" && c.kind !== kind) return false;
      if (!needle) return true;
      if (`${c.name} ${c.email ?? ""}`.toLowerCase().includes(needle)) return true;
      return digits.length >= 3 && !!c.phone && c.phone.replace(/\D/g, "").includes(digits.replace(/^62/, "0").replace(/^0/, ""));
    });
    const by: Record<Sort, (a: CustomerRow, b: CustomerRow) => number> = {
      recent: (a, b) => time(b.lastOrderAt) - time(a.lastOrderAt) || time(b.joinedAt) - time(a.joinedAt),
      spent: (a, b) => b.totalSpent - a.totalSpent || b.orderCount - a.orderCount,
      orders: (a, b) => b.orderCount - a.orderCount || b.totalSpent - a.totalSpent,
      new: (a, b) => time(b.joinedAt) - time(a.joinedAt),
      name: (a, b) => a.name.localeCompare(b.name, "id"),
    };
    return out.sort(by[sort]);
  }, [customers, q, kind, sort]);

  const accounts = customers.filter((c) => c.kind === "ACCOUNT").length;
  const active30 = customers.filter((c) => c.lastOrderAt && now - time(c.lastOrderAt) <= 30 * DAY).length;
  const spent = customers.reduce((s, c) => s + c.totalSpent, 0);
  const buyers = customers.filter((c) => c.orderCount > 0).length;
  const stats: { label: string; value: string; hint: string; icon: LucideIcon }[] = [
    { label: "Total pelanggan", value: formatNumber(customers.length), hint: `${formatNumber(buyers)} sudah pernah pesan`, icon: Users },
    { label: "Akun Google", value: formatNumber(accounts), hint: `${formatNumber(customers.length - accounts)} tamu dengan nomor WA`, icon: UserCheck },
    { label: "Aktif 30 hari", value: formatNumber(active30), hint: "Pesan dalam 30 hari terakhir", icon: ShoppingBag },
    { label: "Total belanja", value: formatRupiah(spent), hint: buyers ? `Rata-rata ${formatRupiah(Math.round(spent / buyers))}/pelanggan` : "Belum ada transaksi", icon: Wallet },
  ];

  const exportCsv = () => {
    const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Nama", "Jenis", "Email", "No. WhatsApp", "Jumlah pesanan", "Total belanja", "Terakhir pesan", "Bergabung"];
    const rows = list.map((c) => [c.name, c.kind === "ACCOUNT" ? "Akun Google" : "Tamu", c.email, c.phone, c.orderCount, c.totalSpent, fmtDate(c.lastOrderAt, true), fmtDate(c.joinedAt)]);
    const csv = "﻿" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `pelanggan-${new Date(now).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const shown = list.slice(0, limit);
  const reset = () => { setQ(""); setKind("ALL"); };

  return (
    <div className="space-y-5">
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-xs sm:p-4">
            <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:grid">
              <s.icon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold leading-tight tabular sm:truncate sm:text-xl" title={s.value}>{s.value}</p>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block" title={s.hint}>{s.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
                placeholder="Cari nama, email, atau nomor WA"
                className="h-9 pl-9"
                aria-label="Cari pelanggan"
              />
            </div>
            <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1">
              {KINDS.map((k) => {
                const n = k.v === "ALL" ? customers.length : customers.filter((c) => c.kind === k.v).length;
                return (
                  <button
                    key={k.v}
                    type="button"
                    onClick={() => { setKind(k.v); setLimit(PAGE); }}
                    className={cn(
                      "flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition",
                      kind === k.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {k.label}
                    <span className={cn("rounded-full px-1.5 text-[10px] tabular", kind === k.v ? "bg-primary/12 text-primary" : "bg-background/70")}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 min-w-0 flex-1 lg:w-52 lg:flex-none" aria-label="Urutkan">
              {SORTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </NativeSelect>
            <Button variant="outline" size="sm" className="h-9 shrink-0 rounded-xl" onClick={exportCsv} disabled={list.length === 0} title="Unduh daftar (CSV, bisa dibuka di Excel)">
              <Download /> <span className="hidden sm:inline">Unduh CSV</span>
            </Button>
          </div>
        </div>

        {list.length === 0 ? (
          customers.length === 0 ? (
            <EmptyState
              icon={<UserRound />}
              title="Belum ada pelanggan"
              description="Pelanggan muncul di sini setelah masuk dengan Google di halaman Akun, atau memesan dengan mengisi nomor WhatsApp."
              className="m-4 border-0"
            />
          ) : (
            <EmptyState
              icon={<Search />}
              title="Tidak ada pelanggan yang cocok"
              description="Coba kata kunci lain atau ubah filter."
              className="m-4 border-0"
              action={<Button variant="outline" size="sm" onClick={reset}>Reset pencarian</Button>}
            />
          )
        ) : (
          <>
            {/* HP: kartu */}
            <ul className="stagger divide-y md:hidden">
              {shown.map((c) => (
                <li key={c.key}>
                  <Link href={`/dashboard/customers/${encodeURIComponent(c.key)}`} className="flex items-center gap-3 p-3.5 transition active:bg-muted/60">
                    <CustomerAvatar name={c.name} image={c.image} guest={c.kind === "GUEST"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold">{c.name}</p>
                        {c.kind === "GUEST" && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Tamu</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{c.email ?? c.phone ?? "—"}</p>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
                        <span className="font-semibold tabular">{formatRupiah(c.totalSpent)}</span>
                        <span className="text-muted-foreground">{c.orderCount} pesanan</span>
                        <span className="text-muted-foreground">{fmtAgo(c.lastOrderAt, now)}</span>
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>

            {/* Tablet & desktop: tabel */}
            <Table wrapperClassName="hidden md:block">
              <THead className="bg-muted/40">
                <tr>
                  <TH>Pelanggan</TH>
                  <TH className="hidden xl:table-cell">No. WhatsApp</TH>
                  <TH className="text-right">Pesanan</TH>
                  <TH className="text-right">Total belanja</TH>
                  <TH>Terakhir pesan</TH>
                  <TH className="hidden lg:table-cell">Bergabung</TH>
                  <TH className="w-10" />
                </tr>
              </THead>
              <TBody className="stagger">
                {shown.map((c) => {
                  const href = `/dashboard/customers/${encodeURIComponent(c.key)}`;
                  return (
                    <TR key={c.key} className={cn("group relative cursor-pointer", !c.isActive && "opacity-60")}>
                      <TD className="max-w-0 w-[38%]">
                        <Link href={href} className="flex items-center gap-3 after:absolute after:inset-0">
                          <CustomerAvatar name={c.name} image={c.image} guest={c.kind === "GUEST"} className="size-9" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-medium">
                              <span className="truncate">{c.name}</span>
                              {c.kind === "GUEST" && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Tamu</Badge>}
                              {!c.isActive && <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">Nonaktif</Badge>}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{c.email ?? c.phone ?? "—"}</p>
                          </div>
                        </Link>
                      </TD>
                      <TD className="hidden whitespace-nowrap text-muted-foreground tabular xl:table-cell">{c.phone ?? "—"}</TD>
                      <TD className="text-right font-medium tabular">{c.orderCount}</TD>
                      <TD className="whitespace-nowrap text-right font-semibold tabular">{formatRupiah(c.totalSpent)}</TD>
                      <TD className="whitespace-nowrap">
                        <p className="text-sm">{fmtAgo(c.lastOrderAt, now)}</p>
                        {c.lastOrderAt && <p className="text-[11px] text-muted-foreground">{fmtDate(c.lastOrderAt)}</p>}
                      </TD>
                      <TD className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">{fmtDate(c.joinedAt)}</TD>
                      <TD className="text-right">
                        <ChevronRight className="ml-auto size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>

            <div className="flex flex-col items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row">
              <span>Menampilkan {formatNumber(shown.length)} dari {formatNumber(list.length)} pelanggan</span>
              {shown.length < list.length && (
                <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>Tampilkan lebih banyak</Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
