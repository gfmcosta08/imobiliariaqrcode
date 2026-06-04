import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "route.ts"), "utf8");

describe("admin invitations route", () => {
  it("supports editing only pending invitations", () => {
    expect(source).toContain("export async function PATCH");
    expect(source).toContain("invitation_not_pending");
    expect(source).toContain("property_count");
    expect(source).toContain("expires_at");
    expect(source).toContain("expiration_days_configured");
  });
});
