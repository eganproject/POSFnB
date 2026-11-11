"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import type { Role } from "@prisma/client";
import { Check, ChevronsUpDown, LogOut, Store, UtensilsCrossed } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/constants";
import { authClient } from "@/lib/auth-client";
import { NAV, isNavActive } from "./nav";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/misc";
import { switchOutlet } from "@/server/actions/session";

export type ShellProps = {
  user: { name: string; email: string; role: Role };
  outlet: { id: string; name: string } | null;
  outlets: { id: string; name: string }[];
};

export function signOut() {
  authClient.signOut().finally(() => (window.location.href = "/login"));
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1 text-lg font-bold tracking-tight">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white shadow-lg shadow-primary/30">
        <UtensilsCrossed className="size-[18px]" />
      </span>
      <span className={cn("whitespace-nowrap transition-opacity duration-200", collapsed && "pointer-events-none opacity-0")}>Santap POS</span>
    </Link>
  );
}

function OutletSwitcher({ outlet, outlets, canSwitch, collapsed }: { outlet: ShellProps["outlet"]; outlets: ShellProps["outlets"]; canSwitch: boolean; collapsed?: boolean }) {
  const [pending, start] = useTransition();
  const content = (
    <div
      title={collapsed ? outlet?.name ?? "Belum ada outlet" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.04] p-2 text-left transition",
        canSwitch && "hover:border-white/10 hover:bg-white/[0.08]",
        pending && "opacity-60"
      )}
    >
      <span className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        <Store className="size-4" />
        {outlet && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-sidebar bg-success" />}
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-sidebar-foreground/50">Outlet aktif</span>
            <span className="block truncate text-sm font-semibold">{outlet?.name ?? "Belum ada outlet"}</span>
          </span>
          {canSwitch && <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/50" />}
        </>
      )}
    </div>
  );
  if (!canSwitch) return content;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/50">{content}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className="w-60">
        <DropdownMenuLabel>Pilih outlet</DropdownMenuLabel>
        {outlets.map((o) => (
          <DropdownMenuItem key={o.id} onSelect={() => start(() => switchOutlet(o.id))}>
            <Store /> <span className="flex-1">{o.name}</span>
            {o.id === outlet?.id && <Check className="!text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenu({ user, collapsed }: { user: ShellProps["user"]; collapsed?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={collapsed ? user.name : undefined}
        className="flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-amber-500 text-sm font-bold text-white ring-2 ring-white/10">
          {initials(user.name)}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{user.name}</span>
              <span className="block text-xs text-sidebar-foreground/50">{ROLE_LABEL[user.role]}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/40" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block text-sm font-semibold text-foreground">{user.name}</span>
          <span className="block truncate font-normal">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} className="text-destructive">
          <LogOut className="!text-destructive" /> Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SidebarBody({ user, outlet, outlets, onNavigate, collapsed }: ShellProps & { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.roles.includes(user.role));
  const main = items.filter((i) => !i.group);
  const manage = items.filter((i) => i.group);

  const renderItem = (n: (typeof NAV)[number]) => {
    const active = isNavActive(n.href, pathname);
    return (
      <Link
        key={n.href}
        href={n.href}
        onClick={onNavigate}
        title={collapsed ? n.label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
          collapsed && "justify-center px-0",
          active
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
            : "text-sidebar-foreground/65 hover:bg-white/[0.06] hover:text-sidebar-foreground"
        )}
      >
        <n.icon className={cn("size-[18px] shrink-0 transition-transform duration-200", !active && "group-hover:scale-110")} />
        {!collapsed && <span className="truncate">{n.label}</span>}
      </Link>
    );
  };

  const section = (label: string) =>
    collapsed ? (
      <div className="mx-auto my-3 h-px w-6 bg-white/10" />
    ) : (
      <p className="px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/35">{label}</p>
    );

  return (
    <div className={cn("flex h-full flex-col gap-4 p-4", collapsed && "px-3")}>
      <div className="flex h-10 items-center">
        <Logo collapsed={collapsed} />
      </div>
      <OutletSwitcher outlet={outlet} outlets={outlets} canSwitch={user.role === "OWNER" && outlets.length > 1} collapsed={collapsed} />
      <nav className="no-scrollbar -mx-1 flex-1 space-y-1 overflow-y-auto px-1">
        {!collapsed && <p className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/35">Operasional</p>}
        {main.map(renderItem)}
        {manage.length > 0 && (
          <>
            {section("Kelola")}
            {manage.map(renderItem)}
          </>
        )}
      </nav>
      <div className="border-t border-white/[0.06] pt-3">
        <UserMenu user={user} collapsed={collapsed} />
      </div>
    </div>
  );
}

export function Sidebar({ collapsed, ...props }: ShellProps & { collapsed: boolean }) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out lg:block",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <SidebarBody {...props} collapsed={collapsed} />
    </aside>
  );
}
