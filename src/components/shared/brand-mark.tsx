import { cn } from "@/lib/utils";

/** Tanda brand Agreya: titik-titik yang saling terhubung membentuk huruf "Y" (digambar ulang dari logo). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden className={cn("size-8", className)}>
      <path d="M13 14.5c2.6 6.4 5.4 11.6 9.4 13.6 5.6-3 9.4-10.2 12.6-18.6" fill="none" stroke="currentColor" strokeWidth="5.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12.5" cy="14" r="5.4" />
      <circle cx="35.5" cy="9" r="6.2" />
      <circle cx="22.6" cy="28.6" r="5.6" />
      <circle cx="22.6" cy="41.6" r="4.6" />
    </svg>
  );
}
