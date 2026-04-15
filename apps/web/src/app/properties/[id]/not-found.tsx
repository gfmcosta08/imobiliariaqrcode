import Link from "next/link";

export default function PropertyNotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Imóvel não encontrado</p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Esse registro não existe ou você não tem acesso.
      </p>
      <Link
        href="/properties"
        className="mt-6 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
      >
        Voltar aos imóveis
      </Link>
    </div>
  );
}
