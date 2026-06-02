# Registro de execucao do pacote de compliance

Data: 2026-06-02

## Ambiente

- Worktree: `C:\tmp\imobiliariaopencode-homologacao-segura`
- Branch: `codex/homologacao-segura`
- Supabase de homologacao: `coeuoyeydqoslhvbbojx`
- Supabase de producao: nao utilizado
- Bot: homologacao adiada por ausencia de numero exclusivo de teste

## Alteracoes de banco

- Migration aplicada em homologacao:
  `supabase/migrations/20260602150000_immutable_legal_acceptance_history.sql`
- Registro remoto confirmado:
  `20260602150000 | immutable_legal_acceptance_history`
- Tabela criada: `public.legal_acceptance_events`
- RLS confirmado: `true`
- Gatilhos confirmados:
  `trg_profiles_log_legal_acceptance`
  `trg_legal_acceptance_events_reject_mutation`

## QA transacional

Arquivo reproduzivel:
`scripts/qa/legal-acceptance-history-rollback.sql`

Resultado:
`passed_with_rollback`

O teste:

1. Seleciona um perfil existente somente dentro de transacao.
2. Atualiza temporariamente o aceite.
3. Confirma a criacao de exatamente um evento.
4. Confirma que alteracao do evento append-only e rejeitada.
5. Executa `rollback`.

## Testes de contrato

Comando:

```text
pnpm --filter web exec vitest run src/guardrails/compliance-public-pages.contract.test.ts src/guardrails/legal-acceptance.contract.test.ts
```

Resultado:

```text
2 test files passed
8 tests passed
```

Uma inspecao renderizada adicional detectou rotulos comerciais antigos vindos do banco na pagina de
planos. O componente foi ajustado para exibir sempre `Checkout indisponivel` enquanto a rota online
permanecer desativada.

## Observacoes

- `supabase db push --linked --dry-run` identificou corretamente o host de homologacao, mas falhou
  por senha direta do Postgres indisponivel.
- A migration foi aplicada de forma transacional pelo comando autenticado
  `supabase db query --linked --file`.
- `pnpm run check:staging-safety` permanece deliberadamente bloqueado por ausencia de
  `BOT_RUNTIME_ENVIRONMENT`, numero exclusivo e allowlist do bot de teste. A parte web pode seguir;
  envios do bot nao devem ser habilitados ate a configuracao dedicada existir.
- Nenhuma alteracao foi feita em producao.
