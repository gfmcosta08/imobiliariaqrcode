# RLS, RPC and Storage Audit - Staging

Data: 2026-06-06
Ambiente: Supabase staging `coeuoyeydqoslhvbbojx`
Produto: ImoveisQR
Production modified: no

## Parecer

Etapa 3 esta fechada para o escopo de engenharia P0: tabelas criticas, RPCs que recebem `account_id` e Storage `property-media` foram validados contra acesso cross-tenant autenticado.

## Referencias Tecnicas

- Supabase recomenda que funcoes `SECURITY DEFINER` usadas em policies nao precisem ficar em schema exposto quando chamadas explicitamente por schema.
- Supabase Storage privado depende de RLS em `storage.objects`; upsert exige `SELECT` + `INSERT` + `UPDATE`.
- Buckets privados aplicam controle de acesso inclusive no download; buckets publicos bypassam leitura publica.

## Evidencia - Storage

Consulta de staging em `storage.buckets`:

| Bucket           | Publico | Limite       | MIME types permitidos                                |
| ---------------- | ------- | ------------ | ---------------------------------------------------- |
| `property-media` | `false` | 52.428.800 B | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |

Policies encontradas em `storage.objects`:

| Policy                              | Comando | Role            | Regra                                                                 |
| ----------------------------------- | ------- | --------------- | --------------------------------------------------------------------- |
| `storage_property_media_select_own` | SELECT  | `authenticated` | `bucket_id='property-media'` e path `account/{account_id}` do usuario |
| `storage_property_media_insert_own` | INSERT  | `authenticated` | mesmo escopo por path/account                                         |
| `storage_property_media_update_own` | UPDATE  | `authenticated` | mesmo escopo por path/account                                         |
| `storage_property_media_delete_own` | DELETE  | `authenticated` | mesmo escopo por path/account                                         |

Teste hostil automatizado:

- Conta A faz upload em `account/{accountA}/...`: permitido.
- Conta A tenta upload em `account/{accountB}/...`: bloqueado por RLS.
- Conta A lista `account/{accountA}`: enxerga o proprio arquivo.
- Conta A lista `account/{accountB}`: retorna zero arquivos.

## Evidencia - RPCs

Migration aplicada e registrada no historico remoto:

- `20260607004942_harden_public_definer_rpc_privileges.sql`

Mudancas aplicadas:

- Criada `private.assert_rpc_account_scope(uuid)`.
- `get_active_plan_code(uuid)`, `account_property_limit(uuid)` e `can_create_property(uuid)` agora validam que o `account_id` informado pertence ao usuario autenticado, ou que a chamada vem de `service_role`.
- `anon` removido dos helpers de plano/limite.
- `assign_premium_lead_recipient(...)` removida de `anon/authenticated`; ficou apenas `service_role`.
- `get_global_dashboard_metrics()` removida de `anon/authenticated`; ficou apenas `service_role`.
- `get_my_dashboard_metrics()` permanece para `authenticated`, sem acesso anonimo.

ACL pos-migration verificada em staging:

| RPC                                  | ACL relevante                   | Guard                              |
| ------------------------------------ | ------------------------------- | ---------------------------------- |
| `account_property_limit(uuid)`       | `authenticated`, `service_role` | `private.assert_rpc_account_scope` |
| `can_create_property(uuid)`          | `authenticated`, `service_role` | `private.assert_rpc_account_scope` |
| `get_active_plan_code(uuid)`         | `authenticated`, `service_role` | `private.assert_rpc_account_scope` |
| `assign_premium_lead_recipient(...)` | `service_role`                  | Direct RPC bloqueada               |
| `get_global_dashboard_metrics()`     | `service_role`                  | Direct RPC bloqueada               |
| `get_my_dashboard_metrics()`         | `authenticated`, `service_role` | Usa `auth.uid()`                   |

Teste hostil automatizado:

- Conta A chama `get_active_plan_code(accountA)`: permitido, retorna `free`.
- Conta A chama `get_active_plan_code(accountB)`: bloqueado com `account scope violation`.
- Conta A chama `account_property_limit(accountB)`: bloqueado com `account scope violation`.
- Conta A chama `can_create_property(accountB)`: bloqueado com `account scope violation`.
- Conta A chama `get_global_dashboard_metrics()`: bloqueado por permissao.
- Conta A chama `assign_premium_lead_recipient(...)` diretamente: bloqueado por permissao.

## Suite Executada

```powershell
$env:E2E_STAGING_WRITE='1'
pnpm --filter web exec playwright test tests/e2e/staging-rls-isolation.spec.ts --config=playwright.config.ts --reporter=line
```

Resultado:

- `1 passed (20.3s)`

## Ressalvas

Ainda existem funcoes `SECURITY DEFINER` no schema `public` para superficies publicas do produto, como QR/home/search. Elas nao foram classificadas como bloqueador da Etapa 3 porque nao recebem `account_id` arbitrario no contrato multitenant auditado aqui. A recomendacao P1 e migrar helpers internos para schema privado em uma janela propria e manter no `public` somente RPCs que sejam produto publico intencional.
