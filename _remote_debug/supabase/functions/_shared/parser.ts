export type ManagerCommand =
  | { type: "confirmar"; customerName: string; time: string }
  | { type: "sugerir"; customerName: string; time: string }
  | { type: "cancelar"; customerName: string; time: string }
  | { type: "agenda_hoje" }
  | { type: "agenda_semana" }
  | { type: "encaixar"; time: string; customerName: string; serviceName: string }
  | { type: "add_servico"; name: string; category: string; price: number; description: string }
  | { type: "servicos" }
  | { type: "pendentes" }
  | { type: "template_help"; code: 5 | 6 | 7 | 8 }
  | { type: "ajuda" }
  | { type: "unknown"; raw: string };

export function normalizeText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function parseManagerCommand(rawText: string): ManagerCommand {
  const text = normalizeText(rawText);

  if (text === "1") return { type: "servicos" };
  if (text === "2") return { type: "pendentes" };
  if (text === "3") return { type: "agenda_hoje" };
  if (text === "4") return { type: "agenda_semana" };
  if (text === "5") return { type: "template_help", code: 5 };
  if (text === "6") return { type: "template_help", code: 6 };
  if (text === "7") return { type: "template_help", code: 7 };
  if (text === "8") return { type: "template_help", code: 8 };

  let match = text.match(/^confirmar\s+(.+)\s+(\d{2}:\d{2})$/);
  if (match) {
    return { type: "confirmar", customerName: match[1], time: match[2] };
  }

  match = text.match(/^sugerir\s+(.+)\s+(\d{2}:\d{2})$/);
  if (match) {
    return { type: "sugerir", customerName: match[1], time: match[2] };
  }

  match = text.match(/^cancelar\s+(.+)\s+(\d{2}:\d{2})$/);
  if (match) {
    return { type: "cancelar", customerName: match[1], time: match[2] };
  }

  if (text === "agenda hoje") {
    return { type: "agenda_hoje" };
  }

  if (text === "agenda semana") {
    return { type: "agenda_semana" };
  }

  match = text.match(/^encaixar\s+(\d{2}:\d{2})\s+(.+)\s+(.+)$/);
  if (match) {
    return {
      type: "encaixar",
      time: match[1],
      customerName: match[2],
      serviceName: match[3],
    };
  }

  match = text.match(/^\+servico\s+(.+)\s+(.+)\s+(\d+(?:[\.,]\d{1,2})?)\s+(.+)$/);
  if (match) {
    return {
      type: "add_servico",
      name: match[1],
      category: match[2],
      price: Number(match[3].replace(",", ".")),
      description: match[4],
    };
  }

  if (text === "servicos") {
    return { type: "servicos" };
  }

  if (text === "pendentes") {
    return { type: "pendentes" };
  }

  if (["ajuda", "help", "comandos", "menu"].includes(text)) return { type: "ajuda" };

  return { type: "unknown", raw: rawText };
}

export function maybeExtractServiceNumber(input: string): number | null {
  const normalized = normalizeText(input);
  const serviceMatch = normalized.match(/^\d+$/);
  if (!serviceMatch) {
    return null;
  }

  return Number(serviceMatch[0]);
}
