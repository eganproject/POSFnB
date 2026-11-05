"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-orange-200 via-amber-100 to-rose-100",
  "from-amber-200 via-yellow-100 to-orange-100",
  "from-rose-200 via-orange-100 to-amber-50",
  "from-emerald-200 via-lime-100 to-amber-50",
  "from-sky-200 via-cyan-100 to-emerald-50",
  "from-fuchsia-200 via-pink-100 to-orange-50",
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
}: {
  src?: string | null;
  name: string;
  emoji?: string | null;
  className?: string;
  emojiClassName?: string;
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
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span className={cn("text-4xl drop-shadow-sm", emojiClassName)} aria-hidden>
            {emoji || "🍽️"}
          </span>
        </div>
      )}
    </div>
  );
}
