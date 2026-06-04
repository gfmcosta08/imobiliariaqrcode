import { describe, expect, it } from "vitest";

import { validateCronAuthorization } from "./cron-auth";

describe("validateCronAuthorization", () => {
  it("fails closed when CRON_SECRET is missing", () => {
    const result = validateCronAuthorization(null, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe("cron_secret_missing");
    }
  });

  it("rejects missing authorization header when secret exists", () => {
    const result = validateCronAuthorization(null, "secret");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe("unauthorized");
    }
  });

  it("rejects wrong bearer token", () => {
    const result = validateCronAuthorization("Bearer wrong", "secret");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe("unauthorized");
    }
  });

  it("accepts exact bearer token", () => {
    const result = validateCronAuthorization("Bearer secret", "secret");
    expect(result.ok).toBe(true);
  });
});
