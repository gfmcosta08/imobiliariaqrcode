# Arquitetura modular do web app

## Inventário de referência

Inventário coletado antes da migração modular em 2026-07-11:

| Área             | Arquivos TypeScript/TSX |
| ---------------- | ----------------------: |
| `src/app`        |                     147 |
| `src/components` |                      20 |
| `src/lib`        |                      59 |
| `src/guardrails` |                      12 |
| Total            |                     239 |

O App Router possuía 80 entrypoints especiais (`page`, `route`, `layout`, `loading`, `error` e
`not-found`) e 65 arquivos de teste. O inventário inclui as rotas administrativas de subscribers e
métricas, convite claim, onboarding API e demais rotas ausentes no blueprint original.

Após a migração, `src/app` contém 80 entrypoints especiais e três testes das rotas de redirect, sem
implementações auxiliares. `src/features` contém 205 arquivos distribuídos entre 11 módulos;
`src/components` ficou com cinco arquivos compartilhados e `src/lib`, com 18 arquivos de
infraestrutura/políticas transversais. A suíte web passou a ter 66 arquivos de teste por causa do
novo contrato arquitetural.

Para repetir o inventário, liste os arquivos especiais sob `apps/web/src/app` e compare o resultado
com o manifesto produzido por `pnpm --filter web run build`.

## Limites

- `app` contém os entrypoints exigidos pelo Next.js e delega comportamento para `features`.
- Cada feature publica somente `client.ts`, `server.ts`, `actions.ts`, `types.ts` e os adapters
  específicos sob `server/` que realmente utiliza. Não existe barrel misturando client e server,
  nem um barrel de APIs que faça uma rota carregar handlers não relacionados.
- Features não importam `app`. Código em `lib` também não depende de `app` ou de features.
- `onboarding` pode depender de `properties`; `public-listings` depende de `properties`; `admin` e
  `dashboard` podem consumir contratos server de `properties` e `billing`.
- Supabase, segurança, autenticação administrativa, contexto de conta, política legal, telefone e
  analytics permanecem em `lib` como infraestrutura ou políticas transversais.
- A lógica do bot permanece nas Supabase Edge Functions. Os crons do web app continuam adaptadores
  operacionais e não formam uma feature `bot`.

Esses limites são verificados por `pnpm architecture:check` com análise de imports pelo parser do
TypeScript.
