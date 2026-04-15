import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

type MyMetrics = {
  total_properties: number;
  total_sold: number;
  total_clients: number;
  total_commission: number;
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, whatsapp_number, role")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_code, status")
    .maybeSingle();

  const isPro = subscription?.plan_code === "pro" && subscription?.status === "pro_active";

  const fallback: MyMetrics = {
    total_properties: 0,
    total_sold: 0,
    total_clients: 0,
    total_commission: 0,
  };

  let metrics = fallback;
  if (isPro) {
    const { data } = await supabase.rpc("get_my_dashboard_metrics");
    if (data && typeof data === "object") {
      const d = data as Partial<MyMetrics>;
      metrics = {
        total_properties: Number(d.total_properties ?? 0),
        total_sold: Number(d.total_sold ?? 0),
        total_clients: Number(d.total_clients ?? 0),
        total_commission: Number(d.total_commission ?? 0),
      };
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Painel</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Conta ativa. Imóveis e QR seguem as regras FREE/PRO no banco de dados.
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">E-mail:</span> {user?.email ?? "—"}
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">Nome:</span> {profile?.full_name ?? "—"}
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">WhatsApp:</span> {profile?.whatsapp_number ?? "—"}
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">Plano:</span> {subscription?.plan_code ?? "—"} ({subscription?.status ?? "—"})
          </p>
          <p className="text-sm">
            <Link href="/profile" className="text-zinc-600 underline dark:text-zinc-400">
              Editar perfil
            </Link>
          </p>
        </div>

        {isPro ? (
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500">Imóveis cadastrados</p>
              <p className="mt-1 text-2xl font-semibold">{metrics.total_properties}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500">Imóveis vendidos</p>
              <p className="mt-1 text-2xl font-semibold">{metrics.total_sold}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500">Clientes atendidos</p>
              <p className="mt-1 text-2xl font-semibold">{metrics.total_clients}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500">Comissão acumulada</p>
              <p className="mt-1 text-2xl font-semibold">{formatBRL(metrics.total_commission)}</p>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Dashboard completo de métricas disponível para assinantes PRO.
            </p>
            <Link
              href="/plans"
              className="mt-3 inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Ver planos
            </Link>
          </div>
        )}

        <nav className="mt-8 flex flex-wrap gap-3">
          <Link href="/properties" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Imóveis
          </Link>
          <Link href="/leads" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:text-zinc-100">
            Leads
          </Link>
          <Link href="/plans" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:text-zinc-100">
            Planos (billing)
          </Link>
          <Link href="/partner" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:text-zinc-100">
            Portal parceiro
          </Link>
          <Link href="/profile" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:text-zinc-100">
            Perfil
          </Link>
        </nav>

        <form className="mt-8" action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            Sair
          </button>
        </form>
        <p className="mt-6 text-sm">
          <Link href="/" className="text-zinc-600 underline dark:text-zinc-400">
            Início
          </Link>
        </p>
      </div>
    </div>
  );
}
