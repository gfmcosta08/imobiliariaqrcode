import Link from "next/link";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

type GlobalMetrics = {
  total_properties: number;
  total_sold: number;
  total_clients: number;
  active_brokers: number;
  total_commission: number;
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function Home() {
  const fallback: GlobalMetrics = {
    total_properties: 0,
    total_sold: 0,
    total_clients: 0,
    active_brokers: 0,
    total_commission: 0,
  };

  let metrics = fallback;
  try {
    const sb = createServiceRoleClient();
    const { data } = await sb.rpc("get_global_dashboard_metrics");
    if (data && typeof data === "object") {
      const d = data as Partial<GlobalMetrics>;
      metrics = {
        total_properties: Number(d.total_properties ?? 0),
        total_sold: Number(d.total_sold ?? 0),
        total_clients: Number(d.total_clients ?? 0),
        active_brokers: Number(d.active_brokers ?? 0),
        total_commission: Number(d.total_commission ?? 0),
      };
    }
  } catch {
    metrics = fallback;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-zinc-950">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-display text-xl font-normal tracking-tight text-zinc-900 dark:text-zinc-50">
            ImobQR
          </span>
          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Painel
            </Link>
            <Link
              href="/login"
              className="rounded-none border border-zinc-900 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-900 hover:text-white dark:border-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="mx-auto flex w-full max-w-6xl flex-col items-start px-6 py-24 lg:py-36">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            Plataforma imobiliária
          </p>
          <h1 className="font-display mt-4 max-w-2xl text-5xl font-normal leading-tight tracking-tight text-zinc-900 dark:text-zinc-50 lg:text-6xl">
            Imóveis com QR, leads e inteligência
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-zinc-500 dark:text-zinc-400">
            Painel completo para corretores: QR Code por imóvel, captura automática de leads via
            WhatsApp e recomendações inteligentes.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="bg-zinc-900 px-8 py-3.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Começar agora
            </Link>
            <Link
              href="/dashboard"
              className="border border-zinc-300 px-8 py-3.5 text-sm font-medium text-zinc-900 transition hover:border-zinc-900 dark:border-zinc-600 dark:text-zinc-100 dark:hover:border-zinc-300"
            >
              Acessar painel
            </Link>
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-zinc-100 dark:border-zinc-800" />

        {/* Metrics */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            Números da plataforma
          </p>
          <div className="mt-8 grid grid-cols-2 gap-x-12 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            <div className="border-l-2 border-zinc-900 pl-4 dark:border-zinc-100">
              <p className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {metrics.total_properties}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Imóveis cadastrados</p>
            </div>
            <div className="border-l-2 border-zinc-900 pl-4 dark:border-zinc-100">
              <p className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {metrics.total_sold}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Imóveis vendidos</p>
            </div>
            <div className="border-l-2 border-zinc-900 pl-4 dark:border-zinc-100">
              <p className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {metrics.total_clients}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Clientes atendidos</p>
            </div>
            <div className="border-l-2 border-zinc-900 pl-4 dark:border-zinc-100">
              <p className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {metrics.active_brokers}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Corretores ativos</p>
            </div>
            <div className="border-l-2 border-zinc-900 pl-4 dark:border-zinc-100">
              <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatBRL(metrics.total_commission)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Comissão total</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-100 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <span className="font-display text-sm text-zinc-400">ImobQR</span>
          <p className="text-xs text-zinc-400">Plataforma imobiliária</p>
        </div>
      </footer>
    </div>
  );
}
