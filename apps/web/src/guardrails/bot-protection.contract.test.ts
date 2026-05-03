import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../../");
const packagePath = path.join(repoRoot, "package.json");
const prdPath = path.join(repoRoot, "prd/PRD-camadas-protecao-fluxo-bot-whatsapp.md");
const invariantsPath = path.join(repoRoot, "prd/INVARIANTES-fluxo-bot-whatsapp.md");
const whatsappGuardrailsPath = path.join(
  repoRoot,
  "apps/web/src/guardrails/whatsapp-flow.contract.test.ts",
);
const monitorGuardrailsPath = path.join(
  repoRoot,
  "apps/web/src/guardrails/bot-monitor.contract.test.ts",
);

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("Bot protection guardrails", () => {
  it("mantem PRD oficial de camadas de protecao do bot", () => {
    const prd = read(prdPath);
    expect(prd).toContain("Camadas De Protecao");
    expect(prd).toContain("PRD obrigatorio por mudanca sensivel");
    expect(prd).toContain("Mapa de invariantes do bot");
    expect(prd).toContain("Guardrails automatizados");
    expect(prd).toContain("Suite de regressao do bot");
    expect(prd).toContain("Checklist obrigatorio antes de deploy");
    expect(prd).toContain("Protecao contra alteracao fora do escopo");
  });

  it("documenta arquivos sensiveis e invariantes de sessao do bot", () => {
    const invariants = read(invariantsPath);
    expect(invariants).toContain("supabase/functions/conversation-handle/index.ts");
    expect(invariants).toContain("supabase/functions/whatsapp-webhook-inbound/index.ts");
    expect(invariants).toContain("supabase/functions/whatsapp-dispatch/index.ts");
    expect(invariants).toContain("supabase/functions/bot-health-monitor/index.ts");
    expect(invariants).toContain("origin_property_id");
    expect(invariants).toContain("current_property_id");
    expect(invariants).toContain("target_property_id");
    expect(invariants).toContain("nao pode sobrescrever `origin_property_id`");
  });

  it("documenta invariantes do menu, pos-semelhantes, notificacoes e anti-silencio", () => {
    const invariants = read(invariantsPath);
    expect(invariants).toContain("Opcao 2 mostra imoveis semelhantes");
    expect(invariants).toContain("Opcao 3 envia contato do corretor captador");
    expect(invariants).toContain("ID informado deve ser resolvido contra todos os imoveis semelhantes");
    expect(invariants).toContain("ID pos-semelhantes nunca deve ser tratado como novo QR");
    expect(invariants).toContain("Notificacao ao corretor nao e resposta visivel ao cliente");
    expect(invariants).toContain("detectar travamento em no maximo 5 minutos");
  });

  it("expoe comando dedicado para validar contratos criticos do bot", () => {
    const pkg = JSON.parse(read(packagePath)) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.["test:bot-guardrails"]).toBeTruthy();
    expect(pkg.scripts?.["test:bot-guardrails"]).toContain("vitest run");
    expect(pkg.scripts?.["test:bot-guardrails"]).toContain("src/guardrails");
  });

  it("mantem guardrails de fluxo whatsapp e monitor do bot", () => {
    const whatsappGuardrails = read(whatsappGuardrailsPath);
    const monitorGuardrails = read(monitorGuardrailsPath);
    expect(whatsappGuardrails).toContain("WhatsApp guardrails contracts");
    expect(whatsappGuardrails).toContain("envia contato do corretor captador");
    expect(whatsappGuardrails).toContain("trava anti-silencio");
    expect(monitorGuardrails).toContain("Bot health monitor guardrails");
    expect(monitorGuardrails).toContain("mantem deteccao de travamento limitada a no maximo 5 minutos");
  });
});
