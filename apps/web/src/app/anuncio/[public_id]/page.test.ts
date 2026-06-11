import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "page.tsx"), "utf8");

describe("legacy /anuncio route", () => {
  it("redirects announcement URLs to the canonical public listing route", () => {
    expect(source).toContain("redirect");
    expect(source).toContain("/imoveis/");
    expect(source).toContain("encodeURIComponent");
  });
});
