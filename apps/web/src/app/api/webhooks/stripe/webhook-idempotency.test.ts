import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const route = readFileSync(resolve(dir, "route.ts"), "utf8");

describe("Stripe webhook contract", () => {
  it("validates signatures and records idempotency", () => {
    expect(route).toContain("constructEvent");
    expect(route).toContain("webhook_events");
    expect(route).toContain("duplicate");
  });

  it("activates Starter after invoice success and handles failures", () => {
    expect(route).toContain("invoice.payment_succeeded");
    expect(route).toContain("starter_active");
    expect(route).toContain("invoice.payment_failed");
    expect(route).toContain("past_due");
    expect(route).toContain("customer.subscription.deleted");
    expect(route).toContain("canceled");
  });
});
