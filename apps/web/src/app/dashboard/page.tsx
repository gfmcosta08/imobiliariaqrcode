import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";

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
    <div className="min-h-screen bg-white">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900">
          {profile?.full_name ? `Olá, ${profile.full_name.split(" ")[0]}` : "Seu painel"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Bem-vindo ao seu painel de corretagem.</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/properties"
            className="bg-[#0055d2] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0044b0]"
          >
            Meus Imóveis
          </Link>
          <Link
            href="/leads"
            className="border border-gray-300 px-5 py-2.5 text-sm text-gray-700 transition hover:border-gray-500"
          >
            Leads
          </Link>
          <Link
            href="/plans"
            className="border border-gray-300 px-5 py-2.5 text-sm text-gray-700 transition hover:border-gray-500"
          >
            Planos
          </Link>
          <Link
            href="/partner"
            className="border border-gray-300 px-5 py-2.5 text-sm text-gray-700 transition hover:border-gray-500"
          >
            Portal parceiro
          </Link>
        </div>

        <div className="mt-10 border border-gray-200 p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Minha conta</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-gray-400">E-mail</p>
              <p className="mt-1 text-sm font-medium text-gray-800">{user?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Nome</p>
              <p className="mt-1 text-sm font-medium text-gray-800">{profile?.full_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">WhatsApp</p>
              <p className="mt-1 text-sm font-medium text-gray-800">{profile?.whatsapp_number ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Plano</p>
              <p className="mt-1 text-sm font-medium text-gray-800">
                {subscription?.plan_code?.toUpperCase() ?? "FREE"}{" "}
                <span className="text-gray-400">({subscription?.status ?? "—"})</span>
              </p>
            </div>
          </div>
          <Link
            href="/profile"
            className="mt-5 inline-block text-sm font-medium text-[#0055d2] transition hover:underline"
          >
            Editar perfil
          </Link>
        </div>

        {isPro ? (
          <div className="mt-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Métricas</h2>
            <div className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div className="border border-gray-200 p-5">
                <p className="text-3xl font-bold text-gray-900">{metrics.total_properties}</p>
                <p className="mt-1 text-xs text-gray-500">Imóveis cadastrados</p>
              </div>
              <div className="border border-gray-200 p-5">
                <p className="text-3xl font-bold text-gray-900">{metrics.total_sold}</p>
                <p className="mt-1 text-xs text-gray-500">Imóveis vendidos</p>
              </div>
              <div className="border border-gray-200 p-5">
                <p className="text-3xl font-bold text-gray-900">{metrics.total_clients}</p>
                <p className="mt-1 text-xs text-gray-500">Clientes atendidos</p>
              </div>
              <div className="border border-gray-200 p-5">
                <p className="text-2xl font-bold text-gray-900">{formatBRL(metrics.total_commission)}</p>
                <p className="mt-1 text-xs text-gray-500">Comissão acumulada</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 border border-gray-200 bg-gray-50 p-6">
            <p className="text-sm text-gray-600">Métricas detalhadas disponíveis no plano PRO.</p>
            <Link
              href="/plans"
              className="mt-4 inline-block bg-[#0055d2] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0044b0]"
            >
              Ver planos
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
