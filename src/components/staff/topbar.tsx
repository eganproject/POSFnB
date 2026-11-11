"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Dialog as D } from "radix-ui";
import { Bell, BellOff, ChevronRight, Menu, MonitorSmartphone, PanelLeftClose, PanelLeftOpen, Receipt, Search, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/misc";
import { SidebarBody, type ShellProps } from "./sidebar";
import { currentPage } from "./nav";
import { Clock } from "./clock";
import { clearAlerts, markAllRead, useAlerts, type StaffAlert } from "./alerts-store";

const ALERT_ICON = { bill: Receipt, waiter: Bell, order: Smartphone } satisfies Record<StaffAlert["kind"], unknown>;

function Notifications() {
  const alerts = useAlerts();
  const unread = alerts.filter((a) => !a.read).length;
  return (
    <Popover onOpenChange={(o) => !o && markAllRead()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-xl" aria-label={`Notifikasi${unread ? ` (${unread} baru)` : ""}`}>
          <Bell className={cn("size-[18px]", unread > 0 && "animate-wiggle")} />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifikasi</p>
          {alerts.length > 0 && (
            <button onClick={clearAlerts} className="text-xs font-medium text-muted-foreground transition hover:text-foreground">
              Bersihkan
            </button>
          )}
        </div>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
            <span className="grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <BellOff className="size-5" />
            </span>
            <p className="text-sm font-medium">Belum ada notifikasi</p>
            <p className="text-xs text-muted-foreground">Panggilan meja, minta bill, dan pesanan QR baru akan muncul di sini.</p>
          </div>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {alerts.map((a) => {
              const Icon = ALERT_ICON[a.kind];
              return (
                <li key={a.id} className={cn("flex items-start gap-3 px-4 py-3 animate-fade-up", !a.read && "bg-primary/[0.04]")}>
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", a.kind === "order" ? "bg-info/10 text-info" : "bg-primary/10 text-primary")}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(a.at, { addSuffix: true, locale: localeId })}</p>
                  </div>
                  {!a.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t px-4 py-2.5">
          <Link href="/dashboard/orders" className="text-xs font-semibold text-primary hover:underline">
            Buka papan pesanan →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Topbar({
  collapsed,
  onToggleCollapse,
  onOpenSearch,
  ...props
}: ShellProps & { collapsed: boolean; onToggleCollapse: () => void; onOpenSearch: () => void }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const page = currentPage(pathname);
  const canPos = ["OWNER", "KASIR", "PELAYAN"].includes(props.user.role);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-2 px-4 sm:px-6 lg:px-8">
        {/* Mobile: buka sidebar sebagai drawer */}
        <D.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <D.Trigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2 rounded-xl lg:hidden" aria-label="Buka menu">
              <Menu className="size-5" />
            </Button>
          </D.Trigger>
          <D.Portal>
            <D.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] animate-fade-in" />
            <D.Content className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar text-sidebar-foreground shadow-2xl animate-slide-in-left">
              <D.Title className="sr-only">Navigasi</D.Title>
              <SidebarBody {...props} onNavigate={() => setMobileOpen(false)} />
            </D.Content>
          </D.Portal>
        </D.Root>

        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 hidden rounded-xl text-muted-foreground lg:inline-flex"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
          title={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
        </Button>
        <span className="mx-1 hidden h-5 w-px bg-border lg:block" />

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          <span className="hidden text-muted-foreground sm:inline">{page.section}</span>
          <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground/60 sm:block" />
          {page.sub && page.href ? (
            <>
              <Link href={page.href} className="truncate text-muted-foreground transition hover:text-foreground">{page.title}</Link>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
              <span className="truncate font-semibold">{page.sub}</span>
            </>
          ) : (
            <span key={pathname} className="flex items-center gap-2 truncate font-semibold animate-fade-in">
              <page.icon className="size-4 text-primary" />
              {page.title}
            </span>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSearch}
            className="group hidden h-9 w-56 items-center gap-2 rounded-xl border bg-card/80 px-3 text-sm text-muted-foreground shadow-xs transition hover:border-foreground/15 hover:text-foreground md:flex"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Cari halaman…</span>
            <kbd className="rounded-md border bg-muted px-1.5 text-[10px] font-semibold">Ctrl K</kbd>
          </button>
          <Button variant="ghost" size="icon" className="rounded-xl md:hidden" onClick={onOpenSearch} aria-label="Cari">
            <Search className="size-[18px]" />
          </Button>
          <Clock />
          {props.outlet && <Notifications />}
          {canPos && pathname !== "/pos" && (
            <Button asChild size="sm" className="ml-1 hidden h-9 rounded-xl px-3.5 sm:inline-flex">
              <Link href="/pos">
                <MonitorSmartphone /> Buka kasir
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
