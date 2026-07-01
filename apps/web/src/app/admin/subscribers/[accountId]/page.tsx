import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import type { SubscriberDashboard } from "@/lib/admin/types";

type PageProps = {
  params: Promise<{ accountId: string }>;
};

function isMissingRpcError(error: { message?: string } | null | undefined, fnName: string) {
  return Boolean(error?.message?.includes(`function public.${fnName}`));
}

async function loadFallbackDashboard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
): Promise<SubscriberDashboard | null> {
  const { data: accountRow, error: accountError } = await supabase
    .from("accounts")
    .select("id, created_at")
    .eq("id", accountId)
    .maybeSingle();

  if (accountError || !accountRow) return null;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, email, whatsapp_number")
    .eq("account_id", accountId)
    .maybeSingle();

  const { data: brokerRow } = await supabase
    .from("brokers")
    .select("display_name, whatsapp_number")
    .eq("account_id", accountId)
    .maybeSingle();

  const { data: subscriptionRow } = await supabase
    .from("subscriptions")
    .select("plan_code, status")
    .eq("account_id", accountId)
    .maybeSingle();

  const { data: properties } = await supabase
    .from("properties")
    .select("id, public_id, title, listing_status, city, state, updated_at")
    .eq("account_id", accountId)
    .order("updated_at", { ascending: false });

  const propertyIds = (properties ?? []).map((prop) => prop.id).filter(Boolean);
  const [qrCount, leadCount] = propertyIds.length
    ? await Promise.all([
        supabase.from("qr_access_events").select("id", { count: "exact", head: true }).in("property_id", propertyIds),
        supabase.from("leads").select("id", { count: "exact", head: true }).in("property_id", propertyIds),
      ])
    : [{ count: 0 }, { count: 0 }];

  const full_name = profileRow?.full_name ?? brokerRow?.display_name ?? "Sem nome";
  const email = profileRow?.email ?? "";
  const whatsapp_number = brokerRow?.whatsapp_number ?? profileRow?.whatsapp_number ?? "";
  const plan_code = subscriptionRow?.plan_code ?? "free";
  const subscription_status = subscriptionRow?.status ?? "free";

  return {
    account: {
      account_id: accountId,
      full_name,
      email,
      whatsapp_number,
      plan_code,
      subscription_status,
      created_at: String(accountRow.created_at ?? ""),
      total_properties: properties?.length ?? 0,
      total_qr_reads: Number(qrCount.count ?? 0),
      total_leads: Number(leadCount.count ?? 0),
      unique_qr_visitors: 0,
    },
    properties: (properties ?? []).map((prop) => ({
      property_id: String(prop.id),
      public_id: String(prop.public_id ?? ""),
      title: String(prop.title ?? prop.public_id ?? ""),
      listing_status: String(prop.listing_status ?? ""),
      city: prop.city ?? null,
      state: prop.state ?? null,
      qr_token: null,
      qr_reads: 0,
      unique_visitors: 0,
      total_leads: 0,
      visit_interest_count: 0,
      updated_at: String(prop.updated_at ?? ""),
    })),
  };
}

export default async function SubscriberDashboardPage(props: PageProps) {
  const { accountId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/dashboard");

  const { data, error } = await supabase.rpc("admin_get_subscriber_dashboard", {
    p_account_id: accountId,
  });

  if (error?.message.includes("account_not_found")) notFound();

  const dashboard = !error
    ? (data as SubscriberDashboard)
    : isMissingRpcError(error, "admin_get_subscriber_dashboard")
      ? await loadFallbackDashboard(supabase, accountId)
      : null;

  if (error && !isMissingRpcError(error, "admin_get_subscriber_dashboard")) {
    throw new Error(error.message);
  }

  if (!dashboard) notFound();

  return <DashboardView accountId={accountId} dashboard={dashboard} />;
}

function DashboardView({ accountId, dashboard }: { accountId: string; dashboard: SubscriberDashboard }) {
  const account = dashboard.account;

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/admin" isAdmin />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <p className="text-sm text-gray-500">
          <Link href="/admin" className="underline">
            Admin
          </Link>{" "}
          /{" "}
          <Link href="/admin/subscribers" className="underline">
            Métricas
          </Link>{" "}
          / {account.full_name}
        </p>

        <h1 className="mt-2 text-3xl font-bold text-gray-900">{account.full_name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {account.email} · {account.whatsapp_number || "Sem telefone"} · Conta{" "}
          <span className="font-mono">{account.account_id}</span>
        </p>
        <p className="text-sm text-gray-500">
          Plano {account.plan_code} ({account.subscription_status})
        </p>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard label="Imóveis" value={account.total_properties} />
          <MetricCard label="Leituras QR" value={account.total_qr_reads} />
          <MetricCard label="Visitantes únicos" value={account.unique_qr_visitors} />
          <MetricCard label="Leads" value={account.total_leads} />
        </div>

        <section className="mt-12">
          <h2 className="text-lg font-bold text-gray-900">Anúncios vinculados</h2>
          <div className="mt-4 overflow-x-auto border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Anúncio</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Leituras</th>
                  <th className="px-4 py-3">Únicos</th>
                  <th className="px-4 py-3">Leads</th>
                  <th className="px-4 py-3">Visitas</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dashboard.properties.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-gray-500">
                      Nenhum anúncio cadastrado.
                    </td>
                  </tr>
                ) : (
                  dashboard.properties.map((prop) => (
                    <tr key={prop.property_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{prop.public_id}</p>
                        <p className="text-xs text-gray-500">{prop.title}</p>
                        <p className="text-xs text-gray-400">
                          {prop.city ?? "—"} / {prop.state ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">{prop.listing_status}</td>
                      <td className="px-4 py-3">{prop.qr_reads}</td>
                      <td className="px-4 py-3">{prop.unique_visitors}</td>
                      <td className="px-4 py-3">{prop.total_leads}</td>
                      <td className="px-4 py-3">{prop.visit_interest_count}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/subscribers/${accountId}/properties/${prop.property_id}`}
                          className="font-medium text-gray-900 underline"
                        >
                          Relatório QR
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-gray-200 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
