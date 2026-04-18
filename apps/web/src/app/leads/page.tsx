import Link from "next/link";
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Leads</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Clique em um lead para editar nome, observacoes e interesses.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error.message}
        </p>
      ) : null}

      <ul className="mt-6 space-y-3">
        {(leads ?? []).length === 0 ? (
          <li className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            Nenhum lead ainda.
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
                  className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                >
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {lead.nome_completo || lead.primeiro_nome || "Lead sem nome"}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {phone || "Sem telefone"} · {property?.public_id ?? "—"} · {property?.city ?? "—"} / {property?.state ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {lead.status} · {lead.origem ?? "qr_code_anuncio"} · nome_validado: {lead.nome_validado ? "sim" : "nao"}
                  </p>
                  <p className="text-xs text-zinc-500">Interesses: {interests || "—"}</p>
                </Link>
              </li>
            );
          })
        )}
      </ul>

      <p className="mt-10 text-sm">
        <Link href="/dashboard" className="text-zinc-600 underline dark:text-zinc-400">
          Painel
        </Link>
      </p>
    </div>
  );
}
