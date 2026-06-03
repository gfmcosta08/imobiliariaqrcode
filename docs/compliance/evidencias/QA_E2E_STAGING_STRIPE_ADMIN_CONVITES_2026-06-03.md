# QA E2E - Staging Stripe, Admin, Convites e Compliance

**Data/hora (BRT):** 2026-06-03 14:52 -03:00
**Executor:** Codex + Playwright + validacoes locais
**Ambiente testado:** homologacao/staging, sem deploy em producao
**URL testada:** https://farollimoveis-staging.vercel.app

---

## 1. Regra de seguranca

- Producao nao foi alterada.
- Nenhum `vercel deploy --prod` foi executado.
- Nenhuma variavel de ambiente de Production foi editada.
- Todos os fluxos E2E foram executados contra `farollimoveis-staging.vercel.app`.
- Stripe usado apenas em Sandbox/test mode.
- Credenciais de QA foram usadas localmente sem serem reproduzidas neste relatorio.

---

## 2. Branch e deploy exercitado

| Item | Resultado |
| --- | --- |
| Branch | `codex/homologacao-segura` |
| Ultimo commit antes desta rodada | `3bc01c7 test(e2e): evita colisao de telefone qa` |
| Alias staging usado | `https://farollimoveis-staging.vercel.app` |
| Deploy de producao | Nao executado |
| Deploy/alias de staging | Alias staging ja apontado para preview da branch de homologacao |

Observacao: os ajustes desta rodada foram apenas nos testes E2E e no relatorio. Codigo de aplicacao de producao nao foi alterado nesta etapa.

---

## 3. Fluxos aprovados em navegador

### Compliance, cadastro, admin, checkout e Stripe

- Paginas publicas: home, planos, termos, privacidade, cancelamento/reembolso, remocao de conteudo e login.
- Cadastro Free exige aceite legal antes de criar conta.
- Dashboard Free aparece apos cadastro comum.
- Admin acessa painel.
- Admin gera convite cortesia.
- Admin edita convite pendente, alterando limite de imoveis e validade.
- Convidado usa convite e completa onboarding com aceite legal.
- Checkout Starter bloqueia pagamento sem aceite dos documentos legais.
- Checkout Stripe Sandbox conclui assinatura Starter.
- Dashboard confirma estado real `STARTER (starter_active)` apos webhook/processamento.
- Portal Stripe abre pelo botao `Gerenciar assinatura (cancelar)`.
- Cancelamento pelo portal Stripe Sandbox foi executado em navegador.

### Fluxo imobiliario completo

- Home publica carrega busca e filtros.
- Formulario de imovel exige localizacao quando publicado.
- Corretor convidado publica primeiro imovel.
- Corretor cria segundo imovel com imagem.
- QR Code e URL publica do imovel funcionam.
- Pagina publica `/imoveis/[public_id]` exibe dados do imovel.
- API publica `/api/public/lead` registra lead a partir do token do QR.
- Corretor visualiza o lead no painel `/leads`.
- Busca da home encontra o anuncio.
- Admin encontra o anuncio pelo codigo interno.
- Convite cortesia com limite de 2 anuncios bloqueia tentativa de terceiro anuncio publicado.

### Segurança funcional

- Rotas protegidas redirecionam visitante para login.
- API de importacao retorna 401 sem sessao.
- Health check publico nao expõe stacktrace sensivel.
- Paginas publicas carregam sem login.
- Homepage mobile passou em projeto mobile real do Playwright.

---

## 4. Resultados Playwright

| Suite | Resultado |
| --- | --- |
| `staging-security-smoke.spec.ts` | 4/4 passou |
| `staging-qa-compliance-e2e.spec.ts` sem Stripe opcional | 5 passou / 2 pulados |
| `staging-full-flow.spec.ts` | 7/7 passou |
| `homepage-mobile.spec.ts` em desktop | 1/1 passou |
| `homepage-mobile.spec.ts` em mobile | 1/1 passou |
| `staging-qa-compliance-e2e.spec.ts` com `E2E_STRIPE_CHECKOUT=1` | 7/7 passou |

Resumo:

- Bateria principal desktop sem Stripe opcional: 17 passou, 2 pulados.
- Mobile real: 1 passou.
- Stripe opcional completo: 7 passou.

---

## 5. Resultados tecnicos locais

| Comando | Resultado |
| --- | --- |
| `pnpm --filter web run typecheck` | Passou |
| `pnpm test` | Passou |
| `pnpm build` | Passou |
| `git diff --check` | Passou |

Detalhe de `pnpm test`:

- Web: 17 arquivos, 101 testes aprovados.
- Property importer: 7 arquivos, 47 testes aprovados.
- Staging safety: 6 testes aprovados.
- Staging commercial safety: 5 testes aprovados.

---

## 6. Correcoes feitas nos testes E2E

- Corrigida rota publica de cancelamento/reembolso de `/cancelamento-reembolso` para `/cancelamento-e-reembolso`.
- Checkout Stripe agora preenche campos visiveis reais do Stripe Checkout: cartao, validade, CVC e nome.
- Checkout agora espera explicitamente `STARTER (starter_active)` no dashboard, evitando falso positivo por texto promocional.
- Adicionado teste de portal Stripe e cancelamento via navegador.
- Adicionado teste de lead publico via QR e validacao do lead no painel do corretor.
- Adicionado teste de bloqueio de terceiro anuncio em convite cortesia com limite de 2.
- Helper de login E2E ficou mais robusto para troca de usuario, limpando sessao residual quando necessario.
- Telefone do lead de QA passou a usar formato brasileiro normalizado com DDI `55`.

---

## 7. Evidencias

Diretorios de screenshots mais recentes:

- `apps/web/qa-output/e2e-screenshots/20260603175005/`
- `apps/web/qa-output/e2e-screenshots/20260603174802/`
- `apps/web/qa-output/e2e-screenshots/20260603174640/`

Exemplos de evidencias geradas:

- `stripe-checkout.png`
- `dashboard-starter-pos-checkout.png`
- `stripe-portal-inicial.png`
- `stripe-portal-cancelar.png`
- `stripe-portal-cancelado.png`
- `signup-sem-aceite.png`
- `dashboard-free-pos-cadastro.png`
- `admin-convite-editado.png`
- `checkout-sem-aceite.png`

Pastas de Playwright geradas localmente:

- `apps/web/playwright-report/`
- `apps/web/test-results/`
- `apps/web/qa-output/`

Essas pastas sao evidencias locais e nao devem ser commitadas automaticamente.

---

## 8. Pendencias antes de producao

Mesmo com o staging aprovado nesta rodada, ainda recomendo manter estes bloqueadores antes de subir para producao:

1. Configurar Stripe live na Vercel Production: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_WEBHOOK_SECRET`.
2. Criar/verificar produto e preco live no Stripe: Starter R$ 150/mes.
3. Criar webhook live separado apontando para `/api/webhooks/stripe`.
4. Confirmar `NEXT_PUBLIC_APP_URL` real de producao.
5. Conferir variaveis Production da Vercel separadas de Preview/Staging.
6. Fazer backup do Supabase Production antes de migrations.
7. Validar que usuarios atuais com convite/cortesia serao preservados e nao serao cobrados indevidamente.
8. Validar manualmente o checkout live com valor real somente quando voce autorizar.
9. Fazer monitoramento pos-deploy: checkout, webhook, assinatura, portal, logs sem segredos.
10. Registrar aprovacao humana antes de qualquer deploy em producao.

---

## 9. Veredito

**Staging aprovado para os fluxos testados.**

Os pontos que antes estavam pendentes agora foram cobertos em navegador: assinatura Stripe Sandbox, `starter_active`, portal/cancelamento, lead via QR e limite de cortesia.

**Producao ainda nao deve ser acionada automaticamente.** O ambiente esta mais preparado para a etapa de promocao, mas o deploy Production continua dependendo de checklist live, backup, variaveis live e aprovacao explicita.
