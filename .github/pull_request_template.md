## Resumo

- O que mudou:
- Por que mudou:

## Tipo De Mudanca

- [ ] Frontend
- [ ] API/rotas server-side
- [ ] Supabase migration/schema
- [ ] Edge Functions
- [ ] WhatsApp/bot
- [ ] Stripe/pagamentos
- [ ] Documentacao/processo

## Checklist De Homologacao

- [ ] CI passou.
- [ ] Preview da Vercel abriu corretamente.
- [ ] Preview aponta para Supabase Staging.
- [ ] Supabase Staging nao contem dados reais sem sanitizacao.
- [ ] Migration foi aplicada e testada no Staging, se aplicavel.
- [ ] Login funciona.
- [ ] Dashboard funciona.
- [ ] Cadastro/edicao de imovel funciona.
- [ ] QR publico funciona.
- [ ] Lead e salvo no Staging.
- [ ] `/api/health` funciona.
- [ ] `/api/health?deep=1` funciona.
- [ ] Stripe usa modo teste, se aplicavel.
- [ ] Nenhuma env var Preview aponta para Production.

## WhatsApp/Bot

Preencher quando a mudanca impactar WhatsApp, QR, bot, fila ou monitoramento.

- [ ] Teste simulado do webhook foi executado contra Supabase Staging.
- [ ] Logs foram conferidos em `webhook_events`, `whatsapp_messages` e `bot_interactions`.
- [ ] Quando houver numero de homologacao: webhook de teste aponta para Supabase Staging.
- [ ] Quando houver numero de homologacao: mensagem real chega no banco Staging.
- [ ] Quando houver numero de homologacao: bot responde no numero de teste.
- [ ] Quando houver numero de homologacao: logs nao aparecem em producao.
- [ ] Numero real de producao continua apontando para Supabase Production.

## Banco E Migrations

- [ ] Nao editei migrations antigas ja aplicadas em producao.
- [ ] Criei migration nova para mudanca estrutural de banco.
- [ ] Testei a migration em Staging antes de Production.

## Seguranca

- [ ] Nenhum secret foi commitado.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` nao usa prefixo `NEXT_PUBLIC_`.
- [ ] Staging nao usa service role de producao.
- [ ] Staging nao usa Stripe live.
- [ ] Dados usados em Staging sao falsos ou sanitizados.

## Plano De Rollback

- Como voltar atras se algo falhar:
