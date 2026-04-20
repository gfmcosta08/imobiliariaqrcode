import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const { data: props, error } = await supabase
    .from("properties")
    .select("id, public_id, title, city, state, listing_status, origin_plan_code, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/properties" />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Imóveis</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie seus imóveis e QR Codes.
            </p>
          </div>
          <Link
            href="/properties/new"
            className="bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            + Novo imóvel
          </Link>
        </div>

        {error ? (
          <p className="mt-6 text-sm text-red-600" role="alert">{error.message}</p>
        ) : null}

        <ul className="mt-8 space-y-3">
          {(props ?? []).length === 0 ? (
            <li className="border border-dashed border-gray-300 p-12 text-center">
              <p className="text-sm text-gray-500">Nenhum imóvel ainda.</p>
              <Link
                href="/properties/new"
                className="mt-4 inline-block bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                Cadastrar o primeiro
              </Link>
            </li>
          ) : (
            props?.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/properties/${p.id}`}
                  className="flex flex-col border border-gray-200 bg-white p-5 transition hover:border-gray-400 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {p.title ?? p.public_id}{" "}
                      <span className="text-xs font-normal text-gray-400">({p.public_id})</span>
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {p.city ?? "Cidade não informada"} / {p.state ?? "UF"} ·{" "}
                      <span className="text-gray-400">{p.listing_status}</span> ·{" "}
                      <span className="text-gray-400">plano: {p.origin_plan_code}</span>
                    </p>
                  </div>
                  <span className="mt-2 text-sm font-medium text-black sm:mt-0">Abrir →</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </main>
    </div>
  );
}
