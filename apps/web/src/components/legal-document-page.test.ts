import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "legal-document-page.tsx"), "utf8");

describe("LegalDocumentPage", () => {
  it("uses embedded legal text instead of showing unavailable documents", () => {
    expect(source).toContain("DEFAULT_LEGAL_DOCUMENTS");
    expect(source).not.toContain("Documento indisponivel");
  });
});
