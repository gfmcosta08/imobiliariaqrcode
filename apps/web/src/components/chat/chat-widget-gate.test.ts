import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const gateSource = readFileSync(resolve(dir, "ChatWidgetGate.tsx"), "utf8");
const pageSource = readFileSync(resolve(dir, "../../app/page.tsx"), "utf8");

describe("ChatWidgetGate", () => {
  it("renderiza floating apenas para logados e exclui admin/checkout payment", () => {
    expect(gateSource).toContain('variant="floating"');
    expect(gateSource).toContain("!isLoggedIn");
    expect(gateSource).toContain('pathname.startsWith("/admin")');
    expect(gateSource).toContain('pathname.startsWith("/checkout/payment")');
  });

  it("falha silenciosamente sem env Supabase", () => {
    expect(gateSource).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(gateSource).toContain("catch");
  });
});

describe("home footer suporte", () => {
  it("link Contato aponta para /contato sem Central de ajuda", () => {
    expect(pageSource).toContain('["Contato", "/contato"]');
    expect(pageSource).not.toContain("Central de ajuda");
  });
});
