import { cn, initials } from "@/lib/utils";

const TZ = "Asia/Jakarta";

export function fmtDate(iso: string | null, withTime = false) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(iso));
}

/** "Hari ini", "Kemarin", "5 hari lalu", "3 bln lalu". `now` dari server agar tidak beda saat hydrate. */
export function fmtAgo(iso: string | null, now: number) {
  if (!iso) return "Belum pernah";
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Hari ini";
  if (days === 1) return "Kemarin";
  if (days < 30) return `${days} hari lalu`;
  if (days < 365) return `${Math.floor(days / 30)} bln lalu`;
  return `${Math.floor(days / 365)} thn lalu`;
}

export function CustomerAvatar({ name, image, guest, className }: { name: string; image: string | null; guest?: boolean; className?: string }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" referrerPolicy="no-referrer" className={cn("size-10 shrink-0 rounded-full object-cover ring-2 ring-card", className)} />
    );
  }
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold ring-2 ring-card",
        guest ? "bg-muted text-muted-foreground" : "bg-olive text-white",
        className
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}

/** Tautan WhatsApp dari nomor 08xx */
export function waLink(phone: string) {
  const d = phone.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("0") ? "62" + d.slice(1) : d}`;
}
