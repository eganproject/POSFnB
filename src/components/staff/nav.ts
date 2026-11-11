import type { Role } from "@prisma/client";
import {
  BarChart3, ChefHat, ClipboardList, LayoutDashboard, PackageX, QrCode, Store, UtensilsCrossed, Users, Wallet, MonitorSmartphone,
} from "lucide-react";

export const SIDEBAR_COOKIE = "sidebar_collapsed";

export const NAV = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard, roles: ["OWNER"] as Role[] },
  { href: "/dashboard/orders", label: "Pesanan", icon: ClipboardList, roles: ["OWNER", "KASIR", "PELAYAN"] as Role[] },
  { href: "/pos", label: "Kasir (POS)", icon: MonitorSmartphone, roles: ["OWNER", "KASIR", "PELAYAN"] as Role[] },
  { href: "/kitchen", label: "Layar dapur", icon: ChefHat, roles: ["OWNER", "KASIR", "DAPUR"] as Role[] },
  { href: "/dashboard/stock", label: "Stok menu", icon: PackageX, roles: ["OWNER", "KASIR", "DAPUR", "PELAYAN"] as Role[] },
  { href: "/dashboard/shifts", label: "Shift kasir", icon: Wallet, roles: ["OWNER", "KASIR"] as Role[] },
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed, roles: ["OWNER"] as Role[], group: "Kelola" },
  { href: "/dashboard/tables", label: "Meja & QR", icon: QrCode, roles: ["OWNER", "KASIR", "PELAYAN"] as Role[], group: "Kelola" },
  { href: "/dashboard/reports", label: "Laporan", icon: BarChart3, roles: ["OWNER"] as Role[], group: "Kelola" },
  { href: "/dashboard/outlets", label: "Outlet", icon: Store, roles: ["OWNER"] as Role[], group: "Kelola" },
  { href: "/dashboard/users", label: "Pengguna", icon: Users, roles: ["OWNER"] as Role[], group: "Kelola" },
];

export function isNavActive(href: string, pathname: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

/** Judul halaman untuk top bar, termasuk sub-halaman (mis. /dashboard/menu/new) */
export function currentPage(pathname: string) {
  const item = [...NAV].sort((a, b) => b.href.length - a.href.length).find((n) => isNavActive(n.href, pathname));
  if (!item) return { section: "Dashboard", title: "Dashboard", icon: LayoutDashboard, sub: null as string | null };
  const rest = pathname.slice(item.href.length).replace(/^\//, "");
  const sub = rest ? (rest === "new" ? "Tambah baru" : "Ubah") : null;
  return { section: item.group ?? "Operasional", title: item.label, icon: item.icon, sub, href: item.href };
}
