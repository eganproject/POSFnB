import { cn } from "@/lib/utils";

/**
 * Tanda brand Aprez Locale: huruf "A" runcing dengan sehelai daun di dalamnya.
 * Digambar ulang dari logo kecil di profil Instagram/Grab; ganti dengan file asli bila sudah ada.
 * `leaf` = warna daun (bawaan mengikuti warna teks).
 */
export function BrandMark({ className, leaf }: { className?: string; leaf?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={cn("size-8", className)}>
      <path d="M9.5 43 22.6 7.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22.6 5.5c1.2-1.9 3.2-1.9 4 .2L40 43h-6.6L24.6 14.5c-.6-2.6-1.2-5.6-2-9Z" fill="currentColor" />
      <path d="M17.5 41.5c-.8-8 3-13.800 10.200-16.300 1.300 7.800-2.400 13.800-10.200 16.300Z" fill={leaf ?? "currentColor"} opacity={leaf ? 1 : 0.7} />
      <path d="M18.200 40.500c2.200-5.400 5.200-9.800 9-13.600" stroke="#fff" strokeOpacity=".55" strokeWidth=".9" strokeLinecap="round" />
    </svg>
  );
}
