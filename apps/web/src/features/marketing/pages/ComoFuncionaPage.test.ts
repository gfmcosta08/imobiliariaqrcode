import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "ComoFuncionaPage.tsx"), "utf8");

describe("ComoFuncionaPage", () => {
  it("explains the QR flow as WhatsApp-first without public lead form fallback", () => {
    expect(source).toContain("Crie o anuncio e gere o QR");
    expect(source).toContain("Use o QR onde quiser");
    expect(source).toContain("Visitante escaneia e abre o WhatsApp");
    expect(source).toContain("pode interagir com a nossa IA para agendar uma visita");
    expect(source).toContain("a IA envia automaticamente ao corretor o nome, contato do cliente");
    expect(source).toContain("Lead e interesse ficam visiveis para o corretor");
    expect(source).toContain("/teste-gratis");
    expect(source).toContain("images.unsplash.com");
    expect(source).not.toContain("WhatsApp ou formulario");
    expect(source).not.toContain("formulario registra o lead como backup");
  });
});
