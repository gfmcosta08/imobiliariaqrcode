import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "PropertiesPage.tsx"), "utf8");

describe("PropertiesPage", () => {
  it("keeps a single primary action for manual property creation", () => {
    expect(source).toContain("QuickCreateButton");
    expect(source).not.toContain("Cadastrar manualmente");
  });
});
