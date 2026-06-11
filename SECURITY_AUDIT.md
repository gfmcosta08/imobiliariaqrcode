# AppSec Zero-Trust — Auditoria & Hardening (2026-05-20)

Projeto: `imobiliariaopencode` (Next.js 15 + Supabase)

## FASE 1 — VISÃO DO ATACANTE (Red Team)

### 🔴 VULN-1: Auth Bypass em rotas de Cron (fail-open)

├─ Severidade: **CRÍTICA**
├─ Localização:
│ - `apps/web/src/app/api/cron/whatsapp-dispatch/route.ts`
│ - `apps/web/src/app/api/cron/bot-health-monitor/route.ts`
├─ Tipo: **OWASP A01 Broken Access Control** | **CWE-306** | **A2 (Auth removido/relaxado)**
├─ Exploit: se `CRON_SECRET` estiver vazio/não configurado, a rota aceitava chamadas sem auth.
├─ Impacto: disparo de jobs internos/Edge Functions, abuso de custo/DoS, efeitos colaterais operacionais.
└─ Prova de Conceito:

```bash
curl -i https://<host>/api/cron/whatsapp-dispatch
curl -i https://<host>/api/cron/bot-health-monitor
```

### 🔴 VULN-2: DoS / payload abuse em endpoint público (JSON sem limite)

├─ Severidade: **ALTA**
├─ Localização: `apps/web/src/app/api/public/lead/route.ts`
├─ Tipo: **OWASP A08 Software and Data Integrity Failures (DoS-like abuse)** | **CWE-400** | **A10 (paginação/limite ausente equivalente)**
├─ Exploit: enviar payload JSON grande e/ou strings enormes sem limite por campo.
├─ Impacto: custo, lentidão, saturação de runtime, log spam.
└─ Prova de Conceito:

```bash
python - <<'PY'
import json
big = "x"*200000
print(json.dumps({"qr_token":"t","client_phone":"5511999999999","observation":big}))
PY | curl -i https://<host>/api/public/lead -H "content-type: application/json" --data-binary @-
```

### 🟠 VULN-3: Security headers incompletos (baseline)

├─ Severidade: **MÉDIA**
├─ Localização: `apps/web/next.config.ts`
├─ Tipo: **OWASP A05 Security Misconfiguration**
├─ Exploit: aumenta impacto de XSS/clickjacking em cenários onde existam injeções.
└─ Prova de Conceito: ausências detectáveis por scanner de headers (ex.: CSP/XFO/HSTS).

### 🟡 Observação: leitura pública vs. RLS em `plans`

- `apps/web/src/app/api/health/route.ts` fazia `deep=1` consultando `plans`, mas a base tem tabela pública dedicada (`plan_display_config`). Relaxar RLS de `plans` não é necessário.

## FASE 2 — CÓDIGO BLINDADO (Blue Team)

### Correções aplicadas

- **Fail-secure** em `/api/cron/*` via helper:
  - `apps/web/src/lib/security/cron-auth.ts`
- **Hardening** em endpoint público `/api/public/lead`:
  - limite de bytes (8KB), `maxLength` por campo, rejeição de chaves inesperadas
  - helper: `apps/web/src/lib/security/json-body.ts`
- **Security headers** baseline:
  - `apps/web/next.config.ts` (CSP + XFO + HSTS só em produção)
- **Health deep check** agora usa tabela explicitamente pública:
  - `apps/web/src/app/api/health/route.ts`

## FASE 3 — TESTES DE SEGURANÇA (Security TDD)

- `apps/web/src/lib/security/cron-auth.test.ts`
  - `VULN-1`: negar sem `CRON_SECRET`
  - `VULN-2`: negar Authorization incorreto
- `apps/web/src/app/api/public/lead/security.test.ts`
  - `VULN-3`: rejeitar payload grande (413)
  - `VULN-4`: rejeitar campo inesperado (400)

Rodar:

```bash
pnpm --filter web test
```

## 📊 SCORECARD DE SEGURANÇA

├─ Vulnerabilidades CRÍTICAS: 1
├─ Vulnerabilidades ALTAS: 1
├─ Vulnerabilidades MÉDIAS: 1
├─ Vulnerabilidades BAIXAS: 0
├─ Anti-Padrões de Vibe Coding detectados: **A2**, **A10 (limites ausentes)**
├─ Nota geral: **C** (melhorou; ainda depende de validação contínua em outras rotas)
└─ Top 3 ações prioritárias:

1. Garantir `CRON_SECRET` setado em todos ambientes (Preview/Staging/Prod)
2. Replicar o padrão de validação/limites para outras rotas que aceitam JSON
3. Rodar smoke tests no Supabase de testes após migrations + RLS
