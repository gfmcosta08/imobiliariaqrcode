import { describe, expect, test } from "vitest";

import { clampString, rejectUnknownKeys } from "./json-body";

describe("json-body helpers", () => {
  test("VULN-5: clampString deve impor maxLength", () => {
    expect(clampString("ok", { maxLength: 2 })).toBe("ok");
    expect(clampString("toolong", { maxLength: 2 })).toBe("");
  });

  test("VULN-4: rejectUnknownKeys deve detectar campo inesperado (mass assignment)", () => {
    const bad = rejectUnknownKeys({ a: 1, b: 2 }, ["a"]);
    expect(bad).toBe("b");
  });
});
