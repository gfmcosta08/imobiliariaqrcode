import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";

import { LeadEditorForm } from "./lead-editor-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeadDetailPage(props: PageProps) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .select(
      "id, nome_completo, primeiro_nome, telefone, client_phone, observacoes, interesses, origem, status, nome_validado, created_at, updated_at, property:properties(id, public_id, city, state)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !lead) notFound();

  const { data: interactions } = await supabase
    .from("lead_interactions")
    .select("id, interaction_type, payload, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const property = lead.property as { id?: string; public_id?: string; city?: string; state?: string } | null;

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/leads" />
      <main className="mx-auto max-w-5xl px-8 py-12">
        <p className="text-sm text-gray-400">
          <Link href="/leads" className="transition hover:text-gray-700">Leads</Link>
          {" / "}{lead.nome_completo || lead.primeiro_nome || "Lead"}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">
          {lead.nome_completo || lead.primeiro_nome || "Lead sem nome"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Telefone: {lead.telefone || lead.client_phone} · Origem: {lead.origem}
        </p>
        <p className="text-sm text-gray-500">
          Imóvel: {property?.public_id ?? "—"} · {property?.city ?? "—"} / {property?.state ?? "—"}
        </p>

        {/* Formulário de edição */}
        <div className="mt-8 border border-gray-200 p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Editar lead</h2>
          <div className="mt-5">
            <LeadEditorForm
              leadId={lead.id}
              initial={{
                nome_completo: lead.nome_completo ?? "",
                primeiro_nome: lead.primeiro_nome ?? "",
                observacoes: lead.observacoes ?? "",
                interesses: (lead.interesses as string[] | null) ?? [],
                status: lead.status ?? "new",
                nome_validado: Boolean(lead.nome_validado),
              }}
            />
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-6 border border-gray-200 p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Timeline de interações
          </h2>
          <ul className="mt-5 space-y-3">
            {(interactions ?? []).length === 0 ? (
              <li className="text-sm text-gray-500">Sem interações registradas.</li>
            ) : (
              interactions?.map((item) => (
                <li key={item.id} className="border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-900">{item.interaction_type}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleString("pt-BR")}
                  </p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-gray-600">
                    {JSON.stringify(item.payload ?? {}, null, 2)}
                  </pre>
                </li>
              ))
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
