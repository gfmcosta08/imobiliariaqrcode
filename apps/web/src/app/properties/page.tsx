import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { QuickCreateButton } from "./quick-create-button";
import { SoloActivateButton } from "./solo-activate-button";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const { data: props, error } = await supabase
    .from("properties")
    .select("id, public_id, title, city, state, listing_status, origin_plan_code, updated_at")
    .order("updated_at", { ascending: false });
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_code, status")
    .maybeSingle();

  const activeCount = (props ?? []).filter((property) =>
    ["published", "printed"].includes(property.listing_status ?? ""),
  ).length;
  const eligibleSoloCount = (props ?? []).filter((property) =>
    ["draft", "expired"].includes(property.listing_status ?? ""),
  ).length;
  const needsSoloChoice =
    subscription?.plan_code === "solo" &&
    subscription?.status === "solo_active" &&
    activeCount === 0 &&
    eligibleSoloCount > 0;

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
            <Link
              href="/properties/new"
              className="border border-gray-300 px-5 py-2.5 text-sm text-gray-700 transition hover:border-gray-500"
            >
              Cadastrar manualmente
            </Link>
          </div>
        </div>

        {error ? (
          <p className="mt-6 text-sm text-red-600" role="alert">
            {error.message}
          </p>
        ) : null}

        {needsSoloChoice ? (
          <div className="mt-6 border border-yellow-300 bg-yellow-50 p-5">
            <p className="text-sm font-medium text-yellow-900">
              Escolha 1 imovel para ativar no plano Solo.
            </p>
            <p className="mt-1 text-sm text-yellow-800">
              O Solo permite somente 1 anuncio ativo por 90 dias. Os demais imoveis continuam
              salvos e podem ser ativados depois de um upgrade.
            </p>
          </div>
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
              <li key={p.id} className="border border-gray-200 bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <Link href={`/properties/${p.id}`} className="block transition hover:opacity-80">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {p.title ?? p.public_id}{" "}
                        <span className="text-xs font-normal text-gray-400">({p.public_id})</span>
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {p.city ?? "Cidade nao informada"} / {p.state ?? "UF"} -{" "}
                        <span className="text-gray-400">{p.listing_status}</span> -{" "}
                        <span className="text-gray-400">plano: {p.origin_plan_code}</span>
                      </p>
                    </div>
                  </Link>
                  <div className="shrink-0">
                    <Link href={`/properties/${p.id}`} className="text-sm font-medium text-black">
                      Abrir
                    </Link>
                    {needsSoloChoice && ["draft", "expired"].includes(p.listing_status ?? "") ? (
                      <SoloActivateButton propertyId={p.id} />
                    ) : null}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </main>
    </div>
  );
}
