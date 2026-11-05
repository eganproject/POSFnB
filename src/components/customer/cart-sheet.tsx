"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { QtyStepper } from "@/components/ui/qty";
import { ProductImage } from "@/components/shared/product-image";
import { cn, formatRupiah } from "@/lib/utils";
import { estimateTotals, modifierText } from "@/lib/cart";
import type { useCart } from "@/hooks/use-cart";
import { rememberOrder } from "@/hooks/use-cart";
import { placeOrder } from "@/server/actions/customer";
import type { MenuOutlet } from "./menu-app";

export function CartSheet({
  open,
  onOpenChange,
  cart,
  outlet,
  table,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cart: ReturnType<typeof useCart>;
  outlet: MenuOutlet;
  table: { token: string; name: string } | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [pay, setPay] = useState<"ONLINE" | "CASHIER">("ONLINE");
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("customer") || "{}");
      if (saved.name) setName(saved.name);
      if (saved.phone) setPhone(saved.phone);
    } catch {
      /* ignore */
    }
  }, []);

  const totals = estimateTotals(cart.subtotal, outlet);

  const submit = async () => {
    if (!name.trim()) {
      setNameError("Isi nama agar pesanan mudah dipanggil");
      document.getElementById("customer-name")?.focus();
      return;
    }
    setSubmitting(true);
    try {
      localStorage.setItem("customer", JSON.stringify({ name: name.trim(), phone: phone.trim() }));
    } catch {
      /* ignore */
    }
    const res = await placeOrder({
      outletId: outlet.id,
      tableToken: table?.token ?? null,
      customerName: name,
      customerPhone: phone || null,
      note: note || null,
      payMethod: pay,
      lines: cart.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        optionIds: l.optionIds,
        note: l.note || null,
      })),
    });
    if (!res.ok) {
      setSubmitting(false);
      toast.error(res.error);
      return;
    }
    rememberOrder(outlet.id, res.data.orderId);
    cart.clear();
    router.push(`/order/${res.data.orderId}${pay === "ONLINE" ? "?pay=1" : ""}`);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <div>
            <DrawerTitle className="text-xl font-bold">Keranjang</DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground">
              {table ? `Diantar ke ${table.name}` : "Takeaway"} · {cart.count} item
            </DrawerDescription>
          </div>
          {cart.count > 0 && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={cart.clear}>
              <Trash2 /> Kosongkan
            </Button>
          )}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-4">
          {cart.lines.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-5xl">🛒</p>
              <p className="mt-3 font-semibold">Keranjang masih kosong</p>
              <p className="text-sm text-muted-foreground">Yuk pilih menu favoritmu dulu</p>
            </div>
          ) : (
            <>
              <ul className="divide-y rounded-2xl border">
                {cart.lines.map((l) => (
                  <li key={l.key} className="flex gap-3 p-3">
                    <ProductImage src={l.imageUrl} name={l.name} emoji={l.emoji} className="size-14 shrink-0 rounded-xl" emojiClassName="text-2xl" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight">{l.name}</p>
                      {l.modifiers.length > 0 && <p className="text-xs text-muted-foreground">{modifierText(l.modifiers)}</p>}
                      {l.note && <p className="text-xs italic text-muted-foreground">“{l.note}”</p>}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold tabular">{formatRupiah(l.unitPrice * l.quantity)}</span>
                        <QtyStepper value={l.quantity} onChange={(q) => cart.setQty(l.key, q)} size="sm" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <section className="space-y-3">
                <h3 className="font-semibold">Data pemesan</h3>
                <div className="grid gap-2.5">
                  <div>
                    <Input
                      id="customer-name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setNameError(null);
                      }}
                      placeholder="Nama kamu *"
                      aria-invalid={!!nameError}
                      className="h-11"
                      maxLength={60}
                    />
                    {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}
                  </div>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
                    placeholder="No. WhatsApp (opsional)"
                    inputMode="tel"
                    className="h-11"
                    maxLength={20}
                  />
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan untuk pesanan (opsional)" rows={2} maxLength={300} />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold">Metode pembayaran</h3>
                <div className="grid gap-2.5">
                  {[
                    { v: "ONLINE" as const, icon: CreditCard, title: "Bayar sekarang", desc: "QRIS, GoPay, ShopeePay, Virtual Account, kartu" },
                    { v: "CASHIER" as const, icon: Banknote, title: "Bayar di kasir", desc: "Pesanan dikonfirmasi staf, bayar tunai / EDC" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setPay(o.v)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3.5 text-left transition",
                        pay === o.v ? "border-primary bg-primary/6 ring-1 ring-primary" : "hover:bg-muted/50"
                      )}
                    >
                      <span className={cn("grid size-10 place-items-center rounded-xl", pay === o.v ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        <o.icon className="size-5" />
                      </span>
                      <span className="flex-1">
                        <span className="block font-semibold">{o.title}</span>
                        <span className="block text-xs text-muted-foreground">{o.desc}</span>
                      </span>
                      <span className={cn("size-5 rounded-full border-2", pay === o.v ? "border-[6px] border-primary" : "border-muted-foreground/30")} />
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-2 rounded-2xl bg-muted/60 p-4 text-sm">
                <Row label="Subtotal" value={totals.subtotal} />
                {totals.serviceCharge > 0 && <Row label={`Service ${outlet.serviceRate}%`} value={totals.serviceCharge} />}
                {totals.tax > 0 && <Row label={`Pajak ${outlet.taxRate}%`} value={totals.tax} />}
                <div className="my-1 border-t border-dashed" />
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span className="tabular">{formatRupiah(totals.total)}</span>
                </div>
              </section>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" /> Pembayaran online diproses aman oleh Midtrans
              </p>
            </>
          )}
        </div>

        {cart.lines.length > 0 && (
          <div className="border-t px-5 pb-safe pt-3">
            <Button size="xl" className="w-full" loading={submitting} onClick={submit}>
              {pay === "ONLINE" ? "Pesan & bayar" : "Kirim pesanan"} · {formatRupiah(totals.total)}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular text-foreground">{formatRupiah(value)}</span>
    </div>
  );
}
