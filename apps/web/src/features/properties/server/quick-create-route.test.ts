import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "quick-create-route.ts"), "utf8");

describe("quick-create route", () => {
  it("publishes the first QR property so the generated QR can produce public leads", () => {
    expect(source).toContain('listing_status: "published"');
    expect(source).toContain('listing_status: "published"');
    expect(source).not.toContain('listing_status: "draft"');
  });
});
