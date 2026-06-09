import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../../");
const monitorPath = path.join(repoRoot, "supabase/functions/bot-health-monitor/index.ts");
const migrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260502090000_unify_bot_monitoring.sql",
);
const configPath = path.join(repoRoot, "supabase/config.toml");
const cronRoutePath = path.join(repoRoot, "apps/web/src/app/api/cron/bot-health-monitor/route.ts");
const vercelConfigPath = path.join(repoRoot, "apps/web/vercel.json");
const githubMonitorWorkflowPath = path.join(repoRoot, ".github/workflows/monitor-whatsapp-bot.yml");

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("Bot health monitor guardrails", () => {
  it("mantem bot_interactions como tabela unica de monitoramento", () => {
    const sql = read(migrationPath);
    expect(sql).toContain("alter table public.bot_interactions");
    expect(sql).toContain("steps_history jsonb");
    expect(sql).toContain("incident_status text");
    expect(sql).toContain("incident_type text");
    expect(sql).toContain("incident_details jsonb");
    expect(sql).toContain("admin_notified_at");
    expect(sql).toContain("broker_notified_at");
    expect(sql).toContain("auto_recovery_attempted_at");
  });

  it("remove tabelas antigas apos consolidar o fluxo em bot_interactions", () => {
    const sql = read(migrationPath);
    expect(sql).toContain("drop table if exists public.bot_incidents");
    expect(sql).toContain("drop table if exists public.bot_interaction_steps");
    expect(sql).toContain("idx_bot_interactions_incident_open");
    expect(sql).toContain("where incident_status = 'open'");
  });

  it("mantem historico de etapas nas RPCs sem escrever em tabela separada", () => {
    const sql = read(migrationPath);
    expect(sql).toContain("create or replace function public.fn_start_interaction_step");
    expect(sql).toContain("steps_history = coalesce(steps_history");
    expect(sql).toContain("create or replace function public.fn_complete_interaction_step");
    expect(sql).toContain("jsonb_array_elements(coalesce(bi.steps_history");
    expect(sql).toContain("create or replace function public.fn_log_dispatch_step_for_phone");
  });

  it("mantem monitor protegido somente por CRON_SECRET na entrada publica", () => {
    const src = read(monitorPath);
    expect(src).toContain("function authOk");
    expect(src).toContain('Deno.env.get("CRON_SECRET")');
    expect(src).not.toContain("authToken === serviceRoleKey");
    expect(src).not.toContain(
      'Deno.env.get("CRON_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")',
    );
    expect(src).toContain('error: "unauthorized"');
  });

  it("mantem resposta visivel sem contar system nem notificacao ao corretor", () => {
    const src = read(monitorPath);
    expect(src).toContain("function hasVisibleCustomerOutbound");
    expect(src).toContain('row.message_type !== "system"');
    expect(src).toContain("payload.to_broker !== true");
  });

  it("mantem alerta para admin e corretor responsavel pelo anuncio", () => {
    const src = read(monitorPath);
    expect(src).toContain("BOT_ADMIN_WHATSAPP_NUMBERS");
    expect(src).toContain('kind: "bot_incident_admin_alert"');
    expect(src).toContain("async function notifyBroker");
    expect(src).toContain('kind: "bot_incident_broker_alert"');
    expect(src).toContain("to_broker: true");
    expect(src).toContain("properties");
    expect(src).toContain("broker_id");
  });

  it("mantem auto-cura segura com fallback sem duplicidade e disparo do dispatch", () => {
    const src = read(monitorPath);
    expect(src).toContain("function hasRecentFallback");
    expect(src).toContain('fallback: "already_exists"');
    expect(src).toContain('kind: "error_fallback"');
    expect(src).toContain("async function triggerDispatch");
    expect(src).toContain("/functions/v1/whatsapp-dispatch");
  });

  it("mantem deteccao de travamento limitada a no maximo 5 minutos", () => {
    const src = read(monitorPath);
    expect(src).toContain("const DEFAULT_STUCK_MINUTES = 5");
    expect(src).toContain("const MAX_STUCK_MINUTES = 5");
    expect(src).toContain("Math.min(stuckMinutes, MAX_STUCK_MINUTES)");
  });

  it("mantem deteccao de webhook processado sem resposta e queda de sucesso", () => {
    const src = read(monitorPath);
    expect(src).toContain('"processed_webhook_without_customer_response"');
    expect(src).toContain("processing_status");
    expect(src).toContain("v_bot_hourly_success");
    expect(src).toContain('"hourly_success_rate_drop"');
  });

  it("mantem alertas operacionais para Stripe, fila WhatsApp, cron e correlation id", () => {
    const src = read(monitorPath);
    const workflow = read(githubMonitorWorkflowPath);
    const dispatch = read(path.join(repoRoot, "supabase/functions/whatsapp-dispatch/index.ts"));

    expect(src).toContain('"stripe_webhook_failed"');
    expect(src).toContain('provider", "stripe"');
    expect(src).toContain('processing_status", "failed"');
    expect(src).toContain('"cron_heartbeat_stale"');
    expect(src).toContain("recordCronHeartbeat");
    expect(src).toContain("critical_open_incidents");
    expect(src).toContain("correlation_id");
    expect(src).toContain('req.headers.get("x-correlation-id")');

    expect(dispatch).toContain("recordCronHeartbeat");
    expect(dispatch).toContain('"whatsapp-dispatch"');

    expect(workflow).toContain("monitor-response.json");
    expect(workflow).toContain("critical_open_incidents");
    expect(workflow).toContain("x-correlation-id");
  });

  it("mantem monitor gravando incidentes somente em bot_interactions", () => {
    const src = read(monitorPath);
    expect(src).toContain('.from("bot_interactions")');
    expect(src).toContain("incident_status");
    expect(src).toContain("incident_details");
    expect(src).not.toContain('.from("bot_incidents")');
    expect(src).not.toContain('.from("bot_interaction_steps")');
  });

  it("registra a edge function no config do Supabase", () => {
    const config = read(configPath);
    expect(config).toContain("[functions.bot-health-monitor]");
    expect(config).toContain("verify_jwt = false");
  });

  it("mantem rota manual do monitor sem cron frequente no Vercel Hobby", () => {
    const route = read(cronRoutePath);
    const vercel = read(vercelConfigPath);
    expect(route).toContain("/functions/v1/bot-health-monitor");
    expect(route).toContain("CRON_SECRET");
    expect(vercel).not.toContain("/api/cron/bot-health-monitor");
    expect(vercel).not.toContain('"schedule": "* * * * *"');
  });

  it("mantem agendamento do monitor pelo GitHub Actions", () => {
    const workflow = read(githubMonitorWorkflowPath);
    expect(workflow).toContain('cron: "*/5 * * * *"');
    expect(workflow).toContain("$SUPABASE_URL/functions/v1/bot-health-monitor");
    expect(workflow).toContain("CRON_SECRET");
    expect(workflow).not.toContain("continue-on-error: true");
  });
});
