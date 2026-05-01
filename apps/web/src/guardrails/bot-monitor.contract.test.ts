import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../../");
const monitorPath = path.join(repoRoot, "supabase/functions/bot-health-monitor/index.ts");
const migrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260501090000_bot_incidents_monitoring.sql",
);
const configPath = path.join(repoRoot, "supabase/config.toml");
const cronRoutePath = path.join(repoRoot, "apps/web/src/app/api/cron/bot-health-monitor/route.ts");
const vercelConfigPath = path.join(repoRoot, "apps/web/vercel.json");
const githubMonitorWorkflowPath = path.join(repoRoot, ".github/workflows/monitor-whatsapp-bot.yml");

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("Bot health monitor guardrails", () => {
  it("mantem tabela de incidentes ligada a rastreabilidade do bot", () => {
    const sql = read(migrationPath);
    expect(sql).toContain("create table if not exists public.bot_incidents");
    expect(sql).toContain("interaction_id");
    expect(sql).toContain("references public.bot_interactions");
    expect(sql).toContain("source_step_id");
    expect(sql).toContain("references public.bot_interaction_steps");
    expect(sql).toContain("admin_notified_at");
    expect(sql).toContain("broker_notified_at");
    expect(sql).toContain("auto_recovery_attempted_at");
  });

  it("mantem deduplicacao de incidentes abertos por fonte", () => {
    const sql = read(migrationPath);
    expect(sql).toContain("idx_bot_incidents_open_interaction_type");
    expect(sql).toContain("idx_bot_incidents_open_step_type");
    expect(sql).toContain("idx_bot_incidents_open_message_type");
    expect(sql).toContain("idx_bot_incidents_open_global_type");
    expect(sql).toContain("where status = 'open'");
  });

  it("mantem monitor protegido por CRON_SECRET ou service role", () => {
    const src = read(monitorPath);
    expect(src).toContain("function authOk");
    expect(src).toContain('Deno.env.get("CRON_SECRET")');
    expect(src).toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
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

  it("mantem deteccao de webhook processado sem resposta e queda de sucesso", () => {
    const src = read(monitorPath);
    expect(src).toContain('"processed_webhook_without_customer_response"');
    expect(src).toContain("processing_status");
    expect(src).toContain("v_bot_hourly_success");
    expect(src).toContain('"hourly_success_rate_drop"');
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
  });
});
