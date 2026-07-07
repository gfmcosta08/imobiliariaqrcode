import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "page.tsx"), "utf8");

describe("ConviteCodePage", () => {
  it("redirects legacy short invite links to the canonical invite form", () => {
    expect(source).toContain("redirect");
    expect(source).toContain("/convite?login_code=");
    expect(source).toContain("replace(/\\D/g");
  });

  it("preserves the current 8 digit invite login code in redirected links", () => {
    expect(source).toContain("slice(0, 8)");
  });
});
