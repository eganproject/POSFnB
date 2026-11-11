import * as React from "react";
import { cn } from "@/lib/utils";

/** Tabel bergaya seragam: header lembut, baris hover, scroll horizontal di layar kecil */
export function Table({ className, wrapperClassName, ...props }: React.ComponentProps<"table"> & { wrapperClassName?: string }) {
  return (
    <div className={cn("overflow-x-auto", wrapperClassName)}>
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}
export function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("text-left text-[11px] uppercase tracking-wider text-muted-foreground [&_tr]:border-b", className)} {...props} />;
}
export function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-border/70", className)} {...props} />;
}
export function TR({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-muted/40", className)} {...props} />;
}
export function TH({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={cn("h-11 px-4 font-semibold first:pl-5 last:pr-5", className)} {...props} />;
}
export function TD({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 first:pl-5 last:pr-5", className)} {...props} />;
}
