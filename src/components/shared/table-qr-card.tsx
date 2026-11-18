import { BRAND } from "@/lib/brand";
import { BrandMark } from "@/components/shared/brand-mark";
import { cn } from "@/lib/utils";

/** Warna kartu dalam hex supaya hasil cetak sama persis dengan layar */
export const QR_CARD_COLORS = {
  olive: "#66694f",
  oliveDeep: "#4a4c38",
  ink: "#2b2d21",
  cream: "#f1e7cf",
  paper: "#fbf6ea",
} as const;

/** Opsi QR yang dipakai kartu (gelap pekat agar mudah discan) */
export const QR_CARD_QR_OPTIONS = {
  margin: 0,
  width: 520,
  errorCorrectionLevel: "M" as const,
  color: { dark: QR_CARD_COLORS.ink, light: "#ffffff" },
};

/** "Meja 07" → { label: "Table", number: "07" }; nama tanpa angka tampil apa adanya */
export function tableLabel(name: string) {
  const m = name.trim().match(/(\d+)\s*$/);
  if (!m) return { label: null, number: null, text: name.trim() };
  return { label: "Table", number: m[1].padStart(2, "0"), text: name.trim() };
}

export type TableQrCardProps = {
  /** Nama meja, mis. "Meja 07". Kosongkan untuk kartu takeaway. */
  name?: string | null;
  area?: string | null;
  qr: string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Kartu QR meja ukuran A6 (105 × 148 mm), siap cetak untuk stand akrilik meja.
 * Semua ukuran memakai mm agar cetakan presisi; di layar diperkecil dengan `zoom`.
 */
export function TableQrCard({ name, area, qr, className, style }: TableQrCardProps) {
  const t = name ? tableLabel(name) : null;
  const c = QR_CARD_COLORS;
  return (
    <div
      className={cn("qr-card relative flex flex-col overflow-hidden font-sans", className)}
      style={{ width: "105mm", height: "148mm", background: c.paper, color: c.ink, ...style }}
    >
      {/* Kepala: wordmark + nomor meja */}
      <div className="relative flex flex-col items-center" style={{ background: c.olive, color: c.cream, padding: "6mm 6mm 0", height: "60mm" }}>
        <div className="flex items-center" style={{ gap: "2.2mm" }}>
          <BrandMark className="size-[9mm] shrink-0" />
          <span className="font-display leading-none" style={{ fontSize: "8.2mm", letterSpacing: "0.04em" }}>
            {BRAND.shortName}
          </span>
        </div>
        <p className="font-semibold uppercase" style={{ fontSize: "2.2mm", letterSpacing: "0.32em", opacity: 0.7, marginTop: "1.6mm" }}>
          {BRAND.tagline}
        </p>

        {t?.number ? (
          <div className="flex flex-col items-center" style={{ marginTop: "3.5mm" }}>
            <p className="font-semibold uppercase" style={{ fontSize: "3.2mm", letterSpacing: "0.5em", paddingLeft: "0.5em", opacity: 0.85 }}>
              {t.label}
            </p>
            <p className="font-display leading-none tabular" style={{ fontSize: "19mm", marginTop: "1mm", letterSpacing: "0.02em" }}>
              {t.number}
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center" style={{ paddingBottom: "8mm" }}>
            <p className="font-semibold uppercase" style={{ fontSize: "3.2mm", letterSpacing: "0.5em", paddingLeft: "0.5em", opacity: 0.85 }}>
              {t ? "Table" : "Order"}
            </p>
            <p className="text-center font-display leading-none" style={{ fontSize: t && t.text.length > 10 ? "9mm" : "13mm", marginTop: "2mm" }}>
              {t ? t.text : "Takeaway"}
            </p>
          </div>
        )}

        {/* Lengkung bawah kepala (seperti matahari terbenam di logo) */}
        <svg viewBox="0 0 105 10" preserveAspectRatio="none" className="absolute" style={{ left: "-0.5mm", right: "-0.5mm", width: "calc(100% + 1mm)", height: "6mm", bottom: "-0.3mm" }} aria-hidden>
          <path d="M0 10 L0 4 Q52.5 -4 105 4 L105 10 Z" fill={c.paper} />
        </svg>
      </div>

      {/* Badan: QR + ajakan */}
      <div className="flex flex-1 flex-col items-center" style={{ padding: "0 7mm 5mm" }}>
        <p className="font-medium" style={{ fontSize: "2.7mm", color: c.olive, marginTop: "-0.5mm", height: "3.5mm" }}>
          {t ? [t.number ? t.text : null, area].filter(Boolean).join(" · ") : "Pesan & ambil di kasir"}
        </p>

        <div
          className="relative"
          style={{ marginTop: "2.5mm", background: "#fff", padding: "3.2mm", borderRadius: "4mm", border: `0.45mm solid ${c.olive}`, boxShadow: `0 0 0 1.4mm ${c.cream}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR ${name ?? "takeaway"}`} style={{ width: "38mm", height: "38mm", display: "block", imageRendering: "pixelated" }} />
        </div>

        <p className="font-extrabold" style={{ fontSize: "5mm", marginTop: "4.5mm", color: c.oliveDeep, letterSpacing: "-0.01em" }}>
          Scan untuk pesan
        </p>
        <p className="font-serif italic" style={{ fontSize: "3.9mm", color: c.olive, marginTop: "0.3mm" }}>
          scan to see the menu &amp; order
        </p>

        <div className="flex items-center" style={{ gap: "1.6mm", marginTop: "3.2mm", marginBottom: "3mm", fontSize: "2.45mm", color: c.ink }}>
          {["Scan QR", "Pilih menu", t ? "Pesanan diantar" : "Ambil di kasir"].map((s, i) => (
            <span key={s} className="flex items-center" style={{ gap: "1mm" }}>
              {i > 0 && <span style={{ width: "2.2mm", height: "0.3mm", background: c.olive, opacity: 0.45, marginRight: "0.6mm" }} />}
              <span
                className="grid place-items-center font-bold"
                style={{ width: "3.6mm", height: "3.6mm", borderRadius: "999px", background: c.cream, color: c.oliveDeep, fontSize: "2.1mm" }}
              >
                {i + 1}
              </span>
              <span className="font-medium whitespace-nowrap">{s}</span>
            </span>
          ))}
        </div>

        <div className="mt-auto flex w-full items-end justify-between" style={{ borderTop: `0.25mm solid ${c.cream}`, paddingTop: "2.2mm", fontSize: "2.2mm", color: c.olive }}>
          <span>
            Buka {BRAND.hoursShort}
            <br />
            {BRAND.links.instagramHandle}
          </span>
          <span className="text-right" style={{ opacity: 0.75 }}>
            Bayar QRIS, e-wallet,
            <br />
            atau di kasir
          </span>
        </div>
      </div>
    </div>
  );
}
