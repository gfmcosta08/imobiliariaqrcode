# Homologacao Segura Do Imoveis QR

Este documento define a trava obrigatoria antes de qualquer promocao para producao.

## Regra Central

- Nunca executar deploy de producao automaticamente.
- Aplicar toda mudanca primeiro no ambiente de homologacao.
- Usar somente dados ficticios ou anonimizados.
- Registrar Evidencias, resultados esperados e resultados obtidos.
- Exigir Aprovacao humana antes de propor qualquer promocao para producao.

## Isolamento Obrigatorio

Confirmar antes de testar:

- Banco Supabase separado da producao.
- Link Vercel de staging separado: `https://farollimoveis-staging.vercel.app`.
- Instancia Uazapi separada da producao.
- Credenciais e webhooks separados.
- Numeros autorizados em allowlist para mensagens reais do bot.
- Dados de QA identificados por prefixo e removidos somente apos revisao.

Se qualquer recurso critico for compartilhado com producao, interromper a homologacao e
classificar o problema como risco `P0`.

## Estado Auditado Em 2026-06-02

- Banco Supabase de homologacao confirmado: `imobiliariaqrcode-staging`
  (`coeuoyeydqoslhvbbojx`).
- Banco Supabase de producao permanece separado: `imobiliariaqrcode`
  (`egeteyzfpkbtkwraizwz`).
- Link Vercel de staging respondeu com sucesso:
  `https://farollimoveis-staging.vercel.app`.
- Variaveis publicas genericas de Preview configuradas na Vercel para usar o Supabase staging.
- GitHub Environment `staging` criado com as variaveis
  `SUPABASE_ENVIRONMENT_NAME=staging` e `SUPABASE_PROJECT_ID=coeuoyeydqoslhvbbojx`.
- Secret sensivel `SUPABASE_ACCESS_TOKEN` configurado no GitHub Environment `staging`
  apos aprovacao explicita.
- Secret sensivel `SUPABASE_SERVICE_ROLE_KEY` configurado na Vercel Preview apos
  aprovacao explicita.
- Bot de homologacao adiado ate existir um numero de WhatsApp exclusivo para testes.

## Variaveis Do Bot De Homologacao

Configurar no projeto Supabase de staging:

| Variavel                     | Regra                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `BOT_RUNTIME_ENVIRONMENT`    | Deve ser `staging` em homologacao e `production` em producao.                                 |
| `BOT_STAGING_ALLOWED_PHONES` | Lista separada por virgulas com os unicos numeros autorizados a receber mensagens em staging. |
| `UAZAPI_BASE_URL`            | Deve apontar para a instancia Uazapi separada de homologacao.                                 |
| `UAZAPI_TOKEN`               | Token da instancia separada de homologacao.                                                   |

O dispatcher falha fechado quando `BOT_RUNTIME_ENVIRONMENT` esta ausente. Em staging,
tambem falha fechado quando a allowlist esta vazia e marca como falha qualquer mensagem
destinada a um numero nao autorizado.

## Preflight Antes Do Smoke Real

O script `scripts/test-bot-flow.sh` somente pode disparar mensagens depois que
`node scripts/check-staging-safety.mjs` confirmar:

- `BOT_RUNTIME_ENVIRONMENT=staging`.
- `CONFIRM_STAGING_PROVIDER_SEND=1`.
- `STAGING_BASE_URL` usa um host permitido de staging.
- `SUPABASE_URL` corresponde a `STAGING_SUPABASE_PROJECT_REF`.
- `TEST_LEAD_PHONE` esta na `BOT_STAGING_ALLOWED_PHONES`.

O preflight nao imprime tokens, chaves ou numeros de telefone.

## Checklist Por Pacote

1. Identificar arquivos, migrations, variaveis e integracoes afetadas.
2. Confirmar banco, link, credenciais, webhooks e bot separados.
3. Aplicar somente em homologacao.
4. Rodar testes unitarios, typecheck e guardrails.
5. Validar fluxos publicos, cadastro, login, imoveis, uploads, QR Codes e leads.
6. Validar o bot com numero autorizado: entrada, resposta, fila, webhook, transcricao,
   recomendacoes, falhas e recuperacao.
7. Revisar logs para impedir vazamento de dados pessoais e segredos.
8. Registrar Evidencias.
9. Definir Rollback.
10. Solicitar Aprovacao humana.

## Promocao Manual De Edge Functions

O workflow `.github/workflows/deploy-functions.yml` e exclusivamente manual:

1. Selecione o GitHub Environment `staging` para homologar.
2. Configure variaveis no GitHub Environment:
   `SUPABASE_ENVIRONMENT_NAME=staging` e o `SUPABASE_PROJECT_ID` de homologacao.
3. Configure o secret `SUPABASE_ACCESS_TOKEN` somente apos aprovacao explicita para
   armazenar a credencial sensivel no GitHub Actions.
4. Para `production`, configure reviewers obrigatorios no GitHub Environment.
5. Configure `SUPABASE_ENVIRONMENT_NAME=production` no GitHub Environment de producao.
6. Selecione `production` somente apos homologacao aprovada.
7. Digite `DEPLOY_PRODUCTION` quando o workflow solicitar confirmacao adicional.

## Rollback

Antes da promocao, registrar:

- SHA ou tag previamente homologado.
- Migrations envolvidas e compatibilidade reversa.
- Procedimento para reimplantar a versao anterior.
- Backup necessario antes de migration destrutiva.
- Responsavel por acompanhar logs e incidentes apos deploy.

## Evidencias

Anexar ao pacote:

- Saida dos testes automatizados.
- Checklist manual preenchida.
- Resultado do smoke do bot com numeros anonimizados.
- Lista de regressoes encontradas e corrigidas.
- Plano de rollback.
- Nome da pessoa que aprovou a promocao.
