import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const gateSource = readFileSync(resolve(dir, "ChatWidgetGate.tsx"), "utf8");
const bubbleSource = readFileSync(resolve(dir, "ChatBubble.tsx"), "utf8");
const pageSource = readFileSync(resolve(dir, "../../app/page.tsx"), "utf8");

describe("ChatWidgetGate", () => {
  it("renderiza floating para visitantes e logados, excluindo admin/checkout apenas deslogado", () => {
    expect(gateSource).toContain('variant="floating"');
    expect(gateSource).not.toContain("!isLoggedIn");
    expect(gateSource).toContain("isExcludedRoute(pathname, isLoggedIn)");
    expect(gateSource).toContain("if (isLoggedIn) return false");
  });

  it("falha silenciosamente sem env Supabase", () => {
    expect(gateSource).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(gateSource).toContain("catch");
  });
});

describe("ChatBubble draggable", () => {
  it("usa arraste com pointer events e posicao fixa", () => {
    expect(bubbleSource).toContain("useDraggableBubble");
    expect(bubbleSource).toContain("onPointerDown");
    expect(bubbleSource).toContain("Arraste para reposicionar");
  });
});

describe("home footer suporte", () => {
  it("link Contato aponta para /contato sem Central de ajuda", () => {
    expect(pageSource).toContain('["Contato", "/contato"]');
    expect(pageSource).not.toContain("Central de ajuda");
  });
});
