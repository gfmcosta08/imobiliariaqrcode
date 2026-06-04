import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "page.tsx"), "utf8");

describe("TesteGratisPage", () => {
  it("explains the free test account before sending the broker to signup", () => {
    expect(source).toContain("Conta teste gratuita");
    expect(source).toContain("1 imovel ativo");
    expect(source).toContain("Sem cartao de credito");
    expect(source).toContain("/login?mode=signup&next=/onboarding/primeiro-qr");
  });
});
