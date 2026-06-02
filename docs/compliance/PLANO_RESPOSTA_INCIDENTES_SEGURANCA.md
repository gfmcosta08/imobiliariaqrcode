# Plano de resposta a incidentes de seguranca

Atualizado em: 2026-06-02

## Objetivo

Conter, investigar, corrigir e documentar incidentes que afetem confidencialidade, integridade,
disponibilidade ou autenticidade de dados pessoais.

## Canal e responsaveis

Antes da producao, preencher:

| Papel                                          | Responsavel | Canal    |
| ---------------------------------------------- | ----------- | -------- |
| Coordenacao do incidente                       | PENDENTE    | PENDENTE |
| Responsavel legal do controlador               | PENDENTE    | PENDENTE |
| Privacidade / encarregado ou canal equivalente | PENDENTE    | PENDENTE |
| Tecnologia                                     | PENDENTE    | PENDENTE |
| Advogado                                       | PENDENTE    | PENDENTE |
| Contato de fornecedores criticos               | PENDENTE    | PENDENTE |

## Classificacao interna

| Nivel | Exemplo                                                                               | Acao                                                       |
| ----- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| P0    | Segredo exposto; acesso indevido amplo; dados pessoais vazados; producao comprometida | Acionar equipe imediatamente, conter e preservar evidencia |
| P1    | Conta privilegiada suspeita; payload exposto; perda parcial de disponibilidade        | Tratar com prioridade e avaliar escalada                   |
| P2    | Vulnerabilidade sem exploracao confirmada; falha operacional limitada                 | Corrigir, testar e registrar                               |

## Procedimento

1. Abrir registro com data e hora da deteccao.
2. Preservar logs e evidencias sem espalhar dados pessoais ou segredos.
3. Conter: revogar chaves, bloquear acesso, isolar integracao ou desativar funcao afetada.
4. Confirmar se houve incidente, quais ambientes foram afetados e se existem dados pessoais.
5. Mapear categorias, quantidade aproximada de titulares, volume, riscos e medidas tecnicas.
6. Acionar advogado e responsavel legal para decidir comunicacoes obrigatorias.
7. Corrigir causa raiz em homologacao, validar rollback e somente depois propor producao.
8. Monitorar recorrencia e produzir relatorio pos-incidente.

## Comunicacao ANPD e titulares

Segundo a pagina oficial da ANPD atualizada em 02/06/2026, o controlador deve comunicar a ANPD e os
titulares quando o incidente confirmado envolver dados pessoais sujeitos a LGPD e puder acarretar
risco ou dano relevante.

- Prazo indicado pela ANPD: 3 dias uteis para comunicacao a ANPD e aos titulares, salvo prazo
  especifico aplicavel.
- Se faltarem informacoes, a comunicacao a ANPD pode ser preliminar e complementada de forma
  fundamentada em ate 20 dias uteis.
- O protocolo para a ANPD e feito por peticionamento eletronico no SEI!ANPD.
- A comunicacao aos titulares deve ser clara, direta e individualizada quando possivel.

Nao esperar o fim da investigacao para escalar internamente.

## Checklist de evidencia

- Linha do tempo.
- Ambiente afetado.
- Sistemas, tabelas, buckets, webhooks e chaves envolvidos.
- Categorias e volume aproximado de dados.
- Titulares potencialmente afetados.
- Medidas de contencao.
- Logs preservados.
- Decisao sobre ANPD e titulares.
- Comunicacoes enviadas.
- Correcao, teste, rollback e monitoramento.

## Exercicios recomendados

- Fazer simulacao trimestral.
- Testar rotacao de `SUPABASE_SERVICE_ROLE_KEY`, tokens de integracao e segredos Vercel.
- Verificar se logs nao contem payloads desnecessarios, chaves ou dados pessoais excessivos.
- Revisar contratos com operadores para notificacao sem demora injustificada.

## Fonte oficial

- ANPD: https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis
