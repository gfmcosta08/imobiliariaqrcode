import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../../");
const conversationHandlePath = path.join(
  repoRoot,
  "supabase/functions/conversation-handle/index.ts",
);
const dispatchPath = path.join(repoRoot, "supabase/functions/whatsapp-dispatch/index.ts");

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("WhatsApp guardrails contracts", () => {
  it("mantem mapeamento da opcao 2 para semelhantes no menu principal", () => {
    const src = read(conversationHandlePath);
    const mainChoiceBlock = src.match(
      /if \(session\.state === "awaiting_main_choice"\)[\s\S]*?if \(session\.state === "awaiting_recommendation_choice"\)/,
    );
    expect(mainChoiceBlock?.[0]).toBeTruthy();
    expect(mainChoiceBlock?.[0]).toContain("if (matchChoice2(text))");
    expect(mainChoiceBlock?.[0]).toContain("handleShowSimilarProperties(");
  });

  it("mantem mapeamento da opcao 2 para paginacao no menu pos-semelhantes", () => {
    const src = read(conversationHandlePath);
    const postSimilarBlock = src.match(
      /if \(session\.state === "awaiting_post_similar_choice"\)[\s\S]*?if \(session\.state === "awaiting_visit_property_id"\)/,
    );
    expect(postSimilarBlock?.[0]).toBeTruthy();
    expect(postSimilarBlock?.[0]).toContain("if (matchChoice2(text))");
    expect(postSimilarBlock?.[0]).toContain("handleShowSimilarProperties(");
  });

  it("mantem pedido de ID na opcao 1 do menu pos-semelhantes", () => {
    const src = read(conversationHandlePath);
    expect(src).toContain('kind: "ask_property_id"');
    expect(src).toContain("Qual o ID do imovel sobre o qual voce deseja falar?");
    expect(src).toContain('state: "awaiting_visit_property_id"');
  });

  it("mantem normalizacao de ID do imovel para comparacao tolerante", () => {
    const src = read(conversationHandlePath);
    expect(src).toContain("function normalizePropertyCode");
    expect(src).toContain('replace(/[^A-Z0-9]/g, "")');
    expect(src).toContain("normalizedInput.includes(normalizedPublicId)");
  });

  it("mantem ordem de envio por flow_step no mesmo flow_group no dispatcher", () => {
    const src = read(dispatchPath);
    expect(src).toContain("function sortRows");
    expect(src).toContain("flowGroupA");
    expect(src).toContain("flowStepA");
    expect(src).toContain("return stepCmp !== 0 ? stepCmp : createdCmp;");
  });
});
