import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { deviceLabel, type DeviceClass } from "@/lib/admin/parse-user-agent";
import { buildGoogleMapsUrl, hasPropertyLocation } from "@/lib/admin/google-maps";
import type { PropertyQrMetrics } from "@/lib/admin/types";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ accountId: string; propertyId: string }>;
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function isMissingRpcError(error: { message?: string } | null | undefined, fnName: string) {
  return Boolean(error?.message?.includes(`function public.${fnName}`));
}

async function loadFallbackPropertyMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
): Promise<PropertyQrMetrics | null> {
  const { data: propertyRow, error: propertyError } = await supabase
    .from("properties")
    .select(
      "id, account_id, public_id, title, listing_status, city, state, neighborhood, full_address, latitude, longitude, updated_at",
    )
    .eq("id", propertyId)
    .maybeSingle();

  if (propertyError || !propertyRow) return null;

  const { data: qrRows } = await supabase
    .from("qr_access_events")
    .select("id, created_at, source, user_agent, ip_hash")
    .eq("property_id", propertyId);

  const { data: leadRows } = await supabase
    .from("leads")
    .select("id, nome_completo, telefone, intent, status, origem, created_at, updated_at")
    .eq("property_id", propertyId);

  const total_scans = qrRows?.length ?? 0;
  const unique_visitors = new Set(
    (qrRows ?? [])
      .map((row) => String((row as { ip_hash?: string | null }).ip_hash ?? ""))
      .filter(Boolean),
  ).size;

  const summary = {
    total_scans,
    unique_visitors,
    total_leads: leadRows?.length ?? 0,
    visit_interest_count: leadRows?.filter((lead) => lead.intent === "visit_interest").length ?? 0,
    qr_entry_count: 0,
    similar_interest_count: 0,
    public_qr_interest_count: 0,
    conversion_scan_to_lead:
      total_scans > 0 ? Number((((leadRows?.length ?? 0) / total_scans) * 100).toFixed(2)) : 0,
    conversion_scan_to_visit:
      total_scans > 0
        ? Number(
            (
              ((leadRows?.filter((lead) => lead.intent === "visit_interest").length ?? 0) /
                total_scans) *
              100
            ).toFixed(2),
          )
        : 0,
    first_scan_at: qrRows?.[0]?.created_at ?? null,
    last_scan_at: qrRows?.[0]?.created_at ?? null,
  };

  return {
    property: {
      property_id: String(propertyRow.id),
      account_id: String(propertyRow.account_id),
      public_id: String(propertyRow.public_id ?? ""),
      title: String(propertyRow.title ?? propertyRow.public_id ?? ""),
      listing_status: String(propertyRow.listing_status ?? ""),
      city: propertyRow.city ?? null,
      state: propertyRow.state ?? null,
      neighborhood: propertyRow.neighborhood ?? null,
      full_address: propertyRow.full_address ?? null,
      latitude: propertyRow.latitude ?? null,
      longitude: propertyRow.longitude ?? null,
      qr_token: null,
    },
    summary,
    scans_by_day: [],
    scans_by_hour: [],
    device_breakdown: [],
    recent_scans: (qrRows ?? []).slice(0, 50).map((row) => ({
      id: String(row.id),
      created_at: String(row.created_at),
      source: String(row.source ?? "unknown"),
      device: "unknown",
      user_agent: String((row as { user_agent?: string | null }).user_agent ?? ""),
      has_ip_hash: Boolean((row as { ip_hash?: string | null }).ip_hash),
    })),
    leads: (leadRows ?? []).map((lead) => ({
      id: String(lead.id),
      nome_completo: String(lead.nome_completo ?? ""),
      telefone: String(lead.telefone ?? ""),
      intent: String(lead.intent ?? ""),
      status: String(lead.status ?? ""),
      origem: String(lead.origem ?? ""),
      created_at: String(lead.created_at ?? ""),
      updated_at: String(lead.updated_at ?? ""),
    })),
    interactions: [],
    location_note:
      "Fallback local: algumas métricas detalhadas podem estar zeradas enquanto a RPC não estiver disponível.",
  };
}

export default async function PropertyMetricsPage(props: PageProps) {
  const { accountId, propertyId } = await props.params;
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

  const { data, error } = await supabase.rpc("admin_get_property_qr_metrics", {
    p_property_id: propertyId,
  });

  if (error?.message.includes("property_not_found")) notFound();

  const metrics = !error
    ? (data as PropertyQrMetrics)
    : isMissingRpcError(error, "admin_get_property_qr_metrics")
      ? await loadFallbackPropertyMetrics(supabase, propertyId)
      : null;

  if (error && !isMissingRpcError(error, "admin_get_property_qr_metrics")) {
    throw new Error(error.message);
  }

  if (!metrics) notFound();

  const { property, summary } = metrics;
  const hasLocation = hasPropertyLocation(property.latitude, property.longitude);

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/admin" isAdmin />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <p className="text-sm text-gray-500">
          <Link href="/admin/subscribers" className="underline">
            Métricas
          </Link>{" "}
          /{" "}
          <Link href={`/admin/subscribers/${accountId}`} className="underline">
            Assinante
          </Link>{" "}
          / {property.public_id}
        </p>

        <h1 className="mt-2 text-3xl font-bold text-gray-900">
          Relatório QR — {property.public_id}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {property.title} · {property.listing_status}
        </p>
        {property.qr_token && (
          <p className="mt-1 font-mono text-xs text-gray-400">Token: {property.qr_token}</p>
        )}

        <div className="mt-6 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {metrics.location_note}
        </div>

        {hasLocation && (
          <div className="mt-6 border border-gray-200 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">
              Localização do imóvel
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              {property.full_address ?? "—"}
              {property.neighborhood ? ` · ${property.neighborhood}` : ""}
              {property.city || property.state
                ? ` · ${property.city ?? ""}${property.state ? `/${property.state}` : ""}`
                : ""}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Lat {property.latitude}, Lng {property.longitude}
            </p>
            <a
              href={buildGoogleMapsUrl(Number(property.latitude), Number(property.longitude))}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-medium text-gray-900 underline"
            >
              Abrir no Google Maps
            </a>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <MetricCard label="Leituras QR" value={summary.total_scans} />
          <MetricCard label="Visitantes únicos" value={summary.unique_visitors} />
          <MetricCard label="Leads totais" value={summary.total_leads} />
          <MetricCard label="Pedidos de visita" value={summary.visit_interest_count} />
          <MetricCard label="Contato via QR (WhatsApp)" value={summary.qr_entry_count} />
          <MetricCard label="Interesse similares" value={summary.similar_interest_count} />
          <MetricCard label="Conv. scan → lead" value={`${summary.conversion_scan_to_lead}%`} />
          <MetricCard label="Conv. scan → visita" value={`${summary.conversion_scan_to_visit}%`} />
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Primeira leitura: {fmtDate(summary.first_scan_at)} · Última:{" "}
          {fmtDate(summary.last_scan_at)}
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="text-lg font-bold text-gray-900">Leituras por dia (90d)</h2>
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
              {metrics.scans_by_day.length === 0 ? (
                <li className="text-gray-500">Sem dados.</li>
              ) : (
                metrics.scans_by_day.map((row) => (
                  <li key={row.day} className="flex justify-between border-b border-gray-100 py-1">
                    <span>{row.day}</span>
                    <span className="font-medium">{row.count}</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900">Por dispositivo</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {metrics.device_breakdown.length === 0 ? (
                <li className="text-gray-500">Sem dados.</li>
              ) : (
                metrics.device_breakdown.map((row) => (
                  <li
                    key={row.device}
                    className="flex justify-between border-b border-gray-100 py-1"
                  >
                    <span>{deviceLabel(row.device as DeviceClass)}</span>
                    <span className="font-medium">{row.count}</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-gray-900">Leituras recentes</h2>
          <div className="mt-4 overflow-x-auto border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Data/hora</th>
                  <th className="px-4 py-2">Dispositivo</th>
                  <th className="px-4 py-2">Origem</th>
                  <th className="px-4 py-2">User-Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {metrics.recent_scans.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-gray-500">
                      Nenhuma leitura registrada.
                    </td>
                  </tr>
                ) : (
                  metrics.recent_scans.map((scan) => (
                    <tr key={scan.id}>
                      <td className="px-4 py-2 whitespace-nowrap">{fmtDate(scan.created_at)}</td>
                      <td className="px-4 py-2">{deviceLabel(scan.device as DeviceClass)}</td>
                      <td className="px-4 py-2">{scan.source}</td>
                      <td className="max-w-xs truncate px-4 py-2 text-xs text-gray-500">
                        {scan.user_agent || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-gray-900">Leads e conversões</h2>
          <div className="mt-4 overflow-x-auto border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Telefone</th>
                  <th className="px-4 py-2">Intent</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Criado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {metrics.leads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-gray-500">
                      Nenhum lead.
                    </td>
                  </tr>
                ) : (
                  metrics.leads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="px-4 py-2">{lead.nome_completo}</td>
                      <td className="px-4 py-2">{lead.telefone}</td>
                      <td className="px-4 py-2">{lead.intent}</td>
                      <td className="px-4 py-2">{lead.status}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{fmtDate(lead.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-gray-900">Timeline de interações</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {metrics.interactions.length === 0 ? (
              <li className="text-gray-500">Sem interações.</li>
            ) : (
              metrics.interactions.map((item) => (
                <li key={item.id} className="border border-gray-100 px-4 py-2">
                  <span className="font-medium">{item.interaction_type}</span>
                  <span className="ml-2 text-gray-500">{fmtDate(item.created_at)}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-gray-200 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
