import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "page.tsx"), "utf8");

describe("ConvitePage", () => {
  it("shows a specific message for canceled courtesy invites", () => {
    expect(source).toContain("invitation_canceled");
    expect(source).toContain("Este convite foi cancelado");
    expect(source).not.toContain("invitation_already_used:");
  });
});
