# Roadmap de compliance: recomendado e ideal para escalar

Atualizado em: 2026-06-02

## Executado neste pacote

- Identificacao empresarial real centralizada no site de homologacao.
- Termos e Politica de Privacidade sem marcadores de preenchimento.
- Pagina publica de remocao de conteudo e denuncias.
- Pagina publica de cancelamento e reembolso.
- Links legais na landing page e na pagina de planos.
- Inventario LGPD preliminar baseado nas tabelas reais.
- Triagem preliminar de marcas na base publica do INPI.
- Plano operacional de resposta a incidentes.
- Migration append-only `20260602150000_immutable_legal_acceptance_history.sql`.
- Aplicacao e validacao da migration apenas no Supabase de homologacao.

## Recomendado antes de vender

| Item                                                                   | Status                          | Proximo responsavel              |
| ---------------------------------------------------------------------- | ------------------------------- | -------------------------------- |
| Revisar Termos, Privacidade, remocao e reembolso                       | Pendente externo                | Advogado digital                 |
| Revisar CNAE, fiscal e enquadramento do SaaS                           | Pendente externo                | Contador e advogado              |
| Avaliar transformacao de Empresario Individual para estrutura adequada | Pendente externo                | Contador e advogado empresarial  |
| Criar e-mails dedicados de suporte, privacidade e juridico             | Pendente externo                | Administracao                    |
| Definir prazos finais de retencao e descarte                           | Pendente externo                | Advogado e tecnologia            |
| Revisar DPA e transferencias de Supabase e Vercel                      | Pendente externo                | Advogado e tecnologia            |
| Criar contrato SaaS e proposta comercial padrao                        | Pendente externo                | Advogado e comercial             |
| Homologar fluxo completo do bot com numero exclusivo e allowlist       | Adiado por decisao do titular   | Tecnologia                       |
| Revisar checkout antes de ativar Stripe                                | Bloqueado ate decisao comercial | Tecnologia, comercial e advogado |

## Ideal para escalar

| Item                                     | Status                                                       | Proximo passo                                              |
| ---------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Registro da marca apos busca por classes | Triagem feita; pedido nao realizado                          | Contratar especialista INPI                                |
| DPA para clientes empresariais           | Pendente                                                     | Definir papeis por fluxo e redigir anexo                   |
| Portal autenticado para direitos LGPD    | Pendente                                                     | Projetar solicitacao, exportacao e eliminacao              |
| Motor de retencao e descarte             | Pendente                                                     | Transformar prazos aprovados em jobs auditaveis            |
| Registro de aceite por evento            | Executado em homologacao                                     | Revisar juridicamente retencao do identificador pseudonimo |
| SIEM ou alertas centralizados            | Pendente                                                     | Definir ferramenta e alertas P0/P1                         |
| Simulacao trimestral de incidente        | Procedimento criado                                          | Agendar exercicio                                          |
| MFA para administradores                 | Pendente de auditoria                                        | Mapear contas privilegiadas e ativar                       |
| Revisao anual de fornecedores            | Pendente                                                     | Criar calendario e evidencias                              |
| Banner de cookies                        | Nao necessario para rastreadores opcionais enquanto inativos | Implementar antes de analytics ou publicidade              |

## Criterio de conclusao

Itens externos nao podem ser executados por codigo. Eles permanecem claramente marcados para evitar
uma falsa sensacao de conformidade.
