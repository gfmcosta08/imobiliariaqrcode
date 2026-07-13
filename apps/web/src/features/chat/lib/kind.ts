import type { ChatKind } from "./types";

const SUGESTAO_RE = /sugest|sugiro|sugerir|ideia/i;
const RECLAMACAO_RE = /reclam|insatisfeit|p[ée]ssim|absurdo|porcari|decepciona|horr[ií]vel/i;

const EXPLICIT_KINDS = new Set<ChatKind>(["duvida", "sugestao", "reclamacao", "outro"]);

/** Autodetecta kind a partir do conteúdo quando não informado explicitamente. */
export function detectChatKind(content: string, explicit?: string): ChatKind {
  if (explicit && EXPLICIT_KINDS.has(explicit as ChatKind)) {
    return explicit as ChatKind;
  }
  if (SUGESTAO_RE.test(content)) return "sugestao";
  if (RECLAMACAO_RE.test(content)) return "reclamacao";
  return "duvida";
}
