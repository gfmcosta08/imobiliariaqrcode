import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../../");
const dispatchPath = path.join(repoRoot, "supabase/functions/whatsapp-dispatch/index.ts");
const conversationHandlePath = path.join(
  repoRoot,
  "supabase/functions/conversation-handle/index.ts",
);
const botSmokePath = path.join(repoRoot, "scripts/test-bot-flow.sh");
const deployFunctionsWorkflowPath = path.join(repoRoot, ".github/workflows/deploy-functions.yml");
const stagingDocsPath = path.join(repoRoot, "docs/HOMOLOGACAO_SEGURA.md");

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("Staging safety guardrails", () => {
  it("mantem o dispatcher fail-closed em staging com allowlist de telefones", () => {
    const src = read(dispatchPath);

    expect(src).toContain('Deno.env.get("BOT_RUNTIME_ENVIRONMENT")');
    expect(src).toContain('Deno.env.get("BOT_STAGING_ALLOWED_PHONES")');
    expect(src).toContain("missing_bot_runtime_environment");
    expect(src).toContain("missing_bot_staging_allowed_phones");
    expect(src).toContain("staging_target_not_allowlisted");
  });

  it("nao registra prefixo do token recebido em falhas de autenticacao", () => {
    const src = read(dispatchPath);

    expect(src).not.toContain("tokenPrefix");
    expect(src).not.toContain("authToken.slice");
  });

  it("protege a presenca de digitacao enviada diretamente pelo conversation-handle", () => {
    const src = read(conversationHandlePath);

    expect(src).toContain("function isStagingTypingTargetAllowed");
    expect(src).toContain('const runtimeEnvironment = Deno.env.get("BOT_RUNTIME_ENVIRONMENT");');
    expect(src).toContain('if (runtimeEnvironment === "production") return true;');
    expect(src).toContain('if (runtimeEnvironment !== "staging") return false;');
    expect(src).toContain('Deno.env.get("BOT_STAGING_ALLOWED_PHONES")');
    expect(src).toContain("staging target not allowlisted");
  });

  it("nao inclui telefone, texto digitado ou resposta do provedor nos logs do conversation-handle", () => {
    const src = read(conversationHandlePath);

    expect(src).not.toMatch(/\n\s+phone: leadPhone,/);
    expect(src).not.toContain("typingPhone: _typingPhone");
    expect(src).not.toContain("typed_property_id: text.trim()");
    expect(src).not.toContain("body: body.slice");
  });

  it("exige preflight local antes de disparar o smoke real do bot", () => {
    const src = read(botSmokePath);

    expect(src).toContain("scripts/check-staging-safety.mjs");
    expect(src).toContain("CONFIRM_STAGING_PROVIDER_SEND");
    expect(src).toContain("BOT_STAGING_ALLOWED_PHONES");
    expect(src).toContain("STAGING_SUPABASE_PROJECT_REF");
  });

  it("mantem deploy das Edge Functions manual e protegido por ambiente", () => {
    const workflow = read(deployFunctionsWorkflowPath);

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("push:");
    expect(workflow).toContain("target_environment:");
    expect(workflow).toContain("confirm_production:");
    expect(workflow).toContain("DEPLOY_PRODUCTION");
    expect(workflow).toContain("environment: ${{ inputs.target_environment }}");
    expect(workflow).toContain("SUPABASE_ENVIRONMENT_NAME");
    expect(workflow).toContain("Configured environment does not match selected target");
    expect(workflow).toContain("${{ vars.SUPABASE_ENVIRONMENT_NAME }}");
    expect(workflow).toContain("${{ vars.SUPABASE_PROJECT_ID }}");
    expect(workflow).not.toContain("${{ secrets.SUPABASE_PROJECT_ID }}");
    expect(workflow).toContain("run: pnpm test");
    expect(workflow).not.toContain("pnpm --filter web run test");
    expect(workflow).not.toContain("Prettier gate");
  });

  it("documenta isolamento, aprovacao humana, rollback e evidencias", () => {
    const docs = read(stagingDocsPath);

    expect(docs).toContain("Banco Supabase separado");
    expect(docs).toContain("Instancia Uazapi separada");
    expect(docs).toContain("allowlist");
    expect(docs).toContain("Aprovacao humana");
    expect(docs).toContain("Rollback");
    expect(docs).toContain("Evidencias");
    expect(docs).toContain("Nunca executar deploy de producao automaticamente");
  });
});
