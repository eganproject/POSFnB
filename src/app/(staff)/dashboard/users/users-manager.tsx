"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { ChefHat, ConciergeBell, Pencil, Plus, Search, UserX, Users, Wallet, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Switch } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { saveUser } from "@/server/actions/admin";

type U = { id?: string; name: string; email: string; role: Role; outletId: string | null; outletName?: string | null; isActive: boolean };

const ROLE_DESC: Record<Role, string> = {
  OWNER: "Akses penuh semua outlet, menu, laporan",
  KASIR: "POS, pembayaran, shift, pesanan",
  DAPUR: "Layar dapur & stok menu",
  PELAYAN: "Konfirmasi & antar pesanan, input open bill",
};
const ROLE_ICON: Record<Role, LucideIcon> = { OWNER: Users, KASIR: Wallet, DAPUR: ChefHat, PELAYAN: ConciergeBell };
const ROLE_VARIANT: Record<Role, "dark" | "default" | "info" | "success"> = { OWNER: "dark", KASIR: "default", DAPUR: "info", PELAYAN: "success" };

export function UsersManager({ users, outlets, meId }: { users: U[]; outlets: { id: string; name: string }[]; meId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<U | null>(null);
  const [role, setRole] = useState<Role>("KASIR");
  const [active, setActive] = useState(true);
  const [pending, start] = useTransition();
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const list = users.filter(
    (u) => (roleFilter === "ALL" || u.role === roleFilter) && `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())
  );
  const activeCount = users.filter((u) => u.isActive).length;

  const open = (u: U) => {
    setRole(u.role);
    setActive(u.isActive);
    setEdit(u);
  };

  return (
    <div className="space-y-5">
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total akun", value: users.length, hint: `${activeCount} aktif`, icon: Users },
          ...(["KASIR", "DAPUR", "PELAYAN"] as Role[]).map((r) => ({
            label: ROLE_LABEL[r],
            value: users.filter((u) => u.role === r).length,
            hint: ROLE_DESC[r],
            icon: ROLE_ICON[r],
          })),
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-xs">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <s.icon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold leading-tight tabular">{s.value}</p>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block" title={s.hint}>{s.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / email" className="h-9 pl-9" />
            </div>
            <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1">
              {(["ALL", ...Object.keys(ROLE_LABEL)] as ("ALL" | Role)[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={cn(
                    "h-7 shrink-0 rounded-lg px-2.5 text-xs font-medium transition",
                    roleFilter === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r === "ALL" ? "Semua" : ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
          <Button size="sm" className="h-9 rounded-xl px-3.5" onClick={() => open({ name: "", email: "", role: "KASIR", outletId: outlets[0]?.id ?? null, isActive: true })}>
            <Plus /> Tambah pengguna
          </Button>
        </div>
        {list.length === 0 ? (
          <EmptyState
            icon={<UserX />}
            title="Tidak ada pengguna yang cocok"
            description="Coba kata kunci lain atau ubah filter role."
            className="m-4 border-0"
            action={<Button variant="outline" size="sm" onClick={() => { setQ(""); setRoleFilter("ALL"); }}>Reset pencarian</Button>}
          />
        ) : (
          <Table>
            <THead className="bg-muted/40">
              <tr>
                <TH>Nama</TH>
                <TH>Role</TH>
                <TH className="hidden md:table-cell">Outlet</TH>
                <TH className="hidden sm:table-cell">Status</TH>
                <TH className="w-14" />
              </tr>
            </THead>
            <TBody className="stagger">
              {list.map((u) => (
                <TR key={u.id} className={cn("group", !u.isActive && "opacity-55")}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-amber-500 text-xs font-bold text-white">{initials(u.name)}</span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {u.name} {u.id === meId && <span className="ml-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Anda</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TD>
                  <TD><Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABEL[u.role]}</Badge></TD>
                  <TD className="hidden text-muted-foreground md:table-cell">{u.role === "OWNER" ? "Semua outlet" : u.outletName ?? "—"}</TD>
                  <TD className="hidden sm:table-cell">
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                        <span className="size-1.5 rounded-full bg-success" /> Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-muted-foreground/50" /> Nonaktif
                      </span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground opacity-70 transition group-hover:bg-muted group-hover:opacity-100" onClick={() => open(u)} aria-label={`Ubah ${u.name}`} title="Ubah">
                      <Pencil />
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
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
