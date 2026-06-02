# Checklist De Compliance E LGPD Do ImobQR

Data da revisão técnica: 2026-06-02.

Este documento organiza pendências técnicas e operacionais. Não substitui parecer de advogado,
contador ou especialista em proteção de dados.

## Obrigatório Antes De Vender

- [ ] Definir razão social, CNPJ, endereço e e-mail oficial de suporte.
- [ ] Definir canal de privacidade e responsável interno pelo atendimento de titulares.
- [ ] Revisar juridicamente Termos de Uso e Política de Privacidade antes da produção.
- [ ] Preencher a identificação da empresa nos documentos públicos.
- [ ] Mapear dados, finalidades, bases legais, retenção e compartilhamentos em inventário LGPD.
- [ ] Documentar Supabase, Vercel, Uazapi/WhatsApp, Stripe e Mercado Pago conforme uso real.
- [ ] Validar o fluxo de aceite versionado em homologação para cadastro comum e convite.
- [ ] Criar procedimento de remoção de conteúdo e denúncia de violação de direitos autorais.
- [ ] Conferir checkout: preço, renovação, cancelamento, suporte e arrependimento quando aplicável.
- [ ] Pesquisar a marca usada comercialmente no INPI e avaliar registro com especialista.
- [ ] Garantir que dados reais não sejam usados em homologação.
- [ ] Definir procedimento de resposta a incidentes de segurança e comunicação quando exigida.

## Recomendado

- [ ] Criar banner e painel de cookies antes de ativar analytics ou publicidade não essenciais.
- [ ] Criar tela para solicitação de acesso, correção e exclusão de dados.
- [ ] Definir política de retenção para leads, mensagens, logs, uploads e webhooks.
- [ ] Criar registro de operadores, contratos e transferências internacionais.
- [ ] Implantar reaceite quando Termos ou Política mudarem de forma relevante.
- [ ] Revisar logs para impedir exposição de dados pessoais e segredos.
- [ ] Formalizar rotina de backup, restauração e teste de rollback.
- [ ] Adotar MFA para contas administrativas.

## Ideal Para Escalar

- [ ] Manter histórico imutável de versões legais e evidências de aceite.
- [ ] Automatizar inventário de dados e revisão periódica de integrações.
- [ ] Criar treinamento interno para suporte, corretores e administradores.
- [ ] Criar matriz de risco de fornecedores e revisão periódica de contratos.
- [ ] Realizar teste de resposta a incidente e auditoria de segurança periódica.
- [ ] Avaliar relatório de impacto à proteção de dados para tratamentos de maior risco.

## Dados Identificados No Código

- Cadastro: nome, e-mail, WhatsApp, perfil, função e credenciais protegidas.
- Imóveis: endereço, geolocalização, descrição, fotos, documentos e dados de proprietário.
- Atendimento: leads, telefones, mensagens, conversas, interações e QR Codes.
- Operação: webhooks, logs, auditoria, falhas, métricas do bot e eventos de impressão.
- Cobrança: plano, assinatura e identificadores de Stripe ou Mercado Pago.
- Integrações: Supabase, Vercel, Uazapi/WhatsApp, Stripe e Mercado Pago.

## Pendências Deliberadas

- O bot de homologação permanece adiado até existir número exclusivo de teste.
- Os documentos públicos são rascunhos e não devem ser promovidos para produção sem revisão.
