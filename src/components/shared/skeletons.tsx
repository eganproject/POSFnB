import { Skeleton } from "@/components/ui/misc";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export function MenuSkeleton() {
  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <div className="h-40 animate-pulse bg-gradient-to-br from-primary/50 to-amber-400/40" />
      <div className="-mt-10 space-y-4 px-4">
        <Skeleton className="h-20 rounded-2xl border bg-card" />
        <Skeleton className="h-11 rounded-full" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-full" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-2xl border bg-card p-3.5">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="size-24 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FullScreenSkeleton({ dark }: { dark?: boolean }) {
  return (
    <div className={dark ? "dark flex h-dvh flex-col bg-background" : "flex h-dvh flex-col bg-muted/40"}>
      <div className="h-16 border-b bg-card" />
      <div className="grid flex-1 grid-cols-2 gap-3 p-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
