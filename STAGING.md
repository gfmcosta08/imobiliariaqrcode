# ImobQR — Staging (URL fixa)

## URL única (sempre a mesma)

- Staging fixo (Vercel alias): `https://farollimoveis-staging.vercel.app`

## Publicação no Staging (sem produção)

1) Fazer deploy **Preview** (nunca `--prod`):

```bash
vercel deploy --yes
```

2) Apontar a URL fixa para o último deploy Preview:

```bash
vercel alias set <deployment-url>.vercel.app farollimoveis-staging.vercel.app
```

## Regras (anti-vazamento)

- Produção recebe **somente** `código + migrations`.
- É **proibido** copiar dados do staging para produção (dump/restore, seeds de QA, copiar `auth.users`, `profiles`, `properties`, `broker_invitations`, etc.).

## Importação de anúncios (SM-2026-05-29-02 — somente homologação)

Disponível apenas quando `VERCEL_ENV` **não** é `production` (Preview/dev). Em Production a rota retorna `feature_disabled`.

### Variáveis Preview (Vercel)

| Variável | Obrigatória | Descrição |
| -------- | ----------- | --------- |
| `PROPERTY_EXTRACTOR_URL` | Sim | Base URL do serviço [extratordeanuncios](https://github.com/gfmcosta08/extratordeanuncios) (ex.: `https://seu-extrator.onrender.com`) |
| `PROPERTY_IMPORT_MODE` | Não | `open` (default) aceita qualquer site HTTPS público; `pilot` só Sonhar; `allowlist` usa `PROPERTY_IMPORT_ALLOWED_HOSTS` |
| `PROPERTY_IMPORT_ALLOWED_HOSTS` | Não | Domínios permitidos separados por vírgula (modo `allowlist`) |
| `ENABLE_PROPERTY_IMPORT` | Não | `1` força ligado em Preview; `0` força desligado |

### Migration (Staging primeiro)

```bash
supabase db push   # ou aplicar no projeto Staging antes de testar
```

Tabela: `property_import_jobs`.

### Deploy Preview (nunca `--prod`)

```powershell
cd apps/web
vercel deploy --yes
vercel alias set <deployment-url>.vercel.app farollimoveis-staging.vercel.app
```

### Checklist rápido

1. Login em https://farollimoveis-staging.vercel.app
2. `/properties` → **Importar anúncios**
3. URL de qualquer site imobiliário (imóvel, listagem ou home) — ex.: Sonhar, casa63.com.br
4. Confirmar imóveis em **Rascunho** sem mapa; publicar só após `location_map_url` válido
5. Não promover para Production até homologar e aplicar migration em Production (feature permanece desligada em prod até decisão explícita)

