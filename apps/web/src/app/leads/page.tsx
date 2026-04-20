import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";

export default async function LeadsPage() {
  const supabase = await createClient();

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, nome_completo, primeiro_nome, telefone, client_phone, status, origem, interesses, nome_validado, updated_at, property:properties (public_id, city, state)",
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/leads" />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
        <p className="mt-1 text-sm text-gray-500">
          Clientes que interagiram com seus imóveis via QR Code.
        </p>

        {error ? (
          <p className="mt-4 text-sm text-red-600" role="alert">{error.message}</p>
        ) : null}

        <ul className="mt-8 space-y-3">
          {(leads ?? []).length === 0 ? (
            <li className="border border-dashed border-gray-300 p-12 text-center">
              <p className="text-sm text-gray-500">Nenhum lead ainda.</p>
            </li>
          ) : (
            leads?.map((lead) => {
              const property = lead.property as { public_id?: string; city?: string; state?: string } | null;
              const phone = lead.telefone || lead.client_phone;
              const interests = Array.isArray(lead.interesses) ? lead.interesses.join(", ") : "";

              return (
                <li key={lead.id}>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="flex flex-col border border-gray-200 bg-white p-5 transition hover:border-gray-400 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {lead.nome_completo || lead.primeiro_nome || "Lead sem nome"}
                        {lead.nome_validado ? (
                          <span className="ml-2 bg-[#0055d2] px-1.5 py-0.5 text-xs font-medium text-white">
                            Validado
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {phone || "Sem telefone"} · {property?.public_id ?? "—"} ·{" "}
                        {property?.city ?? "—"} / {property?.state ?? "—"}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {lead.status} · {lead.origem ?? "qr_code_anuncio"}
                        {interests ? ` · ${interests}` : ""}
                      </p>
                    </div>
                    <span className="mt-2 text-sm font-medium text-[#0055d2] sm:mt-0">
                      Ver lead →
                    </span>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </main>
    </div>
  );
}
