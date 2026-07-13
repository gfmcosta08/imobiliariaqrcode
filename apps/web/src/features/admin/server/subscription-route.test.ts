import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "subscription-route.ts"), "utf8");

describe("admin subscription update route", () => {
  it("accepts current Starter SaaS status combinations, including past_due", () => {
    expect(source).toContain('"starter_active"');
    expect(source).toContain('"starter"');
    expect(source).toContain('"past_due"');
    expect(source).toContain('past_due: ["starter", "solo", "pro"]');
  });
});
