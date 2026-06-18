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

  it("autentica antes de exigir PROPERTY_EXTRACTOR_URL", () => {
    const importRoute = read(
      path.join(repoRoot, "apps/web/src/app/api/properties/import/route.ts"),
    );
    const authIndex = importRoute.indexOf("auth.getUser()");
    const extractorCheckIndex = importRoute.indexOf("if (!getPropertyExtractorBaseUrl())");
    expect(authIndex).toBeGreaterThan(-1);
    expect(extractorCheckIndex).toBeGreaterThan(-1);
    expect(authIndex).toBeLessThan(extractorCheckIndex);
    expect(importRoute).toContain('return json(401, { ok: false, error: "unauthorized" })');
  });

  it("missing_url retorna detail granular para diagnóstico", () => {
    const importRoute = read(
      path.join(repoRoot, "apps/web/src/app/api/properties/import/route.ts"),
    );
    expect(importRoute).toContain('error: "missing_url"');
    expect(importRoute).toContain("detail:");
    expect(importRoute).toContain("all_urls_duplicate");
    expect(importRoute).toContain("resolveImportUrlFields");
  });

  it("run-job trata erro de extrator por item sem derrubar o job inteiro", () => {
    const runJob = read(path.join(repoRoot, "apps/web/src/lib/property-import/run-job.ts"));
    expect(runJob).toContain("normalizeExtratorFetchError");
    expect(runJob).toContain("item_extract_failed");
    expect(runJob).toContain("extrator_unreachable");
  });

  it("health deep=2 faz probe do extrator em preview", () => {
    const healthRoute = read(path.join(repoRoot, "apps/web/src/app/api/health/route.ts"));
    expect(healthRoute).toContain('deep === "2"');
    expect(healthRoute).toContain("probeExtratorConnectivity");
  });
});
