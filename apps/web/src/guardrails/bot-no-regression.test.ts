import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../../../");

function readRepo(pathFromRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRoot), "utf8");
}

describe("bot no-regression contract", () => {
  it("inbound webhook still routes to conversation handling", () => {
    const inbound = readRepo("supabase/functions/whatsapp-webhook-inbound/index.ts");
    expect(inbound).toContain("conversation-handle");
  });

  it("dispatch function still processes queued whatsapp_messages", () => {
    const dispatch = readRepo("supabase/functions/whatsapp-dispatch/index.ts");
    expect(dispatch).toContain("whatsapp_messages");
  });

  it("dispatch function does not chain catch directly on Supabase query builders", () => {
    const dispatch = readRepo("supabase/functions/whatsapp-dispatch/index.ts");
    const lines = dispatch.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (!line.includes(".catch(")) return;
      const nearby = lines.slice(Math.max(0, index - 8), index + 1).join("\n");
      expect(nearby).not.toMatch(/await\s+supabase[\s\S]*\.from\(/);
    });
  });

  it("bot health monitor still references silence/incident monitoring", () => {
    const monitor = readRepo("supabase/functions/bot-health-monitor/index.ts");
    expect(monitor).toMatch(/silence|incident|monitor/i);
  });

  it("QR page still builds WhatsApp link with property public id", () => {
    const qrPage = readRepo("apps/web/src/app/q/[token]/page.tsx");
    expect(qrPage).toContain("wa.me");
    expect(qrPage).toContain("public_id");
  });

  it("public lead route still calls upsert_lead_from_qr_event", () => {
    const leadRoute = readRepo("apps/web/src/app/api/public/lead/route.ts");
    expect(leadRoute).toContain("upsert_lead_from_qr_event");
  });
});
