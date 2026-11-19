"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Camera, Clock, History, LogOut, MapPin, Receipt, ShoppingBag, Star, Phone } from "lucide-react";
import { BRAND, BRAND_PHOTOS } from "@/lib/brand";
import { isOpenNow } from "@/lib/pickup";
import { cn, initials } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { GoogleSignIn } from "./google-sign-in";
import type { MenuCustomer, MenuOutlet } from "./menu-app";

/** "07:30" → "07.30" (format jam Indonesia) */
export const clock = (hhmm: string) => hhmm.replace(":", ".");

/** Status buka/tutup outlet, dihitung di client dan diperbarui tiap menit */
export function useOpenStatus(outlet: MenuOutlet) {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => setOpen(isOpenNow(new Date(), outlet, outlet.timeZone));
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [outlet]);
  return open;
}

export function CustomerAvatar({ customer, className }: { customer: MenuCustomer; className?: string }) {
  return customer.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={customer.image} alt="" referrerPolicy="no-referrer" className={cn("size-8 rounded-full object-cover", className)} />
  ) : (
    <span className={cn("grid size-8 place-items-center rounded-full bg-cream text-[11px] font-bold text-olive-deep", className)}>
      {initials(customer.name)}
    </span>
  );
}

function Row({
  icon: Icon,
  title,
  sub,
  href,
  external,
  onClick,
  trailing,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub?: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  trailing?: React.ReactNode;
  danger?: boolean;
}) {
  const inner = (
    <>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-olive-deep", danger && "bg-destructive/10 text-destructive")}>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[15px] font-semibold", danger && "text-destructive")}>{title}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
      {trailing}
      {!danger && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
    </>
  );
  const cls = "flex w-full min-h-14 items-center gap-3 rounded-2xl px-2 py-2 text-left transition active:bg-secondary hover:bg-secondary/60";
  if (href)
    return external ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** Lembar info kafe: foto, jam buka, lokasi, Instagram, ulasan */
export function InfoSheet({ open, onOpenChange, outlet }: { open: boolean; onOpenChange: (o: boolean) => void; outlet: MenuOutlet }) {
  const isOpen = useOpenStatus(outlet);
  const hours = `${clock(outlet.openTime)} – ${clock(outlet.closeTime)}`;
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="space-y-3 overflow-y-auto px-5 pb-safe pt-3">
          <div className="relative aspect-[16/7] overflow-hidden rounded-2xl bg-muted">
            <Image src={BRAND_PHOTOS.front} alt={`Suasana ${BRAND.name}`} fill sizes="(max-width: 640px) 100vw, 576px" className="object-cover" />
          </div>
          <div>
            <DrawerTitle className="font-display text-3xl leading-tight tracking-wide">{outlet.name}</DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground">{BRAND.description}</DrawerDescription>
          </div>
          <div className="-mx-2 space-y-0.5 pb-4">
            <Row
              icon={Clock}
              title={isOpen === null ? "Jam buka" : isOpen ? "Buka sekarang" : "Sedang tutup"}
              sub={`Setiap hari, ${hours}`}
              trailing={
                isOpen !== null && (
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", isOpen ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                    {isOpen ? "Buka" : "Tutup"}
                  </span>
                )
              }
              href={BRAND.links.maps}
              external
            />
            <Row icon={MapPin} title={BRAND.area} sub={outlet.address || BRAND.address} href={BRAND.links.maps} external />
            <Row icon={Phone} title={BRAND.phone} sub="WhatsApp & reservasi" href={BRAND.links.whatsapp} external />
            <Row icon={Camera} title={BRAND.links.instagramHandle} sub="Lihat di Instagram" href={BRAND.links.instagram} external />
            {BRAND.rating.count > 0 && (
              <Row icon={Star} title={`${BRAND.rating.score} dari ${BRAND.rating.count} ulasan`} sub="Ulasan Google" href={BRAND.links.maps} external />
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Lembar akun: profil/login, pesanan, riwayat, takeaway, info kafe, keluar */
export function AccountSheet({
  open,
  onOpenChange,
  outlet,
  customer,
  googleEnabled,
  isTable,
  pathname,
  ordersCount,
  activeCount,
  onOpenOrders,
  onOpenInfo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  outlet: MenuOutlet;
  customer: MenuCustomer | null;
  googleEnabled: boolean;
  isTable: boolean;
  pathname: string;
  ordersCount: number;
  activeCount: number;
  onOpenOrders: () => void;
  onOpenInfo: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const next = encodeURIComponent(pathname);
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="space-y-3 overflow-y-auto px-5 pb-safe pt-3">
          <DrawerTitle className="text-xl font-bold">{customer ? "Akun saya" : "Lainnya"}</DrawerTitle>
          <DrawerDescription className="sr-only">Akun, pesanan, takeaway, dan info kafe</DrawerDescription>
          {customer ? (
            <div className="flex items-center gap-3 rounded-2xl bg-secondary p-3">
              <CustomerAvatar customer={customer} className="size-11 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{customer.name}</p>
                <p className="text-xs text-muted-foreground">Masuk dengan Google</p>
              </div>
            </div>
          ) : (
            googleEnabled && (
              <div className="space-y-2.5 rounded-2xl bg-secondary p-3.5">
                <p className="text-sm text-muted-foreground">Masuk untuk menyimpan riwayat dan pesan lagi lebih cepat.</p>
                <GoogleSignIn next={pathname} />
              </div>
            )
          )}
          <div className="-mx-2 space-y-0.5 pb-4">
            {ordersCount > 0 && (
              <Row
                icon={Receipt}
                title="Pesanan saya"
                sub={activeCount ? `${activeCount} sedang berjalan` : "Pesanan dari perangkat ini"}
                onClick={onOpenOrders}
                trailing={activeCount > 0 && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">{activeCount}</span>}
              />
            )}
            {customer && <Row icon={History} title="Riwayat pesanan" sub="Pesan lagi dengan sekali ketuk" href={`/akun?next=${next}`} />}
            {isTable && outlet.takeawayEnabled && (
              <Row icon={ShoppingBag} title="Pesan takeaway" sub="Ambil sendiri, pilih jam ambil" href={`/m/${outlet.slug}`} />
            )}
            <Row icon={MapPin} title="Info kafe" sub={`Jam buka ${clock(outlet.openTime)} – ${clock(outlet.closeTime)}, lokasi, Instagram`} onClick={onOpenInfo} />
            {customer && (
              <Row
                icon={LogOut}
                title={leaving ? "Keluar…" : "Keluar"}
                danger
                onClick={async () => {
                  setLeaving(true);
                  await authClient.signOut();
                  window.location.reload();
                }}
              />
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
