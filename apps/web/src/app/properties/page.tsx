import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const { data: props, error } = await supabase
    .from("properties")
    .select("id, public_id, title, city, state, listing_status, origin_plan_code, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Imóveis</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Limites do plano são aplicados no banco (FREE: 1 ativo).
          </p>
        </div>
        <Link
          href="/properties/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Novo imóvel
        </Link>
      </div>

      {error ? (
        <p className="mt-6 text-sm text-red-600" role="alert">
          {error.message}
        </p>
      ) : null}

      <ul className="mt-8 space-y-3">
        {(props ?? []).length === 0 ? (
          <li className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            Nenhum imóvel ainda.{" "}
            <Link href="/properties/new" className="font-medium underline">
              Cadastrar o primeiro
            </Link>
            .
          </li>
        ) : (
          props?.map((p) => (
            <li key={p.id}>
              <Link
                href={`/properties/${p.id}`}
                className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {p.title ?? p.public_id}{" "}
                    <span className="text-xs font-normal text-zinc-500">({p.public_id})</span>
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {p.city} / {p.state} · {p.listing_status} · plano origem: {p.origin_plan_code}
                  </p>
                </div>
                <span className="mt-2 text-sm text-zinc-500 sm:mt-0">Abrir →</span>
              </Link>
            </li>
          ))
        )}
      </ul>

      <p className="mt-10 text-sm">
        <Link href="/dashboard" className="text-zinc-600 underline dark:text-zinc-400">
          Voltar ao painel
        </Link>
      </p>
    </div>
  );
}
