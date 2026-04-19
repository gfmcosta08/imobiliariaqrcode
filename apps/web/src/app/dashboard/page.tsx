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
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/">
            <span className="font-display text-xl font-normal tracking-tight text-zinc-900 dark:text-zinc-50">
              ImobQR
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/properties"
              className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Imóveis
            </Link>
            <Link
              href="/leads"
              className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Leads
            </Link>
            <Link
              href="/plans"
              className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Planos
            </Link>
            <Link
              href="/profile"
              className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Perfil
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Saudação */}
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">Painel</p>
          <h1 className="font-display mt-2 text-4xl font-normal text-zinc-900 dark:text-zinc-50">
            {profile?.full_name ? `Olá, ${profile.full_name.split(" ")[0]}` : "Seu painel"}
          </h1>
        </div>

        {/* Info da conta */}
        <div className="border border-zinc-100 p-6 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">Conta</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-zinc-400">E-mail</p>
              <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
                {user?.email ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Nome</p>
              <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
                {profile?.full_name ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">WhatsApp</p>
              <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
                {profile?.whatsapp_number ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Plano</p>
              <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
                {subscription?.plan_code?.toUpperCase() ?? "FREE"}{" "}
                <span className="text-zinc-400">({subscription?.status ?? "—"})</span>
              </p>
            </div>
          </div>
          <Link
            href="/profile"
            className="mt-5 inline-block text-xs text-zinc-500 underline underline-offset-2 transition hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Editar perfil
          </Link>
        </div>

        {/* Métricas PRO */}
        {isPro ? (
          <div className="mt-8">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">Métricas</p>
            <div className="mt-6 grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-4">
              <div className="border-l-2 border-zinc-900 pl-4 dark:border-zinc-100">
                <p className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {metrics.total_properties}
                </p>
                <p className="mt-1 text-xs text-zinc-400">Imóveis cadastrados</p>
              </div>
              <div className="border-l-2 border-zinc-900 pl-4 dark:border-zinc-100">
                <p className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {metrics.total_sold}
                </p>
                <p className="mt-1 text-xs text-zinc-400">Imóveis vendidos</p>
              </div>
              <div className="border-l-2 border-zinc-900 pl-4 dark:border-zinc-100">
                <p className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {metrics.total_clients}
                </p>
                <p className="mt-1 text-xs text-zinc-400">Clientes atendidos</p>
              </div>
              <div className="border-l-2 border-zinc-900 pl-4 dark:border-zinc-100">
                <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatBRL(metrics.total_commission)}
                </p>
                <p className="mt-1 text-xs text-zinc-400">Comissão acumulada</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 border border-zinc-100 p-6 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Métricas detalhadas disponíveis no plano PRO.
            </p>
            <Link
              href="/plans"
              className="mt-4 inline-block bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Ver planos
            </Link>
          </div>
        )}

        {/* Navegação rápida */}
        <div className="mt-12 border-t border-zinc-100 pt-10 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            Acesso rápido
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/properties"
              className="border border-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-900 hover:text-white dark:border-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
            >
              Imóveis
            </Link>
            <Link
              href="/leads"
              className="border border-zinc-300 px-5 py-2.5 text-sm text-zinc-700 transition hover:border-zinc-900 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-zinc-300"
            >
              Leads
            </Link>
            <Link
              href="/plans"
              className="border border-zinc-300 px-5 py-2.5 text-sm text-zinc-700 transition hover:border-zinc-900 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-zinc-300"
            >
              Planos
            </Link>
            <Link
              href="/partner"
              className="border border-zinc-300 px-5 py-2.5 text-sm text-zinc-700 transition hover:border-zinc-900 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-zinc-300"
            >
              Portal parceiro
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
