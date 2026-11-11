"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { Dialog as D } from "radix-ui";
import { CornerDownLeft, LogOut, Plus, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import { signOut } from "./sidebar";

type Cmd = { id: string; label: string; group: string; icon: LucideIcon; keywords?: string; run: () => void };

/** Palet perintah (Ctrl/⌘ + K) untuk lompat ke halaman atau aksi cepat */
export function CommandPalette({ role, open, onOpenChange }: { role: Role; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const commands = useMemo<Cmd[]>(() => {
    const go = (href: string) => () => router.push(href);
    const pages: Cmd[] = NAV.filter((n) => n.roles.includes(role)).map((n) => ({
      id: n.href,
      label: n.label,
      group: "Halaman",
      icon: n.icon,
      run: go(n.href),
    }));
    const actions: Cmd[] = [];
    if (role === "OWNER") {
      actions.push({ id: "new-menu", label: "Tambah menu baru", group: "Aksi cepat", icon: Plus, keywords: "produk item", run: go("/dashboard/menu/new") });
    }
    actions.push({ id: "logout", label: "Keluar", group: "Akun", icon: LogOut, keywords: "logout sign out", run: signOut });
    return [...pages, ...actions];
  }, [role, router]);

  const list = commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const groups = [...new Set(list.map((c) => c.group))];

  const select = (c: Cmd | undefined) => {
    if (!c) return;
    onOpenChange(false);
    c.run();
  };

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade-in" />
        <D.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border bg-popover shadow-2xl animate-scale-in"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIdx((i) => Math.min(i + 1, list.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              select(list[idx]);
            }
          }}
        >
          <D.Title className="sr-only">Cari halaman atau aksi</D.Title>
          <D.Description className="sr-only">Ketik untuk mencari, panah atas/bawah untuk memilih, Enter untuk membuka.</D.Description>
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari halaman atau aksi…"
              className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
            <kbd className="rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">ESC</kbd>
          </div>
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
            {list.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Tidak ada yang cocok dengan “{q}”</p>}
            {groups.map((g) => (
              <div key={g} className="pb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{g}</p>
                {list.map((c, i) =>
                  c.group !== g ? null : (
                    <button
                      key={c.id}
                      data-idx={i}
                      type="button"
                      onMouseMove={() => setIdx(i)}
                      onClick={() => select(c)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                        i === idx ? "bg-primary/10 text-foreground" : "text-foreground/80"
                      )}
                    >
                      <span className={cn("grid size-8 place-items-center rounded-lg border bg-card transition-colors", i === idx && "border-primary/30 text-primary")}>
                        <c.icon className="size-4" />
                      </span>
                      <span className="flex-1 font-medium">{c.label}</span>
                      {i === idx && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 border-t bg-muted/40 px-4 py-2.5 text-[11px] text-muted-foreground">
            <span><kbd className="font-sans font-semibold">↑ ↓</kbd> pilih</span>
            <span><kbd className="font-sans font-semibold">Enter</kbd> buka</span>
            <span className="ml-auto">Santap POS</span>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
