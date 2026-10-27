# CRM AVANÇADO

## Conversa preservada literalmente

**Usuário:**

> comnsegue analisar tudooooo e ver cada video de cada pagina por favor https://clinicaexperts.notion.site/CliniCRM-3e5916fa848543d0b04b89225626d8e2

**Codex:**

Sim. Analisei toda a estrutura pública do CliniCRM: 12 páginas, 11 vídeos no total — um vídeo de apresentação hospedado no Notion, dez vídeos do YouTube e uma página explicativa sem vídeo. Também comparei cada funcionalidade com o CRM atual do PAIEMAE. Não alterei nenhum código.

Minha conclusão principal é esta: o CliniCRM é um CRM genérico e bastante manual. O PAIEMAE já tem uma vantagem importante: usa a Agenda como fonte da verdade. Não devemos copiar tudo, porque isso faria a equipe preencher etapas, valores, tarefas e qualificações manualmente. O ideal é trazer apenas as funcionalidades que faltam, mantendo a automação.

## O que existe em cada página

| Página analisada | Funcionalidade mostrada |
|---|---|
| [Apresentação do CliniCRM](https://clinicaexperts.notion.site/CliniCRM-3e5916fa848543d0b04b89225626d8e2) | Painel comercial, funil, ranking de vendedores, oportunidades, exportação, tarefas, histórico, documentos, financeiro e comissões. |
| [Configurações iniciais](https://youtu.be/z6Yhdpp4qwk) | Configuração dos funis, etapas, motivos de ganho/perda, regras de movimentação, dias de estagnação e prevenção de oportunidades duplicadas. |
| [Criação de oportunidades](https://youtu.be/jMVqFcqfwQc) | Cliente, funil, etapa, vendedor, valor, título, origem, etiquetas, prioridade, previsão de fechamento e observações. |
| [Oportunidades no perfil do contato](https://youtu.be/YTisgmiEcYs) | Criar uma oportunidade diretamente no cadastro de um cliente já existente. |
| [Criação de tarefas](https://youtu.be/qPhuD1xFPnI) | Várias tarefas por oportunidade, tipo da tarefa, responsável, data, horário, descrição, conclusão e resultado. |
| [Automação pelo WhatsApp](https://youtu.be/yfau8rl27bw) | Palavras-chave recebidas no WhatsApp criam oportunidades automaticamente em um funil e etapa definidos. |
| [Cadastro de leads](https://youtu.be/uvmBiql-lKI) | Cadastro separado de pessoas com contatos, documentos, endereços, arquivos e etiquetas. |
| [Múltiplos funis](https://youtu.be/wrPSzw94y9A) | Diversos funis configuráveis, cada um com etapas próprias e visualização em Kanban ou lista. |
| [Gatilhos nas etapas](https://youtu.be/Efs2uR_m0Hc) | Ao mover uma oportunidade para “Contato”, o sistema abre o envio por WhatsApp, Instagram, e-mail ou SMS. |
| [Formulário de captação](https://youtu.be/y7qb5glsVq4) | Formulário público, campos obrigatórios, destino do lead, link, iframe, API e controle de domínios permitidos. |
| [Previsão e prazos](https://youtu.be/0qdMPavVYOY) | Prazo de tarefas e previsão de fechamento de cada oportunidade. |
| [Tarefas do CRM na Agenda](https://clinicaexperts.notion.site/Mostrar-tarefas-do-CRM-na-agenda-350a52df727b801cbb99daca3ebec88c) | Tarefas comerciais aparecem na agenda e podem ser editadas, excluídas e concluídas por ali. |

## Comparação com o PAIEMAE

### 🟢 Já temos e, em alguns pontos, está melhor

- Funil comercial ligado à realidade da Agenda.
- Etapas automáticas: responder, agendado, atendido e perdido.
- Vínculo entre interessado, paciente e agendamento.
- Conversão de interessado em agendamento e atendimento.
- Histórico comercial e histórico automático da Agenda.
- Origem do interessado e atribuição de campanhas/UTMs.
- Responsável pelo interessado.
- Próxima ação, responsável, prazo e alerta de atraso.
- Filtros por etapa, responsável, atraso, falta de ação e arquivados.
- Indicadores de conversão por origem e responsável.
- Procedimentos que mais geram atendimento e receita.
- Motivos automáticos de perda.
- Recomendações automáticas do que fazer com cada interessado.
- Integração com o Motor de Marketing.
- Contato rápido por WhatsApp e Instagram.
- Automação oficial do Instagram encaminhando pessoas para o CRM.
- Detecção de problemas de qualidade, como telefone duplicado ou vínculo ausente.

O principal diferencial do PAIEMAE é que a recepção não precisa arrastar cartões para dizer que alguém agendou ou foi atendido. A Agenda já informa isso automaticamente.

### 🟡 Existe, mas está incompleto

1. Tarefas comerciais

Hoje existe apenas uma “próxima ação” por interessado. O CliniCRM permite várias tarefas simultâneas:

- Ligar.
- Enviar WhatsApp.
- Cobrar resposta.
- Confirmar interesse.
- Fazer retorno em determinada data.
- Registrar o resultado de cada tarefa.

No PAIEMAE, quando uma ação é concluída, ela vai para o histórico, mas não existe uma tabela real de tarefas comerciais.

2. Tarefas dentro da Agenda

A próxima ação do CRM não aparece na Agenda. Isso poderia existir como uma camada opcional chamada “Tarefas comerciais”, sem misturar por padrão com os atendimentos clínicos.

3. Cadastro da pessoa versus oportunidade

No PAIEMAE, o registro em `crm_leads` representa ao mesmo tempo:

- A pessoa.
- O interesse dela.
- A oportunidade comercial.

Isso funciona enquanto cada pessoa tem apenas um interesse ativo. Mas pode gerar problema se a mesma pessoa estiver negociando Botox e um pacote corporal ao mesmo tempo.

O CliniCRM separa contato de oportunidade e permite várias oportunidades para a mesma pessoa. Essa é a maior diferença estrutural entre os dois sistemas.

4. Motivos de ganho e perda

O PAIEMAE possui `motivo_perda`, principalmente calculado automaticamente. Ainda não existe:

- Catálogo controlado de motivos.
- Motivo de ganho.
- Registro de quem informou o motivo.
- Distinção entre motivo automático e motivo corrigido pela equipe.

5. Prevenção de duplicidade

O sistema identifica alguns telefones duplicados na qualidade dos dados, mas o ideal seria impedir ou alertar antes de cadastrar um novo interessado com o mesmo telefone.

6. Filtros comerciais

Já existem bons filtros, mas ainda não há filtros por:

- Período de criação.
- Última interação.
- Serviço desejado.
- Valor estimado.
- Previsão de fechamento.
- Prioridade.
- Etiquetas.

7. Ranking por responsável

O painel calcula conversão por responsável, mas não apresenta uma visão tão direta quanto o ranking do CliniCRM. Isso pode ser melhorado sem transformar o trabalho em competição artificial.

8. Documentos e arquivos

O PAIEMAE já possui documentos no perfil do paciente, termos, contratos e histórico. O que não existe é um documento ou anexo vinculado especificamente a uma negociação do CRM. Não recomendo duplicar os documentos clínicos; o CRM deve apenas apontar para o que já existe no paciente.

9. Contato pelas etapas

Hoje existem botões de WhatsApp e Instagram, e o Motor possui os modelos de mensagem. Porém, ainda não existe uma tela dentro do CRM para:

- Escolher um modelo.
- Personalizar a mensagem.
- Enviar ou abrir o canal.
- Registrar automaticamente qual mensagem foi usada.

### 🔴 Funcionalidades que realmente não existem

- Formulário público de captação de leads.
- Incorporação do formulário em site ou landing page.
- API pública específica para receber leads.
- Várias oportunidades comerciais para o mesmo paciente.
- Várias tarefas para uma mesma oportunidade.
- Lista central de todas as tarefas comerciais.
- Exibição das tarefas comerciais na Agenda.
- Previsão de fechamento da negociação.
- Valor estimado da oportunidade.
- Orçamentos e propostas ligados ao interessado.
- Exportação do CRM em CSV ou Excel.
- Gatilho de palavras-chave recebidas no WhatsApp.
- Kanban comercial com arrastar e soltar.
- Vários funis personalizados.
- Etiquetas próprias do CRM.
- Registro estruturado do resultado de uma tarefa.
- Criação de um novo interesse diretamente no perfil do paciente.

## O que eu não recomendo copiar

### ⚪ Vários funis agora

A clínica ainda não precisa de diversos funis configuráveis. Isso aumentaria a complexidade sem resolver o principal problema. Um único fluxo automático baseado na Agenda é mais confiável.

No futuro, pode haver fluxos específicos, como:

- Interessados em procedimentos.
- Venda de pacotes.
- Reativação de pacientes.
- Parcerias.

Mas apenas quando houver volume suficiente para justificar.

### ⚪ Movimentação manual em Kanban

Arrastar cartões manualmente faria o CRM perder a principal qualidade que construímos. O estado “Agendado” deve vir da Agenda, não da opinião de quem está usando o CRM.

O Kanban pode existir somente como visualização. A movimentação das etapas automáticas deve continuar bloqueada.

### ⚪ Preencher prioridade manualmente

O PAIEMAE já consegue calcular prioridade usando:

- Tempo sem resposta.
- Proximidade do agendamento.
- Cancelamento.
- Falta.
- Atraso da próxima ação.
- Histórico do paciente.

Isso é melhor do que pedir para uma pessoa escolher “baixa, média ou alta”.

### ⚪ Inbox completo do WhatsApp dentro do sistema

Com a infraestrutura atual da Evolution e a limitação da VPS, não recomendo copiar o inbox do CliniCRM agora. Ainda é possível receber eventos do WhatsApp e criar interessados sem armazenar toda a conversa dentro do PAIEMAE.

### ⚪ Financeiro e comissões dentro do CRM

O vídeo de apresentação mostra caixa, comissão e outras áreas financeiras, mas isso não pertence obrigatoriamente ao CRM. O PAIEMAE já possui Relatórios, Central de Saúde Financeira e Franquia. O CRM deve consumir o resultado financeiro, e não duplicar esses módulos.

## O que eu faria primeiro

Minha ordem recomendada seria:

1. Impedir interessados duplicados pelo telefone.
2. Criar várias tarefas comerciais por interessado, mantendo a próxima ação automática.
3. Criar uma central “Tarefas de hoje”, com atrasadas, hoje e futuras.
4. Permitir visualizar essas tarefas na Agenda por meio de um botão opcional.
5. Criar “Registrar novo interesse” dentro do perfil do paciente.
6. Criar formulário público conectado ao CRM, com UTMs, origem e prevenção de duplicidade.
7. Registrar resultado da tarefa: respondeu, não respondeu, pediu retorno, não tem interesse etc.
8. Adicionar exportação CSV/Excel.
9. Somente depois avaliar a separação definitiva entre pessoa e oportunidade.
10. Deixar propostas, valores estimados, múltiplos funis e WhatsApp por palavra-chave para uma fase posterior.

A funcionalidade de maior impacto que falta não é o Kanban: é uma central automática de tarefas comerciais. Ela permitiria saber exatamente quem precisa ser chamado hoje sem depender de alguém lembrar, mantendo a Agenda e o Motor como fontes automáticas.

Nenhum arquivo foi alterado e nenhum commit ou push foi feito nesta análise.

