# Inventario LGPD

Atualizado em: 2026-06-02

## Escopo

Inventario tecnico preliminar produzido a partir do codigo e do catalogo real do Supabase de
homologacao `coeuoyeydqoslhvbbojx`. Ele deve ser validado juridicamente antes de producao.

As bases legais abaixo sao hipoteses de trabalho. A definicao final depende do papel exercido em
cada fluxo: controlador, operador ou controlador conjunto com corretor ou imobiliaria.

## Inventario de tratamentos

| Grupo                    | Dados e tabelas reais                                                                                                              | Titulares                                 | Finalidade                                                           | Base legal preliminar                                                                  | Retencao preliminar                                              | Compartilhamento                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| Conta e autenticacao     | `profiles`: nome, e-mail, WhatsApp, papel; `auth.users`: credencial protegida e metadados                                          | Usuarios                                  | Criar conta, autenticar, administrar acesso e suporte                | Execucao de contrato; legitimo interesse para seguranca quando cabivel                 | Vigencia da conta e periodo necessario para obrigacoes e defesa  | Supabase                                             |
| Evidencia de aceite      | `profiles`: versoes e datas; `legal_acceptance_events`: identificador pseudonimo, versoes, origem e data                           | Usuarios                                  | Provar aceite dos documentos vigentes                                | Execucao de contrato; exercicio regular de direitos                                    | Definir com advogado; tabela append-only                         | Supabase                                             |
| Corretores               | `brokers`: nome de exibicao, WhatsApp, status, conta                                                                               | Corretores                                | Distribuir leads e operar atendimento                                | Execucao de contrato                                                                   | Vigencia da conta e periodo de defesa                            | Supabase; mensageria quando ativada                  |
| Convites                 | `broker_invitations`: contato, token, status e datas                                                                               | Corretores convidados                     | Convidar e habilitar usuario                                         | Procedimentos preliminares relacionados a contrato                                     | Expirar e eliminar convites inativos em prazo definido           | Supabase                                             |
| Imoveis publicos         | `properties`: titulo, descricao, finalidade, valores, localizacao e caracteristicas                                                | Corretores; eventualmente proprietarios   | Publicar anuncio e recomendar imovel                                 | Execucao de contrato                                                                   | Enquanto anuncio ativo e periodo de defesa                       | Supabase; Vercel na exibicao publica                 |
| Dados privados do imovel | `properties`: nome, telefone e e-mail do proprietario; corretor do anuncio; endereco completo; registro e documentacao             | Proprietarios e corretores                | Administrar anuncio e contato profissional                           | Validar relacao contratual e necessidade; reduzir coleta                               | Enquanto necessario ao anuncio; revisar descarte                 | Supabase                                             |
| Midias                   | `property_media`: caminho, tipo, tamanho, dimensoes e imagens armazenadas                                                          | Pessoas eventualmente retratadas; autores | Exibir anuncio e manter acervo contratado                            | Execucao de contrato; autorizacao ou licenca do uploader                               | Ate remocao do anuncio e periodo operacional definido            | Supabase Storage; Vercel na exibicao                 |
| Leads                    | `leads`: telefone, nome, observacoes, interesses, origem, intencao e status                                                        | Interessados em imoveis                   | Responder solicitacao, encaminhar corretor e medir atendimento       | Procedimentos preliminares solicitados pelo titular; legitimo interesse quando cabivel | Definir janela de inatividade e bloqueio de marketing            | Supabase; corretor responsavel                       |
| Conversas e mensageria   | `whatsapp_messages`, `conversation_sessions`, `lead_interactions`, `webhook_events`: telefone, mensagem, payload, estado e eventos | Leads e corretores                        | Atender solicitacao, recuperar falhas e manter evidencia operacional | Procedimentos preliminares; execucao de contrato; legitimo interesse para seguranca    | Minimizar payload bruto; definir descarte e anonimizacao         | Supabase; Uazapi ou provedor WhatsApp quando ativado |
| QR Codes                 | `property_qrcodes`, `qr_access_events`, `print_events`: codigo, acesso, datas e contexto tecnico                                   | Visitantes e usuarios                     | Direcionar atendimento e medir uso                                   | Legitimo interesse sujeito a teste de balanceamento                                    | Agregar ou anonimizar quando possivel                            | Supabase                                             |
| Logs e seguranca         | `audit_logs`, `bot_interactions`: ator, acao, entidade, metadados, erro, incidente e recuperacao                                   | Usuarios, leads e operadores              | Auditoria, prevencao a fraude e resposta a incidentes                | Legitimo interesse; exercicio regular de direitos                                      | Definir prazo por criticidade; remover segredos e excesso de PII | Supabase                                             |
| Recomendacoes            | `recommendation_events`: imoveis retornados e telefone do lead                                                                     | Leads                                     | Recomendar imoveis e avaliar fluxo                                   | Procedimentos preliminares; legitimo interesse quando cabivel                          | Preferir pseudonimizacao e agregacao                             | Supabase                                             |
| Importacao               | `property_import_jobs`: URL, resultados, falhas e dados importados                                                                 | Corretores; proprietarios                 | Importar anuncios solicitados pelo usuario                           | Execucao de contrato                                                                   | Remover resultados intermediarios apos prazo operacional         | Supabase; fonte indicada pelo usuario                |
| Assinaturas              | `subscriptions`, `accounts`: plano, status, identificadores de provedor, periodos e cancelamento                                   | Usuarios pagantes                         | Administrar plano e cobranca                                         | Execucao de contrato; obrigacao legal                                                  | Conforme obrigacoes fiscais, defesa e contrato                   | Supabase; Stripe somente quando reativado            |
| Camada comercial         | `account_commercial_contracts`, `commercial_packages`, `delivery_orders`, `partners`, `partner_users`                              | Clientes, parceiros e operadores          | Contratos, entrega de placas e operacao comercial                    | Execucao de contrato; obrigacao legal                                                  | Conforme contrato, fiscal e defesa                               | Supabase; parceiros necessarios                      |

## Cookies e rastreamento

- Cookies essenciais de autenticacao do Supabase podem ser usados para sessao e seguranca.
- A busca no codigo nao encontrou Google Analytics, Meta Pixel, Sentry, PostHog, Hotjar ou Clarity
  ativos.
- Nao ativar analytics, publicidade ou novo rastreamento antes de atualizar este inventario,
  revisar base legal e implementar mecanismo de preferencias quando necessario.

## Operadores e transferencias

| Fornecedor        | Uso atual ou planejado        | Status                                                   | Acao antes de producao                                                       |
| ----------------- | ----------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Supabase          | Banco, autenticacao e storage | Ativo                                                    | Revisar DPA, suboperadores, regiao, backup e transferencia internacional     |
| Vercel            | Hospedagem web                | Ativo                                                    | Revisar DPA, logs, suboperadores e transferencia internacional               |
| Uazapi / WhatsApp | Mensageria e webhooks         | Planejado ou parcialmente integrado; bot de teste adiado | Contratar, revisar termos, isolar instancia de teste e limitar destinatarios |
| Stripe            | Assinatura recorrente         | Checkout online desativado                               | Revisar DPA e ativar somente apos checklist comercial                        |
| Mercado Pago      | Webhook stub                  | Nao ativo                                                | Nao declarar como operador ativo ate contratacao e implementacao             |

## Direitos dos titulares

Canal temporario: `gpmcosta@gmail.com`.

Procedimento minimo:

1. Registrar data, solicitante, identidade verificada, pedido e prazo.
2. Localizar dados por perfil, telefone, lead, mensagens, midias e logs.
3. Classificar o que pode ser corrigido, exportado, anonimizado, bloqueado ou eliminado.
4. Justificar retencoes necessarias por obrigacao legal ou exercicio regular de direitos.
5. Responder ao titular e registrar a conclusao.

## Pendencias para revisao juridica

- Definir matriz final de controlador e operador por fluxo.
- Definir prazos exatos de retencao e descarte por categoria.
- Redigir DPA para clientes empresariais e revisar DPAs de fornecedores.
- Aplicar teste de balanceamento para legitimo interesse.
- Confirmar tratamento de dados de criancas, se houver qualquer possibilidade de coleta.
- Criar processo de portabilidade, anonimização e descarte executavel.

## Fontes oficiais

- LGPD: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/Lei/L13709compilado.htm
- Guia de cookies da ANPD: https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf
