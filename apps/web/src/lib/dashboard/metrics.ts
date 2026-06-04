export type DashboardMoneyMetrics = {
  totalProperties: number;
  activeProperties: number;
  qrScans: number;
  leadsTotal: number;
  leadsNew: number;
  leadsResponded: number;
  leadsUnanswered: number;
  averageFirstResponseMinutes: number | null;
  topPropertyTitle: string | null;
  topPropertyLeadCount: number;
};

type PropertyRow = {
  id: string;
  title: string | null;
  listing_status: string | null;
};

type LeadRow = {
  status: string | null;
  property_id: string | null;
  created_at: string | null;
  first_response_at?: string | null;
  updated_at?: string | null;
};

const UNANSWERED_STATUSES = new Set(["new", "contact_pending", "contacted"]);

export function countUnansweredLeads(leads: Array<{ status: string | null }>): number {
  return leads.filter((lead) => UNANSWERED_STATUSES.has(lead.status ?? "")).length;
}

export function formatResponseTime(minutes: number | null): string {
  if (minutes == null) return "Sem dados";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} h`;
}

export function buildDashboardMoneyMetrics(input: {
  properties: PropertyRow[];
  leads: LeadRow[];
  qrScans: number;
}): DashboardMoneyMetrics {
  const { properties, leads, qrScans } = input;
  const activeProperties = properties.filter((p) =>
    ["published", "printed"].includes(p.listing_status ?? ""),
  ).length;

  const leadsNew = leads.filter((l) => l.status === "new").length;
  const leadsResponded = leads.filter((l) =>
    [
      "responded",
      "in_service",
      "visit_scheduled",
      "converted",
      "contacted",
      "scheduled",
      "closed",
    ].includes(l.status ?? ""),
  ).length;

  const responseMinutes = leads
    .map((lead) => {
      const respondedAt = lead.first_response_at ?? lead.updated_at;
      if (!lead.created_at || !respondedAt) return null;
      const created = new Date(lead.created_at).getTime();
      const responded = new Date(respondedAt).getTime();
      if (!Number.isFinite(created) || !Number.isFinite(responded) || responded < created) {
        return null;
      }
      return (responded - created) / 60_000;
    })
    .filter((v): v is number => v != null);

  const averageFirstResponseMinutes =
    responseMinutes.length > 0
      ? responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length
      : null;

  const leadsByProperty = new Map<string, number>();
  for (const lead of leads) {
    if (!lead.property_id) continue;
    leadsByProperty.set(lead.property_id, (leadsByProperty.get(lead.property_id) ?? 0) + 1);
  }

  let topPropertyTitle: string | null = null;
  let topPropertyLeadCount = 0;
  for (const property of properties) {
    const count = leadsByProperty.get(property.id) ?? 0;
    if (count > topPropertyLeadCount) {
      topPropertyLeadCount = count;
      topPropertyTitle = property.title;
    }
  }

  return {
    totalProperties: properties.length,
    activeProperties,
    qrScans,
    leadsTotal: leads.length,
    leadsNew,
    leadsResponded,
    leadsUnanswered: countUnansweredLeads(leads),
    averageFirstResponseMinutes,
    topPropertyTitle,
    topPropertyLeadCount,
  };
}
