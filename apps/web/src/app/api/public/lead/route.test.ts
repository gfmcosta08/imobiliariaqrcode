import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const routeSource = readFileSync(resolve(dir, "route.ts"), "utf8");

describe("public lead route security", () => {
  it("uses bounded JSON parser instead of raw request.json", () => {
    expect(routeSource).toContain("parseJsonObjectWithLimit");
    expect(routeSource).not.toContain("await request.json()");
  });

  it("rejects unknown keys and clamps user strings", () => {
    expect(routeSource).toContain("rejectUnknownKeys");
    expect(routeSource).toContain("clampString");
  });
});
