import { describe, expect, it, vi } from "vitest";

import { detectChatKind } from "./kind";
import {
  computeSinceFromMessages,
  dedupeMessagesById,
  hasPendingVisitorReply,
  isWithinTypingWindow,
  mergeChatMessages,
  resolveChatReplyState,
} from "./messages";
import { CHAT_CLIENT_MESSAGE_ID_METADATA_KEY } from "./types";
import { CHAT_TYPING_WINDOW_MS } from "./types";
import { getChatPollIntervalMs, scheduleNextPoll } from "./polling";
import { sanitizeChatContent } from "./sanitize";
import type { ChatMessage } from "./types";
import { isValidUuid, validateChatPostBody, validateMessagesQuery } from "./validate";

const SAMPLE_UUID = "550e8400-e29b-41d4-a716-446655440000";

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    session_id: SAMPLE_UUID,
    user_id: null,
    visitor_name: null,
    visitor_email: null,
    direction: "visitor",
    kind: "duvida",
    content: "teste",
    is_read_by_costa: false,
    created_at: new Date().toISOString(),
    metadata: null,
    ...overrides,
  };
}

describe("sanitizeChatContent", () => {
  it("trim, remove tags e limita a 1000 chars", () => {
    expect(sanitizeChatContent("  ola  ")).toBe("ola");
    expect(sanitizeChatContent("<b>oi</b>")).toBe("oi");
    expect(sanitizeChatContent("x".repeat(1005)).length).toBe(1000);
    expect(sanitizeChatContent(123)).toBe("");
  });
});

describe("isValidUuid", () => {
  it("aceita UUID v4 valido e rejeita invalidos", () => {
    expect(isValidUuid(SAMPLE_UUID)).toBe(true);
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("")).toBe(false);
  });
});

describe("detectChatKind", () => {
  it("detecta sugestao, reclamacao e duvida", () => {
    expect(detectChatKind("Tenho uma sugestao")).toBe("sugestao");
    expect(detectChatKind("Quero sugerir uma ideia")).toBe("sugestao");
    expect(detectChatKind("Estou insatisfeito, pessimo")).toBe("reclamacao");
    expect(detectChatKind("Horrivel atendimento")).toBe("reclamacao");
    expect(detectChatKind("Como funciona o QR?")).toBe("duvida");
  });

  it("respeita kind explicito valido", () => {
    expect(detectChatKind("reclamacao aqui", "outro")).toBe("outro");
  });
});

describe("validateChatPostBody", () => {
  it("valida body correto", () => {
    const result = validateChatPostBody({
      session_id: SAMPLE_UUID,
      content: "Ola",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.session_id).toBe(SAMPLE_UUID);
      expect(result.kindDetected).toBe("duvida");
    }
  });

  it("rejeita session_id invalido e conteudo vazio", () => {
    expect(validateChatPostBody({ session_id: "bad", content: "x" }).ok).toBe(false);
    expect(validateChatPostBody({ session_id: SAMPLE_UUID, content: "   " }).ok).toBe(false);
  });

  it("aceita telefone opcional valido", () => {
    const result = validateChatPostBody({
      session_id: SAMPLE_UUID,
      content: "Oi",
      visitor_phone: "11999998888",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.visitor_phone).toBe("5511999998888");
    }
  });

  it("rejeita client_message_id invalido", () => {
    const result = validateChatPostBody({
      session_id: SAMPLE_UUID,
      content: "oi",
      client_message_id: "not-uuid",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_client_message_id");
  });

  it("aceita client_message_id UUID valido", () => {
    const clientId = "880e8400-e29b-41d4-a716-446655440003";
    const result = validateChatPostBody({
      session_id: SAMPLE_UUID,
      content: "oi",
      client_message_id: clientId,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.client_message_id).toBe(clientId);
  });
});

describe("validateMessagesQuery", () => {
  it("exige session_id para anonimo", () => {
    const params = new URLSearchParams();
    const result = validateMessagesQuery(params, { requireSessionForAnonymous: true });
    expect(result.ok).toBe(false);
  });

  it("aceita since valido", () => {
    const params = new URLSearchParams({
      session_id: SAMPLE_UUID,
      since: "2026-06-18T12:00:00.000Z",
    });
    const result = validateMessagesQuery(params, { requireSessionForAnonymous: true });
    expect(result.ok).toBe(true);
  });
});

describe("dedupeMessagesById", () => {
  it("remove duplicatas mantendo ordem", () => {
    const a = makeMessage({ id: "a" });
    const b = makeMessage({ id: "b" });
    const dup = makeMessage({ id: "a", content: "dup" });
    expect(dedupeMessagesById([a, b, dup])).toHaveLength(2);
    expect(dedupeMessagesById([a, b, dup])[0]?.id).toBe("a");
  });
});

describe("mergeChatMessages", () => {
  it("remove placeholder otimista quando servidor confirma client_message_id", () => {
    const clientId = "880e8400-e29b-41d4-a716-446655440003";
    const serverId = "990e8400-e29b-41d4-a716-446655440004";
    const optimistic = makeMessage({
      id: clientId,
      content: "como funciona?",
      metadata: { [CHAT_CLIENT_MESSAGE_ID_METADATA_KEY]: clientId },
    });
    const confirmed = makeMessage({
      id: serverId,
      content: "como funciona?",
      metadata: { [CHAT_CLIENT_MESSAGE_ID_METADATA_KEY]: clientId },
    });

    const merged = mergeChatMessages([optimistic], [confirmed]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe(serverId);
  });

  it("deduplica por id quando polling repete a mesma mensagem", () => {
    const serverId = "990e8400-e29b-41d4-a716-446655440004";
    const confirmed = makeMessage({ id: serverId, content: "ok" });
    const merged = mergeChatMessages([confirmed], [confirmed]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe(serverId);
  });
});

describe("computeSinceFromMessages", () => {
  it("retorna null para lista vazia e ISO da mais recente", () => {
    expect(computeSinceFromMessages([])).toBeNull();
    const older = makeMessage({ created_at: "2026-06-18T10:00:00.000Z" });
    const newer = makeMessage({ created_at: "2026-06-18T12:00:00.000Z" });
    expect(computeSinceFromMessages([older, newer])).toBe("2026-06-18T12:00:00.000Z");
  });
});

describe("hasPendingVisitorReply", () => {
  it("true quando ultima mensagem e do visitante", () => {
    const visitor = makeMessage({ direction: "visitor" });
    expect(hasPendingVisitorReply([visitor])).toBe(true);
    const hermes = makeMessage({ direction: "hermes" });
    expect(hasPendingVisitorReply([visitor, hermes])).toBe(false);
  });
});

describe("typing window", () => {
  it("mostra digitando so dentro da janela e depois confirma recebimento", () => {
    const sentAt = "2026-06-18T22:00:00.000Z";
    const visitor = makeMessage({ direction: "visitor", created_at: sentAt });
    const early = Date.parse(sentAt) + 5_000;
    const late = Date.parse(sentAt) + CHAT_TYPING_WINDOW_MS + 1_000;

    expect(isWithinTypingWindow([visitor], early)).toBe(true);
    expect(isWithinTypingWindow([visitor], late)).toBe(false);

    expect(resolveChatReplyState([visitor], early)).toEqual({
      isTyping: true,
      awaitingReply: false,
    });
    expect(resolveChatReplyState([visitor], late)).toEqual({
      isTyping: false,
      awaitingReply: true,
    });
  });
});

describe("polling helpers", () => {
  it("retorna null quando document hidden", () => {
    expect(getChatPollIntervalMs(true)).toBeNull();
    expect(getChatPollIntervalMs(false)).toBe(3000);
  });

  it("scheduleNextPoll usa timer fake", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    scheduleNextPoll(spy, false);
    vi.advanceTimersByTime(3000);
    expect(spy).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
