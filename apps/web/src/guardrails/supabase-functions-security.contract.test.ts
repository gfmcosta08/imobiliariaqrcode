import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../../");

function readRepo(pathFromRoot: string): string {
  return fs.readFileSync(path.resolve(repoRoot, pathFromRoot), "utf8");
}

describe("Supabase Functions security guardrails", () => {
  it("keeps legacy billing webhook stubs disabled by default and cron-protected if enabled", () => {
    const functionPaths = [
      "supabase/functions/billing-stripe-webhook/index.ts",
      "supabase/functions/billing-mercadopago-webhook/index.ts",
    ];

    for (const functionPath of functionPaths) {
      const src = readRepo(functionPath);
      expect(src).toContain("ENABLE_LEGACY_BILLING_WEBHOOK_STUB");
      expect(src).toContain("legacy_billing_webhook_disabled");
      expect(src).toContain('Deno.env.get("CRON_SECRET")');
      expect(src).toContain('error: "unauthorized"');
      expect(src.indexOf("legacyEnabled")).toBeLessThan(src.indexOf("await req.text()"));
    }
  });

  it("keeps optional media-process worker disabled by default and cron-protected if enabled", () => {
    const src = readRepo("supabase/functions/media-process/index.ts");

    expect(src).toContain("ENABLE_MEDIA_PROCESS_WORKER");
    expect(src).toContain("media_process_disabled");
    expect(src).toContain('Deno.env.get("CRON_SECRET")');
    expect(src).toContain('error: "unauthorized"');
    expect(src.indexOf("workerEnabled")).toBeLessThan(src.indexOf("media-process placeholder"));
  });

  it("uses CRON_SECRET, not service role, as public cron/dispatch bearer credential", () => {
    const dispatch = readRepo("supabase/functions/whatsapp-dispatch/index.ts");
    const monitor = readRepo("supabase/functions/bot-health-monitor/index.ts");
    const dispatchWorkflow = readRepo(".github/workflows/dispatch-whatsapp.yml");
    const monitorWorkflow = readRepo(".github/workflows/monitor-whatsapp-bot.yml");

    expect(dispatch).toContain('Deno.env.get("CRON_SECRET")');
    expect(dispatch).not.toContain("validByServiceKey");
    expect(dispatch).not.toContain("authToken === serviceRoleKey");

    expect(monitor).toContain('Deno.env.get("CRON_SECRET")');
    expect(monitor).not.toContain("authToken === serviceRoleKey");
    expect(monitor).not.toContain(
      'Deno.env.get("CRON_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")',
    );

    expect(dispatchWorkflow).toContain("CRON_SECRET");
    expect(dispatchWorkflow).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(monitorWorkflow).toContain("CRON_SECRET");
    expect(monitorWorkflow).not.toContain("continue-on-error: true");
  });
});
