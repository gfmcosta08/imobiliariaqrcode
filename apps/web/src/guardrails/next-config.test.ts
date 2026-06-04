import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "../../next.config.ts"), "utf8");

describe("next redirects", () => {
  it("serves legacy public property URLs as HTTP redirects", () => {
    expect(source).toContain("async redirects()");
    expect(source).toContain('source: "/imovel/:public_id"');
    expect(source).toContain('source: "/anuncio/:public_id"');
    expect(source).toContain('destination: "/imoveis/:public_id"');
    expect(source).toContain("permanent: true");
  });
});
