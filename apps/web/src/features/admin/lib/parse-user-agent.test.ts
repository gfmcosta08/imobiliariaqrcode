import { describe, expect, it } from "vitest";

import { classifyDevice, parseUserAgent } from "./parse-user-agent";

describe("classifyDevice", () => {
  it("detects mobile", () => {
    expect(classifyDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("mobile");
  });

  it("detects desktop", () => {
    expect(classifyDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120")).toBe("desktop");
  });

  it("detects bot", () => {
    expect(classifyDevice("Googlebot/2.1")).toBe("bot");
  });
});

describe("parseUserAgent", () => {
  it("parses chrome on android", () => {
    const parsed = parseUserAgent("Mozilla/5.0 (Linux; Android 13) Chrome/120.0 Mobile");
    expect(parsed.device).toBe("mobile");
    expect(parsed.browser).toBe("Chrome");
    expect(parsed.os).toBe("Android");
  });
});
