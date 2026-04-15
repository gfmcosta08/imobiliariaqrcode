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
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <main className="max-w-5xl text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Imobiliária QR Code
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          QR, leads e Supabase
        </h1>
        <p className="mt-4 text-balance text-zinc-600 dark:text-zinc-400">
          Painel para corretores, página pública do QR com recomendações e registro de interesse.
          Integrações de WhatsApp API e cobrança ficam para a fase final.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-5">
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
            <p className="text-xs text-zinc-500">Corretores ativos</p>
            <p className="mt-1 text-2xl font-semibold">{metrics.active_brokers}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500">Comissão total</p>
            <p className="mt-1 text-2xl font-semibold">{formatBRL(metrics.total_commission)}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Entrar ou cadastrar
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Painel
          </Link>
        </div>
      </main>
    </div>
  );
}
