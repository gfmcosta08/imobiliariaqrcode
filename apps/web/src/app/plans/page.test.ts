import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "page.tsx"), "utf8");

describe("public plans page pricing guardrails", () => {
  it("exposes only Free and Starter in the public plan order", () => {
    expect(source).toContain('type PlanCode = "free" | "starter"');
    expect(source).toContain('const PLAN_ORDER: PlanCode[] = ["free", "starter"]');
    expect(source).not.toContain('"pro"');
  });

  it("does not promise unlimited variable-cost usage", () => {
    expect(source.toLowerCase()).not.toContain("ilimitad");
    expect(source).toContain("STARTER_ACTIVE_PROPERTY_LIMIT");
    expect(source).toContain("STARTER_IMPORT_BATCHES_PER_MONTH");
  });
});
