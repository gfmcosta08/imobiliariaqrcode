import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "public-qr-active.tsx"), "utf8");

describe("PublicQrActive", () => {
  it("can register public lead interest without a real WhatsApp bot number", () => {
    expect(source).toContain("/api/public/lead");
    expect(source).toContain("qr_token: token");
    expect(source).toContain('data-testid="public-qr-lead-submit"');
    expect(source).not.toContain("Numero do bot nao configurado");
  });

  it("shows a fallback lead form even when WhatsApp is available", () => {
    expect(source).toContain("WhatsApp nao abriu");
    expect(source).toContain("Deixe seu contato");
    expect(source).toContain('targetLink ? "whatsapp" : "form"');
  });

  it("does not navigate away automatically before the fallback lead form can be used", () => {
    expect(source).not.toContain("window.location.href = targetLink");
    expect(source).not.toContain("setTimeout");
    expect(source).toContain('data-testid="public-qr-whatsapp-link"');
  });
});
