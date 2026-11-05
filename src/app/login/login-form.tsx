"use client";
import { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const DEMO = [
  { role: "Owner", email: "owner@santap.id", emoji: "👑" },
  { role: "Kasir", email: "kasir@santap.id", emoji: "💳" },
  { role: "Dapur", email: "dapur@santap.id", emoji: "👨‍🍳" },
  { role: "Pelayan", email: "pelayan@santap.id", emoji: "🛎️" },
];

export function LoginForm({ next, showDemo }: { next?: string; showDemo: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent, creds?: { email: string; password: string }) => {
    e?.preventDefault();
    setLoading(true);
    const { error } = await authClient.signIn.email({
      email: creds?.email ?? email,
      password: creds?.password ?? password,
    });
    if (error) {
      setLoading(false);
      toast.error(error.status === 401 ? "Email atau password salah" : error.message || "Gagal masuk");
      return;
    }
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/login";
    window.location.href = safeNext;
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@resto.id" className="h-11" />
        </Field>
        <Field label="Password">
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 pr-11"
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          <LogIn /> Masuk
        </Button>
      </form>
      {showDemo && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> Akun demo (password123) <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                disabled={loading}
                onClick={() => submit(undefined, { email: d.email, password: "password123" })}
                className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition hover:border-primary hover:bg-primary/5"
              >
                <span className="text-lg">{d.emoji}</span>
                <span>
                  <span className="block font-semibold">{d.role}</span>
                  <span className="block text-[11px] text-muted-foreground">{d.email}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
