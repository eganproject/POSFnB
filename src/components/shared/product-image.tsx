"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Latar ilustrasi saat produk belum punya foto: tetap di keluarga warna brand. */
const GRADIENTS = [
  "from-cream to-[oklch(0.88_0.05_95)]",
  "from-[oklch(0.9_0.035_113)] to-cream",
  "from-[oklch(0.92_0.05_80)] to-[oklch(0.95_0.03_95)]",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Foto produk dengan fallback ilustrasi gradien + emoji kategori */
export function ProductImage({
  src,
  name,
  emoji,
  className,
  emojiClassName,
  imgClassName,
}: {
  src?: string | null;
  name: string;
  emoji?: string | null;
  className?: string;
  emojiClassName?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br",
        GRADIENTS[hash(name) % GRADIENTS.length],
        className
      )}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn("absolute inset-0 size-full object-cover", imgClassName)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span className={cn("text-3xl opacity-80 saturate-[0.7]", emojiClassName)} aria-hidden>
            {emoji || "🍽️"}
          </span>
        </div>
      )}
    </div>
  );
}
