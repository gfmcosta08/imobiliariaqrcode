"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
      <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Algo deu errado</p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Tente novamente em instantes.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-none bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Tentar de novo
      </button>
    </div>
  );
}
