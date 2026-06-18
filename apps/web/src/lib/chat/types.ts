export const CHAT_KINDS = ["duvida", "sugestao", "reclamacao", "resposta", "outro"] as const;
export type ChatKind = (typeof CHAT_KINDS)[number];

export const CHAT_DIRECTIONS = ["visitor", "hermes", "system"] as const;
export type ChatDirection = (typeof CHAT_DIRECTIONS)[number];

export type ChatMessage = {
  id: string;
  session_id: string;
  user_id: string | null;
  visitor_name: string | null;
  visitor_email: string | null;
  direction: ChatDirection;
  kind: ChatKind;
  content: string;
  is_read_by_costa: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type ChatPostBody = {
  session_id: string;
  content: string;
  kind?: ChatKind;
  visitor_name?: string;
  visitor_email?: string;
  visitor_phone?: string;
  page_url?: string;
};

export const FALE_CONOSCO_SESSION_KEY = "fale_conosco_session_id";
export const FALE_CONOSCO_ACCEPTED_KEY = "fale_conosco_accepted";

export const CHAT_CONTENT_MAX_LENGTH = 1000;
export const CHAT_POLL_INTERVAL_MS = 3_000;
/** Tempo maximo do indicador "digitando..." antes de confirmar recebimento. */
export const CHAT_TYPING_WINDOW_MS = 20_000;
