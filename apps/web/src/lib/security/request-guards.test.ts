import { describe, expect, it } from "vitest";

import { hashedRateLimitKey, secureNumericCode } from "./request-guards";

describe("request guards", () => {
  it("generates numeric invite codes with the requested entropy length", () => {
    const code = secureNumericCode(8);
    expect(code).toMatch(/^\d{8}$/);
  });

  it("hashes rate limit keys instead of storing raw identifiers", async () => {
    const key = await hashedRateLimitKey(["signup", "127.0.0.1", "user@example.com"]);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("user@example.com");
    expect(key).not.toContain("127.0.0.1");
  });
});
