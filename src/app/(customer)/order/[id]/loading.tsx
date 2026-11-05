import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 pt-14">
      <Skeleton className="h-52 rounded-3xl" />
      <Skeleton className="h-28 rounded-3xl" />
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  );
}
