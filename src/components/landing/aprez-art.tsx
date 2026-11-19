/**
 * Ilustrasi kecil pendamping foto di landing Aprez Locale: daun monstera (tanaman yang ada di ruang makannya),
 * stempel melingkar, dan denah meja ruang semi-VIP. Semuanya SVG, mengikuti warna teks (currentColor).
 */

/** Daun monstera dengan belahan khasnya. `id` harus unik per halaman (dipakai mask). */
export function Monstera({ id, className }: { id: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 224" className={className} aria-hidden>
      <mask id={id}>
        <path fill="#fff" d="M100 34C62-2 4 34 10 104c5 58 58 98 90 112 32-14 85-54 90-112 6-70-52-106-90-70Z" />
        <g fill="#000">
          <path d="M-6 62 74 84-6 80ZM-6 104l78 8-78 12ZM0 150l76-18-62 40ZM206 62l-80 22 80-4ZM206 104l-78 8 78 12ZM200 150l-76-18 62 40ZM40 204l44-48-18 60ZM160 204l-44-48 18 60Z" />
          <ellipse cx="80" cy="64" rx="7" ry="4" transform="rotate(24 80 64)" />
          <ellipse cx="121" cy="66" rx="7" ry="4" transform="rotate(-24 121 66)" />
          <ellipse cx="84" cy="126" rx="6" ry="3.500" transform="rotate(-14 84 126)" />
          <ellipse cx="117" cy="128" rx="6" ry="3.500" transform="rotate(14 117 128)" />
        </g>
      </mask>
      <g mask={`url(#${id})`}>
        <path fill="currentColor" d="M100 34C62-2 4 34 10 104c5 58 58 98 90 112 32-14 85-54 90-112 6-70-52-106-90-70Z" />
        <path d="M100 36v178M100 80 40 56M100 80l60-24M100 118 26 108M100 118l74-10M100 156l-62 8M100 156l62 8" stroke="#fff" strokeOpacity=".22" strokeWidth="2" fill="none" />
      </g>
      <path d="M100 210v14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** Tulisan berputar di dalam lingkaran (cap/stempel) */
export function Stamp({ text, className }: { text: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden>
      <defs>
        <path id="ap-stamp-path" d="M100 100m-76 0a76 76 0 1 1 152 0a76 76 0 1 1-152 0" />
      </defs>
      <circle cx="100" cy="100" r="98" fill="var(--ap-ink)" />
      <text fontSize="15.5" fontWeight="700" letterSpacing="4.2" fill="var(--ap-paper)">
        <textPath href="#ap-stamp-path">{text}</textPath>
      </text>
      <g transform="translate(52 50) scale(2)" fill="var(--ap-paper)">
        <path d="M9.5 43 22.6 7.2" stroke="var(--ap-paper)" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M22.6 5.5c1.2-1.9 3.2-1.9 4 .2L40 43h-6.6L24.6 14.500c-.6-2.6-1.2-5.6-2-9Z" />
        <path d="M17.500 41.500c-.8-8 3-13.800 10.200-16.300 1.300 7.800-2.400 13.800-10.200 16.300Z" fill="var(--ap-gold)" />
      </g>
    </svg>
  );
}

/** Denah meja dilihat dari atas; kursi muncul satu per satu */
export function TablePlan({ seats }: { seats: number }) {
  const w = seats > 8 ? 268 : 196;
  const cx = 200;
  const cy = 110;
  const perSide = Math.ceil((seats - 2) / 2);
  const chairs: { x: number; y: number }[] = [];
  for (let i = 0; i < perSide; i++) {
    const x = cx - w / 2 + (w / (perSide + 1)) * (i + 1);
    chairs.push({ x, y: cy - 62 }, { x, y: cy + 62 });
  }
  chairs.splice(seats - 2);
  chairs.push({ x: cx - w / 2 - 34, y: cy }, { x: cx + w / 2 + 34, y: cy });
  return (
    <svg viewBox="0 0 400 220" className="ap-tplan" aria-hidden>
      {chairs.map((c, i) => (
        <circle key={i} className="ap-seat" cx={c.x} cy={c.y} r="17" style={{ "--ap-i": i } as React.CSSProperties} />
      ))}
      <rect x={cx - w / 2} y={cy - 38} width={w} height="76" rx="38" className="ap-ttop" />
      {Array.from({ length: Math.min(seats, 6) }, (_, i) => (
        <circle key={i} cx={cx - w / 2 + 34 + ((w - 68) / Math.max(1, Math.min(seats, 6) - 1)) * i} cy={cy} r="11" className="ap-dish" />
      ))}
    </svg>
  );
}
