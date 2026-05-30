import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { isPropertyImportEnabled } from "@/lib/property-import/enabled";
import { createClient } from "@/lib/supabase/server";
import { ImportListingsButton } from "./import-listings-button";
import { QuickCreateButton } from "./quick-create-button";

function statusLabel(status: string | null | undefined): string {
  if (status === "draft") return "Rascunho";
  if (status === "published") return "Disponivel";
  if (status === "printed") return "Impresso";
  if (status === "expired") return "Expirado";
  if (status === "removed") return "Removido";
  if (status === "blocked") return "Bloqueado";
  return status ?? "Nao informado";
}

export default async function PropertiesPage() {
  const importEnabled = isPropertyImportEnabled();
  const supabase = await createClient();
  const { data: props, error } = await supabase
    .from("properties")
    .select("id, public_id, title, city, state, listing_status, origin_plan_code, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/properties" />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Imoveis</h1>
            <p className="mt-1 text-sm text-gray-500">Gerencie seus imoveis e QR Codes.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <QuickCreateButton />
            <ImportListingsButton enabled={importEnabled} />
          </div>
        </div>

        {error ? (
          <p className="mt-6 text-sm text-red-600" role="alert">
            {error.message}
          </p>
        ) : null}

        <ul className="mt-8 space-y-3">
          {(props ?? []).length === 0 ? (
            <li className="border border-dashed border-gray-300 p-12 text-center">
              <p className="text-sm text-gray-500">Nenhum imovel ainda.</p>
              <div className="mt-4 flex justify-center">
                <QuickCreateButton />
              </div>
            </li>
          ) : (
            props?.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/properties/${p.id}`}
                  data-testid="properties-list-item"
                  className="flex flex-col border border-gray-200 bg-white p-5 transition hover:border-gray-400 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900" data-testid="properties-list-title">
                      {p.title ?? p.public_id}{" "}
                      <span className="text-xs font-normal text-gray-400">({p.public_id})</span>
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {p.city ?? "Cidade nao informada"} / {p.state ?? "UF"} -{" "}
                      <span className="text-gray-400">{statusLabel(p.listing_status)}</span> -{" "}
                      <span className="text-gray-400">plano: {p.origin_plan_code}</span>
                    </p>
                  </div>
                  <span className="mt-2 text-sm font-medium text-black sm:mt-0">Abrir</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </main>
    </div>
  );
}
