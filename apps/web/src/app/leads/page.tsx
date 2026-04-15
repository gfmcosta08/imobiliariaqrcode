import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, client_phone, intent, status, created_at, property:properties (public_id, city, state)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Leads</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Inclui interesses registrados pela página pública do QR. Automação Uazapi e cobrança online
        entram depois.
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
          leads?.map((l) => {
            const prop = l.property as { public_id?: string; city?: string; state?: string } | null;
            return (
              <li
                key={l.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{l.client_phone}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {prop?.public_id ?? "—"} · {prop?.city ?? "—"} / {prop?.state ?? "—"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {l.intent} · {l.status} · {new Date(l.created_at).toLocaleString("pt-BR")}
                </p>
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
