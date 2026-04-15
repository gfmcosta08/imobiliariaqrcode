import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
      <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Página não encontrada</p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Verifique o endereço ou volte ao início.
      </p>
      <Link
        href="/"
        className="mt-6 text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
      >
        Início
      </Link>
    </div>
  );
}
