"use client";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[70dvh] place-items-center p-6 text-center">
      <div className="max-w-sm space-y-4">
        <p className="text-6xl">😵‍💫</p>
        <h1 className="text-xl font-bold">Ups, ada yang tidak beres</h1>
        <p className="text-sm text-muted-foreground">
          Halaman gagal dimuat. Periksa koneksi lalu coba lagi. Jika terus terjadi, pastikan database sedang berjalan.
        </p>
        {error.digest && <p className="font-mono text-xs text-muted-foreground">Kode: {error.digest}</p>}
        <Button onClick={reset}>
          <RotateCcw /> Coba lagi
        </Button>
      </div>
    </div>
  );
}
