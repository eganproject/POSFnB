import { cn } from "@/lib/utils";

/** Tanda brand: huruf "A" melengkung bergaris tengah, diambil dari gaya logo A·M·A·L·G·A·M. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={cn("size-8", className)}>
      <path d="M15 43V17a9 9 0 0 1 18 0v26" stroke="currentColor" strokeWidth="4.4" strokeLinecap="butt" />
      <path d="M19.5 29h9M4 29h6.5M37.5 29H44" stroke="currentColor" strokeWidth="3.4" />
    </svg>
  );
}
