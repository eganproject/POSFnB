"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GripVertical, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn, formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/misc";
import { ProductImage } from "@/components/shared/product-image";
import { MoneyInput } from "../../../pos/shift";
import { saveProduct } from "@/server/actions/admin";

type Opt = { id?: string; key: string; name: string; priceDelta: number; isDefault: boolean; isAvailable: boolean };
type Group = { id?: string; key: string; name: string; minSelect: number; maxSelect: number; options: Opt[] };
type FormState = {
  id?: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  emoji: string;
  isActive: boolean;
  isFeatured: boolean;
  groups: Group[];
};

const uid = () => Math.random().toString(36).slice(2);

const PRESETS: { label: string; desc: string; make: () => Group }[] = [
  {
    label: "Varian wajib",
    desc: "Pilih 1, mis. ukuran / suhu",
    make: () => ({ key: uid(), name: "Ukuran", minSelect: 1, maxSelect: 1, options: [{ key: uid(), name: "Regular", priceDelta: 0, isDefault: true, isAvailable: true }, { key: uid(), name: "Large", priceDelta: 5000, isDefault: false, isAvailable: true }] }),
  },
  {
    label: "Add-on opsional",
    desc: "Boleh pilih beberapa, mis. topping",
    make: () => ({ key: uid(), name: "Tambahan", minSelect: 0, maxSelect: 3, options: [{ key: uid(), name: "Extra keju", priceDelta: 5000, isDefault: false, isAvailable: true }] }),
  },
];

export function ProductForm({ categories, initial }: { categories: { id: string; name: string; icon: string | null }[]; initial: FormState }) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const setGroup = (key: string, patch: Partial<Group>) => setF((s) => ({ ...s, groups: s.groups.map((g) => (g.key === key ? { ...g, ...patch } : g)) }));
  const setOpt = (gk: string, ok: string, patch: Partial<Opt>) =>
    setF((s) => ({
      ...s,
      groups: s.groups.map((g) => (g.key === gk ? { ...g, options: g.options.map((o) => (o.key === ok ? { ...o, ...patch } : patch.isDefault && g.maxSelect === 1 ? { ...o, isDefault: false } : o)) } : g)),
    }));
  const cat = categories.find((c) => c.id === f.categoryId);

  const upload = async (file: File) => {
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body }).then((r) => r.json()).catch(() => ({ error: "Upload gagal" }));
    setUploading(false);
    if (res.error) return toast.error(res.error);
    set("imageUrl", res.url);
  };

  const submit = async () => {
    setSaving(true);
    const r = await saveProduct({
      id: f.id,
      categoryId: f.categoryId,
      name: f.name,
      description: f.description || null,
      price: f.price,
      imageUrl: f.imageUrl || null,
      emoji: f.emoji || null,
      isActive: f.isActive,
      isFeatured: f.isFeatured,
      groups: f.groups.map((g) => ({
        id: g.id,
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        options: g.options.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, isDefault: o.isDefault, isAvailable: o.isAvailable })),
      })),
    });
    setSaving(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Menu disimpan");
    router.push(`/dashboard/menu?category=${f.categoryId}`);
    router.refresh();
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard/menu"><ArrowLeft /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{f.id ? "Ubah menu" : "Menu baru"}</h1>
          <p className="text-sm text-muted-foreground">{f.id ? f.name : "Lengkapi info menu, varian & add-on"}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Info dasar</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama menu" className="sm:col-span-2">
                <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Mis. Es Kopi Susu" />
              </Field>
              <Field label="Kategori">
                <NativeSelect value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Harga dasar">
                <MoneyInput value={f.price} onChange={(v) => set("price", v)} />
              </Field>
              <Field label="Deskripsi" className="sm:col-span-2">
                <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Ceritakan bahan, rasa, atau porsi" rows={3} />
              </Field>
              <Field label="Emoji ilustrasi" className="sm:col-span-2" hint="Dipakai sebagai gambar jika belum ada foto. Kosongkan untuk memakai ikon kategori.">
                <div className="flex flex-wrap items-center gap-1.5">
                  {["🍳", "🍗", "🍚", "🍜", "🍝", "🍲", "🍤", "🥟", "🍟", "🍌", "☕", "🧋", "🍵", "🥤", "🍫", "🍧", "🍰", "🍨", "💧", "🌶️"].map((e) => (
                    <button key={e} type="button" onClick={() => set("emoji", f.emoji === e ? "" : e)} className={cn("grid size-9 place-items-center rounded-lg border text-lg transition", f.emoji === e ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted")}>
                      {e}
                    </button>
                  ))}
                  <Input value={f.emoji} onChange={(e) => set("emoji", e.target.value.slice(0, 8))} placeholder="lainnya" className="h-9 w-24" />
                </div>
              </Field>
              <Field label="Foto" className="sm:col-span-2" hint="Upload JPG/PNG/WEBP maks 4 MB, atau tempel URL gambar. Kosongkan untuk ilustrasi otomatis.">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => fileRef.current?.click()} className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed text-muted-foreground transition hover:border-primary hover:text-primary">
                    {uploading ? <Loader2 className="animate-spin" /> : f.imageUrl ? <ProductImage src={f.imageUrl} name={f.name} className="absolute inset-0" /> : <ImagePlus />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                  <Input value={f.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://… atau upload" />
                  {f.imageUrl && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => set("imageUrl", "")}><X /></Button>
                  )}
                </div>
              </Field>
              <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <span><b className="block">Tampilkan</b><span className="text-xs text-muted-foreground">Muncul di menu customer & kasir</span></span>
                <Switch checked={f.isActive} onCheckedChange={(v) => set("isActive", v)} />
              </label>
              <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <span><b className="block">Favorit ⭐</b><span className="text-xs text-muted-foreground">Ditonjolkan di bagian atas</span></span>
                <Switch checked={f.isFeatured} onCheckedChange={(v) => set("isFeatured", v)} />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Varian & add-on</CardTitle>
              <CardDescription>Grup pilihan seperti ukuran, level pedas, atau topping. Harga tambahan bisa 0.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {f.groups.map((g, gi) => (
                <div key={g.key} className="space-y-3 rounded-2xl border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <GripVertical className="mb-2.5 size-4 text-muted-foreground" />
                    <Field label={`Grup ${gi + 1}`} className="min-w-40 flex-1">
                      <Input value={g.name} onChange={(e) => setGroup(g.key, { name: e.target.value })} placeholder="Nama grup" />
                    </Field>
                    <Field label="Min pilih" className="w-24">
                      <Input type="number" min={0} value={g.minSelect} onChange={(e) => setGroup(g.key, { minSelect: Math.max(0, Number(e.target.value)) })} />
                    </Field>
                    <Field label="Maks pilih" className="w-24">
                      <Input type="number" min={1} value={g.maxSelect} onChange={(e) => setGroup(g.key, { maxSelect: Math.max(1, Number(e.target.value)) })} />
                    </Field>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => set("groups", f.groups.filter((x) => x.key !== g.key))} aria-label="Hapus grup">
                      <Trash2 />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {g.minSelect > 0 ? `Wajib pilih ${g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`}` : `Opsional, maksimal ${g.maxSelect}`}
                  </p>
                  <div className="space-y-2">
                    {g.options.map((o) => (
                      <div key={o.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-card p-2">
                        <Input value={o.name} onChange={(e) => setOpt(g.key, o.key, { name: e.target.value })} placeholder="Nama pilihan" className="min-w-36 flex-1" />
                        <div className="w-36">
                          <MoneyInput value={o.priceDelta} onChange={(v) => setOpt(g.key, o.key, { priceDelta: v })} />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs">
                          <input type="checkbox" checked={o.isDefault} onChange={(e) => setOpt(g.key, o.key, { isDefault: e.target.checked })} className="size-4 accent-[var(--primary)]" /> Default
                        </label>
                        <label className="flex items-center gap-1.5 text-xs">
                          <input type="checkbox" checked={o.isAvailable} onChange={(e) => setOpt(g.key, o.key, { isAvailable: e.target.checked })} className="size-4 accent-[var(--primary)]" /> Tersedia
                        </label>
                        <Button variant="ghost" size="icon-sm" onClick={() => setGroup(g.key, { options: g.options.filter((x) => x.key !== o.key) })} aria-label="Hapus pilihan">
                          <X />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => setGroup(g.key, { options: [...g.options, { key: uid(), name: "", priceDelta: 0, isDefault: false, isAvailable: true }] })}>
                      <Plus /> Tambah pilihan
                    </Button>
                  </div>
                </div>
              ))}
              <div className="grid gap-2 sm:grid-cols-2">
                {PRESETS.map((p) => (
                  <button key={p.label} type="button" onClick={() => set("groups", [...f.groups, p.make()])} className="flex items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-left transition hover:border-primary hover:bg-primary/5">
                    <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Plus className="size-4" /></span>
                    <span>
                      <b className="block text-sm">{p.label}</b>
                      <span className="text-xs text-muted-foreground">{p.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="space-y-3 xl:sticky xl:top-6 xl:self-start">
          <p className="text-sm font-semibold text-muted-foreground">Pratinjau di HP customer</p>
          <div className="overflow-hidden rounded-[2rem] border-8 border-foreground/90 bg-background shadow-xl">
            <ProductImage src={f.imageUrl} name={f.name || "Menu"} emoji={f.emoji || cat?.icon} className="aspect-[16/10]" emojiClassName="text-6xl" />
            <div className="space-y-3 p-4">
              <div>
                <p className="text-lg font-bold">{f.name || "Nama menu"}</p>
                <p className="text-xs text-muted-foreground">{f.description || "Deskripsi menu"}</p>
                <p className="mt-1 font-bold text-primary">{formatRupiah(f.price)}</p>
              </div>
              {f.groups.map((g) => (
                <div key={g.key} className="space-y-1.5">
                  <p className="flex justify-between text-sm font-semibold">
                    {g.name || "Grup"} <span className="text-[10px] font-medium text-muted-foreground">{g.minSelect > 0 ? "Wajib" : "Opsional"}</span>
                  </p>
                  {g.options.map((o) => (
                    <div key={o.key} className={cn("flex justify-between rounded-lg border px-2.5 py-1.5 text-xs", o.isDefault && "border-primary bg-primary/5", !o.isAvailable && "opacity-40")}>
                      <span>{o.name || "Pilihan"}</span>
                      {o.priceDelta !== 0 && <span className="text-muted-foreground">+{formatRupiah(o.priceDelta)}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/90 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-7xl justify-end gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <Button asChild variant="outline">
            <Link href="/dashboard/menu">Batal</Link>
          </Button>
          <Button loading={saving} onClick={submit} className="min-w-32">
            Simpan menu
          </Button>
        </div>
      </div>
    </div>
  );
}
