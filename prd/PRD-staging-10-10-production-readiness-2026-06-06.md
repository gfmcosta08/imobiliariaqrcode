# PRD - Staging 10/10 Production Readiness

Data: 2026-06-06
Status: P0 tecnico executado e validado em staging; hotfix P0 de integridade WhatsApp aplicado em production; P1/P2 de negocio ainda pendentes
Prioridade: P0 antes de qualquer promocao para producao
Produto: ImoveisQR / staging `https://farollimoveis-staging.vercel.app`
Origem: Auditoria CTO/VC de prontidao do ambiente de teste

## 1. Resumo Executivo

Este PRD transforma a auditoria de staging em um plano de acao por etapas para levar o ambiente de teste ao nivel 10/10 antes de qualquer promocao para producao.

O staging atual esta funcional, com Stripe test mode validado, build verde, testes locais passando e smoke externo do alias oficial passando. Mesmo assim, o parecer de prontidao e **NO-GO para producao** ate que os bloqueadores P0 sejam fechados com evidencia.

Este documento nao substitui o PRD original `PRD-produto-investivel-10-10-2026-06-03.md`. Ele e um addendum operacional: a tese continua sendo QR -> lead rastreavel -> painel -> monetizacao, mas a promocao para producao so deve ocorrer apos a execucao deste plano.

## 1.1 Como Usar Este PRD

Este documento e o quadro de guerra do staging. Cada etapa tem:

- ordem de prioridade;
- problema que destruiu a nota 10/10 na auditoria;
- arquivos-alvo;
- checklist rastreavel;
- criterio de aceite;
- evidencia obrigatoria.

Marcacao:

- `[x]` feito com evidencia objetiva;
- `[ ]` aberto;
- `parcial` quando ha entrega real, mas ainda falta evidencia ou fechamento operacional.

Regra: um item so pode virar `[x]` quando houver teste, log, migration, screenshot, workflow, query ou relatorio sanitizado que prove o resultado. Opiniao nao conta como evidencia.

## 1.2 Red Flags de Investidor

Se eu estivesse assinando um cheque de R$ 1 milhao, os tres sinais que ainda mais pesam contra o produto seriam:

1. **PMF ainda nao provado.** Staging funcionando prova engenharia, nao prova mercado. A tese so fica investivel quando corretores reais geram QR, recebem lead real, voltam ao painel e aceitam pagar.
2. **Monetizacao com risco de margem.** R$150/mes pode virar preco suicida se anunciar "ilimitado" em leads, imagens, bot, importacao e suporte. Todo custo variavel precisa de limite, overage ou plano fechado.
3. **Disciplina operacional historicamente fraca.** Marca inconsistente, migrations desalinhadas, gates incompletos e funcoes publicas demais passam sinal de produto sem rigor de release. Isso precisa continuar fechado antes de producao.

## 1.3 Cinco Deal Breakers Inegociaveis

O staging nao vira producao sem estes cinco cortes:

1. Convite e signup blindados contra brute force, abuso, payload grande e enumeracao.
2. Multitenancy provado por teste hostil com usuario autenticado comum.
3. CI/CD com build, E2E staging, RLS, migration drift, secret scan e audit como gate.
4. Supabase Functions publicas reduzidas, autenticadas ou desativadas quando nao forem webhooks legitimos.
5. Pricing e PMF defendidos por limites reais, unit economics e piloto controlado.

## 1.4 Ordem Executiva de Ataque

| Ordem | Etapa                               | Motivo da prioridade                                                                       | Status atual                     |
| ----: | ----------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------- |
|     1 | Blindar convite                     | E o vetor de ataque mais barato: codigo curto/brute force derruba confianca imediatamente. | Concluido em staging             |
|     2 | Endurecer signup publico            | Cadastro aberto sem anti-abuso vira spam, custo e abuso de service role.                   | Concluido em staging             |
|     3 | Provar isolamento multitenant       | SaaS sem prova hostil de RLS nao e SaaS investivel.                                        | Concluido em staging             |
|     4 | Transformar CI/CD em gate           | Sem gate, producao depende de memoria humana.                                              | Concluido para gates principais  |
|     5 | Reduzir Supabase Functions publicas | Endpoint publico com service role e superficie inutil de ataque.                           | Concluido em staging             |
|    6A | Blindar telefone WhatsApp corretor  | Bot nao pode enviar mensagem de corretor para telefone obsoleto.                           | Concluido em staging/producao    |
|     6 | Fechar headers/web security         | Painel autenticado sem baseline web security e abaixo da regua.                            | Concluido em staging             |
|     7 | Tornar observabilidade real         | Monitor que pode falhar sem consequencia nao opera SaaS.                                   | Concluido em staging             |
|     8 | Unificar marca/narrativa            | Inconsistencia de marca cheira a produto sem disciplina.                                   | Parcial                          |
|     9 | Revisar pricing e limites           | Starter sem limite real pode destruir margem.                                              | Concluido em staging             |
|    10 | Provar PMF inicial                  | Fluxo funcionando nao prova desejo de compra.                                              | Aberto; depende de pilotos reais |

## 1.5 Execucao e Evidencias em 2026-06-06

**Escopo executado:** bloqueadores tecnicos P0 e parte operacional P1 necessaria para staging seguro.

**Ambiente validado:**

- Vercel staging alias: `https://farollimoveis-staging.vercel.app`.
- Deployment aplicado ao alias em 2026-06-09: `https://farollimoveis-hmby88qw2.vercel.app`.
- Deployment id: `dpl_B48QaLCgPEGXuwZVXGLjMunEKf2F`.
- Supabase staging: `imobiliariaqrcode-staging`, project ref `coeuoyeydqoslhvbbojx`.
- Production nao foi modificada durante a execucao original de readiness; excecao posterior P0 em 2026-06-09: hotfix de integridade de destinatario WhatsApp aplicado em production para corrigir incidente real.

**Migrations e banco:**

- `20260602120000_starter_free_legal.sql` aplicada em staging com constraint ajustada para estados reais (`trial_active`, `solo_active`).
- `20260606180000_security_rate_limits_invite_hardening.sql` aplicada em staging.
- `20260607004942_harden_public_definer_rpc_privileges.sql` aplicada em staging.
- `supabase migration fetch --linked` usado para recuperar migrations remotas faltantes do historico de staging.
- `supabase db push --linked --dry-run`: PASS, remote database up to date.
- Verificado em staging: colunas `invalid_attempt_count`, `last_failed_at`, `locked_until`, `claimed_ip_hash`.
- Verificado em staging: tabela `security_rate_limits` e RPC `check_security_rate_limit(text,integer,integer,integer)`.
- Verificado em staging: helpers `account_property_limit`, `get_active_plan_code` e `can_create_property` sem `anon` e com guard `private.assert_rpc_account_scope`.
- Verificado em staging: `assign_premium_lead_recipient` e `get_global_dashboard_metrics` restritas a `service_role`.
- Verificado em staging: bucket `property-media` privado, com policies `SELECT/INSERT/UPDATE/DELETE` por path `account/{account_id}`.

**Deploys de Edge Functions em staging:**

- `whatsapp-dispatch`.
- `bot-health-monitor`.
- `billing-stripe-webhook`.
- `billing-mercadopago-webhook`.
- `lead-notify-broker`.
- `media-process`.
- CORS compartilhado configurado com `CORS_ALLOW_ORIGIN=https://farollimoveis-staging.vercel.app`.

**Gates locais:**

- `pnpm --filter web lint`: PASS, sem warnings/erros.
- `pnpm --filter web run typecheck`: PASS.
- `pnpm test`: PASS, web 148/148 e property-importer 47/47.
- `pnpm --filter web run build`: PASS em Next.js `15.5.18`.
- `pnpm format:check`: PASS.
- `pnpm audit --prod --audit-level high`: PASS; restam 2 moderadas.
- Secret pattern scan: PASS, limpo.

**Gates staging:**

- Playwright staging smoke + mobile + RLS hostil: PASS, 7/7.
- RLS hostil cobriu tentativa de leitura/update cross-tenant em tabelas criticas.
- RLS/RPC/Storage hostil: PASS, `tests/e2e/staging-rls-isolation.spec.ts` com 1/1; cobre tabelas criticas, RPCs cross-tenant e Storage path/account.
- Alias drift corrigido em 2026-06-09: `farollimoveis-staging.vercel.app` estava apontando para `imobiliariaqrcode-8mpq3zkcx.vercel.app` e retornava `NOT_FOUND`; foi restaurado para `farollimoveis-hmby88qw2.vercel.app`.
- `vercel inspect farollimoveis-staging.vercel.app`: project `farollimoveis`, target `preview`, status Ready, deployment `dpl_B48QaLCgPEGXuwZVXGLjMunEKf2F`.
- `vercel curl /plans`: contem Starter, contem limite de 10 anuncios, nao contem `ilimitad`.
- `vercel curl /api/health?deep=1`: `{"ok":true,"service":"web","supabase":"ok"}`.
- Convite live lockout: PASS; 6 tentativas invalidas geraram `429 too_many_attempts`, `invalid_attempt_count=6`, `locked_until` gravado.
- Signup live anti-abuso: PASS; `unexpected_field` retornou 400 e payload grande retornou 413.
- Headers HTTP staging: PASS; CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e `Permissions-Policy` presentes.
- Webhooks legados de billing: PASS; Stripe/Mercado Pago retornam 410 `legacy_billing_webhook_disabled`.
- Edge Functions cron/dispatch sem bearer: PASS; `whatsapp-dispatch` e `bot-health-monitor` retornam 401.
- Edge Functions adicionais: PASS; `lead-notify-broker` retorna 401 sem bearer, `media-process` retorna 410 `media_process_disabled`.
- CORS das Edge Functions criticas: PASS; `Access-Control-Allow-Origin` retorna `https://farollimoveis-staging.vercel.app`.
- Runbook operacional criado: `docs/runbooks/STAGING_OPERATIONAL_HEALTH_RUNBOOK_2026-06-06.md`.
- Snapshot de saude staging: Stripe failures 0, webhooks pendentes >15m 0, import jobs failed 0, bot interactions unresolved 0; fila WhatsApp stuck 37 registrada como esperada no teste sem bot live.

**Pricing e PMF em preparacao:**

- `apps/web/src/app/plans/page.tsx` expoe publicamente apenas Free + Starter.
- `apps/web/src/lib/plans.ts` define limites Free/Starter: 1 anuncio Free, 10 anuncios Starter, 10 imagens por anuncio, 3 importacoes assistidas/mes no piloto.
- `apps/web/src/app/plans/page.test.ts` guarda a pagina publica contra retorno de Pro/ilimitado.
- `supabase/migrations/20260607000144_pricing_limits_unit_economics.sql` aplicada no Supabase staging por Management API SQL; migration history remoto registra `20260607000144`.
- `docs/compliance/UNIT_ECONOMICS_AND_PMF_PILOT_2026-06-06.md` criado com pricing, guardrails de margem, KPI principal e template de piloto.
- Vercel staging redeployado: `dpl_B48QaLCgPEGXuwZVXGLjMunEKf2F`, preview `https://farollimoveis-hmby88qw2.vercel.app`, alias `https://farollimoveis-staging.vercel.app`.
- Validacao HTTP de `/plans`: 200, contem `Ate 10 anuncios ativos`, contem `Ate 3 importacoes assistidas por mes no piloto`, nao contem radical `ilimitad`.
- Evidencia visual: `output/playwright/staging-plans-pricing-2026-06-06.png`.
- Teste SQL staging de limite Starter: 10 ativos permitidos, `can_create_after_10=false`, 11o insert bloqueado com `Seu plano atual permite apenas 10 imovel(is) ativo(s).`.
- Teste SQL staging de `past_due` e `canceled`: plano efetivo `free`, limite 1, 2o insert bloqueado.
- Limpeza QA staging: 0 usuarios, perfis, imoveis QA e 0 contas orfas recentes apos os testes.

**Ressalva explicita:** o ambiente de teste nao possui bot WhatsApp ativo para validacao live de envio/recebimento. O trabalho desta etapa manteve contratos, auth e guardrails do bot, mas nao exige execucao live do bot em staging.

**Incidente P0 production em 2026-06-09:** a conta `percilianafmcosta@gmail.com` evidenciou envio `to_broker` para telefone antigo apos troca/reversao de WhatsApp. Causa raiz: `broker_phone` era tratado como snapshot autoritativo na fila. Hotfix aplicado em staging e production: `whatsapp-dispatch` reconsulta telefone canonico antes de enviar, `conversation-handle`/`lead-notify-broker` passam a preferir `profiles.whatsapp_number`, payloads `to_broker` carregam `broker_id`, e o guardrail `broker-phone-freshness.contract.test.ts` impede regressao. Evidencia: `docs/compliance/PROD_WHATSAPP_BROKER_PHONE_STALE_INCIDENT_2026-06-09.md`.

## 2. Regra Absoluta

Nao promover para producao enquanto existir qualquer etapa P0 aberta.

Proibido durante este plano:

- rodar `vercel --prod`;
- aplicar migration em Supabase production;
- copiar dados de staging para producao;
- usar chaves `sk_live_` em staging;
- expor secrets em logs, docs, screenshots ou relatorios;
- marcar uma etapa como concluida sem evidencia objetiva.

## 3. Definicao de Staging 10/10

O staging so pode ser considerado 10/10 quando:

- fluxos principais passam ponta a ponta;
- convite nao e brute-forceavel;
- signup publico tem limite, anti-abuso e payload controlado;
- multitenancy e provado por testes hostis;
- CI/CD bloqueia regressao real;
- Supabase Functions publicas estao justificadas, autenticadas ou desativadas;
- headers de seguranca estao no baseline minimo de SaaS;
- monitoramento falha de verdade quando algo critico quebra;
- telefone WhatsApp canonico do corretor e revalidado antes de qualquer envio `to_broker`;
- marca e narrativa estao consistentes;
- PR final tem evidencia reproduzivel.

## 4. Score Inicial da Auditoria

Este score e o ponto de partida que gerou o plano. A nota final so deve ser atualizada apos fechar Etapas 9 e 10 com evidencia objetiva.

| Dimensao                | Nota atual |  Alvo |
| ----------------------- | ---------: | ----: |
| Funcionalidade staging  |       8/10 | 10/10 |
| Stripe test mode        |       9/10 | 10/10 |
| Seguranca SaaS          |       6/10 | 10/10 |
| Multitenancy comprovado |       6/10 | 10/10 |
| CI/CD e release         |       5/10 | 10/10 |
| Observabilidade         |       5/10 | 10/10 |
| Produto/PMF investivel  |       6/10 | 10/10 |

## 5. Etapas Prioritarias

### Etapa 1 - Blindar fluxo de convite

**Prioridade:** P0

**Status atual:** `[x]` concluida e validada em staging.

**Problema:** O fluxo de convite usa codigos curtos de 6 digitos com geracao fraca, sem rate limit, sem lockout e sem contador de tentativas. Um atacante tentaria quebrar isso antes de qualquer outra coisa.

**Arquivos-alvo:**

- `apps/web/src/app/api/admin/invitations/route.ts`
- `apps/web/src/app/api/convite/claim/route.ts`
- `supabase/migrations/*broker_invitations*`
- testes unitarios e E2E relacionados a convite

**Checklist:**

- [x] Trocar `Math.random()` por geracao criptografica.
- [x] Aumentar entropia do `login_code` e/ou `access_code`.
- [x] Adicionar contador de tentativas invalidas.
- [x] Adicionar `locked_until` ou mecanismo equivalente de lockout.
- [x] Aplicar rate limit por IP + `login_code`.
- [x] Usar parser JSON com limite de payload na rota de claim.
- [x] Retornar erro generico para credenciais invalidas.
- [x] Registrar evento de auditoria em tentativa invalida, lockout e claim bem-sucedido.
- [x] Garantir que convite vencido, cancelado ou completado nao permita login.
- [x] Criar teste de brute-force simulado.

**Criterios de aceite:**

- 5 a 10 tentativas invalidas bloqueiam temporariamente o convite ou origem.
- Uma tentativa invalida nao revela se `login_code` existe.
- Payload grande ou com campo inesperado falha antes de tocar Supabase.
- E2E de convite continua passando com convite valido.
- Teste hostil prova que brute force nao e trivial.

**Evidencia obrigatoria:**

- Resultado de testes unitarios da rota de claim.
- Resultado de E2E admin/convite em staging.
- Screenshot ou log sanitizado do lockout.
- Migration aplicada em Supabase staging, se houver coluna nova.

### Etapa 2 - Endurecer signup publico

**Prioridade:** P0

**Status atual:** `[x]` concluida e validada em staging.

**Problema:** O signup publico usa `req.json()` sem limite, cria usuario via service role, confirma email automaticamente e nao tem anti-abuso forte. Em producao isso vira spam, enumeracao, custo e possivel abuso operacional.

**Arquivos-alvo:**

- `apps/web/src/app/api/auth/signup/route.ts`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/lib/security/json-body.ts`
- testes de signup

**Checklist:**

- [x] Substituir `req.json()` por `parseJsonObjectWithLimit`.
- [x] Rejeitar campos desconhecidos.
- [x] Aplicar limite de tamanho para email, nome, WhatsApp e senha.
- [x] Aplicar rate limit por IP e email normalizado.
- [x] Adicionar CAPTCHA/Turnstile em staging ou preparar feature flag obrigatoria para producao.
- [x] Rever `email_confirm: true`; manter somente se explicitamente justificado por ambiente de teste.
- [x] Reduzir enumeracao de email em respostas publicas.
- [x] Registrar eventos de abuso e signup concluido.
- [x] Adicionar teste de payload grande.
- [x] Adicionar teste de campo inesperado.

**Criterios de aceite:**

- Signup anonimo nao aceita payload acima do limite.
- Signup nao aceita campos fora da whitelist.
- Repeticoes rapidas retornam `429`.
- Em producao, cadastro publico exige verificacao anti-bot ou email verification.
- Nenhum segredo ou stacktrace aparece na resposta.

**Evidencia obrigatoria:**

- Testes unitarios de signup.
- Smoke staging de cadastro valido.
- Smoke staging de cadastro bloqueado por rate limit/anti-abuso.

### Etapa 3 - Provar isolamento multitenant com testes hostis

**Prioridade:** P0

**Status atual:** `[x]` concluida e validada em staging.

**Problema:** RLS esta habilitado, mas o produto ainda nao prova por teste automatizado que uma conta nao acessa dados de outra. Multitenancy nao e promessa; e contrato verificavel.

**Arquivos-alvo:**

- `supabase/migrations/20250416040000_rls.sql`
- `supabase/migrations/20260604090000_activation_events.sql`
- `supabase/migrations/20260607004942_harden_public_definer_rpc_privileges.sql`
- nova suite de testes RLS ou E2E staging
- rotas que usam `account_id`

**Checklist:**

- [x] Criar duas contas reais de teste no Supabase staging.
- [x] Criar imovel, QR, lead, media e subscription para cada conta.
- [x] Autenticar como Conta A e tentar ler dados da Conta B.
- [x] Autenticar como Conta A e tentar alterar/deletar dados da Conta B.
- [x] Validar `properties`, `property_media`, `property_qrcodes`, `leads`, `lead_interactions`, `subscriptions`, `activation_events`, `property_import_jobs`.
- [x] Auditar RPCs `security definer` que recebem `account_id`.
- [x] Validar Storage policies por path/account.
- [x] Garantir que rotas com service role sempre filtram por usuario autenticado nas rotas cobertas pela auditoria P0.

**Criterios de aceite:**

- Conta A nao le, altera ou apaga nenhum dado da Conta B.
- RPCs publicas/autenticadas nao vazam metricas ou status de outro `account_id`.
- Teste hostil roda em CI ou em suite staging write-gated.
- Falha de isolamento derruba o gate.

**Evidencia obrigatoria:**

- Resultado da suite RLS hostil.
- Lista de tabelas cobertas.
- Relatorio de RPCs revisadas.
- Relatorio `docs/compliance/RLS_RPC_STORAGE_AUDIT_2026-06-06.md`.

### Etapa 4 - Transformar CI/CD em gate real de producao

**Prioridade:** P0

**Status atual:** concluida para o ambiente de teste e para o gate de GitHub. Gates principais existem e agora usam `environment: staging`/`production`, validacao anti-producao e bypass de Vercel Authentication para Playwright. A branch foi publicada em PR draft (`https://github.com/gfmcosta08/imobiliariaqrcode/pull/2`). Depois da publicacao do repo como publico, a API do GitHub aceitou a criacao de branch protection em `main` e `master` com os checks `CI gate` e `Staging readiness gate`. Os environments `staging` e `Production` tambem estao presentes e atualizaveis. A pendencia externa de GitHub foi resolvida quando o repo saiu de privado.

**Problema:** O CI atual valida o basico, mas nao barra regressao de build, E2E, migration drift, isolamento RLS, secret leak ou vulnerabilidade obvia.

**Arquivos-alvo:**

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-functions.yml`
- scripts de QA/staging

**Checklist:**

- [x] Adicionar `pnpm --filter web run build` ao CI.
- [x] Adicionar testes do pacote `@imobiliariaqrcode/property-importer`.
- [x] Adicionar smoke Playwright de staging em workflow separado e seguro.
- [x] Adicionar gate de migration drift/dry-run para Supabase staging.
- [x] Adicionar secret scan com ferramenta dedicada.
- [x] Adicionar dependency audit ou SCA minimo.
- [x] Adicionar suite RLS hostil como gate de staging readiness.
- [x] Publicar artefatos de Playwright quando falhar.
- [x] Garantir que workflows nao usam secrets de producao para staging.
- [x] Referenciar claramente `environment: staging` e `environment: production` nos workflows.
- [x] Remover fallback perigoso de staging para `SUPABASE_PROJECT_ID`.
- [x] Adicionar guard que falha se Supabase ref/URL de staging nao forem `coeuoyeydqoslhvbbojx`.
- [x] Adicionar suporte a `VERCEL_AUTOMATION_BYPASS_SECRET` para Playwright em deployment protegido.
- [x] Criar workflow manual `Production Promotion Gate` sem deploy, exigindo evidencia de staging readiness.
- [x] Remover deploy automatico de Edge Functions em push para main/master; deploy de functions agora e manual, staging-only e exige confirmacao.
- [x] Validar/criar environments reais `staging` e `production` no GitHub com secrets e aprovacao de production.
- [x] Tornar staging readiness obrigatorio no rito de promocao ou branch protection antes de producao.

**Criterios de aceite:**

- PR nao passa se build quebrar.
- PR nao passa se E2E staging basico quebrar.
- PR nao passa se migration drift for detectado.
- PR nao passa se secret for encontrado.
- PR nao passa se teste RLS hostil falhar.

**Evidencia obrigatoria:**

- Link da run de CI verde.
- Lista de gates executados.
- Log sem secrets.
- Relatorio `docs/compliance/STAGING_CICD_GATE_AUDIT_2026-06-09.md`.

### Etapa 5 - Reduzir superficie publica das Supabase Functions

**Prioridade:** P0

**Status atual:** `[x]` concluida em staging. Billing legado e `media-process` ficam desativados por padrao; crons/notificacao exigem bearer; CORS das functions criticas esta restrito ao alias staging.

**Problema:** Varias Edge Functions estao com `verify_jwt=false`. Algumas precisam ser publicas, mas billing Stripe/Mercado Pago Edge ainda persistem payload sem assinatura real e usam service role. Mesmo nao autoritativas, sao superficie desnecessaria.

**Arquivos-alvo:**

- `supabase/config.toml`
- `supabase/functions/billing-stripe-webhook/index.ts`
- `supabase/functions/billing-mercadopago-webhook/index.ts`
- `supabase/functions/whatsapp-dispatch/index.ts`
- `supabase/functions/bot-health-monitor/index.ts`
- `.github/workflows/dispatch-whatsapp.yml`

**Checklist:**

- [x] Inventariar todas as functions com `verify_jwt=false`.
- [x] Classificar cada function: webhook publico legitimo, cron interno, rota obsoleta ou stub.
- [x] Desativar ou exigir segredo forte em functions de billing nao autoritativas.
- [x] Garantir que billing SaaS autoritativo fica somente em `/api/webhooks/stripe`.
- [x] Remover uso de service role key como bearer de scheduler.
- [x] Usar `CRON_SECRET` ou credencial minima para cron.
- [x] Validar CORS restritivo onde aplicavel.
- [x] Garantir assinatura real para qualquer webhook de pagamento que continue ativo.
- [x] Atualizar README das functions.

**Criterios de aceite:**

- Nenhuma function sensivel processa anonimamente.
- Stubs de billing nao aceitam payload publico util.
- Scheduler nao usa `SUPABASE_SERVICE_ROLE_KEY` como token de chamada.
- Testes/smokes provam 401/403 para chamadas anonimas onde exigido.

**Evidencia obrigatoria:**

- Tabela final de functions e postura de auth.
- Smoke sem bearer e bearer invalido.
- Workflow atualizado sem service role como bearer.

### Etapa 6A - Blindar telefone WhatsApp do corretor antes do envio

**Prioridade:** P0

**Status atual:** `[x]` concluida em staging e production por hotfix de incidente.

**Problema:** `broker_phone` era tratado como snapshot autoritativo em `whatsapp_messages`. Se o corretor trocasse o WhatsApp e houvesse mensagem antiga na fila, o dispatcher poderia enviar `to_broker=true` para telefone obsoleto.

**Arquivos-alvo:**

- `supabase/functions/whatsapp-dispatch/index.ts`
- `supabase/functions/conversation-handle/index.ts`
- `supabase/functions/lead-notify-broker/index.ts`
- `supabase/functions/bot-health-monitor/index.ts`
- `apps/web/src/guardrails/broker-phone-freshness.contract.test.ts`

**Checklist:**

- [x] Dispatcher carrega `account_id` e `property_id` da fila.
- [x] Dispatcher reconsulta telefone canonico antes de enviar `to_broker=true`.
- [x] Fonte canonica prioriza `profiles.whatsapp_number`.
- [x] Payloads novos de notificacao ao corretor carregam `broker_id` quando conhecido.
- [x] Linha da fila registra `broker_phone_refreshed_at` quando snapshot diverge.
- [x] Criar guardrail automatizado contra regressao.
- [x] Deployar hotfix em staging.
- [x] Deployar hotfix em production como excecao P0.
- [x] Confirmar que rotas protegidas seguem retornando 401 sem bearer.

**Criterios de aceite:**

- Nenhuma mensagem `to_broker=true` depende apenas de `whatsapp_messages.broker_phone`.
- Troca de telefone no cadastro do corretor passa a valer no despacho seguinte.
- Conta com `broker_id` conhecido nao e resolvida por imovel errado.
- Regressao falha em teste antes de chegar a staging/producao.

**Evidencia obrigatoria:**

- Relatorio: `docs/compliance/PROD_WHATSAPP_BROKER_PHONE_STALE_INCIDENT_2026-06-09.md`.
- Guardrail `broker-phone-freshness.contract.test.ts`: PASS.
- Smokes staging/production sem bearer: `401`.
- Consulta sanitizada da conta afetada sem telefone completo.

### Etapa 6 - Fechar baseline de headers e web security

**Prioridade:** P0/P1

**Status atual:** `[x]` concluida e validada por HTTP no staging.

**Problema:** O staging tem HSTS via Vercel, `nosniff` e referrer policy, mas falta CSP e protecao clara contra framing. Para SaaS com painel autenticado, isso e baixo.

**Arquivos-alvo:**

- `apps/web/next.config.ts`
- testes guardrail de config

**Checklist:**

- [x] Adicionar `Content-Security-Policy` ou `Content-Security-Policy-Report-Only` em staging primeiro.
- [x] Adicionar `frame-ancestors 'none'` ou `X-Frame-Options: DENY`.
- [x] Adicionar `Permissions-Policy` restritiva.
- [x] Revisar dominios permitidos para imagens, Stripe, Supabase, Vercel e analytics.
- [x] Criar teste guardrail para headers obrigatorios.
- [x] Validar headers no staging por HTTP.

**Criterios de aceite:**

- Home e rotas autenticadas retornam headers minimos.
- Stripe checkout/portal nao quebra.
- QR publico e imagens continuam funcionando.
- Teste automatizado falha se header sumir.

**Evidencia obrigatoria:**

- Output HTTP dos headers.
- Teste guardrail verde.
- Smoke visual/home e checkout sem regressao.

### Etapa 7 - Tornar observabilidade operacional de verdade

**Prioridade:** P1

**Status atual:** `[x]` concluida para staging. Monitor critico tem alertas operacionais, heartbeat de cron, `correlation_id` e gate de GitHub Actions por `critical_open_incidents`.

**Problema:** Monitoramento que usa `continue-on-error` nao e monitoramento; e ornamento. O sistema precisa gerar consequencia quando bot, webhook, cron ou fila quebram.

**Arquivos-alvo:**

- `.github/workflows/monitor-whatsapp-bot.yml`
- Supabase functions de monitoramento
- docs/runbooks

**Checklist:**

- [x] Remover `continue-on-error` de checks criticos.
- [x] Separar monitor read-only de auto-recovery.
- [x] Criar alerta automatico para webhook Stripe com `processing_status='failed'`.
- [x] Criar alerta para fila WhatsApp travada.
- [x] Criar alerta para crons sem execucao recente.
- [x] Criar runbook de incidentes.
- [x] Criar dashboard minimo de saude operacional.
- [x] Registrar correlation id nos logs criticos.

**Criterios de aceite:**

- Falha de monitor critico derruba workflow ou dispara alerta.
- Existem passos claros para recuperar bot, webhook e cron.
- Eventos falhos sao visiveis sem precisar garimpar logs.

**Evidencia obrigatoria:**

- Workflow de monitor com falha simulada.
- Runbook versionado.
- Query ou painel de eventos falhos.
- Relatorio `docs/compliance/STAGING_OBSERVABILITY_GATE_AUDIT_2026-06-09.md`.

### Etapa 8 - Unificar marca, narrativa e documentos

**Prioridade:** P1

**Status atual:** parcial. UI publica e metadata foram normalizadas para ImoveisQR; documentos historicos ainda carregam aliases como contexto/migracao.

**Problema:** A auditoria encontrou ImoveisQR, ImobQR, Farol Imoveis, FarolImoveis e `farollimoveis` convivendo em docs/UI. Isso reduz confianca de usuario e investidor.

**Arquivos-alvo:**

- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/como-funciona/page.tsx`
- `README.md`
- `STAGING.md`
- `stripe.md`
- docs de compliance e evidencia

**Checklist:**

- [x] Definir nome publico oficial.
- [x] Definir nome tecnico/alias de staging, se diferente.
- [x] Remover marca antiga da UI publica.
- [x] Atualizar metadata do app.
- [ ] Atualizar README para refletir Starter/Stripe atual.
- [ ] Atualizar `stripe.md` removendo Solo/Pro/Premium legado como instrucao principal.
- [ ] Manter nomes antigos apenas como historico/migracao, quando necessario.

**Criterios de aceite:**

- Usuario publico ve uma marca consistente.
- Documentos operacionais nao contradizem o staging atual.
- Stripe docs refletem Starter testado.

**Evidencia obrigatoria:**

- `rg` sem vazamento indevido de marcas antigas na UI publica.
- Screenshots home, planos, como funciona e login.
- Docs revisados.

### Etapa 9 - Revisar monetizacao e limites de custo

**Prioridade:** P1/P2

**Status atual:** `[x]` concluida e validada em staging. Free/Starter estao limitados no banco, UI publica nao promete ilimitado, overage bloqueia o 11o imovel Starter e `past_due`/`canceled` caem para limite Free.

**Problema:** Starter a R$150 com promessas amplas de QR, leads, bot, importacao e anuncios pode criar margem ruim. O produto precisa precificar valor e custo variavel.

**Arquivos-alvo:**

- `apps/web/src/app/plans/page.tsx`
- `supabase/migrations/20260602120000_starter_free_legal.sql`
- docs de pricing

**Checklist:**

- [x] Definir limites reais por plano: imoveis ativos, imagens, QR, mensagens, importacoes, usuarios.
- [x] Remover linguagem de "ilimitado" quando houver custo variavel.
- [x] Criar modelo inicial de custo/guardrails por conta ativa.
- [x] Definir plano Starter como corretor solo.
- [x] Definir plano Pro/Imobiliaria somente apos prova de equipe.
- [x] Criar migration de limites Free/Starter e display publico sem ilimitado.
- [x] Criar teste guardrail para pagina publica de planos.
- [x] Criar regra de upgrade/overage.
- [x] Testar past_due/cancelamento com limites de acesso.
- [x] Aplicar migration de pricing em Supabase staging.
- [x] Deployar tela de planos revisada no alias staging.
- [x] Registrar evidencia HTTP/visual da pagina de planos sem promessas ilimitadas.

**Criterios de aceite:**

- Plano tem margem bruta defensavel.
- Produto nao promete custo infinito por receita fixa.
- Billing e limites sao coerentes no banco, UI e docs.

**Evidencia obrigatoria:**

- Tabela de unit economics simples.
- Tela de planos revisada.
- Teste de limite por plano.

### Etapa 10 - Provar PMF inicial em staging controlado

**Prioridade:** P2, mas obrigatoria para tese investivel

**Status atual:** aberto. Ha framework de KPI/unit economics, mas prova real depende de pilotos com corretores.

**Problema:** Staging prova que o fluxo funciona, nao que o mercado quer pagar. O PRD original exige pilotos reais, metricas de ativacao e retencao.

**Checklist:**

- [x] Criar framework de KPI e unit economics do piloto.
- [x] Criar template de registro de piloto.
- [ ] Selecionar 10 a 20 corretores piloto.
- [ ] Cada corretor gerar pelo menos 1 QR real.
- [ ] Medir tempo ate primeiro QR.
- [ ] Medir scans reais por placa/link.
- [ ] Medir leads reais recebidos.
- [ ] Medir resposta do corretor.
- [ ] Entrevistar usuarios que ativaram e que desistiram.
- [ ] Registrar disposicao a pagar.
- [ ] Produzir relatorio de retencao inicial.

**Criterios de aceite:**

- Pelo menos 10 usuarios reais completam onboarding.
- Pelo menos 5 usam QR em contexto real.
- Existe evidencia de lead incremental.
- Existe decisao objetiva de continuar, ajustar ou matar a tese.

**Evidencia obrigatoria:**

- Relatorio de piloto.
- Funil de ativacao.
- Metricas de valor.
- Lista anonimizada de aprendizados.

## 6. Checklist Macro de Go/No-Go

- [x] Etapa 1 concluida: convite blindado.
- [x] Etapa 2 concluida: signup publico endurecido.
- [x] Etapa 3 concluida: RLS hostil provado para tabelas criticas, RPCs `security definer` por `account_id` endurecidas e Storage policy validada por path/account.
- [x] Etapa 4 concluida: CI/CD tem gates principais, workflows usam environments separados, staging alias foi corrigido, branch/PR draft publicados e branch protection foi aplicada no GitHub agora que o repo foi tornado publico.
- [x] Etapa 5 concluida: Supabase Functions criticas endurecidas; CORS/README validados em staging.
- [x] Etapa 6A concluida: telefone WhatsApp do corretor e revalidado no dispatcher antes de envio `to_broker`; hotfix aplicado em staging e production.
- [x] Etapa 6 concluida: headers baseline fechados.
- [x] Etapa 7 concluida: monitor critico sem `continue-on-error`, alertas para Stripe/fila/cron, heartbeat operacional, `correlation_id`, workflow gate por `critical_open_incidents` e runbook/dashboard minimo.
- [x] Etapa 8 concluida parcialmente: UI publica e metadata normalizadas para ImoveisQR; docs historicos mantem aliases como evidencia/migracao.
- [x] Etapa 9 concluida: pricing e limites revisados, aplicados e evidenciados no staging.
- [ ] Etapa 10 concluida: PMF inicial provado com pilotos reais.

## 7. Gates Finais Obrigatorios

Antes de promover para producao, executar e registrar:

```powershell
pnpm format:check
pnpm --filter web run typecheck
pnpm --filter web run lint
pnpm --filter web run test
pnpm --filter @imobiliariaqrcode/property-importer run test
pnpm --filter web run build
$env:STAGING_BASE_URL='https://farollimoveis-staging.vercel.app'; pnpm --filter web exec playwright test tests/e2e/staging-security-smoke.spec.ts tests/e2e/homepage-mobile.spec.ts --config=playwright.config.ts
```

Tambem registrar:

- resultado da suite RLS hostil;
- resultado dos testes de convite brute-force;
- resultado dos testes de signup anti-abuso;
- resultado de secret scan;
- resultado de migration drift;
- headers HTTP do staging;
- evidencia Stripe test mode;
- evidencia de crons 401 sem bearer;
- evidencia de monitor/alerta;
- statement explicito: `Production was not modified.`

## 8. Decisao Final Esperada

Enquanto qualquer P0 estiver aberto, a decisao correta e:

> Staging em QA. Producao bloqueada.

Quando todos os P0 estiverem fechados com evidencia:

> Staging apto para auditoria final de promocao.

Somente apos auditoria final verde:

> Liberar plano separado de promocao para producao.
