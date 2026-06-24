import { describe, expect, it } from "vitest";

import {
  ATTENDANCE_FINISHED_TEXT,
  buildMainMenuText,
  buildVisitRegisteredText,
  matchChoice4,
} from "../../../../supabase/functions/conversation-handle/messages";

describe("WhatsApp flow messages", () => {
  it("mantem as quatro opcoes no menu principal personalizado", () => {
    expect(buildMainMenuText("Maria")).toBe(
      [
        "Maria, como posso te ajudar agora:",
        "",
        "1 - Falar com o corretor sobre esse imovel",
        "2 - Ver imoveis semelhantes",
        "3 - Quero o contato do corretor",
        "4 - Finalizar atendimento",
      ].join("\n"),
    );
  });

  it("mantem o menu sem nome com saudacao valida", () => {
    expect(buildMainMenuText(null)).toMatch(/^Como posso te ajudar agora:/);
  });

  it.each(["4", "4 - Finalizar atendimento", "4) Encerrar o atendimento", "finalizar atendimento"])(
    "reconhece %s como finalizacao",
    (text) => {
      expect(matchChoice4(text)).toBe(true);
    },
  );

  it.each(["4 quartos", "14", "quero o contato do corretor"])(
    "nao confunde %s com finalizacao",
    (text) => {
      expect(matchChoice4(text)).toBe(false);
    },
  );

  it("mantem a resposta final exatamente como aprovada", () => {
    expect(ATTENDANCE_FINISHED_TEXT).toBe("Ok! Agradeço seu contato!");
  });

  it("inclui nome e WhatsApp do corretor dono do anuncio na confirmacao", () => {
    expect(
      buildVisitRegisteredText("Maria", {
        name: "Carlos Souza",
        phone: "5511999999999",
      }),
    ).toBe(
      [
        "Maria, combinado! Ja registrei seu pedido de visita. O corretor vai falar com voce em instantes.",
        "",
        "Corretor responsavel pelo anuncio:",
        "Nome: Carlos Souza",
        "WhatsApp: 5511999999999",
      ].join("\n"),
    );
  });

  it("usa fallbacks explicitos quando o cadastro do corretor esta incompleto", () => {
    const message = buildVisitRegisteredText("Maria", { name: null, phone: null });

    expect(message).toContain("Nome: Corretor");
    expect(message).toContain("WhatsApp: Numero nao cadastrado ainda");
  });
});
