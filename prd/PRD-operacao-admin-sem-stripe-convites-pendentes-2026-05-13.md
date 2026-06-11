# PRD Consolidado do Dia - ImoveisQR/FarolImoveis (13/05/2026)

## Contexto e Objetivo

Este PRD consolida, de forma auditavel, o que foi produzido e implementado em 13/05/2026, com foco em:

- estabilizacao do fluxo Admin sem Stripe;
- compatibilidade com planos canonicos `free/solo/pro`;
- operacao segura de convites no painel Admin;
- preservacao integral dos guardrails do bot e comportamento de producao.

Objetivo do documento:

- registrar decisoes tecnicas e operacionais do dia;
- registrar alteracoes de codigo, banco e deploy;
- explicitar riscos, fallbacks e pendencias;
- servir como referencia unica para continuidade do projeto.

## Nota de Atualizacao (14/05/2026)

Atualizacao registrada em 14/05/2026 para refletir estado real de aplicacao remota de migracoes que no registro original ainda estavam pendentes.

## Escopo do Dia (Implementado)

### 1) Modo sem Stripe com catalogo canonico

- Plano canonico ativo no app: `free`, `solo`, `pro`.
- Checkout online removido do fluxo ativo temporariamente.
- API de checkout configurada para indisponibilidade controlada (503), sem erro 500.
- UI de planos atualizada para comunicar indisponibilidade de pagamento online.

### 2) Trial/convites alinhados ao plano `free`

- Fluxos de trial e onboarding administrativo passaram a usar `plan_code=free`.
- Convites de cortesia continuam operacionais sem dependencia de codigo de plano inexistente.

### 3) Admin de planos compativel com schema real

- Painel e APIs de planos ajustados para trabalhar com colunas reais de producao.
- Remocao da dependencia de `plans.max_brokers` na leitura/edicao do admin.

### 4) Convites no Admin: somente pendentes + exclusao segura

- Lista do painel exibe somente convites `pending`.
- Botao de exclusao para convite pendente.
- Exclusao por alteracao de status (nao destrutiva), preservando historico.

## Mudancas Tecnicas por Subsistema

### Planos e comercial (sem Stripe)

- Commit `c4ad168` (13/05/2026 15:42:56 -0300): adiciona/normaliza fluxo `trial/start`.
- Commit `80561fd` (13/05/2026 15:47:45 -0300): corrige seed de `plan_display_config` para codigos existentes.
- Commit `a51004a` (13/05/2026 17:08:13 -0300): consolida modo sem Stripe e alinhamento `free/solo/pro`.

Principais efeitos tecnicos:

- `POST /api/stripe/create-checkout` responde indisponibilidade temporaria (`503`).
- Tela de planos comunica indisponibilidade operacional de pagamento online.
- `POST /api/trial/start` cria/atualiza assinatura em `free` com status compativel.

### Admin (planos, assinaturas, convites)

- Leitura/configuracao de planos compatibilizada com schema de producao.
- Edicao de `plan_display_config` mantida para planos existentes.
- Convites no admin:
  - filtro principal em `status = pending`;
  - exclusao logica com validacao de status;
  - fallback seguro para ambientes com constraint antiga.

## Contratos / Endpoints Afetados

| Endpoint                               | Mudanca                                | Resultado esperado                        |
| -------------------------------------- | -------------------------------------- | ----------------------------------------- |
| `POST /api/stripe/create-checkout`     | Desativado temporariamente             | Retorna `503` com erro controlado         |
| `POST /api/trial/start`                | Trial operacional usa `plan_code=free` | Assinatura valida sem depender de `trial` |
| `POST /api/admin/invitations`          | Convite de cortesia com base `free`    | Convite funcional no modo sem Stripe      |
| `DELETE /api/admin/invitations?id=...` | Cancelamento logico de pendente        | Atualiza status sem delete fisico         |
| `GET /admin`                           | Lista operacional de convites          | Exibe somente pendentes                   |

## Banco de Dados e Migracoes

### Migracoes de contexto

- `supabase/migrations/20260509100000_plan_display_config.sql`.
- `supabase/migrations/20260513184500_seed_plan_display_no_stripe.sql`.
- `supabase/migrations/20260513195000_broker_invitations_add_canceled_status.sql`.
- `supabase/migrations/20260514094500_accounts_add_trial_columns.sql`.

### Estado remoto confirmado em 14/05/2026

Comando de evidencia: `npx supabase migration list`.

- `20260513195000` = Local e Remote.
- `20260514094500` = Local e Remote.

## Validacao e Testes Executados

Evidencias operacionais (13/05/2026 e 14/05/2026):

1. Guardrails do bot

- `corepack pnpm --filter web exec vitest run src/guardrails`
- resultado: `39 passed / 39`.

2. Testes web

- `corepack pnpm --filter web run test`
- resultado: `59 passed / 59`.

3. Typecheck e build

- `corepack pnpm --filter web run typecheck`
- `corepack pnpm --filter web run build`
- resultado: concluido com sucesso.

4. Deploy producao (registro original de 13/05/2026)

- deploy ativo com alias em `https://imoveisqr.com`.

## Deploy e Estado em Producao

Estado funcional esperado:

- Catalogo de planos em modo sem Stripe (`free/solo/pro`).
- Checkout online bloqueado de forma controlada.
- Admin sem dependencia de coluna inexistente em `plans`.
- Convites pendentes operacionais com cancelamento seguro.

## Riscos, Compatibilidade e Rollback

### Riscos

1. Divergencia entre deploy web e estado de schema em janelas de transicao.

- mitigacao: fallback defensivo nos endpoints administrativos.

2. Regressao em fluxo de convite/cortesia.

- mitigacao: validacao funcional pos-migracao e guardrails do bot.

### Compatibilidade

- Fluxos sensiveis do bot preservados.
- Convites mantem rastreabilidade sem exclusao destrutiva.

### Rollback

1. Reverter deploy web para release estavel.
2. Manter fallback de compatibilidade enquanto ambiente convergir.

## Pendencias Abertas (atualizadas em 14/05/2026)

1. Executar reteste operacional completo em producao:

- gerar convite pendente novo;
- cancelar convite pendente;
- validar que convite cancelado nao pode ser reutilizado no claim.

2. Definir plano de reativacao do Stripe quando voltar ao escopo.

## Checklist de Aceite Operacional

- [x] PRD atualizado com status real das migracoes remotas.
- [x] Convites/Trial/Admin refletidos com estado aplicado.
- [x] Guardrails, testes, typecheck e build registrados.
- [x] Documento sincronizado local + Obsidian.

## Apendice - Timeline

- 13/05/2026 15:42:56 -0300: `c4ad168`.
- 13/05/2026 15:47:45 -0300: `80561fd`.
- 13/05/2026 17:08:13 -0300: `a51004a`.
- 14/05/2026: confirmacao de migracoes remotas `20260513195000` e `20260514094500` via `npx supabase migration list`.
