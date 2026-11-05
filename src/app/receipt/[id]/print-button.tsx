"use client";
import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ auto }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) setTimeout(() => window.print(), 400);
  }, [auto]);
  return (
    <Button onClick={() => window.print()}>
      <Printer /> Cetak struk
    </Button>
  );
}
