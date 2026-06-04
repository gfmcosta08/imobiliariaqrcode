# Produto Investivel 10/10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the PRD "Produto Investivel 10/10" in test/staging first, without touching production, until the product has safe billing, hardened security, a protected bot flow, a focused QR-to-lead value proposition, short onboarding, money-oriented dashboard, guided import, and complete validation evidence.

**Architecture:** Execute sequential phases with a hard gate after each phase. P0 stabilizes release discipline, security, Stripe, bot safety, and QR flow evidence. P1 improves product experience around the core thesis: QR -> public page -> lead -> dashboard. P2 adds adoption accelerators, instrumentation, and final QA handoff without promoting to production.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase Postgres/RLS/Edge Functions, Stripe, Vitest, Playwright, pnpm, GitHub Actions, Vercel staging/preview, Supabase staging.

---

## Non-Negotiable Execution Contract

This plan is for a separate implementation agent working in a test/staging environment. It must not deploy to production.

The implementation agent must only finish with one of these statuses:

- `COMPLETE`: every checkbox in this plan is complete, every phase gate passed, and the final evidence report exists.
- `BLOCKED`: an external dependency prevents completion, such as missing staging credentials, missing Stripe test products, or missing Supabase staging access. A real WhatsApp/bot number is not required for the mandatory staging validation in this plan. `BLOCKED` is not success.

The implementation agent must not stop after P0. It must continue through every phase until the full plan is complete, unless truly blocked by an external dependency that cannot be solved from the repository.

## Absolute Safety Rules

- Do not deploy to production.
- Do not run `vercel --prod`.
- Do not run production Supabase migrations.
- Do not run `supabase db push` against production.
- Do not deploy Supabase functions to production.
- Do not use `sk_live_` Stripe keys in local, preview, or staging.
- Do not read, print, paste, commit, or expose production secrets.
- Do not edit `.env.vercel.production`, `.env.vercel.prod.real`, or any production secret file.
- Do not remove or rewrite user changes with `git reset --hard`, `git checkout --`, or destructive cleanup.
- Do not change bot behavior without a regression test or explicit evidence that the existing contract still works.
- Do not mark the plan complete unless `pnpm --filter web run test`, `pnpm --filter web run typecheck`, `pnpm --filter web run lint`, `pnpm --filter web run build`, and `pnpm --filter @imobiliariaqrcode/property-importer run test` all pass.

## Source Documents

Use these documents as source of truth for the implementation intent:

- `prd/PRD-produto-investivel-10-10-2026-06-03.md`
- `prd/INVARIANTES-fluxo-bot-whatsapp.md`
- `prd/PRD-trava-anti-silencio-bot-whatsapp.md`
- `prd/PRD-monitor-deterministico-rastreabilidade-bot-whatsapp.md`
- `docs/compliance/evidencias/QA_E2E_STAGING_STRIPE_ADMIN_CONVITES_2026-06-03.md`

## Known Starting State

The repository is expected to be dirty. Do not revert unrelated work.

Known risks to resolve:

- `apps/web/src/app/api/webhooks/stripe/route.ts` still uses `solo_active` and lacks `webhook_events` idempotency.
- `apps/web/src/app/api/stripe/create-checkout/route.ts` returns `checkout_temporarily_unavailable`.
- `apps/web/src/app/api/cron/whatsapp-dispatch/route.ts` can fail open when `CRON_SECRET` is absent.
- `apps/web/src/app/api/cron/bot-health-monitor/route.ts` can fail open when `CRON_SECRET` is absent.
- `apps/web/src/app/api/public/lead/route.ts` uses raw `request.json()` on a public endpoint.
- Several files needed for Starter/Stripe/legal may be untracked in the local repo.
- Generated QA artifacts may be untracked and not ignored.
- `main`, staging, and homologation may not be aligned.

## Required Final Evidence Report

At the end, create:

`docs/implementation-reports/IMPLEMENTATION_REPORT-produto-investivel-10-10-2026-06-04.md`

The report must include:

- branch name;
- base commit;
- final commit;
- list of changed files;
- list of migrations created;
- environment used;
- exact commands executed;
- exact pass/fail result for every command;
- screenshots or Playwright artifact paths for home, plans, checkout, dashboard, onboarding, QR page, lead creation, import fallback;
- Stripe test event IDs used;
- Supabase staging project identifier, without secrets;
- bot regression evidence;
- QR full-flow evidence;
- known limitations;
- explicit statement: "Production was not modified."

---

## Phase 0: Workspace, Branch, and Baseline

### Task 0.1: Create an isolated implementation branch

**Files:**
- Read: all repository files as needed
- Modify: none

- [ ] **Step 1: Confirm current branch and dirty state**

Run:

```powershell
git status --short --branch
git rev-parse HEAD
git branch --show-current
```

Expected:

- Current branch and commit are visible.
- Dirty files are listed.
- No files are reverted.

- [ ] **Step 2: Create implementation branch**

Run:

```powershell
git switch -c codex/produto-investivel-10-10-staging
```

If the branch already exists, run:

```powershell
git switch codex/produto-investivel-10-10-staging
```

Expected:

- Work continues on `codex/produto-investivel-10-10-staging`.
- No production deploy occurs.

- [ ] **Step 3: Record baseline**

Create directory:

```powershell
New-Item -ItemType Directory -Force -Path "docs/implementation-reports" | Out-Null
```

Create a draft report at:

`docs/implementation-reports/IMPLEMENTATION_REPORT-produto-investivel-10-10-2026-06-04.md`

Add this initial content:

```markdown
# Implementation Report - Produto Investivel 10/10

Status: IN_PROGRESS
Production modified: no
Branch:
Base commit:
Final commit:

## Commands

## Changed Files

## Phase Evidence

## Stripe Evidence

## Bot Evidence

## QR Flow Evidence

## Known Limitations
```

- [ ] **Step 4: Commit only the report scaffold if appropriate**

Run:

```powershell
git status --short
```

If only the report scaffold should be committed now:

```powershell
git add docs/implementation-reports/IMPLEMENTATION_REPORT-produto-investivel-10-10-2026-06-04.md
git commit -m "docs: start produto investivel implementation report"
```

Expected:

- The implementation report exists.
- The agent continues to Phase 0.2.

### Task 0.2: Baseline verification

**Files:**
- Read: `package.json`
- Read: `apps/web/package.json`
- Read: `.github/workflows/ci.yml`
- Modify: `docs/implementation-reports/IMPLEMENTATION_REPORT-produto-investivel-10-10-2026-06-04.md`

- [ ] **Step 1: Run baseline web tests**

Run:

```powershell
pnpm --filter web run test
```

Expected:

- Current known failure may occur in Stripe webhook idempotency.
- Record the exact result in the report.
- Do not stop if this known failure occurs.

- [ ] **Step 2: Run baseline typecheck**

Run:

```powershell
pnpm --filter web run typecheck
```

Expected:

- PASS.
- If FAIL, record exact errors and fix before moving beyond P0.

- [ ] **Step 3: Run baseline lint**

Run:

```powershell
pnpm --filter web run lint
```

Expected:

- PASS.
- If FAIL, record exact errors and fix before moving beyond P0.

- [ ] **Step 4: Run baseline build**

Run:

```powershell
pnpm --filter web run build
```

Expected:

- PASS.
- If FAIL, record exact errors and fix before moving beyond P0.

- [ ] **Step 5: Run baseline importer tests**

Run:

```powershell
pnpm --filter @imobiliariaqrcode/property-importer run test
```

Expected:

- PASS.
- If FAIL, record exact errors and fix before moving beyond P0.

### Task 0.3: Prevent accidental artifact commits

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Inspect artifact directories**

Run:

```powershell
git check-ignore -v apps/web/playwright-report apps/web/test-results apps/web/qa-output QA_STAGING_REPORT.md QA_REPORT_STAGING_2026-05-29.md RELATORIO_COBERTURA_IMPORTACAO_21_SITES.md
```

Expected:

- If these are not ignored, add ignore rules in `.gitignore`.

- [ ] **Step 2: Add ignore rules**

Modify `.gitignore` to include:

```gitignore
# Local QA and Playwright artifacts
apps/web/playwright-report/
apps/web/test-results/
apps/web/qa-output/
QA_STAGING_REPORT.md
QA_REPORT_STAGING_*.md
RELATORIO_COBERTURA_IMPORTACAO_*.md
```

- [ ] **Step 3: Verify ignore rules**

Run:

```powershell
git check-ignore -v apps/web/playwright-report apps/web/test-results apps/web/qa-output QA_STAGING_REPORT.md QA_REPORT_STAGING_2026-05-29.md RELATORIO_COBERTURA_IMPORTACAO_21_SITES.md
```

Expected:

- Each path is ignored by `.gitignore`.

- [ ] **Step 4: Commit artifact ignore rules**

Run:

```powershell
git add .gitignore
git commit -m "chore: ignore local qa artifacts"
```

Expected:

- Commit created.

### Phase 0 Gate

- [ ] Branch is `codex/produto-investivel-10-10-staging`.
- [ ] Production was not modified.
- [ ] Baseline commands are recorded.
- [ ] Generated artifacts are ignored.
- [ ] Implementation report exists.

---

## Phase 1: P0 Security Hardening

### Task 1.1: Add fail-closed cron authorization helper

**Files:**
- Create: `apps/web/src/lib/security/cron-auth.ts`
- Create: `apps/web/src/lib/security/cron-auth.test.ts`
- Modify: `apps/web/src/app/api/cron/whatsapp-dispatch/route.ts`
- Modify: `apps/web/src/app/api/cron/bot-health-monitor/route.ts`
- Review: `apps/web/src/app/api/cron/expire/route.ts`
- Review: `apps/web/src/app/api/cron/notify-expiring/route.ts`

- [ ] **Step 1: Write helper test**

Create `apps/web/src/lib/security/cron-auth.test.ts` with tests for:

```ts
import { describe, expect, it } from "vitest";

import { validateCronAuthorization } from "./cron-auth";

describe("validateCronAuthorization", () => {
  it("fails closed when CRON_SECRET is missing", () => {
    const result = validateCronAuthorization(null, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe("cron_secret_missing");
    }
  });

  it("rejects missing authorization header when secret exists", () => {
    const result = validateCronAuthorization(null, "secret");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe("unauthorized");
    }
  });

  it("rejects wrong bearer token", () => {
    const result = validateCronAuthorization("Bearer wrong", "secret");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe("unauthorized");
    }
  });

  it("accepts exact bearer token", () => {
    const result = validateCronAuthorization("Bearer secret", "secret");
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run helper test and verify failure**

Run:

```powershell
pnpm --filter web exec vitest run src/lib/security/cron-auth.test.ts
```

Expected:

- FAIL because `cron-auth.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `apps/web/src/lib/security/cron-auth.ts`:

```ts
type CronAuthOk = { ok: true; secret: string };
type CronAuthFail = { ok: false; status: 401 | 500; error: "cron_secret_missing" | "unauthorized" };

export type CronAuthResult = CronAuthOk | CronAuthFail;

export function validateCronAuthorization(
  authorizationHeader: string | null,
  cronSecret: string | undefined,
): CronAuthResult {
  const secret = cronSecret?.trim();
  if (!secret) {
    return { ok: false, status: 500, error: "cron_secret_missing" };
  }

  if (authorizationHeader !== `Bearer ${secret}`) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  return { ok: true, secret };
}
```

- [ ] **Step 4: Update cron routes**

In `apps/web/src/app/api/cron/whatsapp-dispatch/route.ts`:

- Import `validateCronAuthorization`.
- Replace `const cronSecret = process.env.CRON_SECRET ?? "";`.
- Reject missing secret with 500.
- Reject wrong header with 401.
- Use `auth.secret` when calling the Supabase function.

In `apps/web/src/app/api/cron/bot-health-monitor/route.ts`:

- Apply the same pattern.

Expected shape:

```ts
const auth = validateCronAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET);
if (!auth.ok) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
pnpm --filter web exec vitest run src/lib/security/cron-auth.test.ts
```

Expected:

- PASS.

- [ ] **Step 6: Run web unit tests**

Run:

```powershell
pnpm --filter web run test
```

Expected:

- Existing Stripe failure may remain until Phase 2.
- New cron helper tests pass.

- [ ] **Step 7: Commit cron hardening**

Run:

```powershell
git add apps/web/src/lib/security/cron-auth.ts apps/web/src/lib/security/cron-auth.test.ts apps/web/src/app/api/cron/whatsapp-dispatch/route.ts apps/web/src/app/api/cron/bot-health-monitor/route.ts
git commit -m "fix(security): fail closed cron routes"
```

Expected:

- Commit created.

### Task 1.2: Harden public lead endpoint payload parsing

**Files:**
- Modify: `apps/web/src/app/api/public/lead/route.ts`
- Create: `apps/web/src/app/api/public/lead/route.test.ts`
- Existing helper: `apps/web/src/lib/security/json-body.ts`

- [ ] **Step 1: Write source-level route test**

Create `apps/web/src/app/api/public/lead/route.test.ts` with source checks:

```ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const routeSource = readFileSync(resolve(dir, "route.ts"), "utf8");

describe("public lead route security", () => {
  it("uses bounded JSON parser instead of raw request.json", () => {
    expect(routeSource).toContain("parseJsonObjectWithLimit");
    expect(routeSource).not.toContain("await request.json()");
  });

  it("rejects unknown keys and clamps user strings", () => {
    expect(routeSource).toContain("rejectUnknownKeys");
    expect(routeSource).toContain("clampString");
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
pnpm --filter web exec vitest run src/app/api/public/lead/route.test.ts
```

Expected:

- FAIL until route is updated.

- [ ] **Step 3: Update route parser**

In `apps/web/src/app/api/public/lead/route.ts`:

- Import `parseJsonObjectWithLimit`, `rejectUnknownKeys`, and `clampString`.
- Use max body size of `8_192` bytes.
- Allow only these keys: `qr_token`, `client_phone`, `nome`, `profile_name`, `observation`, `intent`.
- Return `unexpected_field` for unknown keys.
- Clamp user strings:
  - `qr_token`: max 256, trim true.
  - `client_phone`: max 32, trim true.
  - `nome`: max 120, trim true.
  - `profile_name`: max 120, trim true.
  - `observation`: max 500, trim true.
  - `intent`: max 80, trim true.

Expected route logic:

```ts
const parsed = await parseJsonObjectWithLimit(request, { maxBytes: 8_192 });
if (!parsed.ok) return parsed.response;

const unknown = rejectUnknownKeys(parsed.value, [
  "qr_token",
  "client_phone",
  "nome",
  "profile_name",
  "observation",
  "intent",
]);
if (unknown) {
  return NextResponse.json({ ok: false, error: "unexpected_field", field: unknown }, { status: 400 });
}

const qr_token = clampString(parsed.value.qr_token, { maxLength: 256, trim: true });
const client_phone = clampString(parsed.value.client_phone, { maxLength: 32, trim: true });
const provided_name = clampString(parsed.value.nome, { maxLength: 120, trim: true });
const profile_name = clampString(parsed.value.profile_name, { maxLength: 120, trim: true });
const observation = clampString(parsed.value.observation, { maxLength: 500, trim: true });
const intent = clampString(parsed.value.intent, { maxLength: 80, trim: true }) || "visit_interest";
```

- [ ] **Step 4: Run focused tests**

Run:

```powershell
pnpm --filter web exec vitest run src/app/api/public/lead/route.test.ts src/lib/security/json-body.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Run web tests**

Run:

```powershell
pnpm --filter web run test
```

Expected:

- New public lead tests pass.
- Existing Stripe failure may remain until Phase 2.

- [ ] **Step 6: Commit public lead hardening**

Run:

```powershell
git add apps/web/src/app/api/public/lead/route.ts apps/web/src/app/api/public/lead/route.test.ts
git commit -m "fix(security): bound public lead payload"
```

Expected:

- Commit created.

### Task 1.3: Secure service-role Supabase functions exposed with verify_jwt false

**Files:**
- Modify: `supabase/functions/lead-notify-broker/index.ts`
- Review: `supabase/functions/billing-stripe-webhook/index.ts`
- Review: `supabase/functions/billing-mercadopago-webhook/index.ts`
- Review: `supabase/config.toml`
- Create or update: `docs/compliance/evidencias/SECURITY_P0_STAGING_2026-06-04.md`

- [ ] **Step 1: Inspect exposed function auth**

Run:

```powershell
rg "verify_jwt = false|Deno.serve|Authorization|CRON_SECRET|WEBHOOK" supabase/config.toml supabase/functions -n
```

Expected:

- Identify functions that are public by config.
- Record findings in `SECURITY_P0_STAGING_2026-06-04.md`.

- [ ] **Step 2: Harden lead-notify-broker**

In `supabase/functions/lead-notify-broker/index.ts`:

- Require `Authorization: Bearer ${CRON_SECRET}` or another explicit staging secret already used by the function family.
- If the secret is missing in env, return 500.
- If the header is absent or wrong, return 401.
- Do not process `lead_id` before auth passes.
- Keep existing behavior after auth.

Expected behavior:

- Missing secret: 500.
- Wrong or missing bearer: 401.
- Correct bearer: existing function behavior.

- [ ] **Step 3: Validate billing webhooks are not used as production billing source**

For `supabase/functions/billing-stripe-webhook/index.ts` and `supabase/functions/billing-mercadopago-webhook/index.ts`:

- If they are stubs, add comments and response fields marking them as `not_authoritative_for_saas_billing`.
- Do not make them activate subscriptions.
- The Next.js route `apps/web/src/app/api/webhooks/stripe/route.ts` remains authoritative for Stripe SaaS billing in this plan.

- [ ] **Step 4: Record evidence**

Update `docs/compliance/evidencias/SECURITY_P0_STAGING_2026-06-04.md` with:

```markdown
# SECURITY P0 STAGING - 2026-06-04

Production modified: no

## Public/Service Role Endpoints Reviewed

## Changes

## Validation Commands

## Remaining Production Decision
```

- [ ] **Step 5: Commit Supabase function hardening**

Run:

```powershell
git add supabase/functions/lead-notify-broker/index.ts supabase/functions/billing-stripe-webhook/index.ts supabase/functions/billing-mercadopago-webhook/index.ts docs/compliance/evidencias/SECURITY_P0_STAGING_2026-06-04.md
git commit -m "fix(security): require auth for service role lead notifications"
```

Expected:

- Commit created.

### Task 1.4: Secret hygiene and report redaction

**Files:**
- Modify: tracked or untracked docs only if they contain exposed test credentials
- Create or update: `docs/compliance/evidencias/SECRET_HYGIENE_2026-06-04.md`

- [ ] **Step 1: Search for likely secrets without printing full env files**

Run only against repository docs and tracked/untracked non-env files:

```powershell
rg --only-matching -n "sk_live_|sk_test_|E2E_ADMIN_PASSWORD|SUPABASE_SERVICE_ROLE|STRIPE_WEBHOOK_SECRET|UAZAPI|MERCADOPAGO|password|senha" README.md docs prd apps/web/tests QA_REPORT_STAGING_2026-05-29.md QA_STAGING_REPORT.md SECURITY_AUDIT.md
```

Do not open `.env*` files.

- [ ] **Step 2: Redact secrets in docs**

If a credential appears in a report, replace the value with:

```text
[REDACTED_ROTATE_BEFORE_SHARING]
```

Do not replace normal explanatory words like `password` unless an actual value is present.

- [ ] **Step 3: Create secret hygiene evidence**

Create `docs/compliance/evidencias/SECRET_HYGIENE_2026-06-04.md`:

```markdown
# Secret Hygiene - 2026-06-04

Production modified: no

## Files Scanned

## Redactions Applied

## Secrets To Rotate

## Notes

Any credential previously present in local QA documentation must be rotated before external sharing or production promotion.
```

- [ ] **Step 4: Commit redaction evidence**

Run:

```powershell
git add docs/compliance/evidencias/SECRET_HYGIENE_2026-06-04.md
git status --short
```

Only commit files that were actually changed and are safe to version:

```powershell
git diff --name-only
git add docs/compliance/evidencias/SECRET_HYGIENE_2026-06-04.md
git commit -m "docs(security): redact local qa credentials"
```

If `git diff --name-only` lists a redacted documentation file in addition to `SECRET_HYGIENE_2026-06-04.md`, run one explicit `git add` command for that exact file path before committing. Do not add generated reports that were not intentionally redacted.

Expected:

- No secret value remains visible in docs.
- If no redaction was needed, record that in the implementation report and do not create an empty commit.

### Phase 1 Gate

- [ ] Cron routes fail closed.
- [ ] Public lead endpoint uses bounded parser.
- [ ] Service-role lead notification requires auth.
- [ ] Secrets in docs are redacted.
- [ ] No production secrets were read or printed.
- [ ] Phase evidence recorded in the implementation report.

---

## Phase 2: P0 Stripe, Plans, and SaaS Billing

### Task 2.1: Normalize plan vocabulary to Free + Starter

**Files:**
- Modify: `apps/web/src/lib/plans.ts`
- Modify: `apps/web/src/app/plans/page.tsx`
- Modify: `apps/web/src/app/dashboard/page.tsx`
- Modify: `apps/web/src/app/properties/actions.ts`
- Modify: `apps/web/src/app/api/properties/quick-create/route.ts`
- Modify: `apps/web/src/lib/property-import/resolve-broker.ts`
- Modify: `apps/web/src/app/api/trial/start/route.ts`
- Modify: `apps/web/src/app/api/admin/subscriptions/[accountId]/route.ts`
- Review: `supabase/migrations/20260602120000_starter_free_legal.sql`
- Test: `apps/web/src/lib/plans-stripe.guard.test.ts`

- [ ] **Step 1: Search legacy plan names**

Run:

```powershell
rg "solo|solo_active|Starter|starter_active|CHECKOUT_PLAN_CODE|ACTIVE_SUBSCRIPTION_STATUSES" apps/web/src supabase/migrations -n
```

Expected:

- Every legacy `solo` usage is found.

- [ ] **Step 2: Update application status checks**

Replace active status lists so they include:

```ts
["free", "starter_active", "pro_pending_activation", "pro_active"]
```

Remove `solo_active` from runtime code unless it is inside migration compatibility comments or one-time migration SQL.

- [ ] **Step 3: Update plans page**

In `apps/web/src/app/plans/page.tsx`:

- Change `type PlanCode = "free" | "solo" | "pro"` to `type PlanCode = "free" | "starter" | "pro"`.
- Change `PLAN_ORDER` to `["free", "starter", "pro"]`.
- Change default Solo card to Starter.
- Use `display_label` that starts checkout for Starter when enabled.
- Keep Free non-checkout.

- [ ] **Step 4: Update dashboard access**

In `apps/web/src/app/dashboard/page.tsx`:

- Replace `isPro` with a helper that treats Starter and Pro as paid/active for value metrics where allowed.
- Name it `hasActivePaidPlan`.
- Use `subscription?.status === "starter_active" || subscription?.status === "pro_active"`.

- [ ] **Step 5: Run plan tests**

Run:

```powershell
pnpm --filter web exec vitest run src/lib/plans-stripe.guard.test.ts
```

Expected:

- PASS.

- [ ] **Step 6: Run web tests**

Run:

```powershell
pnpm --filter web run test
```

Expected:

- Stripe route idempotency may still fail until Task 2.3.
- Plan guard tests pass.

- [ ] **Step 7: Commit plan vocabulary normalization**

Run:

```powershell
git add apps/web/src/lib/plans.ts apps/web/src/app/plans/page.tsx apps/web/src/app/dashboard/page.tsx apps/web/src/app/properties/actions.ts apps/web/src/app/api/properties/quick-create/route.ts apps/web/src/lib/property-import/resolve-broker.ts apps/web/src/app/api/trial/start/route.ts "apps/web/src/app/api/admin/subscriptions/[accountId]/route.ts" apps/web/src/lib/plans-stripe.guard.test.ts
git commit -m "fix(plans): normalize starter subscription status"
```

Expected:

- Commit created.

### Task 2.2: Implement Stripe checkout in staging/test

**Files:**
- Modify: `apps/web/src/app/api/stripe/create-checkout/route.ts`
- Modify: `apps/web/src/app/plans/checkout-button.tsx`
- Modify: `apps/web/src/app/plans/page.tsx`
- Review: `apps/web/src/lib/stripe.ts`
- Review: `apps/web/src/lib/stripe-guard.ts`
- Test: create `apps/web/src/app/api/stripe/create-checkout/route.test.ts`

- [ ] **Step 1: Write route source test**

Create `apps/web/src/app/api/stripe/create-checkout/route.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "route.ts"), "utf8");

describe("create-checkout route", () => {
  it("creates Stripe checkout sessions instead of returning unavailable", () => {
    expect(source).toContain("checkout.sessions.create");
    expect(source).toContain("assertStripeTestModeAllowed");
    expect(source).not.toContain("checkout_temporarily_unavailable");
  });

  it("uses starter metadata for webhook activation", () => {
    expect(source).toContain("account_id");
    expect(source).toContain("plan_code");
    expect(source).toContain("starter");
  });
});
```

- [ ] **Step 2: Run route test and verify failure**

Run:

```powershell
pnpm --filter web exec vitest run src/app/api/stripe/create-checkout/route.test.ts
```

Expected:

- FAIL until checkout is implemented.

- [ ] **Step 3: Implement authenticated checkout route**

In `apps/web/src/app/api/stripe/create-checkout/route.ts`:

- Require authenticated user using Supabase server client.
- Resolve user's `account_id`.
- Ensure `STRIPE_SECRET_KEY` is test key outside production using `assertStripeTestModeAllowed`.
- Read `STRIPE_STARTER_PRICE_ID`.
- Reject missing price id with 500 and `stripe_price_missing`.
- Create or reuse `stripe_customer_id` in `accounts`.
- Create Stripe checkout session with:
  - `mode: "subscription"`;
  - `line_items: [{ price: STRIPE_STARTER_PRICE_ID, quantity: 1 }]`;
  - metadata `account_id` and `plan_code: "starter"`;
  - subscription metadata with same fields;
  - success URL `${NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`;
  - cancel URL `${NEXT_PUBLIC_APP_URL}/plans?checkout=canceled`.
- Return `{ ok: true, url }`.

- [ ] **Step 4: Implement checkout button**

In `apps/web/src/app/plans/checkout-button.tsx`:

- On click, POST `/api/stripe/create-checkout`.
- If response has `url`, redirect browser to it.
- Show friendly errors for:
  - unauthenticated: "Entre para contratar o Starter."
  - stripe_price_missing: "Checkout ainda nao configurado no staging."
  - stripe_config_invalid: "Configuracao Stripe invalida no staging."
  - generic: "Nao foi possivel iniciar o checkout."
- Keep button disabled while loading.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
pnpm --filter web exec vitest run src/app/api/stripe/create-checkout/route.test.ts src/lib/plans-stripe.guard.test.ts
```

Expected:

- PASS.

- [ ] **Step 6: Commit checkout implementation**

Run:

```powershell
git add apps/web/src/app/api/stripe/create-checkout/route.ts apps/web/src/app/api/stripe/create-checkout/route.test.ts apps/web/src/app/plans/checkout-button.tsx apps/web/src/app/plans/page.tsx
git commit -m "feat(stripe): enable starter checkout in staging"
```

Expected:

- Commit created.

### Task 2.3: Implement Stripe webhook idempotency and Starter activation

**Files:**
- Modify: `apps/web/src/app/api/webhooks/stripe/route.ts`
- Modify: `apps/web/src/app/api/webhooks/stripe/webhook-idempotency.test.ts`
- Review: `supabase/migrations/20250416030000_partners_leads_ops.sql`
- Review: `supabase/migrations/20260602120000_starter_free_legal.sql`

- [ ] **Step 1: Confirm webhook_events schema**

Run:

```powershell
rg "create table if not exists public.webhook_events|processing_status|provider_event_id|payload" supabase/migrations -n
```

Expected:

- Confirm column names before coding.

- [ ] **Step 2: Update source test if needed**

Ensure `apps/web/src/app/api/webhooks/stripe/webhook-idempotency.test.ts` asserts:

- `constructEvent`;
- `webhook_events`;
- `duplicate`;
- `invoice.payment_succeeded`;
- `starter_active`;
- absence of `solo_active`;
- `invoice.payment_failed`;
- `past_due`;
- `customer.subscription.deleted`;
- `canceled`.

- [ ] **Step 3: Run webhook test and verify current failure**

Run:

```powershell
pnpm --filter web exec vitest run src/app/api/webhooks/stripe/webhook-idempotency.test.ts
```

Expected:

- FAIL until route is fixed.

- [ ] **Step 4: Implement idempotency**

In `apps/web/src/app/api/webhooks/stripe/route.ts`:

- After signature validation and before event processing, insert into `webhook_events`.
- Use provider `stripe`.
- Use provider event id `event.id`.
- Store event type and payload.
- If duplicate unique constraint occurs, return `{ received: true, duplicate: true }`.
- Mark processing status `processed` after success.
- Mark processing status `failed` if handler throws.

Expected behavior:

- Duplicate event does not reactivate or rewrite subscription twice.
- Duplicate response is 200.

- [ ] **Step 5: Implement Starter activation**

In `activateSubscription`:

- Treat `planCode === "starter"` as `starter_active`.
- Remove `solo_active`.
- Do not publish or extend properties based on legacy Solo behavior.
- Preserve Pro behavior if Pro remains supported.

Expected status mapping:

```ts
const status = planCode === "starter" ? "starter_active" : "pro_active";
```

- [ ] **Step 6: Ensure checkout session does not activate subscription early**

In `checkout.session.completed`:

- Do not activate Starter for subscription mode.
- Only record customer/account linkage if needed.
- Activation happens on `invoice.payment_succeeded`.

- [ ] **Step 7: Handle failed and canceled states**

For `invoice.payment_failed`:

- Update subscription status to `past_due`.

For `customer.subscription.deleted`:

- Update subscription status to `canceled`.
- Set `canceled_at`.
- Preserve `current_period_end` if present.

For `customer.subscription.updated`:

- If active and plan_code is `starter`, set `starter_active`.
- If active and plan_code is `pro`, set `pro_active`.
- If not active, set `past_due` or `canceled` based on Stripe status.

- [ ] **Step 8: Run webhook tests**

Run:

```powershell
pnpm --filter web exec vitest run src/app/api/webhooks/stripe/webhook-idempotency.test.ts
```

Expected:

- PASS.

- [ ] **Step 9: Run all web tests**

Run:

```powershell
pnpm --filter web run test
```

Expected:

- PASS.

- [ ] **Step 10: Commit webhook implementation**

Run:

```powershell
git add apps/web/src/app/api/webhooks/stripe/route.ts apps/web/src/app/api/webhooks/stripe/webhook-idempotency.test.ts
git commit -m "fix(stripe): process starter webhooks idempotently"
```

Expected:

- Commit created.

### Task 2.4: Enable customer portal in staging/test

**Files:**
- Modify: `apps/web/src/app/api/stripe/customer-portal/route.ts`
- Modify: `apps/web/src/app/dashboard/manage-subscription-button.tsx`
- Modify: `apps/web/src/app/dashboard/page.tsx`
- Test: create `apps/web/src/app/api/stripe/customer-portal/route.test.ts`

- [ ] **Step 1: Write source test**

Create `apps/web/src/app/api/stripe/customer-portal/route.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "route.ts"), "utf8");

describe("customer portal route", () => {
  it("creates Stripe billing portal sessions in non-production", () => {
    expect(source).toContain("billingPortal.sessions.create");
    expect(source).toContain("assertStripeTestModeAllowed");
  });
});
```

- [ ] **Step 2: Ensure route stays non-production by default**

Keep production guard unless explicit production rollout is approved later:

```ts
if (process.env.VERCEL_ENV === "production") {
  return NextResponse.json({ ok: false, error: "portal_not_enabled_in_production" }, { status: 503 });
}
```

- [ ] **Step 3: Surface portal button for active paid users**

In dashboard:

- Import and render `ManageSubscriptionButton` when subscription status is `starter_active` or `pro_active`.
- Button POSTs `/api/stripe/customer-portal`.
- Redirects to returned portal URL.

- [ ] **Step 4: Run tests**

Run:

```powershell
pnpm --filter web exec vitest run src/app/api/stripe/customer-portal/route.test.ts
pnpm --filter web run test
```

Expected:

- PASS.

- [ ] **Step 5: Commit portal work**

Run:

```powershell
git add apps/web/src/app/api/stripe/customer-portal/route.ts apps/web/src/app/api/stripe/customer-portal/route.test.ts apps/web/src/app/dashboard/manage-subscription-button.tsx apps/web/src/app/dashboard/page.tsx
git commit -m "feat(stripe): expose staging customer portal"
```

Expected:

- Commit created.

### Phase 2 Gate

- [ ] Checkout route creates Stripe test checkout sessions.
- [ ] Webhook verifies signature.
- [ ] Webhook is idempotent through `webhook_events`.
- [ ] Starter activates only through `invoice.payment_succeeded`.
- [ ] Failed payment maps to `past_due`.
- [ ] Subscription deleted maps to `canceled`.
- [ ] Customer portal works in staging/test.
- [ ] `pnpm --filter web run test` passes.
- [ ] Production remains unchanged.

---

## Phase 3: Bot and QR Regression Safety

### Task 3.1: Add bot no-regression source contract

**Files:**
- Create: `apps/web/src/guardrails/bot-no-regression.test.ts`
- Review: `supabase/functions/whatsapp-webhook-inbound/index.ts`
- Review: `supabase/functions/conversation-handle/index.ts`
- Review: `supabase/functions/whatsapp-dispatch/index.ts`
- Review: `supabase/functions/bot-health-monitor/index.ts`

- [ ] **Step 1: Create guardrail test**

Create `apps/web/src/guardrails/bot-no-regression.test.ts` checking:

- inbound webhook still calls conversation handling path;
- dispatch function still processes queued `whatsapp_messages`;
- bot health monitor still references silence/incident monitoring;
- QR page still builds WhatsApp link with property public id;
- public lead route still calls `upsert_lead_from_qr_event`.

Use source-level checks so it can run without external WhatsApp credentials.

- [ ] **Step 2: Run guardrail tests**

Run:

```powershell
pnpm --filter web exec vitest run src/guardrails
```

Expected:

- PASS.

- [ ] **Step 3: Commit bot guardrail**

Run:

```powershell
git add apps/web/src/guardrails/bot-no-regression.test.ts
git commit -m "test(bot): protect qr whatsapp lead contract"
```

Expected:

- Commit created.

### Task 3.2: Create QR full-flow staging E2E spec

**Files:**
- Modify or create: `apps/web/tests/e2e/staging-full-flow.spec.ts`
- Review: `apps/web/tests/e2e/staging-qa-compliance-e2e.spec.ts`
- Review: `apps/web/playwright.config.ts`

- [ ] **Step 1: Define required E2E flow**

The staging E2E must cover:

- login or signup with staging test account;
- create first property or quick-create property;
- verify property detail page exists;
- verify QR/token link exists;
- open `/q/[token]`;
- verify public QR page renders without requiring a real WhatsApp/bot number;
- when no WhatsApp/bot link exists, submit the public QR lead form;
- submit public lead interest where supported;
- verify lead appears in `/leads`;
- verify dashboard shows lead-related value or no broken state.

- [ ] **Step 2: Add data-testid only where needed**

If selectors are brittle, add minimal `data-testid` attributes to:

- QR link/button;
- public QR page;
- public lead form;
- lead list item;
- dashboard lead metric.

Do not redesign UI in this task.

- [ ] **Step 3: Run local build first**

Run:

```powershell
pnpm --filter web run build
```

Expected:

- PASS.

- [ ] **Step 4: Run staging E2E**

Run with staging environment variables only:

```powershell
pnpm --filter web exec playwright test apps/web/tests/e2e/staging-full-flow.spec.ts --config=apps/web/playwright.config.ts
```

Expected:

- PASS against staging.
- If staging credentials are missing, mark this specific step `BLOCKED_EXTERNAL_CREDENTIALS` in the report, but continue all local implementation tasks.

- [ ] **Step 5: Commit E2E flow**

Run:

```powershell
git add apps/web/tests/e2e/staging-full-flow.spec.ts
git commit -m "test(e2e): cover qr lead dashboard flow"
```

Expected:

- Commit created.

### Phase 3 Gate

- [ ] Bot source guardrails pass.
- [ ] QR full-flow E2E exists.
- [ ] Staging E2E passed or is marked blocked by missing external staging credentials.
- [ ] Production remains unchanged.

---

## Phase 4: Home, Brand, and Marketplace Repositioning

### Task 4.1: Replace marketplace-first home with QR lead proposition

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Review: `prd/PRD-identidade-visual-imoveisqr-2026-05-14.md`
- Test: `apps/web/tests/e2e/homepage-mobile.spec.ts`
- Test: create or modify `apps/web/src/lib/public/home-properties.test.ts` only if helper behavior changes

- [ ] **Step 1: Remove weak public metrics from home**

In `apps/web/src/app/page.tsx`:

- Remove `loadMetrics()` usage from public home render.
- Do not call `get_global_dashboard_metrics` on the public homepage.
- Do not display "0 vendido", "R$ 0", or staging-like totals.

- [ ] **Step 2: Make the first viewport about the core promise**

Home hero must communicate:

```text
Cole esse QR no imovel e nunca mais perca um interessado anonimo.
```

Use supporting text:

```text
Gere um QR para cada imovel, capture o interesse em uma pagina publica e acompanhe leads no painel.
```

Primary CTA:

```text
Criar meu primeiro QR
```

Secondary CTA:

```text
Ver como funciona
```

- [ ] **Step 3: Reposition listing grid**

Keep public listings only as secondary content below the hero:

- Heading: `Imoveis com QR ativo`
- Avoid implying full marketplace.
- Keep filters if they already work, but do not make them the main promise.

- [ ] **Step 4: Unify public brand**

Replace visible `IMOBQR`, `QRImoveis`, and `FarolImoveis` in public home with `ImoveisQR`, unless a file is explicitly a legacy migration or external alias.

- [ ] **Step 5: Run home tests**

Run:

```powershell
pnpm --filter web exec playwright test apps/web/tests/e2e/homepage-mobile.spec.ts --config=apps/web/playwright.config.ts
pnpm --filter web run build
```

Expected:

- PASS.

- [ ] **Step 6: Commit home repositioning**

Run:

```powershell
git add apps/web/src/app/page.tsx apps/web/tests/e2e/homepage-mobile.spec.ts
git commit -m "feat(home): focus on qr lead promise"
```

Expected:

- Commit created.

### Task 4.2: Brand consistency pass

**Files:**
- Modify: `apps/web/src/components/app-header.tsx`
- Modify: relevant visible UI files with old names
- Review: `brand/`
- Review: `prd/assets/imoveisqr-branding/`

- [ ] **Step 1: Search brand variants**

Run:

```powershell
rg "IMOBQR|ImobQR|Imobiliaria QR|QRImoveis|FarolImoveis|farollimoveis|ImoveisQR" apps/web/src README.md docs prd -n
```

- [ ] **Step 2: Replace user-facing product name**

Use `ImoveisQR` in:

- header;
- home;
- login;
- plans;
- dashboard;
- legal pages;
- QR page text;
- emails or generated copy if present.

Keep technical env names, Vercel aliases, and historic docs unchanged unless they are directly user-facing.

- [ ] **Step 3: Run tests and build**

Run:

```powershell
pnpm --filter web run typecheck
pnpm --filter web run build
```

Expected:

- PASS.

- [ ] **Step 4: Commit brand consistency**

Run:

```powershell
git add apps/web/src/components/app-header.tsx apps/web/src/app/page.tsx apps/web/src/app/login/page.tsx apps/web/src/app/plans/page.tsx apps/web/src/app/dashboard/page.tsx "apps/web/src/app/q/[token]/page.tsx" apps/web/src/app/termos/page.tsx apps/web/src/app/privacidade/page.tsx apps/web/src/app/cancelamento-reembolso/page.tsx apps/web/src/lib/legal.ts
git commit -m "chore(brand): unify imoveisqr naming"
```

Expected:

- Commit created.

### Phase 4 Gate

- [ ] Home no longer leads with marketplace.
- [ ] Weak public metrics removed.
- [ ] Public promise is QR-to-lead, with WhatsApp bot protected but not required for staging proof.
- [ ] Brand is consistent in active UI.
- [ ] Build passes.

---

## Phase 5: Short Onboarding and First QR in 5 Minutes

### Task 5.1: Add quick-start onboarding route

**Files:**
- Create: `apps/web/src/app/onboarding/primeiro-qr/page.tsx`
- Create: `apps/web/src/app/onboarding/primeiro-qr/quick-property-form.tsx`
- Modify: `apps/web/src/app/api/properties/quick-create/route.ts`
- Modify: `apps/web/src/app/dashboard/page.tsx`
- Modify: `apps/web/src/app/properties/new/page.tsx`

- [ ] **Step 1: Define first QR flow**

Route:

```text
/onboarding/primeiro-qr
```

Flow:

```text
minimal property -> create draft property -> redirect to property detail -> QR visible -> open public QR page -> download/print card
```

- [ ] **Step 2: Build quick form**

The quick form must collect:

- `title`;
- `property_type`;
- `city`;
- `neighborhood`;
- `sale_price` or `rent_price`;
- `whatsapp_number` if profile phone is missing or starts with `pending-`;
- optional `description`.

Do not require:

- full amenities;
- map URL;
- multiple photos;
- advanced property fields.

- [ ] **Step 3: Add API support**

Extend `apps/web/src/app/api/properties/quick-create/route.ts` to accept optional minimal JSON body with the fields above.

Use `parseJsonObjectWithLimit` with max `12_288` bytes.

Reject unknown keys.

Persist property as `draft` unless the required publish fields are present.

Return:

```json
{
  "ok": true,
  "property_id": "...",
  "public_id": "...",
  "qr_token": "...",
  "next_url": "/properties/{id}"
}
```

- [ ] **Step 4: Add dashboard CTA**

On dashboard, if the account has zero properties:

- Show CTA: `Criar meu primeiro QR`.
- Link to `/onboarding/primeiro-qr`.

- [ ] **Step 5: Add fallback from properties/new**

On `/properties/new`:

- Keep full form.
- Add small link to `/onboarding/primeiro-qr` for quick setup.

- [ ] **Step 6: Test quick-create locally**

Add or update Vitest source tests for quick-create parsing.

Run:

```powershell
pnpm --filter web run test
pnpm --filter web run typecheck
pnpm --filter web run build
```

Expected:

- PASS.

- [ ] **Step 7: Commit short onboarding**

Run:

```powershell
git add apps/web/src/app/onboarding/primeiro-qr apps/web/src/app/api/properties/quick-create/route.ts apps/web/src/app/dashboard/page.tsx apps/web/src/app/properties/new/page.tsx
git commit -m "feat(onboarding): create first qr quick start"
```

Expected:

- Commit created.

### Task 5.2: QR action checklist on property detail

**Files:**
- Modify: `apps/web/src/app/properties/[id]/page.tsx`
- Modify: `apps/web/src/app/properties/[id]/qr-print-card.tsx`
- Review: `apps/web/src/app/q/[token]/page.tsx`

- [ ] **Step 1: Add first QR action panel**

On property detail, display actions:

- `Abrir pagina do QR`;
- `Baixar/Imprimir placa`;
- `Copiar link publico`;
- `Ver leads deste imovel`.

- [ ] **Step 2: Keep bot route unchanged**

Do not change QR redirect logic unless test proves it is broken.

- [ ] **Step 3: Add stable selectors**

Add test ids:

- `property-qr-open`;
- `property-qr-print`;
- `property-qr-copy`;
- `property-qr-leads`.

- [ ] **Step 4: Run build**

Run:

```powershell
pnpm --filter web run build
```

Expected:

- PASS.

- [ ] **Step 5: Commit QR action panel**

Run:

```powershell
git add "apps/web/src/app/properties/[id]/page.tsx" "apps/web/src/app/properties/[id]/qr-print-card.tsx"
git commit -m "feat(qr): surface first qr actions"
```

Expected:

- Commit created.

### Phase 5 Gate

- [ ] New user can reach first QR path.
- [ ] Quick onboarding does not require full property form.
- [ ] Property detail provides QR actions.
- [ ] Build and tests pass.

---

## Phase 6: Dashboard Oriented to Money and Opportunities

### Task 6.1: Create dashboard metrics service

**Files:**
- Create: `apps/web/src/lib/dashboard/metrics.ts`
- Create: `apps/web/src/lib/dashboard/metrics.test.ts`
- Modify: `apps/web/src/app/dashboard/page.tsx`
- Review: `supabase/migrations/20260418200000_qr_cycle_lead_enrichment.sql`
- Review: `supabase/migrations/20260415030000_property_sold_metrics.sql`

- [ ] **Step 1: Define metric type**

Create metrics type with:

```ts
export type DashboardMoneyMetrics = {
  totalProperties: number;
  activeProperties: number;
  qrScans: number;
  leadsTotal: number;
  leadsNew: number;
  leadsResponded: number;
  leadsUnanswered: number;
  averageFirstResponseMinutes: number | null;
  topPropertyTitle: string | null;
  topPropertyLeadCount: number;
};
```

- [ ] **Step 2: Add pure helpers**

In `metrics.ts`, add:

- `countUnansweredLeads(leads)`;
- `formatResponseTime(minutes)`;

Use conservative assumptions:

- only expose metrics the system can measure directly;
- avoid fake precision and commercial numbers without validation.

- [ ] **Step 3: Unit test pure helpers**

In `metrics.test.ts`, test:

- dashboard metrics do not expose unvalidated commission estimates;
- unanswered leads count statuses `new` and `contact_pending`;
- response time renders `null` as `Sem dados`.

- [ ] **Step 4: Query account metrics in dashboard**

In dashboard server page:

- Get current account.
- Query account properties.
- Query account leads.
- Query `qr_access_events` if available.
- Compute metrics server-side.
- Show metrics for Free too, but keep advanced historical insights for paid plans if needed.

- [ ] **Step 5: Replace weak metric cards**

Dashboard cards must show:

- leads generated;
- leads without response;
- QR scans;
- top property;
- first response time.

- [ ] **Step 6: Run tests and build**

Run:

```powershell
pnpm --filter web exec vitest run src/lib/dashboard/metrics.test.ts
pnpm --filter web run test
pnpm --filter web run build
```

Expected:

- PASS.

- [ ] **Step 7: Commit dashboard metrics**

Run:

```powershell
git add apps/web/src/lib/dashboard/metrics.ts apps/web/src/lib/dashboard/metrics.test.ts apps/web/src/app/dashboard/page.tsx
git commit -m "feat(dashboard): show money oriented lead metrics"
```

Expected:

- Commit created.

### Task 6.2: Improve leads page for action

**Files:**
- Modify: `apps/web/src/app/leads/page.tsx`
- Modify: `apps/web/src/app/leads/[id]/page.tsx`
- Modify: `apps/web/src/app/leads/[id]/lead-editor-form.tsx`
- Modify: `apps/web/src/app/leads/actions.ts`

- [ ] **Step 1: Define lead statuses**

Use statuses:

- `new`;
- `responded`;
- `in_service`;
- `visit_scheduled`;
- `lost`;
- `converted`.

- [ ] **Step 2: Add status labels**

Create a local map or helper:

```ts
const LEAD_STATUS_LABELS = {
  new: "Novo",
  responded: "Respondido",
  in_service: "Em atendimento",
  visit_scheduled: "Visita marcada",
  lost: "Perdido",
  converted: "Convertido",
} as const;
```

- [ ] **Step 3: Prioritize unanswered leads**

On leads list:

- Sort `new` first.
- Show property title.
- Show phone.
- Show origin.
- Show created date.
- Show status badge.

- [ ] **Step 4: Run tests/build**

Run:

```powershell
pnpm --filter web run typecheck
pnpm --filter web run build
```

Expected:

- PASS.

- [ ] **Step 5: Commit lead action improvements**

Run:

```powershell
git add apps/web/src/app/leads/page.tsx "apps/web/src/app/leads/[id]/page.tsx" "apps/web/src/app/leads/[id]/lead-editor-form.tsx" apps/web/src/app/leads/actions.ts
git commit -m "feat(leads): prioritize actionable opportunities"
```

Expected:

- Commit created.

### Phase 6 Gate

- [ ] Dashboard answers where money/opportunity is.
- [ ] Free users see useful value, not only upgrade wall.
- [ ] Leads page prioritizes action.
- [ ] Tests and build pass.

---

## Phase 7: Importer as Adoption Accelerator

### Task 7.1: Add paste-text import fallback

**Files:**
- Modify: `apps/web/src/app/properties/import-listings-button.tsx`
- Modify: `apps/web/src/app/api/properties/import/route.ts`
- Create: `apps/web/src/lib/property-import/pasted-listing.ts`
- Create: `apps/web/src/lib/property-import/pasted-listing.test.ts`
- Review: `packages/property-importer/src/map-to-property-payload.ts`

- [ ] **Step 1: Create pasted listing parser**

Create `apps/web/src/lib/property-import/pasted-listing.ts`.

It must parse user-pasted text into a draft object:

- title;
- description;
- city;
- neighborhood;
- sale_price;
- rent_price;
- bedrooms;
- bathrooms;
- parking_spaces;
- area.

Rules:

- Never invent values.
- Unknown values stay null.
- Keep original text as description when structured extraction is weak.
- Do not require AI/external services.

- [ ] **Step 2: Unit test pasted parser**

Test:

- BRL sale price extraction;
- rent price extraction;
- bedrooms from `3 quartos`;
- area from `120 m2` and `120m2`;
- missing values return null.

- [ ] **Step 3: Add UI fallback**

In import dialog:

- Keep URL import first.
- Add tab or secondary mode: `Colar texto do anuncio`.
- On URL failure, show CTA: `Colar dados manualmente`.
- Explain in friendly language:

```text
Nao conseguimos ler esse site automaticamente. Cole o texto do anuncio e eu monto um rascunho para voce revisar.
```

- [ ] **Step 4: Add API path**

Extend import API or create a separate route if cleaner:

```text
POST /api/properties/import/paste
```

Input:

```json
{ "text": "..." }
```

Output:

```json
{ "ok": true, "draft": { ... } }
```

Use bounded JSON parser and reject unknown keys.

- [ ] **Step 5: Run importer-related tests**

Run:

```powershell
pnpm --filter web exec vitest run src/lib/property-import/pasted-listing.test.ts
pnpm --filter @imobiliariaqrcode/property-importer run test
pnpm --filter web run test
```

Expected:

- PASS.

- [ ] **Step 6: Commit paste fallback**

Run:

```powershell
git add apps/web/src/app/properties/import-listings-button.tsx apps/web/src/app/api/properties/import apps/web/src/lib/property-import/pasted-listing.ts apps/web/src/lib/property-import/pasted-listing.test.ts
git commit -m "feat(import): add pasted listing fallback"
```

Expected:

- Commit created.

### Task 7.2: Humanize importer errors and ensure manual path never blocks QR

**Files:**
- Modify: `apps/web/src/app/properties/import-listings-button.tsx`
- Modify: `apps/web/src/app/properties/new/page.tsx`
- Modify: `apps/web/src/app/properties/new/property-form.tsx` if needed

- [ ] **Step 1: Rewrite importer failure messages**

User-facing errors must not say:

- WAF;
- Cloudflare;
- parser;
- serverless timeout;
- extractor;
- stack trace.

Use messages:

- `Esse site nao liberou a leitura automatica. Voce pode colar o texto do anuncio ou cadastrar rapido.`
- `Nao encontramos anuncios nessa pagina. Tente o link direto do imovel ou use o cadastro rapido.`
- `A importacao demorou demais. Tente uma URL por vez ou cadastre rapido.`

- [ ] **Step 2: Always show manual CTA**

Every import failure state must show:

- `Cadastrar rapido`;
- `Colar texto do anuncio`;
- `Tentar outra URL`.

- [ ] **Step 3: Run UI build**

Run:

```powershell
pnpm --filter web run typecheck
pnpm --filter web run build
```

Expected:

- PASS.

- [ ] **Step 4: Commit importer UX**

Run:

```powershell
git add apps/web/src/app/properties/import-listings-button.tsx apps/web/src/app/properties/new/page.tsx apps/web/src/app/properties/new/property-form.tsx
git commit -m "feat(import): keep manual qr path available"
```

Expected:

- Commit created.

### Phase 7 Gate

- [ ] URL import remains available.
- [ ] Paste-text fallback exists.
- [ ] Manual quick path is always available.
- [ ] Import failure never blocks QR creation.
- [ ] Importer tests pass.

---

## Phase 8: Activation, Value, and Commercial Metrics

### Task 8.1: Add activation event model

**Files:**
- Create: `supabase/migrations/20260604090000_activation_events.sql`
- Create: `apps/web/src/lib/analytics/activation-events.ts`
- Create: `apps/web/src/lib/analytics/activation-events.test.ts`
- Modify: key routes/actions to record events

- [ ] **Step 1: Create migration**

Create table `public.activation_events`:

Columns:

- `id uuid primary key default gen_random_uuid()`;
- `account_id uuid references public.accounts(id) on delete cascade`;
- `profile_id uuid references public.profiles(id) on delete set null`;
- `event_name text not null`;
- `entity_type text`;
- `entity_id uuid`;
- `metadata jsonb not null default '{}'::jsonb`;
- `created_at timestamptz not null default now()`.

Indexes:

- `(account_id, created_at desc)`;
- `(event_name, created_at desc)`;

RLS:

- service role full access;
- authenticated users can select own account events.

Allowed event names:

- `account_created`;
- `first_property_created`;
- `qr_generated`;
- `qr_test_opened`;
- `lead_received`;
- `dashboard_returned`;
- `checkout_started`;
- `checkout_completed`;
- `subscription_canceled`.

- [ ] **Step 2: Add analytics helper**

Create `apps/web/src/lib/analytics/activation-events.ts`:

- `recordActivationEvent(admin, input)`;
- fail silently after logging only in server context;
- never block user flow on analytics failure.

- [ ] **Step 3: Unit test helper shape**

Test:

- event names are typed;
- metadata defaults to `{}`;
- invalid empty event name is rejected by helper before DB insert.

- [ ] **Step 4: Instrument core events**

Record:

- account created in signup route;
- first property created in property action/quick-create;
- QR generated where QR token exists;
- lead received in public lead route;
- checkout started in create-checkout route;
- checkout completed in webhook after `invoice.payment_succeeded`.

- [ ] **Step 5: Run tests**

Run:

```powershell
pnpm --filter web exec vitest run src/lib/analytics/activation-events.test.ts
pnpm --filter web run test
pnpm --filter web run build
```

Expected:

- PASS.

- [ ] **Step 6: Commit activation events**

Run:

```powershell
git add supabase/migrations/20260604090000_activation_events.sql apps/web/src/lib/analytics/activation-events.ts apps/web/src/lib/analytics/activation-events.test.ts apps/web/src/app/api/auth/signup/route.ts apps/web/src/app/properties/actions.ts apps/web/src/app/api/properties/quick-create/route.ts apps/web/src/app/api/public/lead/route.ts apps/web/src/app/api/stripe/create-checkout/route.ts apps/web/src/app/api/webhooks/stripe/route.ts
git commit -m "feat(analytics): record activation events"
```

Expected:

- Commit created.

### Task 8.2: Add admin/internal activation summary

**Files:**
- Modify: `apps/web/src/app/admin/page.tsx`
- Create: `apps/web/src/app/admin/activation-summary.tsx`

- [ ] **Step 1: Add activation summary component**

Show:

- accounts created;
- first properties created;
- QRs generated;
- leads received;
- checkout started;
- checkout completed;
- users returning to dashboard.

- [ ] **Step 2: Keep admin-only access**

Use existing admin context/role checks in admin page.

- [ ] **Step 3: Run build**

Run:

```powershell
pnpm --filter web run typecheck
pnpm --filter web run build
```

Expected:

- PASS.

- [ ] **Step 4: Commit activation summary**

Run:

```powershell
git add apps/web/src/app/admin/page.tsx apps/web/src/app/admin/activation-summary.tsx
git commit -m "feat(admin): show activation summary"
```

Expected:

- Commit created.

### Phase 8 Gate

- [ ] Activation events are recorded.
- [ ] Value metrics exist.
- [ ] Admin can inspect funnel.
- [ ] User flow does not depend on analytics success.

---

## Phase 9: Full Validation and Handoff

### Task 9.1: Run complete local verification

**Files:**
- Modify: `docs/implementation-reports/IMPLEMENTATION_REPORT-produto-investivel-10-10-2026-06-04.md`

- [ ] **Step 1: Run web tests**

Run:

```powershell
pnpm --filter web run test
```

Expected:

- PASS.

- [ ] **Step 2: Run importer tests**

Run:

```powershell
pnpm --filter @imobiliariaqrcode/property-importer run test
```

Expected:

- PASS.

- [ ] **Step 3: Run typecheck**

Run:

```powershell
pnpm --filter web run typecheck
```

Expected:

- PASS.

- [ ] **Step 4: Run lint**

Run:

```powershell
pnpm --filter web run lint
```

Expected:

- PASS.

- [ ] **Step 5: Run build**

Run:

```powershell
pnpm --filter web run build
```

Expected:

- PASS.

- [ ] **Step 6: Run format check**

Run:

```powershell
pnpm format:check
```

Expected:

- PASS on files intended for commit.
- If generated artifacts outside source still cause failures, ensure they are ignored or excluded in a repo-approved way.

### Task 9.2: Run staging verification

**Files:**
- Modify: `docs/implementation-reports/IMPLEMENTATION_REPORT-produto-investivel-10-10-2026-06-04.md`

- [ ] **Step 1: Deploy to staging/preview only**

Deploy only to test/staging using the team's normal preview pipeline.

Do not deploy to production.

Record:

- staging URL;
- deploy id;
- branch;
- commit.

- [ ] **Step 2: Verify checkout in Stripe test mode**

Use Stripe test mode only.

Validate:

- checkout starts;
- checkout redirects to Stripe;
- test payment succeeds;
- webhook event received;
- subscription becomes `starter_active`;
- dashboard shows paid status;
- customer portal opens;
- cancel from portal;
- subscription becomes canceled or remains active until period end according to Stripe behavior;
- failed payment test maps to `past_due`.

Record Stripe test event IDs, not secrets.

- [ ] **Step 3: Verify QR full flow**

Validate:

- signup/login;
- first property quick onboarding;
- QR generated;
- QR page opens;
- public QR page does not require a real WhatsApp/bot number for staging validation;
- public lead interest creates/updates lead;
- lead appears in leads page;
- dashboard metrics update or show expected current state.

- [ ] **Step 4: Verify bot non-regression**

Validate:

- existing WhatsApp webhook contract remains covered by source-level/regression tests, with live staging payloads only when credentials exist;
- conversation-handle still responds according to current bot invariants;
- whatsapp-dispatch cron requires secret;
- bot-health-monitor cron requires secret;
- no bot silence regression appears in logs.

- [ ] **Step 5: Verify import fallback**

Validate:

- URL import success path for at least one supported staging URL;
- blocked/unsupported URL shows friendly fallback;
- paste-text fallback creates draft;
- manual quick onboarding remains available;
- QR creation is not blocked by import failure.

### Task 9.3: Create final handoff report

**Files:**
- Modify: `docs/implementation-reports/IMPLEMENTATION_REPORT-produto-investivel-10-10-2026-06-04.md`

- [ ] **Step 1: Fill report status**

Set:

```markdown
Status: COMPLETE
Production modified: no
```

Only set `COMPLETE` if every phase gate passed.

- [ ] **Step 2: Include command table**

Add table:

```markdown
| Command | Result | Notes |
|---|---|---|
| pnpm --filter web run test | PASS | |
| pnpm --filter @imobiliariaqrcode/property-importer run test | PASS | |
| pnpm --filter web run typecheck | PASS | |
| pnpm --filter web run lint | PASS | |
| pnpm --filter web run build | PASS | |
| pnpm format:check | PASS | |
```

- [ ] **Step 3: Include changed files**

Run:

```powershell
git diff --name-only main...HEAD
```

Paste the file list into the report.

- [ ] **Step 4: Include final git summary**

Run:

```powershell
git log --oneline main..HEAD
git status --short --branch
```

Expected:

- Branch has commits.
- Working tree has no accidental source changes.
- Ignored generated artifacts do not appear as pending commits.

- [ ] **Step 5: Commit final report**

Run:

```powershell
git add docs/implementation-reports/IMPLEMENTATION_REPORT-produto-investivel-10-10-2026-06-04.md
git commit -m "docs: complete produto investivel staging report"
```

Expected:

- Commit created.

### Task 9.4: Final no-production assertion

**Files:**
- Modify: `docs/implementation-reports/IMPLEMENTATION_REPORT-produto-investivel-10-10-2026-06-04.md` if needed

- [ ] **Step 1: Confirm no production deploy command was used**

Search shell history only if available and safe. Also inspect report.

The report must contain:

```text
Production was not modified.
No production deploy was executed.
No production secrets were used.
```

- [ ] **Step 2: Final status**

The implementing agent final response must include:

```text
Status: COMPLETE
Production modified: no
Branch: codex/produto-investivel-10-10-staging
Report: docs/implementation-reports/IMPLEMENTATION_REPORT-produto-investivel-10-10-2026-06-04.md
```

If any step is incomplete, the final response must not say `COMPLETE`.

### Phase 9 Gate

- [ ] Full local verification passes.
- [ ] Staging verification passes or external credential gaps are documented.
- [ ] Final report exists.
- [ ] Production was not modified.
- [ ] The implementing agent did not stop early.

---

## Final Completion Checklist

- [ ] Phase 0 complete: branch, baseline, artifact hygiene.
- [ ] Phase 1 complete: security P0.
- [ ] Phase 2 complete: Stripe and Starter SaaS billing.
- [ ] Phase 3 complete: bot and QR regression safety.
- [ ] Phase 4 complete: home, brand, marketplace repositioning.
- [ ] Phase 5 complete: short onboarding and first QR flow.
- [ ] Phase 6 complete: money dashboard and actionable leads.
- [ ] Phase 7 complete: importer as adoption accelerator.
- [ ] Phase 8 complete: activation/value metrics.
- [ ] Phase 9 complete: full validation and handoff report.
- [ ] `pnpm --filter web run test` PASS.
- [ ] `pnpm --filter @imobiliariaqrcode/property-importer run test` PASS.
- [ ] `pnpm --filter web run typecheck` PASS.
- [ ] `pnpm --filter web run lint` PASS.
- [ ] `pnpm --filter web run build` PASS.
- [ ] `pnpm format:check` PASS or documented repo-approved exception.
- [ ] Staging URL recorded.
- [ ] Stripe test evidence recorded.
- [ ] Bot evidence recorded.
- [ ] QR flow evidence recorded.
- [ ] Import fallback evidence recorded.
- [ ] Production not modified.

## Handoff to Gian and Codex Reviewer

After implementation, send Gian:

```text
Status: COMPLETE
Production modified: no
Branch:
Final commit:
Staging URL:
Report path:
Commands passed:
Known limitations:
```

Gian will then provide the report and branch state to Codex for independent review, tests, verification, and a joint decision about whether anything should be promoted to production.
