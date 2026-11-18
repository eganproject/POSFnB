const CUP = "M72 104H248L233 236q-3 22-25 22H112q-22 0-25-22Z";

/** Cangkir garis yang terisi mengikuti scroll (digerakkan LandingMotion lewat data-cup). */
export function BrewCup() {
  return (
    <div className="lp-cup">
      <svg viewBox="0 0 320 330" aria-hidden>
        <defs>
          <clipPath id="lp-cup-clip">
            <path d={CUP} />
          </clipPath>
        </defs>
        {/* Tanpa JavaScript cangkir tampil penuh dan beruap */}
        <g className="lp-bsteam" data-cup="steam">
          <path d="M124 78c0-18 16-18 16-38" />
          <path d="M160 74c0-18 16-18 16-38" />
          <path d="M196 78c0-18 16-18 16-38" />
        </g>
        <rect data-cup="stream" x="155" y="-40" width="10" height="150" rx="5" fill="#3b2416" opacity="0" />
        <g clipPath="url(#lp-cup-clip)">
          <rect x="60" y="100" width="200" height="170" fill="rgb(243 231 201 / 0.07)" />
          <g data-cup="liquid" transform="translate(0,104)">
            <path
              data-cup="wave"
              className="lp-wave"
              fill="#b07c4e"
              d="M-20 8q20-10 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0V400H-20Z"
            />
          </g>
          <ellipse data-cup="foam" cx="160" cy="112" rx="92" ry="11" fill="#f1dfbd" />
          <path
            data-cup="art"
            d="M160 110c-8-7-18-9-18-15 0-4 6-6 9-2 3-4 9-2 9 2 0-4 6-6 9-2 3-4 9-2 9 2 0 6-10 8-18 15Z"
            fill="#b9814d"
          />
        </g>
        <g fill="none" stroke="#f3e7c9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <path d={CUP} />
          <path d="M245 128c46-4 52 30 42 50-9 18-30 24-50 22" />
          <path d="M40 282h240" />
          <path d="M70 282q8 18 30 18h120q22 0 30-18" />
        </g>
      </svg>
    </div>
  );
}
