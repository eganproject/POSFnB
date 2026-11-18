"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintCardsButton() {
  return (
    <Button onClick={() => window.print()}>
      <Printer /> Cetak / simpan PDF
    </Button>
  );
}
