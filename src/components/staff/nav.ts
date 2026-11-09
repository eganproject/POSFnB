import type { Role } from "@prisma/client";
import {
  BarChart3, ChefHat, ClipboardList, LayoutDashboard, PackageX, QrCode, Store, UtensilsCrossed, Users, Wallet, MonitorSmartphone, Undo2, History,
} from "lucide-react";

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
  { href: "/dashboard/refunds", label: "Refund", icon: Undo2, roles: ["OWNER"] as Role[], group: "Kelola" },
  { href: "/dashboard/activity", label: "Log aktivitas", icon: History, roles: ["OWNER"] as Role[], group: "Kelola" },
  { href: "/dashboard/outlets", label: "Outlet", icon: Store, roles: ["OWNER"] as Role[], group: "Kelola" },
  { href: "/dashboard/users", label: "Pengguna", icon: Users, roles: ["OWNER"] as Role[], group: "Kelola" },
];
