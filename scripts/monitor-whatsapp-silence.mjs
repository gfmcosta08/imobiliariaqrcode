#!/usr/bin/env node

/**
 * Monitor de saúde do bot WhatsApp com auto-cura.
 * - Detecta inbound sem outbound, webhooks presos, mensagens travadas e interações paradas.
 * - Cura automaticamente: chama dispatch e/ou enfileira fallback.
 * - Nunca escreve diretamente dados de negócio; usa apenas REST API do Supabase.
 * - Sempre termina com exit 0 — alertas reais vão para o webhook configurado.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ALERT_WEBHOOK_URL = process.env.BOT_MONITOR_ALERT_WEBHOOK_URL ?? "";

const SLA_SECONDS = Number(process.env.BOT_MONITOR_SLA_SECONDS ?? "90");
const PENDING_MINUTES = Number(process.env.BOT_MONITOR_PENDING_MINUTES ?? "3");
const QUEUE_STUCK_MINUTES = Number(process.env.BOT_MONITOR_QUEUE_STUCK_MINUTES ?? "10");
const LOOKBACK_MINUTES = Number(process.env.BOT_MONITOR_LOOKBACK_MINUTES ?? "20");
const PENDING_LOOKBACK_HOURS = Number(process.env.BOT_MONITOR_PENDING_LOOKBACK_HOURS ?? "24");
const HEAL_ENABLED = (process.env.BOT_MONITOR_HEAL ?? "true") !== "false";
const FALLBACK_TEXT =
  process.env.BOT_MONITOR_FALLBACK_TEXT ??
  "Desculpe, tivemos um problema tecnico. Tente novamente em instantes.";

// URL do dispatch derivada automaticamente do SUPABASE_URL
const DISPATCH_URL = `${SUPABASE_URL}/functions/v1/whatsapp-dispatch`;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
};

// ─── Helpers de tempo ────────────────────────────────────────────────────────

function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function isoHoursAgo(hours) {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function isoSecondsAgo(seconds) {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

// ─── REST helpers ────────────────────────────────────────────────────────────

async function get(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function patch(resource, id, idField, body) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${resource}?${idField}=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(body),
    },
  );
  return res.ok;
}

async function insert(resource, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${resource}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

// ─── Ações de cura ───────────────────────────────────────────────────────────

async function callDispatch() {
  try {
    const res = await fetch(DISPATCH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    });
    console.log(`[heal] dispatch triggered → ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error("[heal] dispatch call failed", err.message);
    return false;
  }
}

async function enqueueFallback(leadPhone) {
  if (!leadPhone) return false;
  const ok = await insert("whatsapp_messages", {
    direction: "outbound",
    provider: "uazapi",
    lead_phone: leadPhone,
    message_type: "text",
    payload: { kind: "error_fallback", text: FALLBACK_TEXT },
    status: "queued",
  });
  console.log(`[heal] fallback enqueued for ${leadPhone} → ${ok}`);
  return ok;
}

async function markWebhookFailed(webhookId) {
  return patch("webhook_events", webhookId, "id", {
    processing_status: "failed",
    processed_at: new Date().toISOString(),
  });
}

async function markInteractionMaxRetries(interactionId) {
  return patch("bot_interactions", interactionId, "id", {
    current_step: "error_max_retries",
    is_resolved: true,
  });
}

async function setInteractionRecovering(interactionId, newRetryCount) {
  return patch("bot_interactions", interactionId, "id", {
    current_step: "recovering",
    retry_count: newRetryCount,
  });
}

// ─── Queries de detecção ─────────────────────────────────────────────────────

async function getPendingSteps() {
  const cutoff = isoMinutesAgo(QUEUE_STUCK_MINUTES);
  return get(
    `bot_interaction_steps?select=id,interaction_id,step_name,started_at` +
      `&status=eq.pending` +
      `&started_at=lte.${encodeURIComponent(cutoff)}` +
      `&order=started_at.asc` +
      `&limit=50`,
  );
}

async function getStuckQueuedMessages() {
  const cutoff = isoMinutesAgo(QUEUE_STUCK_MINUTES);
  return get(
    `whatsapp_messages?select=id,lead_phone,created_at,status` +
      `&direction=eq.outbound` +
      `&status=in.(queued,processing)` +
      `&created_at=lte.${encodeURIComponent(cutoff)}` +
      `&order=created_at.desc` +
      `&limit=200`,
  );
}

async function getStuckPendingWebhooks() {
  const since = isoHoursAgo(PENDING_LOOKBACK_HOURS);
  const olderThan = isoMinutesAgo(PENDING_MINUTES);
  return get(
    `webhook_events?select=id,received_at,payload` +
      `&processing_status=eq.pending` +
      `&received_at=gte.${encodeURIComponent(since)}` +
      `&received_at=lte.${encodeURIComponent(olderThan)}` +
      `&order=received_at.desc` +
      `&limit=100`,
  );
}

async function getStuckInteractions() {
  const cutoff = isoMinutesAgo(QUEUE_STUCK_MINUTES);
  // Etapas finais (resolvidas pelo trigger) são excluídas via is_resolved=false
  // Excluir explicitamente etapas de erro terminal que não devem ser retentadas
  return get(
    `bot_interactions?select=id,lead_phone,current_step,retry_count,updated_at` +
      `&is_resolved=eq.false` +
      `&updated_at=lte.${encodeURIComponent(cutoff)}` +
      `&current_step=not.in.(error_max_retries,error_no_property,error_dispatch_failed)` +
      `&order=updated_at.asc` +
      `&limit=20`,
  );
}

async function hasOutboundQueued(leadPhone) {
  if (!leadPhone) return false;
  const rows = await get(
    `whatsapp_messages?select=id` +
      `&direction=eq.outbound` +
      `&status=eq.queued` +
      `&lead_phone=eq.${encodeURIComponent(leadPhone)}` +
      `&limit=1`,
  );
  return rows.length > 0;
}

// ─── Alerta externo ──────────────────────────────────────────────────────────

async function postAlert(payload) {
  if (!ALERT_WEBHOOK_URL) return;
  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[alert] webhook post failed", err.message);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const alerts = [];
  const healed = [];
  let dispatchTriggered = false;

  // Função auxiliar para chamar dispatch uma só vez por ciclo
  async function healDispatch(reason) {
    if (!dispatchTriggered) {
      const ok = await callDispatch();
      if (ok) {
        dispatchTriggered = true;
        healed.push(`dispatch_triggered:${reason}`);
      }
    }
  }

  // ── 0. Etapas pending presas (log por etapa) ───────────────────
  const pendingSteps = await getPendingSteps();
  for (const step of pendingSteps) {
    const interactionRows = await get(
      `bot_interactions?select=lead_phone&id=eq.${step.interaction_id}&limit=1`,
    );
    const phone = interactionRows[0]?.lead_phone ?? null;

    alerts.push({
      type: "step_pending_timeout",
      step_name: step.step_name,
      lead_phone: phone,
      event_id: step.id,
      started_at: step.started_at,
      suspect_function: "conversation-handle/whatsapp-dispatch",
    });

    if (HEAL_ENABLED) {
      if (step.step_name === "conversation_starting" || step.step_name === "response_queuing") {
        // conversation-handle não completou a etapa → fallback + dispatch
        if (phone && !(await hasOutboundQueued(phone))) {
          await enqueueFallback(phone);
          healed.push(`fallback_enqueued:${phone}`);
        }
        await healDispatch(`step_${step.step_name}_stuck`);
      } else if (step.step_name === "dispatch_sent") {
        // Mensagens enfileiradas mas dispatch não processou
        await healDispatch("dispatch_sent_pending");
      }
      // Marcar step como failed para não processar de novo no próximo ciclo
      await patch("bot_interaction_steps", step.id, "id", {
        status: "failed",
        completed_at: new Date().toISOString(),
        error_detail: "healed_by_monitor",
      });
      healed.push(`step_healed:${step.step_name}:${step.interaction_id}`);
    }
  }

  // ── 1. Mensagens queued/processing presas ──────────────────────
  const stuckQueued = await getStuckQueuedMessages();
  if (stuckQueued.length > 0) {
    alerts.push({
      type: "queued_messages_stuck",
      affected_count: stuckQueued.length,
      lead_phone: stuckQueued[0]?.lead_phone ?? null,
      event_id: stuckQueued[0]?.id ?? null,
      created_at: stuckQueued[0]?.created_at ?? null,
      suspect_function: "whatsapp-dispatch",
    });
    if (HEAL_ENABLED) {
      await healDispatch("queued_messages_stuck");
    }
  }

  // ── 2. webhook_events em pending presos ────────────────────────
  const stuckWebhooks = await getStuckPendingWebhooks();
  for (const wh of stuckWebhooks) {
    const leadPhone =
      wh?.payload?.chat?.phone ?? wh?.payload?.message?.sender_pn ?? null;
    const hasQueued = await hasOutboundQueued(leadPhone);

    alerts.push({
      type: "pending_webhook_event",
      lead_phone: leadPhone,
      event_id: wh.id,
      created_at: wh.received_at,
      suspect_function: "whatsapp-webhook-inbound",
      has_queued_messages: hasQueued,
    });

    if (HEAL_ENABLED) {
      if (!hasQueued && leadPhone) {
        // Conversa se perdeu: lead não tem mensagens esperando — enfileirar fallback
        await enqueueFallback(leadPhone);
        healed.push(`fallback_enqueued:${leadPhone}`);
      }
      // Em ambos os casos: tentar dispatch e fechar o webhook_event
      await healDispatch("pending_webhook");
      await markWebhookFailed(wh.id);
      healed.push(`webhook_marked_failed:${wh.id}`);
    }
  }

  // ── 3. bot_interactions travadas em etapa intermediária ─────────
  const stuckInteractions = await getStuckInteractions();
  for (const interaction of stuckInteractions) {
    const { id, lead_phone: phone, current_step: step, retry_count: retries } = interaction;

    if ((retries ?? 0) >= 3) {
      // Esgotou tentativas do monitor: desistir e sinalizar
      alerts.push({
        type: "interaction_max_retries",
        lead_phone: phone,
        event_id: id,
        current_step: step,
        retry_count: retries,
        suspect_function: "conversation-handle/whatsapp-dispatch",
      });
      if (HEAL_ENABLED) {
        await markInteractionMaxRetries(id);
        healed.push(`interaction_max_retries:${id}`);
      }
      continue;
    }

    alerts.push({
      type: "interaction_stuck",
      lead_phone: phone,
      event_id: id,
      current_step: step,
      retry_count: retries,
      suspect_function: "conversation-handle/whatsapp-dispatch",
    });

    if (HEAL_ENABLED) {
      const hasQueued = await hasOutboundQueued(phone);
      if (!hasQueued && phone) {
        await enqueueFallback(phone);
        healed.push(`fallback_enqueued:${phone}`);
      }
      await setInteractionRecovering(id, (retries ?? 0) + 1);
      healed.push(`interaction_recovering:${id}`);
      await healDispatch("interaction_stuck");
    }
  }

  // ── 4. Inbound sem outbound (SLA) — detecção, sem auto-cura ────
  const inboundSince = isoMinutesAgo(LOOKBACK_MINUTES);
  const inboundOlderThan = isoSecondsAgo(SLA_SECONDS);
  const pendingOlderThan = isoMinutesAgo(PENDING_MINUTES);
  const pendingSince = isoHoursAgo(PENDING_LOOKBACK_HOURS);

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
        outbound.lead_phone === inbound.lead_phone &&
        outbound.created_at >= inbound.created_at,
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

  // ── 5. Relatório ────────────────────────────────────────────────
  const summary = {
    source: "bot-monitor",
    generated_at: new Date().toISOString(),
    heal_enabled: HEAL_ENABLED,
    alerts_count: alerts.length,
    healed_count: healed.length,
    alerts,
    healed,
  };

  if (alerts.length === 0) {
    console.log("BOT_MONITOR_OK: no alerts");
  } else {
    console.error(`BOT_MONITOR_ALERTS: ${alerts.length} | HEALED: ${healed.length}`);
    console.error(JSON.stringify(summary, null, 2));
    await postAlert(summary);
  }

  // Sempre exit 0: alertas reais vão para o webhook; histórico do GitHub Actions fica limpo
  process.exit(0);
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
    healed: [],
  });
  process.exit(2);
});
