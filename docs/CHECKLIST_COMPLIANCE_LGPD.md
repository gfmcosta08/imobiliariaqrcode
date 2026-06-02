# Checklist de compliance e LGPD do ImobQR

Data da revisao tecnica: 2026-06-02.

Este documento organiza pendencias tecnicas e operacionais. Nao substitui parecer de advogado,
contador ou especialista em protecao de dados.

Dossie detalhado: [docs/compliance/README.md](./compliance/README.md)

## Obrigatorio antes de vender

- [x] Identificar razao social, CNPJ, endereco e canal eletronico temporario.
- [x] Preencher identificacao da empresa nos documentos publicos de homologacao.
- [x] Criar inventario LGPD preliminar com dados, finalidades, bases, retencao e compartilhamentos.
- [x] Documentar fornecedores conforme uso real: Supabase, Vercel, Uazapi/WhatsApp e Stripe.
- [x] Validar aceite versionado no cadastro comum em homologacao.
- [x] Criar trilha append-only de evidencia de aceite em homologacao.
- [x] Criar procedimento e pagina publica de remocao de conteudo e denuncia autoral.
- [x] Revisar fluxo atual de planos, cancelamento, reembolso e atendimento eletronico.
- [x] Fazer triagem preliminar das marcas ImobQR, Imoveis QR e Farollimoveis no INPI.
- [x] Criar procedimento de resposta a incidentes de seguranca.
- [ ] Criar e-mails dedicados para suporte, privacidade e juridico.
- [ ] Definir responsavel interno pelo atendimento de titulares.
- [ ] Revisar juridicamente Termos, Privacidade, remocao e politica comercial antes da producao.
- [ ] Revisar natureza juridica e CNAEs com contador e advogado empresarial.
- [ ] Homologar fluxo completo do bot quando houver numero exclusivo de teste.
- [ ] Garantir que dados reais nao sejam usados em homologacao.

## Recomendado

- [ ] Criar banner e painel de cookies antes de ativar analytics ou publicidade nao essenciais.
- [ ] Criar tela para solicitacao de acesso, correcao e exclusao de dados.
- [ ] Aprovar prazos finais de retencao para leads, mensagens, logs, uploads e webhooks.
- [ ] Criar registro contratual de operadores e transferencias internacionais.
- [ ] Implantar reaceite quando Termos ou Politica mudarem de forma relevante.
- [ ] Revisar logs para impedir exposicao de dados pessoais e segredos.
- [ ] Formalizar rotina de backup, restauracao e teste de rollback.
- [ ] Adotar MFA para contas administrativas.

## Ideal para escalar

- [x] Manter historico imutavel de versoes legais e evidencias de aceite em homologacao.
- [ ] Automatizar inventario de dados e revisao periodica de integracoes.
- [ ] Criar treinamento interno para suporte, corretores e administradores.
- [ ] Criar matriz de risco de fornecedores e revisao periodica de contratos.
- [ ] Realizar teste de resposta a incidente e auditoria de seguranca periodica.
- [ ] Avaliar relatorio de impacto a protecao de dados para tratamentos de maior risco.

## Pendencias deliberadas

- O bot de homologacao permanece adiado ate existir numero exclusivo de teste.
- Os documentos publicos continuam como rascunhos e nao devem ir para producao sem revisao.
- O checkout online permanece desativado.
