/** Skeleton genérico para `loading.tsx` (App Router). */
export function PageSkeleton() {
  return (
    <div className="animate-pulse px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-4 w-1/4 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-8 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
