"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, ExternalLink, MoreVertical, Pencil, Plus, Printer, RefreshCw, Rows3, ShoppingBag, Trash2, TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Switch, EmptyState } from "@/components/ui/misc";
import { bulkCreateTables, deleteTable, regenerateTableQr, saveTable } from "@/server/actions/admin";

type T = { id: string; name: string; area: string | null; capacity: number; isActive: boolean; token: string; url: string; qr: string; activeOrders: number };

export function TablesManager({ canEdit, outletId, tables, takeaway, localhostWarning }: { canEdit: boolean; outletId: string; tables: T[]; takeaway: { url: string; qr: string }; localhostWarning: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Partial<T> | null>(null);
  const [bulk, setBulk] = useState(false);
  const [preview, setPreview] = useState<T | null>(null);
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(msg);
        router.refresh();
      }
    });

  const copy = (url: string) => navigator.clipboard.writeText(url).then(() => toast.success("Link disalin"));
  const download = (t: { name: string; qr: string }) => {
    const a = document.createElement("a");
    a.href = t.qr;
    a.download = `QR-${t.name.replace(/\s+/g, "-")}.png`;
    a.click();
  };

  return (
    <div className="space-y-5">
      {localhostWarning && (
        <div className="flex gap-3 rounded-2xl border border-warning/50 bg-warning/10 p-4 text-sm">
          <TriangleAlert className="size-5 shrink-0 text-[oklch(0.55_0.13_70)]" />
          <p>
            QR saat ini mengarah ke <b>localhost</b>, jadi tidak bisa dibuka dari HP. Isi <code>NEXT_PUBLIC_APP_URL</code> di <code>.env</code> dengan IP laptop
            (mis. <code>http://192.168.1.10:3000</code>) lalu restart server agar QR bisa discan.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <Button onClick={() => setEdit({ capacity: 4, isActive: true })}>
              <Plus /> Tambah meja
            </Button>
            <Button variant="outline" onClick={() => setBulk(true)}>
              <Rows3 /> Tambah banyak
            </Button>
          </>
        )}
        <Button variant="outline" asChild>
          <a href="/print/tables" target="_blank" rel="noreferrer">
            <Printer /> Cetak semua QR
          </a>
        </Button>
        <Button variant="ghost" onClick={() => setPreview({ id: "takeaway", name: "Takeaway", area: null, capacity: 0, isActive: true, token: "", url: takeaway.url, qr: takeaway.qr, activeOrders: 0 })}>
          <ShoppingBag /> QR takeaway
        </Button>
      </div>

      {tables.length === 0 ? (
        <EmptyState icon={<Rows3 />} title="Belum ada meja" description="Tambahkan meja untuk membuat QR pemesanan." className="bg-card" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {tables.map((t) => (
            <div key={t.id} className={cn("group rounded-2xl border bg-card p-4 shadow-xs transition hover:shadow-md", !t.isActive && "opacity-60")}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold">{t.name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t.area ?? "Tanpa area"} · <Users className="size-3" /> {t.capacity}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      !t.isActive ? "bg-muted text-muted-foreground" : t.activeOrders ? "bg-primary/12 text-primary" : "bg-success/12 text-success"
                    )}
                  >
                    {!t.isActive ? "Nonaktif" : t.activeOrders ? `${t.activeOrders} pesanan` : "Kosong"}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-lg p-1.5 hover:bg-muted">
                      <MoreVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => copy(t.url)}><Copy /> Salin link</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => window.open(t.url, "_blank")}><ExternalLink /> Buka menu</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => download(t)}><Download /> Unduh QR</DropdownMenuItem>
                      {canEdit && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setEdit(t)}><Pencil /> Ubah</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => confirm(`Buat QR baru untuk ${t.name}? QR lama tidak bisa dipakai lagi.`) && act(() => regenerateTableQr(t.id), "QR baru dibuat")}>
                            <RefreshCw /> Ganti QR
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onSelect={() => confirm(`Hapus ${t.name}?`) && act(() => deleteTable(t.id), "Meja dihapus")}>
                            <Trash2 className="!text-destructive" /> Hapus
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <button onClick={() => setPreview(t)} className="mx-auto mt-3 block rounded-xl border bg-white p-2 transition group-hover:scale-[1.02]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.qr} alt={`QR ${t.name}`} className="size-36" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit / tambah */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-md">
          {edit && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                start(async () => {
                  const r = await saveTable({
                    id: edit.id,
                    outletId,
                    name: String(f.get("name")),
                    area: String(f.get("area") || "") || null,
                    capacity: Number(f.get("capacity")) || 1,
                    isActive: f.get("isActive") === "on",
                  });
                  if (!r.ok) { toast.error(r.error); return; }
                  toast.success("Meja disimpan");
                  setEdit(null);
                  router.refresh();
                });
              }}
            >
              <DialogHeader>
                <DialogTitle>{edit.id ? `Ubah ${edit.name}` : "Tambah meja"}</DialogTitle>
              </DialogHeader>
              <Field label="Nama meja">
                <Input name="name" defaultValue={edit.name} placeholder="Meja 01" required autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Area">
                  <Input name="area" defaultValue={edit.area ?? ""} placeholder="Indoor / Outdoor" />
                </Field>
                <Field label="Kapasitas">
                  <Input name="capacity" type="number" min={1} defaultValue={edit.capacity ?? 4} />
                </Field>
              </div>
              <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                Aktif (bisa menerima pesanan)
                <SwitchInput name="isActive" defaultChecked={edit.isActive ?? true} />
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEdit(null)}>Batal</Button>
                <Button type="submit" loading={pending}>Simpan</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk */}
      <Dialog open={bulk} onOpenChange={setBulk}>
        <DialogContent className="max-w-md">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              start(async () => {
                const r = await bulkCreateTables(outletId, String(f.get("prefix")), Number(f.get("from")), Number(f.get("to")), String(f.get("area") || ""));
                if (!r.ok) { toast.error(r.error); return; }
                toast.success(`${r.data.created} meja ditambahkan`);
                setBulk(false);
                router.refresh();
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Tambah banyak meja</DialogTitle>
              <DialogDescription>Contoh: awalan “Meja”, 1 sampai 10 → Meja 01 … Meja 10.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Awalan nama"><Input name="prefix" defaultValue="Meja" /></Field>
              <Field label="Area"><Input name="area" placeholder="Indoor" /></Field>
              <Field label="Dari nomor"><Input name="from" type="number" defaultValue={tables.length + 1} min={1} /></Field>
              <Field label="Sampai nomor"><Input name="to" type="number" defaultValue={tables.length + 5} min={1} /></Field>
            </div>
            <DialogFooter>
              <Button type="submit" loading={pending}>Buat meja</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview QR */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-sm text-center">
          {preview && (
            <>
              <DialogHeader className="items-center pr-0">
                <DialogTitle>{preview.id === "takeaway" ? "QR Takeaway" : preview.name}</DialogTitle>
                <DialogDescription className="break-all text-xs">{preview.url}</DialogDescription>
              </DialogHeader>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.qr} alt="QR" className="mx-auto size-64 rounded-xl border bg-white p-2" />
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" onClick={() => copy(preview.url)}><Copy /> Salin</Button>
                <Button variant="outline" onClick={() => window.open(preview.url, "_blank")}><ExternalLink /> Buka</Button>
                <Button onClick={() => download(preview)}><Download /> Unduh</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Switch yang ikut terkirim di FormData */
function SwitchInput({ name, defaultChecked }: { name: string; defaultChecked: boolean }) {
  const [v, setV] = useState(defaultChecked);
  return (
    <>
      <Switch checked={v} onCheckedChange={setV} />
      {v && <input type="hidden" name={name} value="on" />}
    </>
  );
}
