import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="space-y-4">
        <p className="text-6xl">🍽️</p>
        <h1 className="text-2xl font-bold">Halaman tidak ditemukan</h1>
        <p className="text-muted-foreground">QR atau link yang kamu buka mungkin sudah tidak berlaku.</p>
        <Button asChild>
          <Link href="/">Kembali ke beranda</Link>
        </Button>
      </div>
    </div>
  );
}
