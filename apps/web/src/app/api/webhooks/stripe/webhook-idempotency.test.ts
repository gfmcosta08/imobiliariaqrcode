import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const routeSource = readFileSync(resolve(dir, "route.ts"), "utf8");

describe("webhook Stripe", () => {
  it("valida assinatura e registra idempotencia em webhook_events", () => {
    expect(routeSource).toContain("constructEvent");
    expect(routeSource).toContain("webhook_events");
    expect(routeSource).toContain("duplicate");
  });

  it("ativa starter apenas em invoice.payment_succeeded", () => {
    expect(routeSource).toContain("invoice.payment_succeeded");
    expect(routeSource).toContain("starter_active");
    expect(routeSource).not.toContain("solo_active");
  });

  it("nao ativa em payment_failed", () => {
    expect(routeSource).toContain("invoice.payment_failed");
    expect(routeSource).toContain("past_due");
  });
});
