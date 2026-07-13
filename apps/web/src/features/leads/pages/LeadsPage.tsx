import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";

const LEAD_STATUS_LABELS = {
  new: "Novo",
  responded: "Respondido",
  in_service: "Em atendimento",
  visit_scheduled: "Visita marcada",
  lost: "Perdido",
  converted: "Convertido",
  contacted: "Contactado",
  scheduled: "Agendado",
  closed: "Fechado",
  invalid: "Invalido",
} as const;

function statusLabel(status: string | null): string {
  if (!status) return "—";
  return LEAD_STATUS_LABELS[status as keyof typeof LEAD_STATUS_LABELS] ?? status;
}

function statusRank(status: string | null): number {
  if (status === "new") return 0;
  if (status === "contacted" || status === "contact_pending") return 1;
  return 2;
}

export default async function LeadsPage() {
  const supabase = await createClient();

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, nome_completo, primeiro_nome, telefone, client_phone, status, origem, interesses, nome_validado, created_at, updated_at, property:properties (public_id, title, city, state)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const sortedLeads = [...(leads ?? [])].sort((a, b) => {
    const rankDiff = statusRank(a.status) - statusRank(b.status);
    if (rankDiff !== 0) return rankDiff;
    const aTime = new Date(a.created_at ?? 0).getTime();
    const bTime = new Date(b.created_at ?? 0).getTime();
    return bTime - aTime;
  });

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/leads" />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
        <p className="mt-1 text-sm text-gray-500">
          Priorize oportunidades sem resposta e avance no atendimento.
        </p>

        {error ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error.message}
          </p>
        ) : null}

        <ul className="mt-8 space-y-3">
          {sortedLeads.length === 0 ? (
            <li className="border border-dashed border-gray-300 p-12 text-center">
              <p className="text-sm text-gray-500">Nenhum lead ainda.</p>
            </li>
          ) : (
            sortedLeads.map((lead) => {
              const property = lead.property as {
                public_id?: string;
                title?: string;
                city?: string;
                state?: string;
              } | null;
              const phone = lead.telefone || lead.client_phone;
              const interests = Array.isArray(lead.interesses) ? lead.interesses.join(", ") : "";

              return (
                <li key={lead.id} data-testid="lead-list-item">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="flex flex-col border border-gray-200 bg-white p-5 transition hover:border-gray-400 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {lead.nome_completo || lead.primeiro_nome || "Lead sem nome"}
                        <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                          {statusLabel(lead.status)}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {phone || "Sem telefone"} · {property?.title ?? property?.public_id ?? "—"}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {lead.origem ?? "qr_code_anuncio"}
                        {interests ? ` · ${interests}` : ""}
                        {lead.created_at
                          ? ` · ${new Date(lead.created_at).toLocaleString("pt-BR")}`
                          : ""}
                      </p>
                    </div>
                    <span className="mt-2 text-sm font-medium text-black sm:mt-0">Ver lead →</span>
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
