import { describe, expect, it } from "vitest";

import { normalizeBrazilPhone } from "./phone";

describe("normalizeBrazilPhone", () => {
  it("prefixa 55 em celular 11 dígitos", () => {
    expect(normalizeBrazilPhone("11999998888")).toBe("5511999998888");
  });

  it("prefixa 55 em fixo 10 dígitos", () => {
    expect(normalizeBrazilPhone("1133334444")).toBe("551133334444");
  });

  it("mantém número já com DDI 55", () => {
    expect(normalizeBrazilPhone("5511999998888")).toBe("5511999998888");
  });

  it("aceita máscara e espaços", () => {
    expect(normalizeBrazilPhone("(11) 99999-8888")).toBe("5511999998888");
  });

  it("rejeita tamanho inválido", () => {
    expect(normalizeBrazilPhone("123")).toBeNull();
    expect(normalizeBrazilPhone("")).toBeNull();
  });
});
