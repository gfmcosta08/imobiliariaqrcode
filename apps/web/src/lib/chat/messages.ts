import { CHAT_CLIENT_MESSAGE_ID_METADATA_KEY, CHAT_TYPING_WINDOW_MS } from "./types";
import type { ChatMessage } from "./types";

function readClientMessageId(message: ChatMessage): string | null {
  const value = message.metadata?.[CHAT_CLIENT_MESSAGE_ID_METADATA_KEY];
  return typeof value === "string" ? value : null;
}

export type ChatReplyState = {
  isTyping: boolean;
  awaitingReply: boolean;
};

/** Deduplica mensagens pelo id, preservando a ordem da lista de entrada. */
export function dedupeMessagesById(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  const result: ChatMessage[] = [];
  for (const message of messages) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    result.push(message);
  }
  return result;
}

/**
 * Mescla mensagens locais com as do servidor, removendo placeholders otimistas
 * quando o servidor confirma o mesmo client_message_id.
 */
export function mergeChatMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return dedupeMessagesById(existing);

  const supersededClientIds = new Set<string>();
  for (const message of incoming) {
    const clientId = readClientMessageId(message);
    if (clientId) supersededClientIds.add(clientId);
  }

  const filtered = existing.filter((message) => !supersededClientIds.has(message.id));
  return dedupeMessagesById([...filtered, ...incoming]);
}

/** Retorna ISO8601 da última created_at para uso como parâmetro since. */
export function computeSinceFromMessages(messages: ChatMessage[]): string | null {
  if (messages.length === 0) return null;
  let latest = messages[0]!;
  for (const message of messages) {
    if (Date.parse(message.created_at) > Date.parse(latest.created_at)) {
      latest = message;
    }
  }
  return latest.created_at;
}

function sortByCreatedAt(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

/** Indica se há mensagem do visitante aguardando resposta Hermes/sistema. */
export function hasPendingVisitorReply(messages: ChatMessage[]): boolean {
  if (messages.length === 0) return false;
  const last = sortByCreatedAt(messages)[messages.length - 1]!;
  return last.direction === "visitor";
}

/** "Digitando..." so aparece por janela curta apos a ultima msg do visitante. */
export function isWithinTypingWindow(
  messages: ChatMessage[],
  nowMs: number,
  windowMs: number = CHAT_TYPING_WINDOW_MS,
): boolean {
  if (!hasPendingVisitorReply(messages)) return false;
  const last = sortByCreatedAt(messages)[messages.length - 1]!;
  const elapsed = nowMs - Date.parse(last.created_at);
  return elapsed >= 0 && elapsed < windowMs;
}

export function resolveChatReplyState(
  messages: ChatMessage[],
  nowMs: number,
  windowMs: number = CHAT_TYPING_WINDOW_MS,
): ChatReplyState {
  const pending = hasPendingVisitorReply(messages);
  const isTyping = pending && isWithinTypingWindow(messages, nowMs, windowMs);
  return {
    isTyping,
    awaitingReply: pending && !isTyping,
  };
}
