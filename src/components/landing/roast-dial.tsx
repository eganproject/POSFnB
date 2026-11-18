/** Biji kopi kecil yang mengorbit di lingkaran: [x, y, putaran, besar] */
const ORBIT: [number, number, number, boolean][] = [
  [160, 14, 30, true],
  [286.4, 87, 80, false],
  [286.4, 233, 140, true],
  [160, 306, 10, false],
  [33.6, 233, 60, true],
  [33.6, 87, 110, false],
];

/**
 * Biji kopi yang berubah warna dari hijau sampai matang mengikuti scroll
 * (digerakkan LandingMotion lewat atribut data-roast).
 */
export function RoastDial() {
  return (
    <div className="lp-dial">
      <svg viewBox="0 0 320 320" aria-hidden>
        <circle cx="160" cy="160" r="146" fill="none" stroke="rgb(244 241 227 / 0.16)" strokeWidth="2" />
        <circle
          data-roast="arc"
          cx="160"
          cy="160"
          r="146"
          fill="none"
          stroke="#c9a063"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="917.4"
          strokeDashoffset="917.4"
          transform="rotate(-90 160 160)"
        />
        <g data-roast="orbit">
          {ORBIT.map(([x, y, rot, big]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <ellipse rx={big ? 6 : 5} ry={big ? 9 : 7.5} fill="#f4f1e3" opacity={big ? 0.8 : 0.5} transform={`rotate(${rot})`} />
            </g>
          ))}
        </g>
        <g className="lp-smoke" data-roast="smoke" opacity="0">
          <path d="M128 66c0-16 14-16 14-34" />
          <path d="M160 60c0-16 14-16 14-34" />
          <path d="M192 66c0-16 14-16 14-34" />
        </g>
        <g data-roast="bean" transform="rotate(-24 160 160)">
          <ellipse data-roast="fill" cx="160" cy="160" rx="62" ry="92" fill="#8fa870" />
          <ellipse cx="140" cy="128" rx="16" ry="34" fill="#fff" opacity="0.12" />
          <path data-roast="crease" d="M160 74c34 46-34 126 0 172" fill="none" stroke="#5d7347" strokeWidth="7" strokeLinecap="round" />
        </g>
        <text data-roast="stage" x="160" y="292" textAnchor="middle" fontSize="13">
          Green bean
        </text>
      </svg>
    </div>
  );
}
