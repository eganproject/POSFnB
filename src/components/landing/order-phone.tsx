import { formatRupiah } from "@/lib/utils";

export type PhoneItem = { name: string; price: number; imageUrl: string | null; emoji: string | null };

/** Pola mirip QR (hiasan, bukan QR sungguhan). Deterministik agar hasil server = client. */
function FakeQr({ seed }: { seed: number }) {
  const N = 13;
  let s = seed;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const corner = (r: number, c: number) => {
    const inBox = (a: number, b: number) => r >= a && r < a + 4 && c >= b && c < b + 4;
    return inBox(0, 0) || inBox(0, N - 4) || inBox(N - 4, 0);
  };
  const cells: boolean[] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells.push(corner(r, c) || rnd() > 0.5);
  return (
    <div className="lp-qr">
      {cells.map((on, i) => (
        <i key={i} className={on ? undefined : "lp-o"} />
      ))}
    </div>
  );
}

/**
 * Mockup HP yang memperagakan alur: scan QR → pilih menu → bayar → pantau pesanan.
 * Layar yang aktif diatur LandingMotion (kelas lp-on); tanpa JavaScript layar pertama yang tampil.
 * `items[0]` dan `items[1]` dianggap sudah masuk keranjang (minuman dari bar, makanan dari dapur).
 */
export function OrderPhone({ logo, brand, items, table = "07" }: { logo: string; brand: string; items: PhoneItem[]; table?: string }) {
  const picked = items.slice(0, 2);
  const total = picked.reduce((sum, it) => sum + it.price, 0);
  const stations = ["Bar", "Dapur"];
  return (
    <div className="lp-phone" aria-hidden>
      <div className="lp-screen">
        {/* 1. scan */}
        <div className="lp-scr lp-s-scan lp-on">
          <div className="lp-table">
            <div className="lp-qcard">
              <small>TABLE</small>
              <strong>{table}</strong>
              <FakeQr seed={7} />
            </div>
          </div>
          <div className="lp-finder">
            <b />
            <s />
          </div>
          <div className="lp-toast">
            <span className="lp-ok">✓</span>Meja {table} · Buka menu
          </div>
        </div>

        {/* 2. menu */}
        <div className="lp-scr">
          <div className="lp-sbar" />
          <div className="lp-shead">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt={brand} />
            <span className="lp-pill">Meja {table}</span>
          </div>
          <div className="lp-mlist">
            {items.slice(0, 4).map((it, i) => (
              <div key={it.name} className={`lp-mitem${i === 0 ? " lp-hit" : ""}`}>
                <div className="lp-t">
                  {it.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <span>{it.emoji || "🍽️"}</span>
                  )}
                </div>
                <div>
                  <div className="lp-nm">{it.name}</div>
                  <div className="lp-pr">{formatRupiah(it.price)}</div>
                </div>
                <span className="lp-add">+</span>
              </div>
            ))}
          </div>
          <div className="lp-cartbar">
            <span>
              <em>{picked.length}</em>Lihat keranjang
            </span>
            <span>{formatRupiah(total)}</span>
          </div>
        </div>

        {/* 3. bayar */}
        <div className="lp-scr">
          <div className="lp-sbar" />
          <div className="lp-shead">
            <b>Bayar</b>
            <span className="lp-pill">QRIS</span>
          </div>
          <div className="lp-pay">
            <small>Total pesanan</small>
            <div className="lp-amt">{formatRupiah(total)}</div>
            <div className="lp-qris">
              <FakeQr seed={20} />
              <div className="lp-done">
                <div>
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12.5 10 17.5 19 7" />
                  </svg>
                  <div>Lunas</div>
                </div>
              </div>
            </div>
            <small>Scan dengan aplikasi bank atau e-wallet</small>
          </div>
        </div>

        {/* 4. pantau */}
        <div className="lp-scr">
          <div className="lp-sbar" />
          <div className="lp-shead">
            <b>Pesanan saya</b>
            <span className="lp-pill">Meja {table}</span>
          </div>
          <div className="lp-bell">🔔</div>
          <div className="lp-track2">
            <div className="lp-tcard">
              <div className="lp-big">Sedang disiapkan…</div>
              <div className="lp-bars">
                <i />
                <i />
                <i />
              </div>
              <div className="lp-lbls">
                <span>Diterima</span>
                <span>Disiapkan</span>
                <span>Siap</span>
              </div>
            </div>
            <div className="lp-tcard">
              {picked.map((it, i) => (
                <div key={it.name} className="lp-titem">
                  <span>1× {it.name}</span>
                  <span className="lp-st">{stations[i % stations.length]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
