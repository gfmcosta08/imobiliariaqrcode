import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "route.ts"), "utf8");

describe("admin invitations route", () => {
  it("generates stronger invite codes without Math.random", () => {
    expect(source).toContain("secureNumericCode(8)");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("randomSixDigits");
  });

  it("supports editing only pending invitations", () => {
    expect(source).toContain("export async function PATCH");
    expect(source).toContain("invitation_not_pending");
    expect(source).toContain("property_count");
    expect(source).toContain("expires_at");
    expect(source).toContain("expiration_days_configured");
  });

  it("syncs invitation property count with courtesy subscription override", () => {
    expect(source).toContain("max_active_properties_override: propertyCount");
    expect(source).toContain('.eq("status", "free")');
  });
});
