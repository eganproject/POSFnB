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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function LoginForm({ next, showDemo, googleEnabled }: { next?: string; showDemo: boolean; googleEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/login";

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
    window.location.href = safeNext;
  };

  const signInGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: safeNext,
      // Saat gagal (mis. email belum terdaftar), kembali ke halaman login dengan ?error=...
      errorCallbackURL: "/login",
    });
    if (error) {
      setGoogleLoading(false);
      toast.error(error.message || "Gagal membuka login Google");
    }
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
      {googleEnabled && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> atau <div className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" size="lg" className="w-full" loading={googleLoading} disabled={loading} onClick={signInGoogle}>
            {!googleLoading && <GoogleIcon />} Masuk dengan Google
          </Button>
        </div>
      )}
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
