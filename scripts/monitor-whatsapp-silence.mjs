#!/usr/bin/env node

/**
 * Read-only production monitor for WhatsApp bot flow health.
 * It never writes to DB and only emits alerts.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ALERT_WEBHOOK_URL = process.env.BOT_MONITOR_ALERT_WEBHOOK_URL ?? "";

const SLA_SECONDS = Number(process.env.BOT_MONITOR_SLA_SECONDS ?? "90");
const PENDING_MINUTES = Number(process.env.BOT_MONITOR_PENDING_MINUTES ?? "3");
const QUEUE_STUCK_MINUTES = Number(process.env.BOT_MONITOR_QUEUE_STUCK_MINUTES ?? "10");
const LOOKBACK_MINUTES = Number(process.env.BOT_MONITOR_LOOKBACK_MINUTES ?? "20");
const PENDING_LOOKBACK_HOURS = Number(process.env.BOT_MONITOR_PENDING_LOOKBACK_HOURS ?? "24");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
};

function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function isoHoursAgo(hours) {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function isoSecondsAgo(seconds) {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

async function get(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function postAlert(payload) {
  if (!ALERT_WEBHOOK_URL) return;
  await fetch(ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function main() {
  const alerts = [];

  const inboundSince = isoMinutesAgo(LOOKBACK_MINUTES);
  const inboundOlderThan = isoSecondsAgo(SLA_SECONDS);
  const pendingOlderThan = isoMinutesAgo(PENDING_MINUTES);
  const pendingSince = isoHoursAgo(PENDING_LOOKBACK_HOURS);
  const queuedOlderThan = isoMinutesAgo(QUEUE_STUCK_MINUTES);

  const inboundRows = await get(
    `whatsapp_messages?select=id,lead_phone,created_at,payload` +
      `&direction=eq.inbound` +
      `&message_type=eq.text` +
      `&created_at=gte.${encodeURIComponent(inboundSince)}` +
      `&created_at=lte.${encodeURIComponent(inboundOlderThan)}` +
      `&order=created_at.desc` +
      `&limit=200`,
  );

  const outboundRows = await get(
    `whatsapp_messages?select=id,lead_phone,created_at,status,payload` +
      `&direction=eq.outbound` +
      `&created_at=gte.${encodeURIComponent(inboundSince)}` +
      `&order=created_at.desc` +
      `&limit=400`,
  );

  for (const inbound of inboundRows) {
    const hasOutboundAfter = outboundRows.some(
      (outbound) =>
        outbound.lead_phone === inbound.lead_phone && outbound.created_at >= inbound.created_at,
    );
    if (!hasOutboundAfter) {
      alerts.push({
        type: "inbound_without_outbound",
        lead_phone: inbound.lead_phone,
        event_id: inbound.id,
        created_at: inbound.created_at,
        suspect_function: "conversation-handle/whatsapp-dispatch",
      });
    }
  }

  const pendingEvents = await get(
    `webhook_events?select=id,received_at,processing_status,external_event_id,payload` +
      `&processing_status=eq.pending` +
      `&received_at=gte.${encodeURIComponent(pendingSince)}` +
      `&received_at=lte.${encodeURIComponent(pendingOlderThan)}` +
      `&order=received_at.desc` +
      `&limit=100`,
  );

  for (const event of pendingEvents) {
    alerts.push({
      type: "pending_webhook_event",
      lead_phone: event?.payload?.chat?.phone ?? null,
      event_id: event.id,
      created_at: event.received_at,
      suspect_function: "whatsapp-webhook-inbound",
    });
  }

  const stuckQueued = await get(
    `whatsapp_messages?select=id,lead_phone,created_at,status` +
      `&direction=eq.outbound` +
      `&status=in.(queued,processing)` +
      `&created_at=lte.${encodeURIComponent(queuedOlderThan)}` +
      `&order=created_at.desc` +
      `&limit=200`,
  );

  if (stuckQueued.length > 0) {
    alerts.push({
      type: "queued_messages_stuck",
      lead_phone: stuckQueued[0].lead_phone ?? null,
      event_id: stuckQueued[0].id,
      created_at: stuckQueued[0].created_at,
      suspect_function: "whatsapp-dispatch",
      affected_count: stuckQueued.length,
    });
  }

  if (alerts.length === 0) {
    console.log("BOT_MONITOR_OK: no alerts");
    return;
  }

  const summary = {
    source: "bot-monitor",
    generated_at: new Date().toISOString(),
    alerts,
  };

  console.error(`BOT_MONITOR_ALERTS: ${alerts.length}`);
  console.error(JSON.stringify(summary, null, 2));
  await postAlert(summary);

  process.exit(1);
}

main().catch(async (err) => {
  console.error("BOT_MONITOR_ERROR", err instanceof Error ? err.message : String(err));
  await postAlert({
    source: "bot-monitor",
    generated_at: new Date().toISOString(),
    alerts: [
      {
        type: "monitor_runtime_error",
        suspect_function: "monitor-whatsapp-silence",
        detail: err instanceof Error ? err.message : String(err),
      },
    ],
  });
  process.exit(2);
});
