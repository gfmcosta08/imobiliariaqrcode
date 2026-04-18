import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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

  if (error || !lead) {
    notFound();
  }

  const { data: interactions } = await supabase
    .from("lead_interactions")
    .select("id, interaction_type, payload, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const property = lead.property as { id?: string; public_id?: string; city?: string; state?: string } | null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm text-zinc-500">
        <Link href="/leads" className="underline">
          Leads
        </Link>{" "}
        / {lead.nome_completo}
      </p>

      <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Edicao de Lead</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Telefone: {lead.telefone || lead.client_phone} · Origem: {lead.origem}
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Imovel: {property?.public_id ?? "—"} · {property?.city ?? "—"} / {property?.state ?? "—"}
      </p>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
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

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Timeline de Interacoes</h2>
        <ul className="mt-4 space-y-3">
          {(interactions ?? []).length === 0 ? (
            <li className="text-sm text-zinc-500">Sem interacoes registradas.</li>
          ) : (
            interactions?.map((item) => (
              <li key={item.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.interaction_type}</p>
                <p className="mt-1 text-xs text-zinc-500">{new Date(item.created_at).toLocaleString("pt-BR")}</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
                  {JSON.stringify(item.payload ?? {}, null, 2)}
                </pre>
              </li>
            ))
          )}
        </ul>
      </div>

      <p className="mt-10 text-sm">
        <Link href="/dashboard" className="text-zinc-600 underline dark:text-zinc-400">
          Painel
        </Link>
      </p>
    </div>
  );
}
