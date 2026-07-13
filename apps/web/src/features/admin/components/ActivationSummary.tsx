import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SupabaseClient } from "@supabase/supabase-js";

const EVENTS = [
  "account_created",
  "first_property_created",
  "qr_generated",
  "qr_test_opened",
  "lead_received",
  "checkout_started",
  "checkout_completed",
  "dashboard_returned",
  "subscription_canceled",
] as const;

type EventName = (typeof EVENTS)[number];
type EventCounts = Partial<Record<EventName, number>>;
type SummaryRow = { event_name: EventName; count: number };
type TrackingStatus = "activation_events" | "metricas_operacionais" | "erro_metricas";

function makeRows(counts: EventCounts): SummaryRow[] {
  return EVENTS.map((event) => ({
    event_name: event,
    count: counts[event] ?? 0,
  }));
}

function mergeCounts(primary: EventCounts, fallback: EventCounts): EventCounts {
  const merged: EventCounts = {};
  for (const event of EVENTS) {
    merged[event] = Math.max(primary[event] ?? 0, fallback[event] ?? 0);
  }
  return merged;
}

function hasNonZeroCount(counts: EventCounts): boolean {
  return EVENTS.some((event) => (counts[event] ?? 0) > 0);
}

async function safeCount(
  query: () => PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count, error } = await query();
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function loadActivationEventCounts(
  admin: SupabaseClient,
): Promise<{ counts: EventCounts; hasRows: boolean }> {
  const { data, error } = await admin.from("activation_events").select("event_name");
  if (error) return { counts: {}, hasRows: false };

  const counts: EventCounts = {};
  for (const row of data ?? []) {
    const event = EVENTS.find((name) => name === String(row.event_name ?? ""));
    if (event) counts[event] = (counts[event] ?? 0) + 1;
  }
  return { counts, hasRows: (data ?? []).length > 0 };
}

async function loadOperationalCounts(admin: SupabaseClient): Promise<EventCounts> {
  const [
    accountsCreated,
    propertiesCreated,
    activeQrCodes,
    leadsReceived,
    paidSubscriptions,
    canceledSubscriptions,
  ] = await Promise.all([
    safeCount(() =>
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "broker"),
    ),
    safeCount(() => admin.from("properties").select("id", { count: "exact", head: true })),
    safeCount(() =>
      admin
        .from("property_qrcodes")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ),
    safeCount(() => admin.from("leads").select("id", { count: "exact", head: true })),
    safeCount(() =>
      admin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .in("status", ["starter_active", "solo_active", "pro_active"]),
    ),
    safeCount(() =>
      admin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .in("status", ["canceled", "expired", "past_due"]),
    ),
  ]);

  return {
    account_created: accountsCreated,
    first_property_created: propertiesCreated,
    qr_generated: activeQrCodes,
    lead_received: leadsReceived,
    checkout_started: paidSubscriptions,
    checkout_completed: paidSubscriptions,
    subscription_canceled: canceledSubscriptions,
  };
}

export async function ActivationSummary() {
  let rows: SummaryRow[] = [];
  let trackingStatus: TrackingStatus = "activation_events";

  try {
    const admin = createServiceRoleClient();
    const [eventMetrics, operationalMetrics] = await Promise.all([
      loadActivationEventCounts(admin),
      loadOperationalCounts(admin),
    ]);
    const shouldUseOperationalFallback =
      !eventMetrics.hasRows || hasNonZeroCount(operationalMetrics);

    trackingStatus = shouldUseOperationalFallback ? "metricas_operacionais" : "activation_events";
    rows = makeRows(
      shouldUseOperationalFallback
        ? mergeCounts(eventMetrics.counts, operationalMetrics)
        : eventMetrics.counts,
    );
  } catch {
    trackingStatus = "erro_metricas";
    rows = makeRows({});
  }

  return (
    <div>
      <p className="mt-3 text-xs uppercase tracking-wide text-gray-400">
        Fonte:{" "}
        <span data-testid="activation-tracking-status" className="font-semibold text-gray-600">
          {trackingStatus}
        </span>
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.event_name} className="border border-gray-200 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">{row.event_name}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{row.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
