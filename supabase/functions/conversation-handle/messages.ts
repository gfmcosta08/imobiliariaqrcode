export type BrokerContact = {
  name: string | null;
  phone: string | null;
};

const MAIN_MENU_OPTIONS = [
  "1 - Falar com o corretor sobre esse imovel",
  "2 - Ver imoveis semelhantes",
  "3 - Quero o contato do corretor",
  "4 - Finalizar atendimento",
];

export const ATTENDANCE_FINISHED_TEXT = "Ok! Agradeço seu contato!";

function normalizeMenuText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildMainMenuText(firstName?: string | null): string {
  const name = firstName?.trim();
  const greeting = name ? `${name}, como` : "Como";

  return `${greeting} posso te ajudar agora:\n\n${MAIN_MENU_OPTIONS.join("\n")}`;
}

export function matchChoice4(text: string): boolean {
  const normalized = normalizeMenuText(text);

  if (/^4$/.test(normalized)) {
    return true;
  }

  return /^(?:4\s*[-.)]\s*|(?:quero\s+)?)(?:finalizar|encerrar)(?:\s+o)?\s+atendimento$/.test(
    normalized,
  );
}

export function buildVisitRegisteredText(firstName: string, brokerContact: BrokerContact): string {
  const brokerName = brokerContact.name?.trim() || "Corretor";
  const brokerPhone = brokerContact.phone?.trim() || "Numero nao cadastrado ainda";

  return [
    `${firstName}, combinado! Ja registrei seu pedido de visita. O corretor vai falar com voce em instantes.`,
    "",
    "Corretor responsavel pelo anuncio:",
    `Nome: ${brokerName}`,
    `WhatsApp: ${brokerPhone}`,
  ].join("\n");
}
