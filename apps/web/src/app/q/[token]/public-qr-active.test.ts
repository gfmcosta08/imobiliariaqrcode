import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "public-qr-active.tsx"), "utf8");

describe("PublicQrActive", () => {
  it("keeps the QR landing page focused on the WhatsApp handoff", () => {
    expect(source).toContain('data-testid="public-qr-whatsapp-link"');
    expect(source).toContain("Abrir WhatsApp");
    expect(source).not.toContain("Numero do bot nao configurado");
  });

  it("does not expose the legacy public lead fallback form", () => {
    expect(source).not.toContain("/api/public/lead");
    expect(source).not.toContain("WhatsApp nao abriu");
    expect(source).not.toContain("Deixe seu contato");
    expect(source).not.toContain('data-testid="public-qr-lead-form"');
    expect(source).not.toContain('data-testid="public-qr-lead-submit"');
    expect(source).not.toContain('targetLink ? "whatsapp" : "form"');
  });

  it("does not navigate away automatically before the visitor can review the property", () => {
    expect(source).not.toContain("window.location.href = targetLink");
    expect(source).not.toContain("setTimeout");
    expect(source).toContain('data-testid="public-qr-whatsapp-link"');
  });
});
