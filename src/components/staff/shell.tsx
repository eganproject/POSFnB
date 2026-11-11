"use client";
import { useState } from "react";
import { Sidebar, type ShellProps } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { SIDEBAR_COOKIE } from "./nav";

/** Kerangka dashboard: sidebar (bisa diciutkan), top bar, dan palet perintah */
export function DashboardShell({ children, defaultCollapsed, ...props }: ShellProps & { children: React.ReactNode; defaultCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [search, setSearch] = useState(false);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div className="flex min-h-dvh bg-muted/40" style={{ "--sidebar-w": collapsed ? "76px" : "16rem" } as React.CSSProperties}>
      <Sidebar {...props} collapsed={collapsed} />
      <div className="relative min-w-0 flex-1">
        {/* Cahaya lembut di atas konten agar latar tidak datar */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_20%_0%,color-mix(in_oklch,var(--primary)_7%,transparent),transparent)]" />
        <Topbar {...props} collapsed={collapsed} onToggleCollapse={toggle} onOpenSearch={() => setSearch(true)} />
        <main className="relative mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <CommandPalette role={props.user.role} open={search} onOpenChange={setSearch} />
    </div>
  );
}
