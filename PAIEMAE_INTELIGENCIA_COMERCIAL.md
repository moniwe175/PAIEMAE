# PAIEMAE — Inteligência Comercial

Especificação para implementação pelo Antigravity · 13/10/2026

## 1. O resultado que quero no ERP

Quero transformar os dados que a clínica já registra em decisões práticas: entender quem atendemos bem, de onde vêm os clientes, quais ações merecem atenção e o que aconteceu depois de uma campanha.

O diferencial será a ligação entre análise e trabalho: **abrir um número, conferir as pessoas que o compõem, salvar um público e transformar a descoberta em uma ideia ou campanha**. Toda recomendação deverá explicar os dados usados.

Exemplo de uso: identificar clientes de determinada região e serviço que demonstraram interesse em uma conversa com a Evelyn, salvar esse público, planejar a live na lousa, vincular uma campanha e acompanhar os interessados que efetivamente agendaram e compareceram.

Entregar frontend utilizável, consultas e serviços reais, persistência, migração incremental, validações e testes. Este documento orienta a implementação; ele não comprova que as novas funcionalidades já existem.

## 2. Restrições e contexto confirmado

O banco já recebeu marketing_ideas_migration.sql e outras correções de Ideias e Planejamento. O usuário pediu expressamente:

> Já executei o marketing_ideas_migration.sql no Supabase. Considere o banco existente nas correções e prepare uma migração incremental para o que faltar, preservando os dados cadastrados.
>
> Mantenha a restrição: não alterar nada da API ou da automação do Instagram.

Aplicar essa restrição a endpoints, webhooks, credenciais, regras, tabelas e componentes da integração, incluindo Insights. Não fazer chamadas à Meta durante este trabalho. As telas novas podem ler os registros comerciais que já chegaram ao CRM, respeitando suas permissões.

Não executar trabalho na VPS. Não ativar campanhas, criar filas de envio ou mandar mensagens como efeito de salvar um segmento ou uma ideia.

Preparar código e SQL para revisão e homologação. Migrações em produção e publicação devem seguir as instruções explícitas do usuário para esta entrega; não usar dados reais para fixtures de teste.

### Estrutura consultada

Consulta somente de leitura ao GitHub, main no commit 2299cc6f52b606a947089f1fe5a6473a4b0b3a27, em 13/10/2026. O banco de produção não foi inspecionado nesta elaboração.

| Parte existente | Evidência no código | Como aproveitar |
| --- | --- | --- |
| Marketing | src/pages/Marketing.jsx | Acrescentar uma sub-aba; manter as atuais |
| Ideias, aprovação, tarefas e campanhas vinculadas | src/services/marketingIdeasService.js | Reutilizar fluxos de criação e vínculo |
| CRM | src/pages/CrmInteressados.jsx | Reutilizar qualificação, próxima ação e vínculos com paciente/agenda |
| Pacientes | src/pages/Pacientes.jsx | Já contém análises de origem, retorno e recorrência; evitar duplicação |
| Relatórios financeiros | src/pages/Reports.jsx | Conferir critérios e conciliar valores com a fonte original |
| Estratégia / OKRs | src/pages/Estrategia.jsx e src/services/okrService.js | Aproveitar objetivos e metas existentes |
| Permissões | src/contexts/AuthContext.jsx | Respeitar os cargos e as regras efetivas |
| Fontes financeiras e campanhas | src/services/supabaseService.js | Auditar mapeamentos antes de calcular indicadores |

Pontos concretos a resolver na descoberta:

- Existem transactions e sheet_transactions. O serviço identifica sheet_transactions como fonte financeira real e usa filtros como deleted_at e is_metadata. Isso é evidência do código, não confirmação da semântica de cada pagamento.
- Os lançamentos de planilha mostram identificação de cliente por texto. Nome igual, sozinho, não comprova que dois registros pertencem à mesma pessoa.
- Há fallbacks para “Instagram” na tela de Pacientes. Na análise nova, origem ausente deve aparecer como “Não informada”. Registros antigos preenchidos por um default não passam a ter origem comprovada.
- As métricas atuais de campanhas ficam parcialmente em notes. O mapeador de escrita reconstrói esse objeto; não inserir novos campos ali supondo que serão preservados.
- fetchClients busca três faixas fixas até 3.000 registros. Indicadores não podem usar essa lista como se fosse necessariamente toda a base.
- Conferir o HEAD local e remoto antes de implementar. Este documento não autoriza substituir alterações posteriores.

## 3. Escopo e organização da interface

Adicionar somente uma nova sub-aba em Marketing: **Inteligência**.

Dentro dela, usar três visões compactas:

1. **Visão geral** — resultados, oportunidades de trabalho e qualidade dos dados.
2. **Clientes e públicos** — perfil de relacionamento, segmentos e perfis ideais.
3. **Canais e campanhas** — origens, vínculos e resultados atribuídos.

Configurações, definições de métricas e conciliações abrem em painel lateral. Não criar uma nova página para cada conceito estudado.

Manter Ideias e Planejamento como lousa principal de planejamento. Manter Estratégia como lugar de objetivos/OKRs. A nova área oferece contexto e links para essas funções.

### Padrão visual

- Reutilizar tipografia, cores e componentes do ERP.
- Até quatro indicadores em destaque por visão; detalhes em tabelas, filtros e painéis laterais.
- Cada indicador abre os registros que justificam o valor, com período e filtros mantidos.
- Filtros com chips visíveis, botão Limpar e endereço compartilhável dentro do ERP.
- No celular, cartões compactos e tabela adaptada; não espremer colunas até ficarem ilegíveis.
- Estados distintos: carregando, vazio, filtro sem resultado, acesso negado, erro e base incompleta.
- Navegação de teclado, rótulos claros e status indicado por texto, além de cor.
- Carregar a sub-aba sob demanda. Não aumentar o trabalho inicial das telas de Instagram.

## 4. Visão geral: resultado com explicação

### 4.1 Indicadores principais

Exibir para um período explícito:

- Clientes únicos atendidos.
- Novos interessados registrados.
- Recebimentos confirmados, se a fonte estiver validada.
- Clientes que retornaram no período.

Cada cartão mostra valor, definição curta, período, atualização e cobertura. “Sem dados suficientes” é diferente de zero.

O card “Clientes atendidos” é uma candidata inicial a métrica principal, em avaliação. Na configuração, registrar definição, objetivo relacionado, período e justificativa. Não apresentá-la como North Star já comprovada: volume precisa ser acompanhado de experiência do cliente e resultado econômico.

Meta mensal deve ser cadastrada pela gestão, sem valores inventados. Aproveitar vínculo com um objetivo/resultado-chave existente quando compatível; não alterar automaticamente o progresso dos OKRs.

### 4.2 Onde focar agora

Até três cartões acionáveis, calculados por regras transparentes:

| Sinal | Condição | Ação |
| --- | --- | --- |
| Retornos pendentes | Próxima ação vencida e não concluída no CRM | Abrir a fila filtrada |
| Interessados sem próximo passo | Lead aberto sem próxima ação definida | Abrir os registros |
| Revisar relacionamento | Público salvo que satisfaz critérios explícitos de retorno | Revisar pessoas ou criar ideia |

Esses cartões são um retrato atual da operação, identificado como “Agora”; os indicadores de resultado respeitam o período selecionado.

Não usar “chance de comprar 85%”, “cliente perdido” ou recomendação de procedimento inferidos. A ausência de retorno não determina necessidade clínica. Não gerar contatos automaticamente.

### 4.3 Saúde da base

Uma faixa discreta mostra quantos registros têm:

- Origem informada e origem confirmada.
- Vínculo com cliente, quando necessário à métrica.
- Recebimento conciliado com a pessoa correta.
- Data e status suficientes para o cálculo.

O usuário pode abrir as pendências. Uma falha de consulta mostra erro; não deve produzir um painel com todos os números zerados.

## 5. Clientes e públicos

### 5.1 Ficha comercial

Usar o cadastro existente como identidade. Exibir:

| Informação | Definição |
| --- | --- |
| Primeiro atendimento conhecido | Primeira ocorrência concluída disponível na base |
| Tempo de relacionamento observado | Intervalo desde esse atendimento até a data de referência |
| Último atendimento | Última ocorrência concluída até a data de referência |
| Dias sem atendimento | Dias de calendário desde essa ocorrência |
| Atendimentos no período | Contagem distinta de ocorrências concluídas |
| Total recebido no período | Pagamentos confirmados atribuídos ao cliente, líquidos de estornos registrados |
| Total recebido no histórico disponível | Mesma regra para toda a cobertura conhecida, com data inicial da base |
| Serviços realizados | Serviços de ocorrências concluídas, deduplicados corretamente |
| Origem e campanha | Valor, evidência e eventuais lacunas |
| Próxima ação | Abrir o fluxo já existente do CRM |

Datas de importação de cadastro não provam início de relacionamento. Cobertura incompleta precisa ficar visível, especialmente na classificação “novo cliente”.

Exemplo de interface, com dados fictícios apenas em testes: “Ana · primeiro atendimento conhecido há 2 anos · 8 atendimentos nos últimos 12 meses · R$ 4.800 recebidos nesse período · último atendimento há 40 dias”.

Se houver recebimento comprovado sem atendimento registrado, mostrar as duas informações separadas.

### 5.2 Recência, frequência e valor

Aplicar uma leitura de RFM adaptada ao atendimento da clínica:

- Recência de atendimento: dias desde o último atendimento concluído.
- Frequência de atendimento: ocorrências concluídas no período.
- Valor: recebimentos confirmados no mesmo período.

Nomear a adaptação. RFM comercial baseado em compras usa outra unidade; parcelas não devem virar novos atendimentos nem novas compras.

Na primeira versão, mostrar os valores brutos e filtros. Não criar notas 1–5, percentis, “VIP” ou ranking de valor humano sem critérios aprovados. O período padrão desta análise pode ser 12 meses, sempre visível.

### 5.3 Segmentos salvos

Construir um editor simples de condições: **campo → operador → valor**. Na primeira versão, todas as condições são combinadas por “E”; não implementar uma linguagem arbitrária de consultas.

Campos permitidos:

- Tipo de registro: interessado ou cliente, em segmentos separados.
- Serviço de interesse ou serviço realizado, identificados como coisas diferentes.
- Origem, campanha, cidade/bairro quando informados.
- Primeiro/último atendimento, número de atendimentos e valor recebido.
- Etapa do CRM, responsável e situação da próxima ação.
- Preferência de contato, se houver informação explícita.

Condições de serviço e prazo precisam se referir ao mesmo serviço quando essa for a intenção. Evitar unir “fez serviço A” com “último serviço B há 90 dias” e apresentar isso como tempo de retorno de A.

Exemplos disponíveis para o usuário revisar e salvar:

1. Interessados abertos sem agendamento ativo vinculado.
2. Clientes com primeiro atendimento conhecido no período.
3. Clientes com dois ou mais atendimentos concluídos nos últimos 12 meses.
4. Clientes de um serviço que ultrapassaram o intervalo configurado de acompanhamento e não têm atendimento futuro ativo desse serviço.
5. Clientes da região selecionada que realizaram ou declararam interesse em um serviço.

Reutilizar dias_para_retorno e outras configurações existentes se forem adequadas. Não impor um prazo clínico universal nem modificar os motores de automação atuais.

Requisitos:

- Nome, descrição, entidade-base, condições versionadas, período/janela e autoria.
- Prévia com contagem e lista antes de salvar.
- Membros recalculados na consulta; listas sobrepostas são permitidas.
- Campo desconhecido não satisfaz uma condição por acidente; filtro “Não informado” explícito.
- Segmento arquivável e editável, com controle de versão.
- Ações “Criar ideia” e “Vincular a campanha”, ambas sem disparo de mensagem.
- Publicar um segmento não deve criar um lead para cada cliente.
- Preferências de não receber contato devem ser respeitadas em qualquer preparação de público de contato. Pertencer a um segmento não equivale a autorizar envio.

### 5.4 Perfil ideal de cliente — ICP

Dentro de Clientes e públicos, incluir “Perfis que queremos atender melhor”.

Um perfil contém nome, necessidades declaradas, serviços de interesse, região, critérios de relacionamento, segmento de referência, responsável e status “Hipótese” ou “Validado pela gestão”.

Ao selecionar um grupo, mostrar a evidência: tamanho da amostra, período, frequência, valores recebidos, origens e cobertura. Comparar grupos no mesmo período.

O sistema ajuda a observar padrões; a gestão decide o que configura bom encaixe. Gastar mais ou ser cliente antigo não basta para declarar alguém “ideal”. Não inferir renda, personalidade, inseguranças, diagnóstico ou predisposição clínica.

Qualificação comercial reutiliza os campos existentes do CRM: objetivo/serviço, prazo, disponibilidade, dúvidas e próxima ação. Orientações de conversa podem ser exibidas como exemplos; não criar outro formulário obrigatório com perguntas repetidas.

## 6. Canais e campanhas: saber de onde veio o resultado

### 6.1 Separar conceitos

| Conceito | Exemplo |
| --- | --- |
| Aquisição | Indicação, Instagram orgânico, anúncio Meta, busca Google |
| Canal de contato | WhatsApp, telefone, Direct, presencial |
| Formato | Live, Reel, evento, conteúdo educativo |
| Campanha | Live da Evelyn — outubro |
| Identificação de origem | UTM registrada ou informação declarada pela pessoa |

Uma conversa por WhatsApp pode ter sido adquirida por indicação. Uma live é um formato/ação; a origem do interessado pode ser anúncio, conteúdo orgânico ou convite.

Quando o legado informa apenas “Instagram”, manter “Instagram — modalidade não identificada”. Não presumir mídia paga ou orgânica. Preservar o texto original e indicar a qualidade da identificação.

### 6.2 Tabela de desempenho

Colunas iniciais: canal, interessados, interessados com agendamento vinculado, clientes atendidos vinculados, recebimentos atribuídos e cobertura de atribuição.

Permitir abrir campanha ou pessoas. Investimento e custo por aquisição aparecem apenas com dados compatíveis. Não transformar orçamento planejado em gasto realizado.

A atribuição inicial será simples e documentada:

- Origem de aquisição do cliente: primeiro vínculo comercial confirmado disponível; não sobrescrever por interações posteriores.
- Origem da oportunidade: canal/campanha daquele lead ou oportunidade.
- Resultado da campanha: atendimento ou recebimento com vínculo comprovado à oportunidade/campanha.
- Uma pessoa pode ter várias oportunidades. Para aquisição, o mesmo cliente novo só é contado uma vez.
- Cliente já existente que retorna por uma campanha entra como retorno/reativação, separado de aquisição.
- Sem vínculo suficiente, o resultado fica em “Não atribuído”. Não dividir valores entre campanhas por adivinhação.
- Receita histórica inteira de uma pessoa não deve ser atribuída à última campanha.

Utm_source, utm_medium, utm_campaign, utm_content e utm_term podem ser preservadas quando já capturadas ou cadastradas manualmente. Um gerador de link com UTM não comprova visita, inscrição ou venda. Não instalar UTMify, pixels ou SDKs nesta entrega.

### 6.3 Plano e resultado da campanha

Complementar a ficha da campanha existente com:

- Objetivo mensurável e meta.
- Serviço, público/segmento, responsável e período.
- Ideia de origem e, opcionalmente, objetivo/OKR existente.
- Orçamento planejado e investimento realizado em campos distintos.
- Resultado observado, decisão “Repetir / Ajustar / Encerrar” e aprendizado final.

Preservar todos os campos já existentes. Preferir extensão associada à campanha se os mapeadores atuais ou a automação não tolerarem novos dados. Não refatorar o fluxo compartilhado da integração Instagram para acomodar esta entrega.

Ao vincular um público à campanha, registrar a versão dos critérios, a data e a quantidade estimada naquele momento. A prévia atual pode mudar; isso não representa lista de pessoas contatadas.

Se houver registro manual de investimento, exigir período, categoria e referência. Impedir duplicação ao salvar de novo. Esse registro analítico não deve lançar despesas no financeiro automaticamente.

## 7. Conexão com lousa, CRM e Estratégia

### Descoberta para ação

“Criar ideia” a partir de um segmento abre a ficha existente pré-preenchida com título sugerido, hipótese, público, referência da análise e objetivo. O usuário revisa antes de salvar.

Preservar aprovação e etapa como conceitos separados. Não aprovar ideias por elas terem vindo de um indicador.

A lousa continua salvando posições, post-its, setas, filtros e versão pelo fluxo atual. Informações comerciais ficam na ficha da ideia ou em extensão associada; não transformar o JSON do canvas em cadastro comercial.

Reutilizar a conversão transacional de ideia em campanha. Duplo clique ou repetição da requisição não deve criar campanhas duplicadas.

### Atendimento comercial

Reutilizar o drawer e as próximas ações do CRM. Se faltarem dados para medir resposta humana, acrescentar um registro explícito de contato humano com data/hora, canal e autoria.

Nota interna, link de WhatsApp aberto e mensagem automática não comprovam contato humano enviado. Não retropreencher esse horário com created_at, updated_at ou com o horário da DM automática.

### Estratégia

Usar referências aos objetivos/OKRs existentes. Não criar outro módulo de metas concorrente. Acompanhamento automático de resultados-chave só será implementado se existir contrato compatível e teste de regressão; nesta versão, vínculo e acesso ao objetivo são suficientes.

## 8. Contrato dos cálculos

Definir na implementação um catálogo único de métricas, compartilhado entre cartão, tabela e detalhamento.

Usar America/Sao_Paulo. Períodos incluem a data inicial e final na interface; consultas de timestamp usam início inclusivo e início do dia posterior exclusivo. Datas sem horário não devem sofrer conversão indevida de fuso.

| Indicador | Cálculo e regra |
| --- | --- |
| Clientes atendidos | Clientes distintos com pelo menos um atendimento concluído cuja data de ocorrência está no período |
| Atendimentos | IDs distintos de ocorrências concluídas; vários itens de uma ocorrência não multiplicam sua contagem |
| Novos clientes observados | Clientes cujo primeiro atendimento conhecido está no período; evidenciar cobertura histórica |
| Clientes que retornaram | Atendidos no período que têm atendimento concluído anterior ao início dele |
| Participação de clientes que retornaram | Grupo anterior dividido pelos clientes atendidos no período; não chamar de taxa de retenção de coorte |
| Recebimentos líquidos registrados | Valores efetivamente recebidos no período menos estornos/devoluções efetivamente registrados no período, sem abater custos operacionais |
| Recebido por cliente pagante | Recebimentos atribuídos divididos pelos clientes distintos associados a pagamentos positivos no período; nomear a unidade corretamente |
| Interessados registrados | Leads distintos criados no período; não equiparar automaticamente a pessoas distintas |
| Lead com agendamento | Lead da coorte com pelo menos um agendamento válido e vinculado até a data de corte |
| Conversão de interessados em agendamento | Leads com agendamento dividido pelos leads da mesma coorte; identificar janela e data de corte |
| Primeira resposta humana | Tempo entre entrada do interessado e primeiro contato humano de saída comprovado; apresentar mediana, amostra e ainda não respondidos |
| Retornos comerciais atrasados | Próximas ações vencidas, não concluídas, em leads abertos; comparar prazo date no fuso local |

Regras complementares:

- “Encerrado ganho”, “agendado”, “compareceu” e “pagou” representam eventos diferentes. Status comercial sozinho não comprova os demais.
- Classificação de cliente novo/retorno usa toda a história disponível até a data de corte, não somente os registros já filtrados pelo período.
- Dois atendimentos dentro do primeiro mês não fazem esse cliente entrar como retorno de uma coorte anterior.
- Reagendamento não deve inflar a conversão de leads. Definir o mapeamento dos status válidos e cancelados a partir do projeto.
- Comparar períodos equivalentes. Identificar período parcial; não anualizar ou projetar automaticamente.
- Denominador zero: mostrar “Não calculável”, nunca Infinity ou taxa fabricada.
- Cobertura parcial: mostrar valor observado com ressalva mensurável. Dados impossíveis de calcular: valor ausente.
- Não usar preço da agenda ou valor contratado como recebimento.
- Parcelas, pacote vendido e sessões consumidas precisam de unidades distintas. Venda de pacote paga uma vez não gera receita em cada sessão.

### Indicadores condicionados a dados adicionais

| Indicador | Quando pode ser exibido |
| --- | --- |
| Custo de mídia por novo cliente atribuído | Gasto realizado de mídia, período compatível e novos clientes com atribuição comprovada |
| CAC completo | Além do anterior, composição explícita dos custos de aquisição incluídos; não rotular apenas mídia como CAC completo |
| ROAS observado | Recebimentos atribuídos à publicidade / gasto de publicidade, com período, modelo e cobertura explícitos |
| NPS | Respostas reais à pergunta de recomendação: % de notas 9–10 menos % de notas 0–6, usando todas as respostas válidas no denominador |
| Margem | Custos e receitas compatíveis e completos; margem após insumos não pode ser apresentada como lucro líquido |
| LTV projetado e LTV/CAC | Fora desta versão; exigem modelo, hipóteses e base histórica suficiente |

Não construir coleta nova de NPS, previsão ou integração de anúncios nesta entrega. Se a informação não existe, indicar a dependência apenas na definição da métrica, sem ocupar a tela com cartões vazios.

## 9. Descoberta e modelagem dos dados

Antes de criar tabelas, entregar um mapa curto: informação → fonte real → ID de vínculo → regra de data/status → lacuna.

Inspecionar schema, constraints, grants, RLS e RPCs existentes em ambiente autorizado. Arquivos históricos SQL não provam o schema atual. Conferir os tipos reais das chaves de clients, appointments, campaigns e crm_leads.

### Fonte financeira

Escolher e documentar uma fonte canônica por recebimento. Não somar transactions, sheet_transactions e daily_reports como receitas independentes.

Validar o significado de gross, formas de pagamento, status, estornos, linhas de resumo e comandas. A presença de um campo numérico não prova recebimento.

Normalizar BRL com decimal no banco ou centavos inteiros nos cálculos; não usar soma imprecisa de ponto flutuante como fonte monetária.

### Identidade e conciliação

- Preferir chaves existentes e vínculos confirmados.
- Nomes, usernames e telefones podem ajudar a encontrar candidatos, mas não permitem fusão automática de homônimos ou contatos compartilhados.
- Quando faltar client_id na origem financeira, usar associação auxiliar entre registro de origem e cliente, com confirmação, autoria e data.
- Oferecer em “Qualidade dos dados” a revisão dessa associação. Uma nova associação deve invalidar os cálculos afetados.
- Não alterar o lançamento financeiro original para resolver uma necessidade analítica.
- Cadastros sem vínculo permanecem visíveis na cobertura e no total geral elegível, quando este for calculável, mas não entram no valor individual atribuído.

### Estruturas complementares sugeridas

Os nomes abaixo são propostas; criar apenas o que não existe e justificar adaptações:

| Estrutura | Conteúdo |
| --- | --- |
| marketing_segments | Critérios versionados, entidade-base, janela, descrição, autoria e arquivamento |
| marketing_icp_profiles | Hipótese de público ideal, evidência, segmento e validação da gestão |
| marketing_campaign_briefs | Extensão 1:1 da campanha com objetivo, meta, público e aprendizado |
| marketing_acquisition_links | Origem/oportunidade atribuída e evidência, caso o modelo atual não comporte |
| commercial_record_links | Associações confirmadas entre fontes sem ID comum, somente se necessárias |
| marketing_commercial_settings | Definições configuráveis e versão das regras, sem duplicar as já existentes |

Recebimentos, clientes e atendimentos continuam nas fontes existentes. Evitar tabelas copiadas só para alimentar cartões. Preferir consultas agregadas e views compatíveis com as permissões.

## 10. Backend, serviços e permissões

Criar serviço dedicado à inteligência comercial, com componentes pequenos por visão. Reutilizar React, React Query, Recharts e a estrutura de UI presentes; avaliar a versão instalada antes de usar qualquer API de biblioteca.

Requisitos técnicos:

- Consultas agregadas no banco para totais; paginação com ordenação estável para detalhamento.
- Não calcular números globais a partir de páginas incompletas de 1.000 ou 3.000 linhas.
- Critérios de segmentos validados no servidor: campos e operadores permitidos, sem SQL arbitrário.
- Retornar junto ao valor: unidade, período, data de referência, estado de qualidade, denominador quando houver, cobertura e motivos de exclusão.
- Contagem, detalhamento e cálculo devem usar o mesmo contrato e a mesma data de corte.
- Filtros e ordenação paginada não podem modificar o conjunto usado pelo total.
- Salvar alterações com versão/concorrência otimista; mensagem de conflito preserva o formulário do usuário.
- Operações compostas precisam ser atômicas ou declarar resultado parcial e caminho de recuperação. Duplo clique deve ser idempotente.
- Gravação bem-sucedida invalida somente as consultas relacionadas. Não remontar a lousa para atualizar indicadores.
- Usar await e o retorno de erro do SDK existente; não repetir .insert(...).catch() em query builders.
- Não instalar infraestrutura de streaming, warehouse, agente de IA, cron ou serviço pago para essa versão.

As novas consultas e tabelas devem respeitar as permissões reais por cargo:

- Marketing para visualização/edição comercial.
- CRM e Pacientes para os respectivos detalhes e alterações.
- Financeiro/Relatórios para valores financeiros; não expor valores por um agregado que contorne uma restrição existente.
- Administrador conforme o modelo atual.

Validar no banco/servidor, além dos botões. Nas novas tabelas expostas, configurar RLS e grants mínimos. Nas views, garantir que o mecanismo escolhido respeite autorização, incluindo security_invoker quando aplicável. RPCs não devem usar SECURITY DEFINER apenas para contornar erro de permissão.

Consultar docs vigentes do Supabase para a implementação. Manter chaves privilegiadas fora do frontend. Não reescrever permissões de outros módulos para facilitar esta entrega.

## 11. Migração e compatibilidade

Preparar migração incremental sobre o banco existente e roteiro de verificação.

1. Conferir dependências e tipos antes de qualquer alteração.
2. Criar apenas estruturas/colunas ausentes; IF NOT EXISTS sozinho não atualiza a definição de um objeto antigo.
3. Preservar cadastros, layouts, históricos, campanhas e aprovações.
4. Não converter chaves usando NULL, nem truncar/resetar tabelas.
5. Criar índices coerentes com período, cliente, campanha e filtros reais.
6. Incluir grants e políticas dos objetos novos na mesma entrega.
7. Retentar a migração em uma base de teste já migrada deve preservar dados e terminar corretamente.
8. Se um dado legado for ambíguo, mantê-lo e apontar a pendência. Não decidir a origem ou a identidade silenciosamente.

Usar o procedimento de migrações do repositório e da CLI disponível. Entregar o arquivo completo, ordem de aplicação e consultas de conferência; nunca um SQL com funções abreviadas por reticências.

Sem migração aplicada, mostrar “Configuração do banco pendente” na funcionalidade nova e manter o restante do ERP utilizável. Não apresentar fallback em memória como persistência real.

## 12. Cenário de aceite: Live da Evelyn

Este é um exemplo para a interface e para testes, não uma campanha que deve ser publicada automaticamente.

1. Selecionar um grupo por região e interesse declarado/serviço realizado.
2. Salvar “Público da conversa com a Evelyn”.
3. Criar ideia na lousa: conversa sobre dúvidas, expectativas e experiência de atendimento.
4. Definir público, objetivo, responsável, tarefas, aprovação e prazo na ficha existente.
5. Converter em rascunho de campanha e guardar o vínculo com ideia e segmento.
6. Registrar interessados pelo CRM existente, com origem e campanha quando comprovadas.
7. Relacionar agendamentos reais e acompanhar comparecimento.
8. Associar recebimentos somente quando houver evidência.
9. Ao encerrar, registrar resultados, limitações da atribuição e aprendizado para a próxima ação.

Não desenvolver landing page, transmissão/embutimento de live, anúncio, coleta automática de Instagram ou disparo nesta entrega. O ganho imediato é planejar e medir o que já pode ser registrado.

## 13. Ordem de implementação

Executar as etapas abaixo como uma entrega integrada. Concluir primeiro o fluxo menor que funciona; depois acrescentar os demais blocos. Não encerrar após só desenhar as telas.

| Etapa | Entrega verificável |
| --- | --- |
| 0 — Descoberta | Mapa real das fontes, permissões, limitações e arquivos a alterar |
| 1 — Base e clientes | Consultas confiáveis, ficha comercial, cobertura e revisão de vínculos quando necessária |
| 2 — Públicos e ICP | Filtros, segmentos persistentes e perfis com evidência |
| 3 — Canais e campanhas | Atribuição explícita, extensão da campanha e ligação com ideias |
| 4 — Visão geral | Indicadores clicáveis, oportunidades e vínculo com objetivos |
| 5 — Homologação | Migração testada, cenários de uso, regressões e relatório final |

Uma ausência no histórico pode impedir um indicador; não impede concluir os demais. Nesses casos, entregar captura futura necessária e estado de indisponibilidade verdadeiro, sem inventar o passado.

## 14. Testes obrigatórios que provam o comportamento

Fixtures devem ficar isoladas de produção. Testar o código real de cálculo/consulta e os componentes, não reescrever a implementação dentro de testes.

| Caso | Resultado esperado |
| --- | --- |
| Uma pessoa, dois atendimentos e vários itens | 1 cliente atendido; ocorrências contadas por seus IDs |
| Cliente com atendimento anterior ao período | Retorno, sem ser contado como novo |
| Cliente com dois atendimentos no primeiro mês | Novo naquele período; não retorno de uma coorte anterior |
| Origem ausente | “Não informada”, sem virar Instagram |
| Origem legada “Instagram” | Modalidade não identificada até existir evidência |
| Comanda espelhada em duas fontes | Receita contabilizada uma única vez |
| Recebimento de R$ 1.000 e estorno de R$ 200 no período | R$ 800 líquidos registrados, sem duplicar linhas de resumo |
| Pacote pago, três sessões consumidas | Valor recebido uma vez; atendimentos contados separadamente |
| Dois clientes homônimos | Sem união automática dos valores |
| Dados sem confirmação de pagamento | Não aparecem como recebimentos confirmados |
| Duas campanhas para um cliente antigo | Retorno separado de aquisição; sem atribuir toda a receita histórica |
| Lead criado antes do período, agendado dentro dele | Não mistura denominadores da coorte selecionada |
| Auto DM sem contato humano | Não conta como primeira resposta humana |
| Fonte incompleta/consulta com erro | Ausência ou erro identificado, sem zero fabricado |
| Mais de 3.000 registros | Total completo e detalhamento paginado consistente |
| Limite de dia em São Paulo | Evento incluído no dia local correto |
| Mudança dos dados de um segmento | Prévia atual muda; referência histórica da campanha permanece |
| Duplo clique em criar campanha | Uma campanha e um vínculo |
| Edição concorrente de segmento | Conflito explícito; nenhuma sobrescrita silenciosa |
| Perfil sem acesso a valores | Bloqueio também via consulta/API, não apenas na interface |
| Aplicar migração duas vezes | Sem perda de dados nem alteração indevida de definições |

Regressões da lousa: editar post-it duas vezes, edição durante salvamento, alternar filtros/modo conectar, desfazer arraste e cancelar arquivamento. Manter conteúdo, posições e setas após atualização.

Regressões das campanhas: abrir, editar e salvar preserva notes e os demais dados legados. O diff dos arquivos protegidos do Instagram deve permanecer vazio; testes dessa integração, se executados, somente isolados e sem chamadas externas.

Executar build, lint dos arquivos alterados e testes pertinentes. Relatar falhas preexistentes separadamente, sem desabilitar regras apenas para dizer que passou.

## 15. Definição de entrega concluída

- As três visões são utilizáveis com dados reais autorizados e estados de lacuna honestos.
- Cada métrica tem fórmula, unidade, período e registros de origem conferíveis.
- Cliente, atendimento e recebimento não são confundidos.
- Segmento pode virar ideia/campanha persistida e o vínculo pode ser reaberto.
- ICP fica sustentado por uma amostra e critérios explícitos.
- Campanhas mostram resultado atribuído e cobertura; o que não tem origem permanece não atribuído.
- A lousa, o CRM e as telas anteriores continuam funcionando.
- Nada da integração Instagram foi alterado ou acionado.
- Migração completa para esta mudança está documentada e validada em teste.

Entregar ao final:

1. Resumo das funcionalidades, com caminhos de navegação.
2. Arquivos alterados e justificativa.
3. Fonte e fórmula de cada indicador entregue.
4. SQL incremental e consultas de conferência.
5. Testes executados e resultados reais; distinguir unitário, navegador, banco local e produção.
6. Capturas das novas telas com fixtures ou dados autorizados sem dados pessoais desnecessários.
7. Lacunas que dependem de captura futura ou decisão operacional.
8. Estado exato: alterações locais, commit, push e deploy são etapas distintas. Só declarar a que estiver comprovada.

## 16. Fora desta versão

Integração UTMify; gestão de anúncios Meta/Google; alteração de automações; disparos em massa; nova landing page; chatbots; transcrição; previsões de compra; LTV estimado; modelo de atribuição multitoque; motor novo de metas; questionários automáticos.

Esses itens podem aproveitar a base construída futuramente. Não são dependências para entregar esta versão.

## 17. Fontes e fundamento

As decisões de interface, escopo, fórmulas operacionais e adaptação à clínica são propostas deste documento. As referências abaixo fundamentam os conceitos gerais:

- [Amplitude — North Star Framework](https://www.amplitude.com/books/north-star/about-north-star-framework): relação entre valor para o cliente, indicador principal e resultados; não prova que a candidata proposta seja a melhor métrica da clínica.
- [Shopify — Segmentação de clientes](https://help.shopify.com/en/manual/customers/customer-segmentation/index): grupos dinâmicos definidos por critérios.
- [Shopify — Relatórios de clientes e RFM](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/customers-reports): recência, frequência e valor de compras. Aqui, atendimento é uma adaptação explicitamente nomeada.
- [Bain — Cálculo de NPS](https://www.netpromotersystem.com/about/measuring-your-net-promoter-score/): fórmula e faixas de resposta.
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) e [proteção da Data API](https://supabase.com/docs/guides/api/securing-your-api): autorização de dados, grants e exposição dos objetos.
- [Código consultado do PAIEMAE](https://github.com/moniwe175/PAIEMAE/tree/2299cc6f52b606a947089f1fe5a6473a4b0b3a27): base para o mapa de reaproveitamento. Conferir novamente antes de implementar.

## 18. Instrução de execução para o Antigravity

Leia este documento inteiro e implemente a Inteligência Comercial no PAIEMAE, seguindo a ordem definida. Comece verificando o código e o schema disponíveis. Reaproveite Marketing, CRM, Pacientes, Relatórios, Estratégia e a lousa.

O objetivo é entregar um fluxo funcional de dados → público → ideia/campanha → acompanhamento de resultado. Faça decisões rotineiras de implementação, documente adaptações e continue até concluir o escopo. Se faltar informação essencial, identifique a lacuna exata e avance nas partes independentes.

Preserve o banco existente e prepare SQL incremental. Respeite integralmente a restrição de não alterar nem acionar a API, a automação ou os Insights do Instagram. Não use dados de teste em produção.

Apresente a entrega com evidências e critérios de aceite atendidos. Não declare conclusão apenas porque o build compilou.
