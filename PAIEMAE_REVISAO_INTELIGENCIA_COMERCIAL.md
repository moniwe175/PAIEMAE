# PAIEMAE — Revisão da entrega de Inteligência Comercial

14/10/2026 · Revisão do commit 75f1685c93011acdf1005d2acb86633715373fb4.

## Conclusão

A entrega criou uma base inicial, mas ainda não atende ao aceite do documento PAIEMAE_INTELIGENCIA_COMERCIAL.md. A correção de client_id para integer foi publicada e está presente no banco. Há dois erros de consulta confirmados no Supabase, falhas de cálculo e concorrência reproduzidas localmente, além de funcionalidades essenciais ainda ausentes.

Esta revisão não alterou o código remoto nem gravou dados no Supabase. As consultas de execução no banco foram feitas em transações somente de leitura. Fixtures e reprodução de escrita/migração ficaram em PostgreSQL local isolado via PGlite.

## 1. O que foi confirmado

| Item | Situação verificada |
| --- | --- |
| Publicação do código | Commits 68be34a e 75f1685 presentes em main |
| Nova sub-aba e três visões | Presentes no código |
| Estruturas novas | Tabelas consultadas por metadados no banco |
| Tipo do vínculo financeiro | commercial_record_links.client_id já é integer |
| Tipo de clients.id | integer |
| Tipo de appointments.appointment_date | date |
| Tipo de campaigns.id | bigint; a extensão nova usa integer |
| Testes publicados | 28/28 passam, mas testam cópias locais da lógica |
| Restrição Instagram | O diff desta entrega não altera endpoints, componentes ou serviços específicos do Instagram |
| Deploy e navegação real | Não verificados nesta revisão |

Arquivos da entrega: marketing_inteligencia_migration.sql, inteligenciaComercialService.js, InteligenicaComercial.jsx, tests/inteligenciaComercial.test.mjs e integração em Marketing.jsx.

## 2. Bloqueador confirmado no banco: campos inexistentes

A tabela public.clients não tem source, city ou neighborhood. O schema foi conferido diretamente, sem ler fichas de pacientes.

As duas consultas instaladas falham:

- fn_ic_client_rfm: erro 42703 — column c.source does not exist.
- fn_ic_segment_preview_clients: erro 42703 — column source does not exist. A consulta também seleciona city e neighborhood.

SQL criado com sucesso não significa que o corpo de uma função PL/pgSQL funcionará quando executado.

### Correção exigida

Mapear campos reais e a fonte correta da origem/região. Se esses dados não existem, decidir uma extensão comercial ou colunas opcionais em migração incremental, com valores iniciais desconhecidos. Não preencher “Instagram” por padrão nem inventar cidade/bairro.

Enquanto não houver coleta, consultas devem devolver ausência tipada e a interface deve refletir isso. Filtros não podem apontar para colunas inexistentes.

Aceite: executar as cinco RPCs com schema compatível com o banco real, em ambiente de teste e em leitura autorizada. RFM e prévia de clientes devem funcionar, inclusive com origem/região vazias.

## 3. Ajuste de migração que precisa ser corrigido

O bloco para corrigir client_id UUID contém:

    ALTER TABLE public.commercial_record_links DROP COLUMN client_id CASCADE;
    ALTER TABLE public.commercial_record_links ADD COLUMN client_id integer NOT NULL ...;

Isso não é uma conversão que preserva vínculos. Com uma tabela UUID já populada, reproduzi erro 23502: a coluna nova contém nulls e não pode receber NOT NULL. O erro ocorre dentro do BEGIN e o rollback preserva o estado anterior nesse cenário; esta revisão não encontrou evidência de dados apagados no banco atual.

Em uma tabela vazia, CASCADE ainda pode remover dependências. Remover esse procedimento de reparo.

### Procedimento esperado

- Conferir tipo real e quantidade de vínculos existentes.
- Tipo integer já correto: não recriar a coluna.
- Tipo incompatível com dados: falhar com mensagem clara e preservar tudo até existir um mapeamento explícito.
- Caso vazio: ajuste controlado, com inspeção das constraints/dependências e sem CASCADE genérico.
- Alinhar marketing_campaign_briefs.campaign_id ao bigint real de campaigns.id.
- Preservar tabelas e dados já criados pela primeira tentativa.

O arquivo também faz COMMIT antes das RPCs. Colocar as alterações relacionadas em uma transação coerente para evitar entrega parcial.

DROP FUNCTION em todas as reaplicações é excessivo. A mudança de tipo de retorno de uma função pode exigir drop/recriação, mas funções sem essa mudança devem ser substituídas com preservação de dependências e permissões. Tratar a alteração necessária de forma explícita e conferir grants.

## 4. Falhas reproduzidas usando o código real

Os casos SQL abaixo executaram o arquivo publicado em PostgreSQL isolado; os casos JavaScript carregaram o serviço real, substituindo somente o transporte ao banco por um adaptador de teste.

| Caso | Observado | Correção |
| --- | --- | --- |
| Lead ligado a agendamento cancelado | Conta como conversão porque appointment_id está preenchido | Validar existência, status e data de corte do agendamento |
| Lead arquivado com ação vencida | Continua no contador de retornos pendentes | Excluir arquivados dos sinais operacionais |
| Vínculo financeiro confirmado criado | receita_status permanece indisponivel | Implementar a consulta e a revisão de associações; a tabela sozinha não habilita nada |
| RFM de setembro com atendimento em outubro | Último atendimento aparece em outubro; data de referência não é respeitada | Usar uma data de corte definida e visível; aplicar coerentemente aos cálculos |
| Cliente sem atendimento dentro do período | Some da análise RFM | Disponibilizar população e filtros adequados para revisar clientes sem retorno |
| Campo boolean com operador contém | Erro 42883: boolean não suporta ILIKE | Validar operadores e valores por tipo de campo no servidor e na interface |
| Dois editores salvando segmento versão 1 | Ambos recebem sucesso e uma edição é sobrescrita; versão final 2 | Compare-and-set atômico no UPDATE |
| Preset 7d com navegador em UTC+14 | Intervalo cobre 8 dias | Aritmética de datas sem conversão dependente do fuso do dispositivo |

### Concorrência

updateSegment consulta a versão e depois atualiza apenas por id. Entre a leitura e a escrita, outro usuário pode salvar.

O UPDATE precisa filtrar simultaneamente por id e version esperada, incrementando a versão na mesma operação. Zero linhas significa conflito; não sobrescrever nem apagar o formulário. Arquivamento e outras alterações também precisam participar do versionamento.

### Receita e valor

A RPC de overview retorna receita_status = indisponivel de forma fixa. A UI usa unavailable sem consultar uma situação dinâmica. Nenhum serviço desta entrega lê commercial_record_links para calcular o valor.

A ausência de FK direta impede atribuição individual automática, mas não prova, por si só, que o total geral de recebimentos é impossível. Validar primeiro a fonte financeira e a semântica dos registros. Implementar cobertura, exclusão de metadados/linhas apagadas, deduplicação, pacotes e estornos conforme a especificação original.

Se algo não pode ser calculado, manter a ausência verdadeira. Se um vínculo confirmado habilita o cálculo, ele precisa efetivamente mudar o resultado.

## 5. Funcionalidades da especificação ainda ausentes

| Requisito original | Estado no código revisado |
| --- | --- |
| Indicadores clicáveis com registros de origem | MetricCard não recebe ação de detalhamento |
| Ações que abrem a fila exata do CRM | Ambos os botões apenas navegam para /crm |
| Paginação da análise de clientes | Chamada fixa com limit 50 e offset 0; sem controles para outras páginas |
| Segmentos por frequência, último atendimento e serviço realizado | Prévia de clientes permite somente source, status, city, neighborhood e name |
| Janela temporal do segmento | Armazenada, mas não aplicada nas RPCs |
| Público → criar ideia → campanha | Não há ações nem integração com o serviço da lousa; aparece somente no subtítulo |
| Público ligado à campanha com snapshot dos critérios | segment_id existe no schema, mas não há fluxo de escolha nem snapshot de versão/condições |
| ICP sustentado por evidência | Formulário textual; não liga segmento/amostra e não exibe os dados do grupo |
| Workflow de validação/edição do ICP | Pode nascer validado no select de criação; não há ação de validação posterior nem edição no card |
| Metas e métrica principal | Funções de configuração importadas, sem interface ou consumo operacional |
| Conciliação financeira | Tabela criada, sem serviço nem tela de revisão dos vínculos |
| Primeira resposta humana e qualificação conectada | Não implementadas nesta entrega |
| Origem, contato e formato como dimensões distintas | Estatística agrupa apenas lead.origem |

Concluir os requisitos da versão definida no MD. Não incluir anúncios automáticos, UTMify, landing page, NPS automático ou previsões que ficaram fora daquele escopo.

## 6. Erros, permissões e persistência

Problemas encontrados por leitura do código:

- checkIntelligenceSetup consulta apenas marketing_segments e classifica qualquer erro como tables_missing. Permissão negada ou falha de conexão não significam migração ausente.
- Erros em fetchSegments e fetchIcpProfiles são ignorados e viram lista vazia.
- handleArchiveSeg remove o cartão mesmo que archiveSegment retorne erro.
- Erro ao buscar um brief vira objeto vazio; o usuário pode salvar por cima de informações não carregadas.
- Quando overview falha, os cartões de ação podem exibir zero, mesmo sem uma consulta válida.
- O componente não usa canEdit/canView para os controles; as políticas das tabelas novas permitem operações a todos os authenticated.

Aplicar o modelo de permissões por cargo existente, incluindo leitura/edição, validação de ICP e acesso financeiro. Garantir a regra no backend/banco e nos controles. SECURITY INVOKER é adequado, mas não substitui a autorização dos objetos novos.

Os salvamentos devem refletir o resultado real. Erro preserva o formulário e o estado anterior; conflito não equivale a sucesso. Testar negação de edição e de valores com perfis reais de teste.

## 7. O que os 28 testes comprovam

A suíte publicada importa somente node:assert e node:test. Ela define cópias próprias de getDateRange e das funções de cálculo; não importa o serviço real, não chama as RPCs e não usa o SDK, apesar do comentário no início do arquivo.

O resultado 28/28 foi reproduzido. Ele verifica exemplos dessas cópias e não detecta os erros 42703 do banco ou a corrida de updateSegment.

Acrescentar:

1. Testes que aplicam a migração e executam as RPCs reais sobre schema fiel à produção.
2. Testes do serviço real com transporte isolado, inclusive concorrência.
3. Testes dos componentes para erro, arquivamento malsucedido, paginação, ICP e vínculo de público.
4. Regressores da lousa e das campanhas existentes.
5. Homologação do cenário completo de público → ideia → campanha → resultado.

Build/lint não foram repetidos nesta revisão. Não há confirmação aqui de navegação no navegador ou do deploy de produção.

## 8. Ordem de continuação para o Antigravity

1. Corrigir as consultas quebradas a partir do schema real.
2. Preparar patch incremental para o banco que já recebeu esta migração; eliminar reparos destrutivos.
3. Corrigir conversão, arquivados, referências de data, concorrência, erros e permissões.
4. Concluir ficha comercial/recebimentos, públicos por relacionamento e serviço, ICP com evidência e metas.
5. Conectar indicadores, filas do CRM, segmentos, ideias e campanhas.
6. Executar os testes no código real e os critérios de aceite do MD original.

Manter a restrição original: não alterar nem acionar API, automação, Insights, webhooks ou credenciais do Instagram. O banco atual deve ser preservado.

## 9. Evidências e referências

- [Commit revisado](https://github.com/moniwe175/PAIEMAE/commit/75f1685c93011acdf1005d2acb86633715373fb4).
- [Migração revisada](https://github.com/moniwe175/PAIEMAE/blob/75f1685c93011acdf1005d2acb86633715373fb4/marketing_inteligencia_migration.sql).
- [Serviço revisado](https://github.com/moniwe175/PAIEMAE/blob/75f1685c93011acdf1005d2acb86633715373fb4/src/services/inteligenciaComercialService.js).
- [Componente revisado](https://github.com/moniwe175/PAIEMAE/blob/75f1685c93011acdf1005d2acb86633715373fb4/src/components/marketing/inteligencia/InteligenicaComercial.jsx).
- [Testes publicados](https://github.com/moniwe175/PAIEMAE/blob/75f1685c93011acdf1005d2acb86633715373fb4/tests/inteligenciaComercial.test.mjs).
- [PostgreSQL — ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html): efeitos de DROP COLUMN, CASCADE e alteração de tipo.
- [PostgreSQL — CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html): mudança do tipo de retorno, preservação de permissões e dependências.
- [Supabase — funções](https://supabase.com/docs/guides/database/functions): execução, grants e modos de autorização.

Evidência própria: dois erros 42703 confirmados em leitura no Supabase; oito cenários reproduzidos em ambiente isolado; 28 testes publicados executados com sucesso. Não se trata de uma afirmação de perda de dados na produção.
