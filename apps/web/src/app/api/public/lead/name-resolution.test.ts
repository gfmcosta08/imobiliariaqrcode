import { describe, expect, it } from "vitest";

import { resolvePublicLeadName } from "./name-resolution";

describe("resolvePublicLeadName", () => {
  it("aceita nome completo informado pelo usuário", () => {
    const resolved = resolvePublicLeadName({
      clientNameRaw: "Marina Costa",
      uazapiNameRaw: "Contato Fallback",
    });

    expect(resolved.name).toBe("Marina Costa");
    expect(resolved.source).toBe("client_name");
    expect(resolved.requiresPrompt).toBe(false);
  });

  it("usa fallback da uazapi quando usuário recusa informar nome", () => {
    const resolved = resolvePublicLeadName({
      clientNameRaw: "não quero informar",
      uazapiNameRaw: "Carlos Almeida",
    });

    expect(resolved.name).toBe("Carlos Almeida");
    expect(resolved.source).toBe("uazapi_name");
    expect(resolved.requiresPrompt).toBe(false);
  });

  it("bloqueia salvamento quando não há nome válido nem fallback", () => {
    const resolved = resolvePublicLeadName({
      clientNameRaw: "",
      uazapiNameRaw: "",
    });

    expect(resolved.name).toBeNull();
    expect(resolved.source).toBe("none");
    expect(resolved.requiresPrompt).toBe(true);
  });
});
