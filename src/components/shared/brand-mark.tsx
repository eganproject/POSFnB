import { cn } from "@/lib/utils";

/**
 * Tanda brand Aprez Locale: mangkuk dengan sepasang sumpit yang bersilang membentuk huruf "A".
 * Tanda sementara buatan kami, bukan logo resmi; ganti bila logo asli sudah ada.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={cn("size-8", className)}>
      <path d="M17.5 30 27 5.5M30.5 30 21 5.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M20.2 21.5h7.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M5 27.5h38a19 15 0 0 1-38 0Z" fill="currentColor" />
      <path d="M16 42.5h16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
