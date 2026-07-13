import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "customer-portal-route.ts"), "utf8");

describe("customer portal route", () => {
  it("creates Stripe billing portal sessions in non-production", () => {
    expect(source).toContain("billingPortal.sessions.create");
    expect(source).toContain("assertStripeTestModeAllowed");
  });
});
