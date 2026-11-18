"use client";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/shared/google-icon";
import { cn } from "@/lib/utils";

/** Login / daftar pelanggan dengan Google. Akun baru otomatis berperan pelanggan. */
export function GoogleSignIn({ next = "/akun", className, label = "Masuk dengan Google" }: { next?: string; className?: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/akun";
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={cn("w-full bg-card", className)}
      loading={loading}
      onClick={async () => {
        setLoading(true);
        const { error } = await authClient.signIn.social({
          provider: "google",
          callbackURL: safeNext,
          errorCallbackURL: "/akun",
        });
        if (error) {
          setLoading(false);
          toast.error(error.message || "Gagal membuka login Google");
        }
      }}
    >
      {!loading && <GoogleIcon />} {label}
    </Button>
  );
}
