import { describe, expect, it } from "vitest";

import { validateOptionalVisitorInfo } from "@/components/chat/useChatSession";

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
