export function ClosedNotice({ name, title, message }: { name: string; title?: string; message?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="space-y-3">
        <p className="text-6xl">🌙</p>
        <h1 className="font-display text-3xl">{title ?? `${name} sedang tutup`}</h1>
        <p className="text-sm text-muted-foreground">{message ?? "Pemesanan lewat QR belum tersedia. Silakan hubungi staf kami."}</p>
      </div>
    </div>
  );
}
