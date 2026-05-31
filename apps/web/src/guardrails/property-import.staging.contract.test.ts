import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { isPropertyImportEnabled } from "@/lib/property-import/enabled";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../..");
const conversationHandlePath = path.join(
  repoRoot,
  "supabase/functions/conversation-handle/index.ts",
);

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("Property import staging guardrails", () => {
  it("desliga importação em VERCEL_ENV=production por padrão", () => {
    const prevVercel = process.env.VERCEL_ENV;
    const prevFlag = process.env.ENABLE_PROPERTY_IMPORT;
    process.env.VERCEL_ENV = "production";
    delete process.env.ENABLE_PROPERTY_IMPORT;
    expect(isPropertyImportEnabled()).toBe(false);
    process.env.VERCEL_ENV = prevVercel;
    if (prevFlag === undefined) delete process.env.ENABLE_PROPERTY_IMPORT;
    else process.env.ENABLE_PROPERTY_IMPORT = prevFlag;
  });

  it("não altera conversation-handle (bot WhatsApp)", () => {
    const before = read(conversationHandlePath);
    expect(before).toContain("awaiting_main_choice");
    expect(before).not.toContain("property_import_jobs");
    expect(before).not.toContain("PROPERTY_EXTRACTOR_URL");
  });

  it("rotas de import existem e citam feature_disabled", () => {
    const importRoute = read(
      path.join(repoRoot, "apps/web/src/app/api/properties/import/route.ts"),
    );
    expect(importRoute).toContain("isPropertyImportEnabled");
    expect(importRoute).toContain("feature_disabled");
    expect(importRoute).toContain("validateImportUrl");
  });
});
