import { describe, expect, it } from "vitest";

import {
  formatVisitorSummary,
  hasVisitorInfo,
  initialVisitorFormMode,
  validateOptionalVisitorInfo,
} from "./visitor-info";

describe("validateOptionalVisitorInfo", () => {
  it("permite campos vazios", () => {
    expect(validateOptionalVisitorInfo({ name: "", email: "", phone: "" })).toBeNull();
  });

  it("rejeita e-mail invalido quando preenchido", () => {
    expect(validateOptionalVisitorInfo({ name: "Ana", email: "invalido", phone: "" })).toContain(
      "E-mail",
    );
  });

  it("rejeita telefone invalido quando preenchido", () => {
    expect(
      validateOptionalVisitorInfo({ name: "", email: "", phone: "123" }),
    ).toContain("Telefone");
  });

  it("aceita telefone brasileiro valido", () => {
    expect(
      validateOptionalVisitorInfo({ name: "", email: "", phone: "11999998888" }),
    ).toBeNull();
  });
});

describe("visitor form modes", () => {
  it("inicia compacto quando ja ha dados salvos", () => {
    expect(
      initialVisitorFormMode({ name: "Ana", email: "a@b.com", phone: "" }),
    ).toBe("bar");
  });

  it("inicia oculto quando nao ha dados", () => {
    expect(initialVisitorFormMode({ name: "", email: "", phone: "" })).toBe("hidden");
  });

  it("monta resumo compacto", () => {
    expect(
      formatVisitorSummary({ name: "Ana", email: "a@b.com", phone: "11999998888" }),
    ).toContain("Ana");
    expect(hasVisitorInfo({ name: "", email: "", phone: "" })).toBe(false);
  });
});
