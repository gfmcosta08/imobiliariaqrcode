import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { buildDashboardMoneyMetrics, formatResponseTime } from "@/lib/dashboard/metrics";
import { createClient } from "@/lib/supabase/server";

import { ManageSubscriptionButton } from "./manage-subscription-button";

function hasActivePaidPlan(status: string | null | undefined): boolean {
  return status === "starter_active" || status === "pro_active";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, whatsapp_number, role, account_id")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_code, status")
    .maybeSingle();

  const accountId = profile?.account_id as string | undefined;
  const paidPlan = hasActivePaidPlan(subscription?.status);

  const { data: properties } = accountId
    ? await supabase
        .from("properties")
        .select("id, title, listing_status")
        .eq("account_id", accountId)
    : { data: [] };

  const { data: leads } = await supabase
    .from("leads")
    .select("status, property_id, created_at, updated_at");

  let qrScans = 0;
  if (accountId) {
    const propertyIds = (properties ?? []).map((p) => p.id);
    if (propertyIds.length > 0) {
      const { data: qrRows } = await supabase
        .from("property_qrcodes")
        .select("qr_token")
        .in("property_id", propertyIds)
        .eq("is_active", true);
      const tokens = (qrRows ?? []).map((row) => row.qr_token).filter(Boolean);
      if (tokens.length > 0) {
        const { count } = await supabase
          .from("qr_access_events")
          .select("id", { count: "exact", head: true })
          .in("qr_token", tokens);
        qrScans = count ?? 0;
      }
    }
  }

  const metrics = buildDashboardMoneyMetrics({
    properties: properties ?? [],
    leads: leads ?? [],
    qrScans,
  });

  const hasProperties = metrics.totalProperties > 0;

  return (
    <div className="min-h-screen bg-white">
      <AppHeader isAdmin={profile?.role === "admin"} />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900">
          {profile?.full_name ? `Ola, ${profile.full_name.split(" ")[0]}` : "Seu painel"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Acompanhe leads, QR e oportunidades de atendimento em um so lugar.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {!hasProperties ? (
            <Link
              href="/onboarding/primeiro-qr"
              className="bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Criar meu primeiro QR
            </Link>
          ) : null}
          <Link
            href="/properties/new"
            className="border border-gray-300 px-5 py-2.5 text-sm text-gray-700 transition hover:border-gray-500"
          >
            Cadastrar imovel
          </Link>
          <Link
            href="/properties"
            className="border border-gray-300 px-5 py-2.5 text-sm text-gray-700 transition hover:border-gray-500"
          >
            Meus Imoveis
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
        </div>

        <div className="mt-10 border border-gray-200 p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Minha conta</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-gray-400">E-mail</p>
              <p className="mt-1 text-sm font-medium text-gray-800">{user?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Plano</p>
              <p className="mt-1 text-sm font-medium text-gray-800">
                {subscription?.plan_code?.toUpperCase() ?? "FREE"}{" "}
                <span className="text-gray-400">({subscription?.status ?? "—"})</span>
              </p>
            </div>
          </div>
          {paidPlan ? <ManageSubscriptionButton /> : null}
        </div>

        <div className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Oportunidades
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            <MetricCard
              value={String(metrics.leadsTotal)}
              label="Leads gerados"
              testId="dashboard-metric-leads-total"
            />
            <MetricCard
              value={String(metrics.leadsUnanswered)}
              label="Sem resposta"
              testId="dashboard-metric-leads-unanswered"
            />
            <MetricCard
              value={String(metrics.qrScans)}
              label="Leituras de QR"
              testId="dashboard-metric-qr-scans"
            />
            <MetricCard
              value={metrics.topPropertyTitle ?? "—"}
              label={`Top imovel (${metrics.topPropertyLeadCount} leads)`}
            />
            <MetricCard
              value={formatResponseTime(metrics.averageFirstResponseMinutes)}
              label="Tempo 1a resposta"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ value, label, testId }: { value: string; label: string; testId?: string }) {
  return (
    <div className="border border-gray-200 p-5" data-testid={testId}>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}
