import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "complete-profile-route.ts"), "utf8");

describe("complete profile route", () => {
  it("repairs courtesy property limit override when claiming an invitation", () => {
    expect(source).toContain("property_count");
    expect(source).toContain("max_active_properties_override");
  });
});
