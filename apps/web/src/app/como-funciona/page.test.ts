import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "page.tsx"), "utf8");

describe("ComoFuncionaPage", () => {
  it("explains the QR to lead flow with a sales-oriented step-by-step", () => {
    expect(source).toContain("Cole o QR no imovel");
    expect(source).toContain("Visitante aponta a camera");
    expect(source).toContain("Lead aparece no painel");
    expect(source).toContain("/teste-gratis");
    expect(source).toContain("images.unsplash.com");
  });
});
