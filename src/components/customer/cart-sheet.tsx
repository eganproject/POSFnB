"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Banknote, Clock, CreditCard, ShieldCheck, Trash2 } from "lucide-react";
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
import type { MenuCustomer, MenuOutlet, PickupConfig } from "./menu-app";
import { canOrderAsap, formatClock, pickupSlots } from "@/lib/pickup";
import { NativeSelect } from "@/components/ui/input";
import { GoogleSignIn } from "./google-sign-in";

export function CartSheet({
  open,
  onOpenChange,
  cart,
  outlet,
  table,
  customer = null,
  googleEnabled = false,
  pickup = null,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cart: ReturnType<typeof useCart>;
  outlet: MenuOutlet;
  table: { token: string; name: string } | null;
  customer?: MenuCustomer | null;
  googleEnabled?: boolean;
  pickup?: PickupConfig | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pickupMode, setPickupMode] = useState<"ASAP" | "LATER">("ASAP");
  const [pickupSlot, setPickupSlot] = useState("");
  // Hitung ulang slot jam ambil setiap keranjang dibuka
  const schedule = useMemo(() => {
    if (!pickup || !open) return null;
    const now = new Date();
    return {
      asap: canOrderAsap(now, pickup, pickup.timeZone),
      slots: pickupSlots(now, pickup, pickup.timeZone).map((d) => ({ value: d.toISOString(), label: formatClock(d, pickup.timeZone) })),
    };
  }, [pickup, open]);
  useEffect(() => {
    if (!schedule) return;
    if (!schedule.asap) setPickupMode("LATER");
    setPickupSlot((cur) => (schedule.slots.some((s) => s.value === cur) ? cur : schedule.slots[0]?.value ?? ""));
  }, [schedule]);
  const scheduled = Boolean(schedule && pickupMode === "LATER");
  const takeawayOff = Boolean(pickup && !pickup.enabled);
  const takeawayClosed = takeawayOff || Boolean(schedule && !schedule.asap && schedule.slots.length === 0);
  useEffect(() => {
    if (scheduled) setPay("ONLINE");
  }, [scheduled]);
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
      if (!saved.name && customer?.name) setName(customer.name);
      if (!saved.phone && customer?.phone) setPhone(customer.phone);
    } catch {
      /* ignore */
    }
  }, [customer]);

  const totals = estimateTotals(cart.subtotal, outlet);

  const submit = async () => {
    if (!name.trim()) {
      setNameError("Isi nama agar pesanan mudah dipanggil");
      document.getElementById("customer-name")?.focus();
      return;
    }
    if (takeawayClosed) {
      toast.error(takeawayOff ? "Takeaway sedang tidak tersedia." : "Takeaway hari ini sudah tutup.");
      return;
    }
    if (scheduled && !pickupSlot) {
      toast.error("Pilih jam ambil dulu.");
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
      pickupAt: scheduled ? pickupSlot : null,
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
      // Muat ulang menu agar stok habis / perubahan harga terlihat
      router.refresh();
      return;
    }
    rememberOrder(outlet.id, res.data.orderId, res.data.queueNumber);
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

              {schedule && (
                <section className="space-y-3">
                  <h3 className="font-semibold">Waktu ambil</h3>
                  {takeawayOff ? (
                    <p className="rounded-2xl bg-muted p-3.5 text-sm text-muted-foreground">
                      Pesanan takeaway lewat aplikasi sedang tidak dibuka. Silakan pesan langsung di outlet atau scan QR di meja.
                    </p>
                  ) : takeawayClosed ? (
                    <p className="rounded-2xl bg-muted p-3.5 text-sm text-muted-foreground">
                      Takeaway hari ini sudah tutup (buka {pickup!.openTime}–{pickup!.closeTime}). Sampai jumpa besok!
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={!schedule.asap}
                        onClick={() => setPickupMode("ASAP")}
                        className={cn(
                          "rounded-2xl border p-3 text-left transition disabled:opacity-50",
                          pickupMode === "ASAP" ? "border-primary bg-primary/6 ring-1 ring-primary" : "hover:bg-muted/50"
                        )}
                      >
                        <span className="block text-sm font-semibold">Secepatnya</span>
                        <span className="block text-xs text-muted-foreground">
                          {schedule.asap ? `Siap ±${pickup!.leadMinutes} menit` : "Outlet belum buka"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickupMode("LATER")}
                        className={cn(
                          "rounded-2xl border p-3 text-left transition",
                          pickupMode === "LATER" ? "border-primary bg-primary/6 ring-1 ring-primary" : "hover:bg-muted/50"
                        )}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-semibold"><Clock className="size-3.5" /> Pilih jam</span>
                        <span className="block text-xs text-muted-foreground">Ambil nanti, bayar online</span>
                      </button>
                      {pickupMode === "LATER" && (
                        <NativeSelect
                          aria-label="Jam ambil"
                          value={pickupSlot}
                          onChange={(e) => setPickupSlot(e.target.value)}
                          className="col-span-2 h-11"
                        >
                          {schedule.slots.map((sl) => (
                            <option key={sl.value} value={sl.value}>
                              Ambil jam {sl.label}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    </div>
                  )}
                </section>
              )}

              {!customer && googleEnabled && (
                <section className="space-y-2.5 rounded-2xl border border-dashed p-3.5">
                  <p className="text-sm">
                    <b>Simpan riwayat pesananmu.</b>{" "}
                    <span className="text-muted-foreground">Masuk dengan Google agar bisa lihat riwayat & pesan lagi. Keranjangmu tidak hilang.</span>
                  </p>
                  <GoogleSignIn next={pathname} className="h-10" />
                </section>
              )}

              <section className="space-y-3">
                <h3 className="font-semibold">Metode pembayaran</h3>
                <div className="grid gap-2.5">
                  {[
                    { v: "ONLINE" as const, icon: CreditCard, title: "Bayar sekarang", desc: "QRIS, GoPay, ShopeePay, Virtual Account, kartu" },
                    { v: "CASHIER" as const, icon: Banknote, title: "Bayar di kasir", desc: "Pesanan dikonfirmasi staf, bayar tunai / EDC" },
                  ].filter((o) => !(scheduled && o.v === "CASHIER")).map((o) => (
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
            <Button size="xl" className="w-full" loading={submitting} disabled={takeawayClosed} onClick={submit}>
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
