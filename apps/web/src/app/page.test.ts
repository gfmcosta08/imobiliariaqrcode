import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "page.tsx"), "utf8");

describe("home page investor positioning", () => {
  it("keeps public listings secondary while sending primary CTAs to conversion pages", () => {
    expect(source).toContain('href="/teste-gratis"');
    expect(source).toContain('href="/como-funciona"');
    expect(source).toContain("Imoveis com QR ativo");
    expect(source).toContain('id="imoveis"');
  });

  it("describes capture as WhatsApp-first instead of form fallback", () => {
    expect(source).toContain("capture o interessado pelo WhatsApp");
    expect(source).not.toContain("WhatsApp ou formulario");
  });
});
