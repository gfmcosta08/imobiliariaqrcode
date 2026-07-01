import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { getAdminContext } from "@/lib/admin-auth";
import { loadSubscriberDashboard } from "@/lib/admin/subscriber-dashboard";
import type { SubscriberDashboard } from "@/lib/admin/types";

type PageProps = {
  params: Promise<{ accountId: string }>;
};

export default async function SubscriberDashboardPage(props: PageProps) {
  const { accountId } = await props.params;
  const admin = await getAdminContext();

  if (!admin.ok && admin.status === 401) redirect("/login");
  if (!admin.ok && admin.status === 403) redirect("/dashboard");
  if (!admin.ok) throw new Error(admin.error);

  const dashboard = await loadSubscriberDashboard(admin.supabase, accountId);

  if (!dashboard) notFound();

  return <DashboardView accountId={dashboard.account.account_id} dashboard={dashboard} />;
}

function DashboardView({
  accountId,
  dashboard,
}: {
  accountId: string;
  dashboard: SubscriberDashboard;
}) {
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

        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          Visitantes unicos sao visitantes distintos estimados na conta inteira. Na tabela, a coluna
          Unicos mostra esse mesmo calculo por imovel, entao a soma das linhas pode ser maior quando
          a mesma pessoa acessa mais de um anuncio.
        </p>

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
