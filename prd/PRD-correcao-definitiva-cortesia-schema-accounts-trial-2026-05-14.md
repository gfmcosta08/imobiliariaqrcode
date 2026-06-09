# PRD - Correcao Definitiva da Cortesia (Schema Accounts Trial) - 14/05/2026

## Contexto

Na geracao de convite de cortesia no painel admin (`/admin`) ocorreu erro de coluna ausente em `accounts`:

- `account_state_update_failed: Could not find the 'trial_started_at' column of 'accounts' in the schema cache`.

Este documento foi atualizado para registrar o estado final implementado e validado em 14/05/2026.

## Analise de Raiz (confirmada)

Causa raiz confirmada:

- o backend de cortesia e trial tentava escrever colunas inexistentes em `public.accounts`:
  - `trial_started_at`
  - `trial_used_at`

Impacto:

- falha direta na geracao de cortesia;
- risco de falha no `POST /api/trial/start` em ambientes com mesmo drift de schema.

## Implementacao Aplicada

### 1) Alinhamento de schema

Migration aplicada:

- `supabase/migrations/20260514094500_accounts_add_trial_columns.sql`

Mudanca:

- `ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;`
- `ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS trial_used_at timestamptz;`

### 2) Defesa de aplicacao (anti-drift)

Endpoints protegidos com fallback defensivo:

- `POST /api/admin/invitations`
- `POST /api/trial/start`

Comportamento:

1. tenta update completo com colunas de trial;
2. em caso de erro de schema cache/coluna ausente, aplica fallback minimo seguro;
3. retorna erro controlado apenas quando realmente impeditivo.

### 3) Integridade do fluxo de cortesia

- Ajustes para reduzir estado parcial em falhas intermediarias.
- Fluxo mantido sem impacto em funcoes sensiveis do bot.

## Evidencias Operacionais (14/05/2026)

1. Migracao aplicada no remoto

- Comando: `npx supabase migration list`
- Evidencia: `20260514094500` presente em Local e Remote.

2. Validacoes tecnicas

- `corepack pnpm --filter web exec vitest run src/guardrails` -> `39/39`.
- `corepack pnpm --filter web run test` -> `59/59`.
- `corepack pnpm --filter web run typecheck` -> sucesso.
- `corepack pnpm --filter web run build` -> sucesso.
- `git diff --check` -> sem erro estrutural.

3. Estado funcional esperado

- geracao de cortesia funcional;
- `trial/start` funcional;
- sem regressao do bot.

## Regras de Nao Regressao do Bot

Arquivos sensiveis preservados (sem alteracao de comportamento por este tema):

- `supabase/functions/conversation-handle/index.ts`
- `supabase/functions/whatsapp-webhook-inbound/index.ts`
- `supabase/functions/whatsapp-dispatch/index.ts`
- `supabase/functions/bot-health-monitor/index.ts`
- `supabase/functions/qr-resolve/index.ts`
- `supabase/functions/lead-notify-broker/index.ts`

## Riscos e Mitigacoes

1. Ambiente parcialmente atualizado durante deploy.

- Mitigacao: fallback defensivo nos endpoints.

2. Regressao lateral em admin/trial.

- Mitigacao: validacao funcional + suite tecnica completa.

## Criterios de Aceite

- [x] Erro de coluna ausente eliminado no fluxo de cortesia.
- [x] `trial/start` operando com schema alinhado.
- [x] Guardrails do bot preservados.
- [x] Evidencia remota de migracao aplicada registrada.

## Assumptions

1. Escopo restrito a admin/trial/schema de `accounts`.
2. Nenhum segredo, senha ou token em texto claro neste documento.
