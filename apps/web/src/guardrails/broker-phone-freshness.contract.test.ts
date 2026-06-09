import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../../");

function readRepo(pathFromRoot: string): string {
  return fs.readFileSync(path.resolve(repoRoot, pathFromRoot), "utf8");
}

describe("Broker WhatsApp phone freshness guardrails", () => {
  it("refreshes broker-directed queue rows from canonical profile phone before dispatch", () => {
    const src = readRepo("supabase/functions/whatsapp-dispatch/index.ts");

    expect(src).toContain("account_id: string | null");
    expect(src).toContain("property_id: string | null");
    expect(src).toContain("async function resolveFreshBrokerPhone");
    expect(src).toContain("async function refreshBrokerPhoneBeforeSend");
    expect(src).toContain("broker_phone_refreshed_at");
    expect(src).toMatch(
      /\.select\(\s*"id, message_type, payload, lead_phone, broker_phone, account_id, property_id, scheduled_for, created_at",?\s*\)/,
    );
    expect(src.indexOf("rowToSend = await refreshBrokerPhoneBeforeSend")).toBeGreaterThan(
      src.indexOf('.update({ status: "processing" })'),
    );
    expect(src.indexOf("rowToSend = await refreshBrokerPhoneBeforeSend")).toBeLessThan(
      src.indexOf("await waitWithTyping"),
    );
  });

  it("uses profile whatsapp_number as canonical source when queueing broker phone snapshots", () => {
    const conversation = readRepo("supabase/functions/conversation-handle/index.ts");
    const leadNotify = readRepo("supabase/functions/lead-notify-broker/index.ts");

    expect(conversation).toContain("const profilePhone =");
    expect(conversation).toContain("profilePhone || broker?.whatsapp_number");
    expect(conversation).toContain("const brokerProfilePhone =");
    expect(conversation).toContain("brokerProfilePhone || broker?.whatsapp_number");

    expect(leadNotify).toContain(
      "brokers (id, whatsapp_number, account_id, profiles(whatsapp_number))",
    );
    expect(leadNotify).toContain("const brokerProfilePhone =");
    expect(leadNotify).toContain(
      "const brokerWhatsapp = brokerProfilePhone || broker?.whatsapp_number",
    );
    expect(leadNotify).toContain("broker_id: broker.id");
  });
});
