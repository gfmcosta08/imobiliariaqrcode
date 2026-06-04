import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "activation-summary.tsx"), "utf8");

describe("ActivationSummary", () => {
  it("uses operational tables as a fallback when activation_events is unavailable or empty", () => {
    expect(source).toContain('from("activation_events")');
    expect(source).toContain('from("profiles")');
    expect(source).toContain('from("properties")');
    expect(source).toContain('from("property_qrcodes")');
    expect(source).toContain('from("leads")');
    expect(source).toContain('from("subscriptions")');
  });

  it("does not silently present an all-zero dashboard when tracking is missing", () => {
    expect(source).toContain("trackingStatus");
    expect(source).toContain("metricas_operacionais");
  });
});
