import {
  buildWelcomeBackMessage,
  extractUazapiName,
  normalizeFullNameCandidate,
  resolveLeadNameFromTextOrFallback,
} from "./name-flow.ts";

Deno.test("valida nome completo informado pelo lead", () => {
  const ok = normalizeFullNameCandidate("Maria Souza");
  if (ok !== "Maria Souza") {
    throw new Error(`Nome esperado nao retornado. Recebido: ${ok}`);
  }

  const invalid = normalizeFullNameCandidate("Maria");
  if (invalid !== null) {
    throw new Error("Nome de palavra unica nao deve ser aceito como nome completo.");
  }
});

Deno.test("fallback para nome da Uazapi quando lead nao informa nome", () => {
  const payload = {
    data: {
      pushName: "Carlos Alberto",
    },
  };

  const resolved = resolveLeadNameFromTextOrFallback("nao quero informar", payload);
  if (resolved.name !== "Carlos Alberto" || resolved.source !== "uazapi") {
    throw new Error(`Fallback esperado nao aplicado: ${JSON.stringify(resolved)}`);
  }
});

Deno.test("extracao direta de nome da estrutura Uazapi", () => {
  const payload = {
    message: {
      content: {
        contactName: "Ana Paula Lima",
      },
    },
  };

  const name = extractUazapiName(payload);
  if (name !== "Ana Paula Lima") {
    throw new Error(`Nome esperado nao encontrado. Recebido: ${name}`);
  }
});

Deno.test("saudacao personalizada para lead cadastrado", () => {
  const greeting = buildWelcomeBackMessage("Joao Pedro");
  if (!greeting.includes("Joao Pedro")) {
    throw new Error(`Saudacao nao contem nome do lead: ${greeting}`);
  }
});
