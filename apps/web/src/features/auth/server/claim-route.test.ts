import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "claim-route.ts"), "utf8");

describe("convite claim route", () => {
  it("limits payload shape and applies persistent rate limiting", () => {
    expect(source).toContain("parseJsonObjectWithLimit");
    expect(source).toContain("rejectUnknownKeys");
    expect(source).toContain("checkSecurityRateLimit");
    expect(source).toContain("too_many_attempts");
  });

  it("uses persistent rate limiting without invitation lockout columns", () => {
    expect(source).toContain("checkSecurityRateLimit");
    expect(source).toContain("INVITE_CLAIM_RATE_LIMIT");
    expect(source).toContain("too_many_attempts");
    expect(source).not.toContain("INVITE_INVALID_ATTEMPT_LIMIT");
    expect(source).not.toContain("invalid_attempt_count");
    expect(source).not.toContain("claimed_ip_hash");
  });

  it("does not require optional invitation lockout columns to load valid invites", () => {
    expect(source).toContain('"id, access_code_hash, temp_email, expires_at, status"');
    expect(source).not.toContain("invalid_attempt_count, locked_until");
  });

  it("returns a specific error for canceled invites", () => {
    expect(source).toContain('invitation.status === "canceled"');
    expect(source).toContain('error: "invitation_canceled"');
    expect(source).toContain("status: 410");
  });
});
