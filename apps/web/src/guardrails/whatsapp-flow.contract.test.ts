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
const conversationMessagesPath = path.join(
  repoRoot,
  "supabase/functions/conversation-handle/messages.ts",
);
const conversationRoutingPath = path.join(
  repoRoot,
  "supabase/functions/conversation-handle/routing.ts",
);
const inboundPath = path.join(repoRoot, "supabase/functions/whatsapp-webhook-inbound/index.ts");
const dispatchPath = path.join(repoRoot, "supabase/functions/whatsapp-dispatch/index.ts");
const qrResolvePath = path.join(repoRoot, "supabase/functions/qr-resolve/index.ts");

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("WhatsApp guardrails contracts", () => {
  it("mantem menu unico com as quatro opcoes em todos os pontos de envio", () => {
    const src = read(conversationHandlePath);
    const messages = read(conversationMessagesPath);

    expect(messages).toContain('"4 - Finalizar atendimento"');
    expect(src.match(/text: buildMainMenuText\(firstName\)/g)).toHaveLength(2);
    expect(src).toContain("responda com 1, 2, 3 ou 4");
  });

  it("fecha o atendimento pela opcao 4 nos menus principal e pos-semelhantes", () => {
    const src = read(conversationHandlePath);
    const routing = read(conversationRoutingPath);
    const mainChoiceBlock = src.match(
      /if \(session\.state === "awaiting_main_choice"\)[\s\S]*?if \(session\.state === "awaiting_recommendation_choice"\)/,
    );
    const postSimilarBlock = src.match(
      /if \(session\.state === "awaiting_post_similar_choice"\)[\s\S]*?if \(session\.state === "awaiting_visit_property_id"\)/,
    );
    const finishBlock = src.match(
      /async function finishAttendance\([\s\S]*?async function handlePostSimilarPropertyId/,
    );
    const classifierBlock = routing.match(
      /export function classifyConversationIntent\([\s\S]*?export function shouldForceQrEntryForCrossProperty/,
    );

    expect(classifierBlock?.[0]).toContain("matchChoice4(text)");
    expect(mainChoiceBlock?.[0]).toContain("if (matchChoice4(text))");
    expect(mainChoiceBlock?.[0]).toContain("finishAttendance(");
    expect(postSimilarBlock?.[0]).toContain("if (matchChoice4(text))");
    expect(postSimilarBlock?.[0]).toContain("finishAttendance(");
    expect(finishBlock?.[0]).toContain("text: ATTENDANCE_FINISHED_TEXT");
    expect(finishBlock?.[0]).toContain('state: "closed"');
  });

  it("permite que um novo QR reabra uma sessao encerrada", () => {
    const src = read(conversationHandlePath);
    const qrBlock = src.match(/if \(qrToken\)[\s\S]*?\/\/ fim if \(qrToken\)/)?.[0];

    expect(qrBlock).toBeTruthy();
    expect(qrBlock).toContain('state: "awaiting_main_choice"');
    expect(qrBlock).toContain('last_menu: "main_menu"');
  });

  it("inclui contato do dono do anuncio antes de confirmar a visita", () => {
    const src = read(conversationHandlePath);
    const registerVisitBlock = src.match(
      /async function doRegisterVisit\([\s\S]*?async function finishAttendance/,
    )?.[0];

    expect(registerVisitBlock).toBeTruthy();
    expect(registerVisitBlock).toContain("loadBrokerContact(supabase, listingOwnerBrokerId)");
    expect(registerVisitBlock).toContain(
      "buildVisitRegisteredText(firstName, listingOwnerContact)",
    );
    expect(registerVisitBlock).toContain(
      'const ownerName = listingOwnerContact.name ?? "Corretor do anuncio"',
    );
    expect(registerVisitBlock!.indexOf("listingOwnerContact")).toBeLessThan(
      registerVisitBlock!.indexOf('kind: "visit_registered"'),
    );
  });

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

  it("prioriza ID informado no estado pos-semelhantes antes de tratar como novo QR", () => {
    const src = read(conversationHandlePath);
    const routing = read(conversationRoutingPath);
    const sessionLoadBlock = src.match(
      /const parsedQrToken = parseQrToken\(text\);[\s\S]*?if \(!qrToken\)/,
    );
    expect(sessionLoadBlock?.[0]).toBeTruthy();
    expect(routing).toContain("function classifyConversationIntent");
    expect(src).toContain("getEffectiveSessionState");
    expect(src).toContain("isSessionExpired");
    expect(src).toContain("shouldForceQrEntryForCrossProperty");
    expect(src).toContain('"post_similar_property_id"');
    expect(src).toContain('"visit_property_id"');
    expect(src).toContain('conversationIntent === "visit_property_id"');
    expect(src).toContain('conversationIntent === "post_similar_property_id"');

    const qrBranchIndex = src.indexOf("if (qrToken) {");
    const visitIdBranchIndex = src.indexOf('if (session.state === "awaiting_visit_property_id")');
    expect(qrBranchIndex).toBeGreaterThan(-1);
    expect(visitIdBranchIndex).toBeGreaterThan(qrBranchIndex);
  });

  it("nao bloqueia novo QR quando a sessao pos-semelhantes expirou", () => {
    const src = read(conversationHandlePath);
    const routing = read(conversationRoutingPath);

    expect(routing).toContain("function getEffectiveSessionState");
    expect(routing).toContain("function isSessionExpired");
    expect(src).toContain("const effectiveSessionState = getEffectiveSessionState");
    expect(src).toContain("classifyConversationIntent(");
    expect(src).toContain("effectiveSessionState");
    expect(src).toContain("if (sessionExpired) {");
    expect(src).not.toMatch(
      /if \(sessionExpired\)[\s\S]*?queuePropertyCodePrompt[\s\S]*?parsedQrToken/,
    );
  });

  it("mantem normalizacao de ID do imovel para comparacao tolerante", () => {
    const src = read(conversationHandlePath);
    expect(src).toContain("function normalizePropertyCode");
    expect(src).toContain('replace(/[^A-Z0-9]/g, "")');
    expect(src).toContain("normalizedInput.includes(normalizedPublicId)");
  });

  it("mantem retry quando o ID informado apos semelhantes nao e encontrado", () => {
    const src = read(conversationHandlePath);
    const selectionHandlerBlock = src.match(
      /async function handlePostSimilarPropertyId\([\s\S]*?async function sendTypingPresenceNow/,
    );
    expect(selectionHandlerBlock?.[0]).toBeTruthy();
    expect(selectionHandlerBlock?.[0]).toContain(
      "resolveRecommendedProperty(supabase, text, recommended, shown)",
    );
    expect(selectionHandlerBlock?.[0]).toContain('kind: "ask_property_id_retry"');
    expect(selectionHandlerBlock?.[0]).toContain(
      "Nao encontrei esse imovel. Por favor, informe novamente o ID do imovel.",
    );
    expect(selectionHandlerBlock?.[0]).toContain('state: "awaiting_visit_property_id"');
  });

  it("mantem resolucao do ID contra todos os imoveis semelhantes ja exibidos", () => {
    const src = read(conversationHandlePath);
    const resolverBlock = src.match(
      /async function resolveRecommendedProperty\([\s\S]*?function summarizeProperty/,
    );
    const selectionHandlerBlock = src.match(
      /async function handlePostSimilarPropertyId\([\s\S]*?async function sendTypingPresenceNow/,
    );
    expect(resolverBlock?.[0]).toBeTruthy();
    expect(resolverBlock?.[0]).toContain("shownIds: string[] = []");
    expect(resolverBlock?.[0]).toContain("[...recommendedIds, ...shownIds]");
    expect(resolverBlock?.[0]).toContain('.in("id", candidateIds)');
    expect(resolverBlock?.[0]).toContain("trimmed === internalId");
    expect(resolverBlock?.[0]).toContain("normalizePropertyCode(p.public_id)");
    expect(selectionHandlerBlock?.[0]).toContain("session.similar_shown_property_ids");
    expect(selectionHandlerBlock?.[0]).toContain(
      "resolveRecommendedProperty(supabase, text, recommended, shown)",
    );
  });

  it("aceita ID direto no menu pos-semelhantes sem exigir escolha 1 antes", () => {
    const src = read(conversationHandlePath);
    const postSimilarBlock = src.match(
      /if \(session\.state === "awaiting_post_similar_choice"\)[\s\S]*?if \(session\.state === "awaiting_visit_property_id"\)/,
    );
    expect(postSimilarBlock?.[0]).toBeTruthy();
    expect(postSimilarBlock?.[0]).toContain("option1_direct_property_id_in_multi_property_context");
    expect(postSimilarBlock?.[0]).toContain("handlePostSimilarPropertyId({");
  });

  it("preserva contexto pos-semelhantes ao pedir ID para falar com corretor", () => {
    const src = read(conversationHandlePath);
    const postSimilarBlock = src.match(
      /if \(session\.state === "awaiting_post_similar_choice"\)[\s\S]*?if \(matchChoice2\(text\)\)/,
    );
    expect(postSimilarBlock?.[0]).toBeTruthy();
    expect(postSimilarBlock?.[0]).toContain('state: "awaiting_visit_property_id"');
    expect(postSimilarBlock?.[0]).toContain('last_menu: "main_menu_post_similar"');
    expect(postSimilarBlock?.[0]).toContain("last_recommended_properties: recommended");
    expect(postSimilarBlock?.[0]).toContain("similar_shown_property_ids: shown");
    expect(postSimilarBlock?.[0]).toContain("target_property_id: null");
  });

  it("mantem registro de visita pos-semelhantes marcado como fluxo pos-listagem", () => {
    const src = read(conversationHandlePath);
    const selectionHandlerBlock = src.match(
      /async function handlePostSimilarPropertyId\([\s\S]*?async function sendTypingPresenceNow/,
    );
    expect(selectionHandlerBlock?.[0]).toBeTruthy();
    expect(selectionHandlerBlock?.[0]).toContain("targetProp");
    expect(selectionHandlerBlock?.[0]).toContain('"main_menu_post_similar"');
    expect(selectionHandlerBlock?.[0]).toContain("{ postListingFlow: true }");
  });

  it("mantem current_property_id como contexto do menu e origin_property_id como captador", () => {
    const src = read(conversationHandlePath);
    const followUpBlock = src.match(
      /const sessionPropertyId = fmt\(session\.current_property_id\)[\s\S]*?const \{ data: broker \} = await supabase/,
    );
    const registerVisitBlock = src.match(
      /async function doRegisterVisit\([\s\S]*?async function handlePostSimilarPropertyId/,
    );
    expect(followUpBlock?.[0]).toBeTruthy();
    expect(followUpBlock?.[0]).toContain("fmt(session.current_property_id)");
    expect(followUpBlock?.[0]).toContain("fmt(session.origin_property_id)");
    expect(registerVisitBlock?.[0]).toContain("current_property_id: String(property.id)");
    expect(registerVisitBlock?.[0]).toContain("target_property_id: null");
    expect(registerVisitBlock?.[0]).toContain("originBrokerId");
  });

  it("envia contato do corretor captador na opcao 3 quando existe origin_property_id", () => {
    const src = read(conversationHandlePath);
    const mainChoiceBlock = src.match(
      /if \(session\.state === "awaiting_main_choice"\)[\s\S]*?if \(session\.state === "awaiting_recommendation_choice"\)/,
    );
    const postSimilarBlock = src.match(
      /if \(session\.state === "awaiting_post_similar_choice"\)[\s\S]*?if \(session\.state === "awaiting_visit_property_id"\)/,
    );
    const originContactBlock = src.match(
      /async function loadLeadOriginBrokerContact\([\s\S]*?async function resolveRecommendedProperty/,
    );

    expect(originContactBlock?.[0]).toBeTruthy();
    expect(originContactBlock?.[0]).toContain("loadOriginPropertyForSession");
    expect(originContactBlock?.[0]).toContain(
      "const originBrokerId = fmt(originProperty?.broker_id)",
    );
    expect(originContactBlock?.[0]).toContain("loadBrokerContact(supabase, originBrokerId)");
    expect(originContactBlock?.[0]).toContain("fallbackBrokerId");
    expect(mainChoiceBlock?.[0]).toContain("loadLeadOriginBrokerContact(");
    expect(postSimilarBlock?.[0]).toContain("loadLeadOriginBrokerContact(");
    expect(mainChoiceBlock?.[0]).toContain("broker_phone: leadOriginBroker.brokerPhone");
    expect(postSimilarBlock?.[0]).toContain("broker_phone: leadOriginBroker.brokerPhone");
    expect(mainChoiceBlock?.[0]).toContain("responsavel pelo seu atendimento");
    expect(postSimilarBlock?.[0]).toContain("responsavel pelo seu atendimento");
  });

  it("mantem template enriquecido para cenario B do estoque geral", () => {
    const src = read(conversationHandlePath);
    const registerVisitBlock = src.match(
      /async function doRegisterVisit\([\s\S]*?async function sendTypingPresenceNow/,
    );
    expect(registerVisitBlock?.[0]).toBeTruthy();
    expect(registerVisitBlock?.[0]).toContain('scenario: isGeneralStockOwner ? "B" : "A"');
    expect(registerVisitBlock?.[0]).toContain("Alerta de novo lead para visita.");
    expect(registerVisitBlock?.[0]).toContain("Nome do lead:");
    expect(registerVisitBlock?.[0]).toContain("Telefone do lead:");
    expect(registerVisitBlock?.[0]).toContain("ID do imovel escolhido:");
    expect(registerVisitBlock?.[0]).toContain("Dono do anuncio:");
    expect(registerVisitBlock?.[0]).toContain("Contato do dono do anuncio:");
    expect(registerVisitBlock?.[0]).toContain("to_broker: true");
  });

  it("mantem ordem pos-ID: confirmacao, notificacao ao corretor e menu", () => {
    const src = read(conversationHandlePath);
    const registerVisitBlock = src.match(
      /async function doRegisterVisit\([\s\S]*?async function sendTypingPresenceNow/,
    )?.[0];
    expect(registerVisitBlock).toBeTruthy();
    expect(registerVisitBlock).toContain("options.postListingFlow");
    expect(registerVisitBlock).toContain(
      "const flowGroup = isPostListingFlow ? crypto.randomUUID() : null;",
    );
    expect(registerVisitBlock).toContain("flow_step: flowGroup ? flowStep++ : null");

    const confirmIndex = registerVisitBlock!.indexOf('kind: "visit_registered"');
    const notifyIndex = registerVisitBlock!.indexOf('kind: "broker_notification"');
    const menuIndex = registerVisitBlock!.indexOf("await sendMainMenu(");
    expect(confirmIndex).toBeGreaterThan(-1);
    expect(notifyIndex).toBeGreaterThan(confirmIndex);
    expect(menuIndex).toBeGreaterThan(notifyIndex);
  });

  it("mantem ordem de envio por flow_step no mesmo flow_group no dispatcher", () => {
    const src = read(dispatchPath);
    expect(src).toContain("function sortRows");
    expect(src).toContain("flowGroupA");
    expect(src).toContain("flowStepA");
    expect(src).toContain("return stepCmp !== 0 ? stepCmp : createdCmp;");
  });

  it("mantem trava anti-silencio ignorando mensagens internas e notificacoes ao corretor", () => {
    const src = read(conversationHandlePath);
    expect(src).toContain("function countVisibleCustomerOutboundMessages");
    expect(src).toContain('row.message_type !== "system"');
    expect(src).toContain("payload.to_broker !== true");
    expect(src).toContain("function ensureCustomerResponseQueued");
    expect(src).toContain('"error_silent_response_blocked"');
  });

  it("mantem validacao anti-silencio no fluxo inicial por QR apos montar o pacote", () => {
    const src = read(conversationHandlePath);
    const qrBlock = src.match(/if \(qrToken\)[\s\S]*?\/\/ fim if \(qrToken\)/)?.[0];
    expect(qrBlock).toBeTruthy();
    expect(qrBlock).toContain("await sendPropertyPack(");
    expect(qrBlock).toContain("ensureCustomerResponseQueued(supabase");
    expect(qrBlock).toContain('context: "qr_entry_property_pack"');
  });

  it("mantem deduplicacao do QR baseada apenas no pacote visivel ao cliente", () => {
    const src = read(conversationHandlePath);
    expect(src).toContain("function isQrPackCustomerMessage");
    expect(src).toContain("async function countRecentQrPackCustomerMessages");
    expect(src).toContain('row.message_type !== "system"');
    expect(src).toContain("payload.to_broker !== true");
    expect(src).toContain('kind === "lead_intro"');
    expect(src).toContain('kind === "property_summary"');
    expect(src).toContain('kind === "property_image"');
    expect(src).toContain('kind === "main_menu"');
    expect(src).toContain('kind.startsWith("menu_option_")');
  });

  it("impede que lead_created ou alerta ao corretor bloqueiem o pacote inicial do QR", () => {
    const src = read(conversationHandlePath);
    const qrBlock = src.match(/if \(qrToken\)[\s\S]*?\/\/ fim if \(qrToken\)/)?.[0];
    expect(qrBlock).toBeTruthy();
    expect(qrBlock).toContain("countRecentQrPackCustomerMessages(");
    expect(qrBlock).not.toContain("countRecentOutboundMessages(");
    expect(qrBlock).toContain("await sendPropertyPack(");
  });

  it("mantem fallback rastreavel quando a trava anti-silencio bloqueia sucesso falso", () => {
    const src = read(conversationHandlePath);
    expect(src).toContain("class SilentResponseError extends Error");
    expect(src).toContain("silent_guard: true");
    expect(src).toContain("silent_response_blocked");
    expect(src).toContain("fallback_queued: e.fallbackQueued");
  });

  it("mantem checagem defensiva no webhook antes de marcar como processado", () => {
    const src = read(inboundPath);
    const successGuardIndex = src.indexOf("const visibleCustomerMessages");
    const processedIndex = src.indexOf('processing_status: "processed"');
    expect(successGuardIndex).toBeGreaterThan(-1);
    expect(processedIndex).toBeGreaterThan(successGuardIndex);
    expect(src).toContain("conversation-handle succeeded without visible customer response");
    expect(src).toContain('"silent_response_blocked"');
  });

  it("mantem a marca ImoveisQR no link gerado por qr-resolve", () => {
    const src = read(qrResolvePath);
    expect(src).toContain("que vi no ImoveisQR");
    expect(src).not.toContain("que vi no QRImoveis");
  });
});
