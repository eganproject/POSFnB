"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Phone, Plus, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/misc";
import { saveOutlet } from "@/server/actions/admin";

type O = { id?: string; name: string; slug: string; address: string | null; phone: string | null; taxRate: number; serviceRate: number; maxDiscountPercent: number; receiptFooter: string | null; isActive: boolean; tables?: number; staff?: number };

export function OutletsManager({ outlets }: { outlets: O[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<O | null>(null);
  const [active, setActive] = useState(true);
  const [pending, start] = useTransition();

  const open = (o: O) => {
    setActive(o.isActive);
    setEdit(o);
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {outlets.map((o) => (
          <div key={o.id} className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Store className="size-5" /></span>
                <div>
                  <p className="font-bold">{o.name}</p>
                  <p className="text-xs text-muted-foreground">/{o.slug}</p>
                </div>
              </div>
              <Badge variant={o.isActive ? "success" : "secondary"}>{o.isActive ? "Buka" : "Nonaktif"}</Badge>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              {o.address && <p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" /> {o.address}</p>}
              {o.phone && <p className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0" /> {o.phone}</p>}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                ["Pajak", `${o.taxRate}%`],
                ["Service", `${o.serviceRate}%`],
                ["Meja", o.tables],
                ["Staf", o.staff],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-muted/60 py-2">
                  <p className="font-bold text-foreground">{v}</p>
                  <p className="text-muted-foreground">{l}</p>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={() => open(o)}>
              <Pencil /> Ubah
            </Button>
          </div>
        ))}
        <button
          onClick={() => open({ name: "", slug: "", address: "", phone: "", taxRate: 10, serviceRate: 0, maxDiscountPercent: 20, receiptFooter: "", isActive: true })}
          className="grid min-h-60 place-items-center rounded-2xl border-2 border-dashed text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          <span className="flex flex-col items-center gap-2 font-semibold"><Plus className="size-6" /> Tambah outlet</span>
        </button>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          {edit && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                start(async () => {
                  const r = await saveOutlet({
                    id: edit.id,
                    name: String(f.get("name")),
                    slug: String(f.get("slug")),
                    address: String(f.get("address")) || null,
                    phone: String(f.get("phone")) || null,
                    taxRate: Number(f.get("taxRate")) || 0,
                    serviceRate: Number(f.get("serviceRate")) || 0,
                    maxDiscountPercent: Math.round(Number(f.get("maxDiscountPercent")) || 0),
                    receiptFooter: String(f.get("receiptFooter")) || null,
                    isActive: active,
                  });
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Outlet disimpan");
                  setEdit(null);
                  router.refresh();
                });
              }}
            >
              <DialogHeader>
                <DialogTitle>{edit.id ? `Ubah ${edit.name}` : "Outlet baru"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nama outlet" className="col-span-2"><Input name="name" defaultValue={edit.name} required /></Field>
                <Field label="Slug (link takeaway)" hint="/m/slug"><Input name="slug" defaultValue={edit.slug} placeholder="otomatis" /></Field>
                <Field label="Telepon"><Input name="phone" defaultValue={edit.phone ?? ""} /></Field>
                <Field label="Alamat" className="col-span-2"><Input name="address" defaultValue={edit.address ?? ""} /></Field>
                <Field label="Pajak (%)"><Input name="taxRate" type="number" step="0.5" min={0} max={30} defaultValue={edit.taxRate} /></Field>
                <Field label="Service charge (%)"><Input name="serviceRate" type="number" step="0.5" min={0} max={30} defaultValue={edit.serviceRate} /></Field>
                <Field label="Batas diskon kasir (%)" className="col-span-2" hint="Owner tidak dibatasi"><Input name="maxDiscountPercent" type="number" step="1" min={0} max={100} defaultValue={edit.maxDiscountPercent} /></Field>
                <Field label="Teks bawah struk" className="col-span-2"><Textarea name="receiptFooter" defaultValue={edit.receiptFooter ?? ""} rows={2} /></Field>
              </div>
              <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                Outlet aktif (menerima pesanan QR)
                <Switch checked={active} onCheckedChange={setActive} />
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEdit(null)}>Batal</Button>
                <Button type="submit" loading={pending}>Simpan</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
