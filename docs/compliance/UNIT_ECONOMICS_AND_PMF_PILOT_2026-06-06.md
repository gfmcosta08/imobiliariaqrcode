# Unit Economics e PMF Pilot - ImoveisQR

Data: 2026-06-06
Ambiente: staging
Status: plano de validacao comercial; nao substitui evidencia de pilotos reais

## Evidencia Tecnica de Staging

Validado em staging em 2026-06-06:

- Supabase staging `coeuoyeydqoslhvbbojx` com migration `20260607000144_pricing_limits_unit_economics` registrada no historico remoto.
- Plano Free: 1 anuncio ativo, 10 imagens, expiracao de 30 dias.
- Plano Starter: 10 anuncios ativos, 10 imagens por anuncio, sem promessa de ilimitado.
- Tela publica `/plans` no alias `https://farollimoveis-staging.vercel.app` sem radical `ilimitad`.
- Screenshot: `output/playwright/staging-plans-pricing-2026-06-06.png`.
- Teste SQL transiente de overage: 10 anuncios Starter ativos deixam `can_create_property=false`; 11o insert bloqueado.
- Teste SQL transiente de `past_due` e `canceled`: plano efetivo `free`, limite 1, 2o insert bloqueado.
- Dados QA temporarios removidos apos validacao.

## Decisao de Pricing

O Starter deixa de ser tratado como plano amplo ou "ilimitado". A oferta publica validavel em staging e:

- Free: 1 anuncio ativo, 10 imagens, QR e formulario de lead, sem renovacao automatica.
- Starter: R$ 150/mes para corretor solo.
- Starter inclui ate 10 anuncios ativos.
- Starter inclui 10 imagens por anuncio.
- Starter inclui QR por anuncio ativo.
- Starter inclui captura de leads e painel de oportunidades.
- Importacao assistida fica limitada operacionalmente a 3 lotes por mes durante o piloto.
- Planos para equipe/imobiliaria ficam em piloto fechado depois de prova de uso do Starter.

## Hipotese de Margem

| Item                   | Premissa conservadora | Risco de custo                  | Controle                                    |
| ---------------------- | --------------------: | ------------------------------- | ------------------------------------------- |
| Receita Starter        |            R$ 150/mes | fixa                            | checkout Stripe                             |
| Imoveis ativos         |                    10 | storage, suporte e moderacao    | `plans.max_active_properties`               |
| Imagens                |        10 por anuncio | storage e processamento         | `plans.max_images_per_property`             |
| Importacoes assistidas |           3 lotes/mes | extrator, timeout, suporte      | limite operacional de piloto                |
| Leads                  |     medidos por conta | suporte e volume de notificacao | KPI de leads por conta                      |
| Bot WhatsApp           |    fora do teste live | custo e confiabilidade          | guardrails/monitor, validacao live separada |

## KPI Principal do Piloto

**Ativacao com valor:** percentual de corretores piloto que criam pelo menos 1 anuncio, geram QR e registram pelo menos 1 lead real em ate 7 dias.

Formula:

`corretores com anuncio + QR + lead real em 7 dias / corretores pilotos convidados`

Alvo inicial:

- minimo aceitavel: 30%;
- bom sinal: 50%;
- sinal forte: 70%.

## Drivers

- Tempo ate primeiro QR: mediana abaixo de 5 minutos.
- Taxa de QR gerado: pelo menos 70% dos pilotos criam 1 QR.
- Taxa de lead real: pelo menos 50% dos pilotos com QR recebem 1 lead real.
- Retorno ao painel em D7: pelo menos 40% dos pilotos voltam ao painel.
- Disposicao a pagar: pelo menos 5 pilotos aceitam pagar ou agendar pagamento do Starter.

## Guardrails

- Custo operacional por conta Starter nao pode passar de R$ 45/mes sem plano de ajuste.
- Importacao nao pode ser requisito para gerar QR.
- Nenhum piloto deve depender de bot live no ambiente de teste; quando nao houver bot, usar formulario de lead do QR.
- Nao prometer leads ilimitados, importacao ilimitada ou usuarios ilimitados.
- Nao promover para producao sem relatorio de piloto ou decisao explicita de que a promocao sera apenas beta controlado.

## Evidencia Necessaria Para Etapa 10

Ainda falta evidencia externa real:

- lista de 10 a 20 corretores piloto;
- data de convite e data de ativacao;
- primeiro QR gerado por corretor;
- primeiro lead real por corretor;
- retorno ao painel em D7;
- entrevista curta de compra/cancelamento;
- decisao objetiva: continuar, ajustar ou matar a tese.

## Template de Registro de Piloto

| Piloto | ICP                 | Convidado em | Primeiro QR | Primeiro lead | D7 voltou? | Pagaria R$150? | Aprendizado |
| ------ | ------------------- | ------------ | ----------- | ------------- | ---------- | -------------- | ----------- |
| P001   | corretor solo       |              |             |               |            |                |             |
| P002   | corretor solo       |              |             |               |            |                |             |
| P003   | pequena imobiliaria |              |             |               |            |                |             |
