/**
 * Ilustrasi landing Aprez Locale: mangkuk mi beruap, bahan-bahan yang melayang, piring-piring
 * signature yang tersusun satu per satu, langit kota, dan denah meja ruang semi-VIP.
 * Semua digambar dengan SVG supaya ringan, tajam di layar apa pun, dan mudah diberi animasi.
 */

/* ---------------------------------------------------------------- hero */

/** Mangkuk mi dilihat dari samping, sumpit mengangkat mi, uap naik */
export function HeroBowl() {
  return (
    <svg className="ap-bowl" viewBox="0 0 520 470" aria-hidden>
      <defs>
        <linearGradient id="ap-bowl-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--ap-clay)" />
          <stop offset="1" stopColor="var(--ap-clay-deep)" />
        </linearGradient>
        <linearGradient id="ap-broth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9a861" />
          <stop offset="1" stopColor="#c87a3d" />
        </linearGradient>
        <clipPath id="ap-bowl-in">
          <ellipse cx="260" cy="250" rx="196" ry="46" />
        </clipPath>
      </defs>
      {/* uap */}
      <g className="ap-steam" fill="none" strokeLinecap="round">
        <path d="M196 214c-22-34 22-52 0-88s20-54 0-86" />
        <path d="M262 206c-22-34 22-52 0-88s20-54 0-90" />
        <path d="M326 214c-22-34 22-52 0-88s20-54 0-80" />
      </g>
      {/* bayangan */}
      <ellipse cx="260" cy="440" rx="170" ry="18" fill="rgb(35 44 69/.16)" />
      {/* badan mangkuk */}
      <path d="M64 250c0 104 88 178 196 178s196-74 196-178Z" fill="url(#ap-bowl-body)" />
      <path d="M96 296c40 50 96 74 164 74s124-24 164-74" fill="none" stroke="var(--ap-paper)" strokeOpacity=".5" strokeWidth="5" strokeDasharray="2 14" strokeLinecap="round" />
      <path d="M200 424h120l-8 22H208Z" fill="var(--ap-clay-deep)" />
      {/* isi */}
      <ellipse cx="260" cy="250" rx="196" ry="46" fill="var(--ap-paper)" />
      <g clipPath="url(#ap-bowl-in)">
        <ellipse cx="260" cy="258" rx="186" ry="40" fill="url(#ap-broth)" />
        <g fill="none" stroke="#fbe6c2" strokeWidth="5" strokeLinecap="round">
          <path d="M110 262c30-16 50 14 80 0s50 14 80 0 50 14 80 0 50 14 70 2" />
          <path d="M130 278c30-14 50 12 80 0s50 12 80 0 50 12 80 0" />
        </g>
        <ellipse cx="170" cy="248" rx="34" ry="12" fill="#b9614b" />
        <ellipse cx="206" cy="242" rx="30" ry="11" fill="#c97361" />
        <circle cx="330" cy="246" r="13" fill="#8a4b2c" />
        <circle cx="356" cy="258" r="11" fill="#7a4226" />
        <path d="M282 236c10-14 30-14 38 0-10 8-28 8-38 0Z" fill="#5f9150" />
        <path d="M244 262c8-12 26-12 32 0-8 7-24 7-32 0Z" fill="#6ea35c" />
        <circle cx="390" cy="244" r="7" fill="#d8402f" />
        <circle cx="140" cy="270" r="6" fill="#d8402f" />
      </g>
      <ellipse cx="260" cy="250" rx="196" ry="46" fill="none" stroke="var(--ap-clay-deep)" strokeWidth="6" />
      {/* sumpit + mi yang terangkat */}
      <g className="ap-lift">
        <g fill="none" stroke="#fbe6c2" strokeWidth="5" strokeLinecap="round">
          <path d="M286 120c-8 40 10 70-2 120" />
          <path d="M298 118c6 44-10 76 4 124" />
          <path d="M310 122c-6 40 12 72 0 116" />
        </g>
        <path d="M206 132 424 64" stroke="var(--ap-wood)" strokeWidth="9" strokeLinecap="round" />
        <path d="M212 150 430 98" stroke="var(--ap-wood)" strokeWidth="9" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Chili({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden>
      <path d="M26 34c10 44 42 72 82 74-30-14-48-44-52-78Z" fill="#d8402f" />
      <path d="M40 40c6 22 18 40 36 52" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="4" strokeLinecap="round" />
      <path d="M22 34c4-10 18-14 30-8l4 4c-10 0-22 2-34 4Z" fill="#4f8a3c" />
      <path d="M34 26c-4-8-2-16 6-20" fill="none" stroke="#4f8a3c" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function StarAnise({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 45} 60 60)`}>
          <path d="M60 60c-7-12-8-30 0-48 8 18 7 36 0 48Z" fill="#7b3f22" />
          <ellipse cx="60" cy="34" rx="3.2" ry="5" fill="#c98a52" />
        </g>
      ))}
      <circle cx="60" cy="60" r="7" fill="#5c2c16" />
    </svg>
  );
}

export function Lime({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden>
      <circle cx="60" cy="60" r="50" fill="#6aa043" />
      <circle cx="60" cy="60" r="43" fill="#e8f2c4" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d="M60 60 60 22a38 38 0 0 1 26.9 11.1Z" fill="#b9d97a" transform={`rotate(${i * 45} 60 60)`} stroke="#e8f2c4" strokeWidth="3" />
      ))}
      <circle cx="60" cy="60" r="5" fill="#e8f2c4" />
    </svg>
  );
}

export function Leaf({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden>
      <path d="M14 104C14 50 50 16 106 14c0 56-36 90-92 90Z" fill="#4f8a3c" />
      <path d="M14 104C42 76 70 46 106 14" fill="none" stroke="#2f5f26" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Shrimp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden>
      <path d="M92 30C66 10 22 20 18 58c-3 30 26 48 50 40-18-4-30-18-26-36 4-20 28-30 50-18Z" fill="#ee8a57" />
      <g fill="none" stroke="#fbd2b6" strokeWidth="3.5" strokeLinecap="round">
        <path d="M36 34c6 6 8 14 6 22M52 26c6 7 7 16 4 24M70 24c4 6 4 14 1 20" />
      </g>
      <path d="M68 98c6 6 14 8 22 4-6-2-10-6-12-10Z" fill="#d8402f" />
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
      <g transform="translate(64 58) scale(1.5)" fill="none" stroke="var(--ap-blush)" strokeLinecap="round">
        <path d="M17.5 30 27 5.5M30.5 30 21 5.5" strokeWidth="2.6" />
        <path d="M20.2 21.5h7.6" strokeWidth="2.2" />
      </g>
      <path d="M71 99h58a29 23 0 0 1-58 0Z" fill="var(--ap-blush)" />
    </svg>
  );
}

/* ---------------------------------------------------------------- signature: piring tersusun */

/** Bagian piring yang muncul saat scroll mencapai `at` (0..1 di dalam giliran hidangan itu) */
function Part({ at, children, x = 0, y = 0 }: { at: number; children: React.ReactNode; x?: number; y?: number }) {
  return (
    <g className="ap-part" data-at={at} style={{ "--ap-x": `${x}px`, "--ap-y": `${y}px` } as React.CSSProperties}>
      {children}
    </g>
  );
}

const plateBase = (
  <>
    <ellipse cx="200" cy="214" rx="176" ry="170" fill="rgb(35 44 69/.18)" />
    <circle cx="200" cy="200" r="176" fill="#fbf7ef" />
    <circle cx="200" cy="200" r="150" fill="none" stroke="#e8dccb" strokeWidth="3" />
    <circle cx="200" cy="200" r="168" fill="none" stroke="var(--ap-clay)" strokeWidth="3" strokeDasharray="1 11" strokeLinecap="round" />
  </>
);

export function PlateNasiIkan() {
  return (
    <svg viewBox="0 0 400 400" className="ap-plate" aria-hidden>
      {plateBase}
      <Part at={0.05} y={-30}>
        {/* nasi */}
        <circle cx="140" cy="214" r="62" fill="#fffdf8" stroke="#ece4d6" strokeWidth="3" />
        <g fill="#ece4d6">
          {Array.from({ length: 22 }, (_, i) => {
            const a = i * 2.4;
            const r = 12 + ((i * 17) % 40);
            return <ellipse key={i} cx={140 + Math.cos(a) * r} cy={214 + Math.sin(a) * r} rx="4.5" ry="2" transform={`rotate(${i * 37} ${140 + Math.cos(a) * r} ${214 + Math.sin(a) * r})`} />;
          })}
        </g>
      </Part>
      <Part at={0.22} x={60} y={-40}>
        {/* ikan barramundi goreng */}
        <g transform="rotate(-28 236 196)">
          <path d="M132 196c30-46 130-52 176-6-46 48-146 44-176 6Z" fill="#c9792f" />
          <path d="M308 190l50-34c-6 26-6 48 0 72Z" fill="#a85f22" />
          <path d="M150 196c26-30 110-36 150-4" fill="none" stroke="#e7a65a" strokeWidth="5" strokeLinecap="round" />
          <g fill="none" stroke="#8e4e1b" strokeWidth="4" strokeLinecap="round">
            <path d="M190 168c8 12 8 26 0 40M222 164c8 13 8 30 0 46M254 166c8 12 8 28 0 42" />
          </g>
          <circle cx="160" cy="188" r="6" fill="#3d1d0b" />
          <path d="M232 156c10-14 26-16 40-12-12 4-22 8-30 16Z" fill="#a85f22" />
        </g>
      </Part>
      <Part at={0.42} x={30} y={-30}>
        {/* mangkuk sayur lodeh */}
        <circle cx="290" cy="110" r="52" fill="var(--ap-clay)" />
        <circle cx="290" cy="110" r="42" fill="#f3dca0" />
        <rect x="266" y="94" width="18" height="12" rx="3" fill="#e2a24c" transform="rotate(-14 275 100)" />
        <rect x="292" y="116" width="18" height="12" rx="3" fill="#e2a24c" transform="rotate(20 301 122)" />
        <path d="M300 92h22M270 124h20" stroke="#5f9150" strokeWidth="6" strokeLinecap="round" />
        <circle cx="306" cy="104" r="6" fill="#b9d97a" />
      </Part>
      <Part at={0.6} x={-20} y={-30}>
        {/* sambal */}
        <circle cx="300" cy="300" r="32" fill="#fbf7ef" stroke="#e8dccb" strokeWidth="3" />
        <circle cx="300" cy="300" r="22" fill="#c63a22" />
        <g fill="#f08a64">
          <circle cx="294" cy="294" r="3" />
          <circle cx="306" cy="304" r="2.5" />
          <circle cx="298" cy="308" r="2" />
        </g>
      </Part>
      <Part at={0.74} x={-30} y={-20}>
        {/* irisan jeruk & daun */}
        <path d="M84 116a30 30 0 0 1 52 22Z" fill="#6aa043" />
        <path d="M90 120a24 24 0 0 1 40 18Z" fill="#e8f2c4" />
        <path d="M206 318c10-20 34-24 50-14-12 14-34 20-50 14Z" fill="#4f8a3c" />
      </Part>
    </svg>
  );
}

export function PlatePho() {
  return (
    <svg viewBox="0 0 400 400" className="ap-plate" aria-hidden>
      <ellipse cx="200" cy="214" rx="176" ry="170" fill="rgb(35 44 69/.18)" />
      <circle cx="200" cy="200" r="170" fill="var(--ap-ink)" />
      <circle cx="200" cy="200" r="150" fill="#2f3a5a" />
      <Part at={0.05} y={0}>
        <circle cx="200" cy="200" r="140" fill="#d99a56" />
        <circle cx="200" cy="200" r="140" fill="url(#ap-pho-sheen)" />
        <defs>
          <radialGradient id="ap-pho-sheen" cx=".4" cy=".35" r=".7">
            <stop offset="0" stopColor="#fff" stopOpacity=".28" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
      </Part>
      <Part at={0.2} y={-20}>
        <g fill="none" stroke="#fbf0d8" strokeWidth="6" strokeLinecap="round">
          <path d="M100 210c20-14 34 10 54-2s34 12 54 0 34 12 54 0 30 10 40 2" />
          <path d="M108 236c20-12 34 10 54-2s34 12 54 0 34 12 54 0" />
          <path d="M124 186c20-12 34 10 54-2s34 12 54 0 34 12 54 0" />
        </g>
      </Part>
      <Part at={0.36} x={20} y={-30}>
        {Array.from({ length: 5 }, (_, i) => (
          <g key={i} transform={`rotate(${-50 + i * 22} 200 200)`}>
            <path d="M200 74c26 0 46 12 52 30-20 10-60 10-80 0 4-18 14-30 28-30Z" fill="#b5604f" />
            <path d="M184 92c12-6 28-6 40 0" fill="none" stroke="#e7a296" strokeWidth="4" strokeLinecap="round" />
          </g>
        ))}
      </Part>
      <Part at={0.52} y={-30}>
        <circle cx="150" cy="268" r="17" fill="#7a4226" />
        <circle cx="186" cy="290" r="15" fill="#8a4b2c" />
        <circle cx="146" cy="262" r="5" fill="#a5643f" />
        <circle cx="182" cy="284" r="4" fill="#a5643f" />
      </Part>
      <Part at={0.66} x={-20} y={-30}>
        <g fill="#4f8a3c">
          <path d="M252 250c14-24 44-28 62-12-16 18-44 22-62 12Z" />
          <path d="M240 284c4-24 26-40 50-34-4 22-26 38-50 34Z" fill="#6ea35c" />
          <path d="M226 262c-4-20 8-38 28-42 4 20-8 38-28 42Z" />
        </g>
        <g fill="#d8402f">
          <circle cx="282" cy="296" r="6" />
          <circle cx="296" cy="282" r="5" />
        </g>
      </Part>
      <Part at={0.8} x={30} y={0}>
        <g transform="translate(286 30) scale(.62)">
          <circle cx="60" cy="60" r="50" fill="#6aa043" />
          <circle cx="60" cy="60" r="43" fill="#e8f2c4" />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d="M60 60 60 22a38 38 0 0 1 26.9 11.1Z" fill="#b9d97a" transform={`rotate(${i * 45} 60 60)`} stroke="#e8f2c4" strokeWidth="3" />
          ))}
        </g>
      </Part>
    </svg>
  );
}

export function PlateKwayTeow() {
  return (
    <svg viewBox="0 0 400 400" className="ap-plate" aria-hidden>
      {plateBase}
      <Part at={0.05} y={-24}>
        <g fill="none" strokeLinecap="round">
          {Array.from({ length: 9 }, (_, i) => (
            <path
              key={i}
              d={`M${92 + (i % 3) * 8} ${120 + i * 20}c40-22 70 22 110 0s70 22 110 0`}
              stroke={i % 2 ? "#a86b3c" : "#c48850"}
              strokeWidth="13"
            />
          ))}
        </g>
      </Part>
      <Part at={0.26} x={30} y={-30}>
        {[
          [150, 150, -20],
          [250, 170, 30],
          [190, 260, 160],
          [270, 250, 80],
        ].map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x - 30} ${y - 30}) rotate(${r} 30 30) scale(.5)`}>
            <path d="M92 30C66 10 22 20 18 58c-3 30 26 48 50 40-18-4-30-18-26-36 4-20 28-30 50-18Z" fill="#ee8a57" />
            <path d="M36 34c6 6 8 14 6 22M52 26c6 7 7 16 4 24" fill="none" stroke="#fbd2b6" strokeWidth="5" strokeLinecap="round" />
          </g>
        ))}
      </Part>
      <Part at={0.46} y={-30}>
        <g stroke="#fbf6e6" strokeWidth="5" strokeLinecap="round">
          {Array.from({ length: 14 }, (_, i) => {
            const x = 120 + ((i * 47) % 170);
            const y = 130 + ((i * 71) % 150);
            return <path key={i} d={`M${x} ${y}l${10 + (i % 3) * 4} ${i % 2 ? 8 : -8}`} />;
          })}
        </g>
      </Part>
      <Part at={0.62} y={-30}>
        <g stroke="#4f8a3c" strokeWidth="6" strokeLinecap="round">
          {Array.from({ length: 9 }, (_, i) => {
            const x = 130 + ((i * 53) % 150);
            const y = 140 + ((i * 41) % 140);
            return <path key={i} d={`M${x} ${y}l${22} ${i % 2 ? -6 : 6}`} />;
          })}
        </g>
      </Part>
      <Part at={0.78} y={-24}>
        <g fill="#f4c64f">
          <ellipse cx="170" cy="200" rx="14" ry="9" />
          <ellipse cx="236" cy="226" rx="12" ry="8" />
          <ellipse cx="214" cy="160" rx="10" ry="7" />
          <ellipse cx="152" cy="246" rx="9" ry="6" />
        </g>
      </Part>
    </svg>
  );
}

/* ---------------------------------------------------------------- langit & kota */

/** Lapisan kota: dipakai jendela parallax (tiap lapisan bergerak dengan kecepatan berbeda) */
export function Skyline({ layer }: { layer: "far" | "mid" | "near" }) {
  if (layer === "far")
    return (
      <svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <path
          d="M0 300V190h60v-40h50v60h40V120h70v90h40v-50h60v-70h50v120h50v-90h80v130h40V90h60v120h50v-60h70v70h40v-110h60v130h50v-60h60v-40h70v100h40v-70h50v140Z"
          fill="#43507a"
          opacity=".55"
        />
      </svg>
    );
  if (layer === "mid")
    return (
      <svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <path
          d="M0 300V220h90V130h80v90h50V160h90v-90h70v150h60V110h100v190Zm610 0V150h80V60h90v90h40v60h70V120h90v80h60v-70h70v170Z"
          fill="#2f3a5a"
        />
        <g fill="#f7c98a" opacity=".8">
          {Array.from({ length: 36 }, (_, i) => (
            <rect key={i} x={110 + ((i * 97) % 1000)} y={150 + ((i * 53) % 110)} width="7" height="10" rx="1" />
          ))}
        </g>
      </svg>
    );
  return (
    <svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <path d="M0 300V250c120-30 220-30 330 0s210 30 330 0 220-30 330 0 160 20 210 10v40Z" fill="var(--ap-ink)" />
      <g fill="var(--ap-ink)">
        <rect x="140" y="160" width="10" height="100" />
        <circle cx="145" cy="150" r="34" />
        <circle cx="120" cy="170" r="24" />
        <circle cx="172" cy="172" r="24" />
        <rect x="1000" y="170" width="10" height="90" />
        <circle cx="1005" cy="160" r="30" />
        <circle cx="1030" cy="178" r="22" />
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------- ruang */

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
