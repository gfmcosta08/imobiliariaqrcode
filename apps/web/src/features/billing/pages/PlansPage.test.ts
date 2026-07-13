import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "PlansPage.tsx"), "utf8");

describe("PlansPage", () => {
  it("does not advertise a public lead form as part of the plan", () => {
    expect(source).toContain("QR Code");
    expect(source).not.toContain("QR Code e formulario de lead");
  });
});
