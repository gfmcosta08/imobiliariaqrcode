# Identificacao empresarial

Atualizado em: 2026-06-02

## Fonte

Dados extraidos do comprovante de inscricao e situacao cadastral fornecido pelo titular em
`CNPJ (1).pdf`, emitido em 05/05/2026.

## Identificacao usada na homologacao

| Campo                          | Valor                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Nome empresarial               | 66.615.554 GIANPAOLO FERREIRA MATOS COSTA                                                                            |
| CNPJ                           | 66.615.554/0001-01                                                                                                   |
| Situacao cadastral             | Ativa                                                                                                                |
| Data de abertura               | 05/05/2026                                                                                                           |
| Porte                          | ME                                                                                                                   |
| Natureza juridica              | 213-5 - Empresario (Individual)                                                                                      |
| Endereco publico do fornecedor | Q ARSE 14 ALAMEDA 7, SN, LOTE 01; BLOCO I; CASA 02; COND ALPHA VILLAGE, PLANO DIRETOR SUL, Palmas/TO, CEP 77.020-136 |
| Canal eletronico temporario    | gpmcosta@gmail.com                                                                                                   |

O telefone do comprovante nao foi publicado no site porque nao e necessario para os ajustes atuais.

## Alertas antes de producao

### P0 - Responsabilidade patrimonial

O CNPJ existe, mas a natureza juridica atual e `Empresario Individual`. O material oficial do DREI
informa que o Empresario Individual responde com todos os seus bens pelas dividas e prejuizos da
atividade. A existencia do CNPJ, sozinha, nao cria separacao patrimonial equivalente a uma LTDA.

Acao: revisar com advogado empresarial e contador se a operacao deve ser transformada em Sociedade
Limitada unipessoal ou outra estrutura adequada antes de escalar vendas.

### P0 - Atividade economica

O CNAE principal informado no comprovante e `85.99-6-03 - Treinamento em informatica`. A operacao
planejada envolve SaaS imobiliario. Somente contador e advogado podem confirmar o enquadramento
correto e eventuais CNAEs adicionais.

Acao: revisar CNAE, emissao fiscal, contrato SaaS e regime tributario antes de vendas recorrentes.

### P1 - Canais dedicados

O e-mail publico atual e temporario e coincide com o e-mail cadastrado no CNPJ.

Acao: criar caixas dedicadas, por exemplo `suporte@`, `privacidade@` e `juridico@`, e atualizar
`apps/web/src/lib/legal-entity.ts` antes da producao.

## Fonte oficial

- DREI: https://www.gov.br/empresas-e-negocios/pt-br/drei/orientacoes-de-abertura/tipos-de-pessoas-juridicas
