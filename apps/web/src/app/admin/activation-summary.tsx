import { createServiceRoleClient } from "@/lib/supabase/service-role";

const EVENTS = [
  "account_created",
  "first_property_created",
  "qr_generated",
  "lead_received",
  "checkout_started",
  "checkout_completed",
  "dashboard_returned",
] as const;

export async function ActivationSummary() {
  let rows: Array<{ event_name: string; count: number }> = [];
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin.from("activation_events").select("event_name");
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const name = String(row.event_name ?? "");
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    rows = EVENTS.map((event) => ({
      event_name: event,
      count: counts.get(event) ?? 0,
    }));
  } catch {
    rows = EVENTS.map((event) => ({ event_name: event, count: 0 }));
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <div key={row.event_name} className="border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">{row.event_name}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{row.count}</p>
        </div>
      ))}
    </div>
  );
}
