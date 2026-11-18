import { formatRupiah } from "@/lib/utils";
import { ProductImage } from "@/components/shared/product-image";

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
        <i key={i} className={on ? undefined : "o"} />
      ))}
    </div>
  );
}

/**
 * Mockup HP yang memperagakan alur: scan QR → pilih menu → bayar → pantau pesanan.
 * Layar yang aktif diatur LandingMotion (kelas lp-on); tanpa JavaScript layar pertama yang tampil.
 */
export function OrderPhone({ brand, items, table = "07" }: { brand: string; items: PhoneItem[]; table?: string }) {
  const picked = items.slice(0, 2);
  const total = picked.reduce((sum, it) => sum + it.price, 0);
  const stations = ["Bar", "Dapur"];
  return (
    <div className="lp-phone" aria-hidden>
      <div className="lp-screen">
        {/* 1. scan */}
        <div className="lp-scr lp-s-scan lp-on">
          <div className="lp-s-table">
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
            <b>{brand}</b>
            <span className="lp-pill">Meja {table}</span>
          </div>
          <div className="lp-mlist">
            {items.slice(0, 4).map((it, i) => (
              <div key={it.name} className={`lp-mitem${i === 0 ? " lp-hit" : ""}`}>
                <ProductImage src={it.imageUrl} name={it.name} emoji={it.emoji} className="lp-mthumb" emojiClassName="text-[1.6em]" />
                <div className="min-w-0">
                  <div className="lp-mname">{it.name}</div>
                  <div className="lp-mprice">{formatRupiah(it.price)}</div>
                </div>
                <span className="lp-madd">+</span>
              </div>
            ))}
          </div>
          <div className="lp-cart">
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
            <span>Total pesanan</span>
            <div className="lp-amt">{formatRupiah(total)}</div>
            <div className="lp-qris">
              <FakeQr seed={20} />
              <div className="lp-paid">
                <div>
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12.5 10 17.5 19 7" />
                  </svg>
                  Lunas
                </div>
              </div>
            </div>
            <span>Scan dengan aplikasi bank atau e-wallet</span>
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
          <div className="lp-track">
            <div className="lp-tcard">
              <div className="lp-tbig">Sedang disiapkan…</div>
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
