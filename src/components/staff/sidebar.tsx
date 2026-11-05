"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { Check, ChevronsUpDown, LogOut, Menu, Store } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/constants";
import { authClient } from "@/lib/auth-client";
import { NAV } from "./nav";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/misc";
import { switchOutlet } from "@/server/actions/session";

type Props = {
  user: { name: string; email: string; role: Role };
  outlet: { id: string; name: string } | null;
  outlets: { id: string; name: string }[];
};

export function signOut() {
  authClient.signOut().finally(() => (window.location.href = "/login"));
}

function OutletSwitcher({ outlet, outlets, canSwitch }: { outlet: Props["outlet"]; outlets: Props["outlets"]; canSwitch: boolean }) {
  const [pending, start] = useTransition();
  const content = (
    <div className={cn("flex w-full items-center gap-2.5 rounded-xl bg-white/5 p-2.5 text-left transition", canSwitch && "hover:bg-white/10", pending && "opacity-60")}>
      <span className="grid size-9 place-items-center rounded-lg bg-primary/20 text-primary">
        <Store className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-sidebar-foreground/50">Outlet aktif</span>
        <span className="block truncate text-sm font-semibold">{outlet?.name ?? "Belum ada outlet"}</span>
      </span>
      {canSwitch && <ChevronsUpDown className="size-4 text-sidebar-foreground/50" />}
    </div>
  );
  if (!canSwitch) return content;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full outline-none">{content}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
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

function SidebarBody({ user, outlet, outlets, onNavigate }: Props & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.roles.includes(user.role));
  const main = items.filter((i) => !i.group);
  const manage = items.filter((i) => i.group);
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  const renderItem = (n: (typeof NAV)[number]) => (
    <Link
      key={n.href}
      href={n.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        isActive(n.href) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground"
      )}
    >
      <n.icon className="size-[18px]" />
      {n.label}
    </Link>
  );

  return (
    <div className="flex h-full flex-col gap-5 p-4">
      <Link href="/" className="flex items-center gap-2.5 px-1 text-lg font-bold">
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-lg">🍽️</span> Santap POS
      </Link>
      <OutletSwitcher outlet={outlet} outlets={outlets} canSwitch={user.role === "OWNER" && outlets.length > 1} />
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {main.map(renderItem)}
        {manage.length > 0 && (
          <>
            <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Kelola</p>
            {manage.map(renderItem)}
          </>
        )}
      </nav>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-3 rounded-xl p-2 text-left outline-none transition hover:bg-white/5">
          <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-primary to-amber-500 text-sm font-bold text-white">
            {initials(user.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{user.name}</span>
            <span className="block text-xs text-sidebar-foreground/50">{ROLE_LABEL[user.role]}</span>
          </span>
          <ChevronsUpDown className="size-4 text-sidebar-foreground/40" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={signOut} className="text-destructive">
            <LogOut className="!text-destructive" /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function Sidebar(props: Props) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 bg-sidebar text-sidebar-foreground lg:block">
      <SidebarBody {...props} />
    </aside>
  );
}

export function MobileTopbar(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-40 flex items-center gap-3 border-b bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Trigger className="rounded-lg p-2 hover:bg-muted" aria-label="Menu">
          <Menu className="size-5" />
        </D.Trigger>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <D.Content className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar text-sidebar-foreground shadow-2xl animate-[fade-up_0.2s_ease-out]">
            <D.Title className="sr-only">Navigasi</D.Title>
            <SidebarBody {...props} onNavigate={() => setOpen(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>
      <span className="font-bold">Santap POS</span>
      <span className="ml-auto truncate text-sm text-muted-foreground">{props.outlet?.name}</span>
    </div>
  );
}
