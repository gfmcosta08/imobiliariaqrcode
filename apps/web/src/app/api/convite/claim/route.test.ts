import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "route.ts"), "utf8");

describe("convite claim route", () => {
  it("returns a specific error for canceled invites", () => {
    expect(source).toContain('invitation.status === "canceled"');
    expect(source).toContain('error: "invitation_canceled"');
    expect(source).toContain("status: 410");
  });
});
