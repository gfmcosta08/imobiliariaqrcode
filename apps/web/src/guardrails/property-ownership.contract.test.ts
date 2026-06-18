import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(currentDir, "../..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("Property ownership guardrails", () => {
  it("property detail page forca dynamic e filtra por account_id", () => {
    const source = read("src/app/properties/[id]/page.tsx");
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain("resolveCurrentAccountContext");
    expect(source).toContain('.eq("account_id", ctx.accountId)');
    expect(source).toContain("notFound()");
  });

  it("mutations de imovel validam ownership antes de alterar", () => {
    const source = read("src/app/properties/actions.ts");
    expect(source).toContain("assertOwnedPropertyAccess");
    expect(source).toMatch(/updatePropertyDetails[\s\S]*assertOwnedPropertyAccess/);
    expect(source).toMatch(/updatePropertyStatus[\s\S]*assertOwnedPropertyAccess/);
    expect(source).toMatch(/markPropertyAsSold[\s\S]*assertOwnedPropertyAccess/);
  });

  it("delete de midia valida ownership do imovel", () => {
    const source = read("src/app/properties/media-actions.ts");
    expect(source).toContain("assertOwnedPropertyAccess");
    expect(source).toMatch(/deletePropertyMedia[\s\S]*assertOwnedPropertyAccess/);
  });

  it("secao de similares so usa service role apos checagem de conta", () => {
    const source = read("src/app/properties/[id]/property-similar-section.tsx");
    expect(source).toContain("accountId");
    expect(source).toContain('.eq("account_id", accountId)');
  });
});
