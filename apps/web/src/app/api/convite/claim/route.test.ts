import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "route.ts"), "utf8");

describe("convite claim route", () => {
  it("limits payload shape and applies persistent rate limiting", () => {
    expect(source).toContain("parseJsonObjectWithLimit");
    expect(source).toContain("rejectUnknownKeys");
    expect(source).toContain("checkSecurityRateLimit");
    expect(source).toContain("too_many_attempts");
  });

  it("locks invitations after repeated invalid access codes", () => {
    expect(source).toContain("invalid_attempt_count");
    expect(source).toContain("locked_until");
    expect(source).toContain("INVITE_INVALID_ATTEMPT_LIMIT");
    expect(source).toContain("invite_claim_lockout");
  });

  it("returns a specific error for canceled invites", () => {
    expect(source).toContain('invitation.status === "canceled"');
    expect(source).toContain('error: "invitation_canceled"');
    expect(source).toContain("status: 410");
  });
});
