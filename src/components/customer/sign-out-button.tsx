"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ className, redirectTo = "/akun", label = "Keluar" }: { className?: string; redirectTo?: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading}
      className={className}
      onClick={async () => {
        setLoading(true);
        await authClient.signOut();
        window.location.href = redirectTo;
      }}
    >
      <LogOut className="mr-1 inline size-3.5" /> {loading ? "Keluar…" : label}
    </button>
  );
}
