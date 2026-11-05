export function ClosedNotice({ name }: { name: string }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="space-y-3">
        <p className="text-6xl">🌙</p>
        <h1 className="text-xl font-bold">{name} sedang tutup</h1>
        <p className="text-sm text-muted-foreground">Pemesanan lewat QR belum tersedia. Silakan hubungi staf kami.</p>
      </div>
    </div>
  );
}
