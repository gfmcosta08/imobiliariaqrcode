import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "import-listings-button.tsx"), "utf8");

describe("ImportListingsButton", () => {
  it("exposes pasted listing import in the dialog", () => {
    expect(source).toContain("/api/properties/import/paste");
    expect(source).toContain("overflow-y-auto");
    expect(source).toContain("Colar texto do anuncio");
    expect(source).toContain('data-testid="import-paste-submit"');
  });
});
