import { cn } from "@/lib/utils";

/** Tanda brand: matahari terbit di atas garis meja (bukan logo resmi cafe). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={cn("size-8", className)}>
      <path d="M6 33a18 18 0 0 1 36 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M14 33a10 10 0 0 1 20 0z" fill="currentColor" />
      <path d="M4 38h40" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
