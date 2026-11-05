"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/misc";
import { saveUser } from "@/server/actions/admin";

type U = { id?: string; name: string; email: string; role: Role; outletId: string | null; outletName?: string | null; isActive: boolean };

const ROLE_DESC: Record<Role, string> = {
  OWNER: "Akses penuh semua outlet, menu, laporan",
  KASIR: "POS, pembayaran, shift, pesanan",
  DAPUR: "Layar dapur & stok menu",
  PELAYAN: "Konfirmasi & antar pesanan, input open bill",
};
const ROLE_VARIANT: Record<Role, "dark" | "default" | "info" | "success"> = { OWNER: "dark", KASIR: "default", DAPUR: "info", PELAYAN: "success" };

export function UsersManager({ users, outlets, meId }: { users: U[]; outlets: { id: string; name: string }[]; meId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<U | null>(null);
  const [role, setRole] = useState<Role>("KASIR");
  const [active, setActive] = useState(true);
  const [pending, start] = useTransition();
  const list = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));

  const open = (u: U) => {
    setRole(u.role);
    setActive(u.isActive);
    setEdit(u);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / email" className="pl-9" />
        </div>
        <Button onClick={() => open({ name: "", email: "", role: "KASIR", outletId: outlets[0]?.id ?? null, isActive: true })}>
          <Plus /> Tambah pengguna
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Outlet</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.map((u) => (
              <tr key={u.id} className={cn(!u.isActive && "opacity-55")}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-primary to-amber-500 text-xs font-bold text-white">{initials(u.name)}</span>
                    <div>
                      <p className="font-medium">{u.name} {u.id === meId && <span className="text-xs text-muted-foreground">(Anda)</span>}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABEL[u.role]}</Badge></td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{u.role === "OWNER" ? "Semua outlet" : u.outletName ?? "—"}</td>
                <td className="px-4 py-3">{u.isActive ? <Badge variant="success">Aktif</Badge> : <Badge variant="secondary">Nonaktif</Badge>}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => open(u)} aria-label="Ubah"><Pencil /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
                  const r = await saveUser({
                    id: edit.id,
                    name: String(f.get("name")),
                    email: String(f.get("email")),
                    role,
                    outletId: role === "OWNER" ? null : String(f.get("outletId")),
                    isActive: active,
                    password: String(f.get("password") || "") || undefined,
                  });
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Pengguna disimpan");
                  setEdit(null);
                  router.refresh();
                });
              }}
            >
              <DialogHeader>
                <DialogTitle>{edit.id ? "Ubah pengguna" : "Pengguna baru"}</DialogTitle>
                <DialogDescription>{edit.id ? "Kosongkan password jika tidak ingin menggantinya." : "Bagikan email & password ini ke staf."}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nama" className="col-span-2"><Input name="name" defaultValue={edit.name} required /></Field>
                <Field label="Email"><Input name="email" type="email" defaultValue={edit.email} required /></Field>
                <Field label={edit.id ? "Password baru" : "Password"}><Input name="password" type="text" placeholder={edit.id ? "••••••" : "min. 6 karakter"} minLength={edit.id ? undefined : 6} required={!edit.id} /></Field>
              </div>
              <Field label="Role">
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <button type="button" key={r} onClick={() => setRole(r)} className={cn("rounded-xl border p-3 text-left transition", role === r ? "border-primary bg-primary/6 ring-1 ring-primary" : "hover:bg-muted")}>
                      <p className="text-sm font-semibold">{ROLE_LABEL[r]}</p>
                      <p className="text-[11px] leading-snug text-muted-foreground">{ROLE_DESC[r]}</p>
                    </button>
                  ))}
                </div>
              </Field>
              {role !== "OWNER" && (
                <Field label="Outlet">
                  <NativeSelect name="outletId" defaultValue={edit.outletId ?? outlets[0]?.id}>
                    {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </NativeSelect>
                </Field>
              )}
              <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                Akun aktif (bisa login)
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
    </div>
  );
}
