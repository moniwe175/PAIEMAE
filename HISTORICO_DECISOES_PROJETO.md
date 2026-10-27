# Histórico de decisões do projeto PAIEMAE

> Registro estruturado da conversa com o Codex.
> Atualizado em 27/10/2026.
> Este documento preserva decisões, restrições, ideias, problemas relatados e próximos passos. Ele não é uma transcrição literal de todas as mensagens do chat.

## 1. Objetivo do projeto

Construir um sistema simples de operar, mas completo para a gestão de uma clínica de estética. O sistema precisa reduzir trabalho manual, organizar a operação, conectar Agenda, pacientes, CRM, marketing, pacotes, documentos e dados financeiros e, no futuro, permitir avaliar se o negócio é saudável e replicável como franquia.

O projeto não deve copiar outros sistemas indiscriminadamente. As funcionalidades observadas em Clínica Experts, Kommo, Utmify e outros produtos servem como referência. Só devem ser incorporadas quando fizerem sentido para a realidade da clínica.

## 2. Princípios que não devem ser esquecidos

1. O CRM deve exigir o mínimo possível de preenchimento manual.
2. A Agenda é a principal fonte de verdade para agendamentos, comparecimento, faltas, cancelamentos e atendimentos finalizados.
3. Enquanto não houver pagamento integrado, um atendimento `finalizado` pode ser usado como indicação provisória de atendimento realizado/pago, mas isso não substitui dados financeiros reais.
4. O sistema não deve inventar receita, custos, lucros ou conversões quando os dados não existirem. Deve mostrar `Pendente`, `Não informado` ou explicar a limitação.
5. Não alterar a lógica existente do Motor de Marketing sem autorização. É permitido adicionar funcionalidades ao redor dele, preservando o que já funciona.
6. O WhatsApp está conectado pela Evolution API usando QR Code. Não há inbox dentro do PAIEMAE porque a infraestrutura/VPS atual não comporta essa operação.
7. O Instagram usa API oficial.
8. Evitar criar muitas telas. As funcionalidades devem ser agrupadas de forma lógica e fácil de entender.
9. Processos automáticos devem ter prioridade sobre tarefas manuais.
10. Alterações estruturais importantes precisam ser discutidas antes de serem feitas.

## 3. CRM e interessados

### Intenção principal

O CRM deve dizer automaticamente:

- Quem precisa ser chamado hoje.
- Quem ainda não respondeu.
- Quem agendou.
- Quem foi atendido.
- Quem faltou ou cancelou.
- Quem precisa de tentativa de recuperação.
- Qual canal trouxe o interessado.
- Qual interessado virou agendamento e atendimento.

### Lógica acordada

- O telefone normalizado liga interessado, cliente e agendamento.
- A Agenda atualiza automaticamente a situação comercial.
- Agendamento ativo leva o interessado para `Agendado`.
- Atendimento finalizado leva para `Atendido/Ganho`.
- Falta, cancelamento ou longo período sem agendar podem levar para recuperação ou perda, conforme as regras.
- A vinculação manual deve existir apenas como correção de exceção.
- A Inteligência Comercial lê os resultados do CRM e da Agenda; ela não deve depender de alguém preencher qualificações manualmente.

### Estrutura existente observada

- Estados armazenados: aguardando resposta, aguardando cliente, retorno agendado, agendado, ganho e perdido.
- Interface simplificada em Responder, Agendados, Atendidos e Perdidos.
- Histórico de interações.
- Próxima ação, responsável, prazo e conclusão.
- Vínculo com cliente e agendamento.
- Indicadores de conversão por origem, responsável e procedimento.
- Recomendações operacionais baseadas na jornada.
- Integração com Agenda, Marketing e Motor.

### Lacunas importantes identificadas

- Prevenção de duplicidade antes de cadastrar um interessado.
- Várias tarefas comerciais para o mesmo interessado.
- Uma central de tarefas comerciais de hoje, atrasadas e futuras.
- Resultado estruturado de cada tarefa: respondeu, não respondeu, pediu retorno, sem interesse etc.
- Visualização opcional das tarefas comerciais na Agenda.
- Formulário público de captação conectado ao CRM, com UTMs e origem.
- Exportação de dados do CRM em CSV/Excel.
- Registro de um novo interesse diretamente no perfil de um paciente.
- Possibilidade futura de separar pessoa/contato de oportunidade comercial, permitindo mais de um interesse simultâneo por pessoa.

### O que não deve ser copiado automaticamente

- Kanban manual em que a recepção precisa arrastar o interessado para informar que ele agendou ou foi atendido.
- Prioridade preenchida manualmente quando ela pode ser calculada pelo sistema.
- Diversos funis configuráveis sem uma necessidade operacional real.
- Campos de qualificação que ninguém manterá atualizados.
- Inbox completo de WhatsApp na infraestrutura atual.

## 4. Comparação completa com o CliniCRM

Fonte principal:

- https://clinicaexperts.notion.site/CliniCRM-3e5916fa848543d0b04b89225626d8e2

Foram analisadas 12 páginas: um vídeo de apresentação hospedado no Notion, dez vídeos do YouTube e uma página explicativa sem vídeo.

### Conteúdo analisado

1. Apresentação geral: painel, funil, ranking, oportunidades, tarefas, exportação, histórico, documentos, caixa e comissões.
2. Configurações: funis, etapas, ganho/perda, estagnação, movimentação e duplicidade.
3. Criação de oportunidades: cliente, vendedor, origem, valor, prioridade, previsão e observações.
4. Oportunidades no perfil do contato.
5. Tarefas ligadas às oportunidades.
6. Criação automática pelo WhatsApp usando palavras-chave.
7. Cadastro completo de leads/contatos.
8. Múltiplos funis e visualização Kanban/lista.
9. Gatilhos de comunicação ao entrar em determinadas etapas.
10. Formulário público para captação de leads.
11. Previsão de fechamento e prazos.
12. Tarefas do CRM exibidas na Agenda.

### Classificação da comparação

#### Verde — o PAIEMAE já possui

- Funil conectado à Agenda.
- Etapas automáticas.
- Conversão entre interessado, agendamento e atendimento.
- Histórico comercial.
- Origem e atribuição de campanhas/UTMs.
- Responsável e próxima ação.
- Alertas de atraso e falta de ação.
- Indicadores por origem, responsável e procedimento.
- Motivos automáticos de perda.
- Contato rápido por WhatsApp e Instagram.
- Motor de Marketing.
- Automação oficial do Instagram encaminhando para o CRM.
- Verificação de qualidade dos dados.

#### Amarelo — existe parcialmente

- Tarefas: existe somente uma próxima ação por interessado.
- Agenda comercial: as próximas ações ainda não são eventos comerciais exibidos na Agenda.
- Motivos de ganho/perda: existem, mas não como catálogo controlado e auditável.
- Duplicidade: pode ser detectada, mas deveria ser impedida/alertada antes do cadastro.
- Filtros: existem, mas faltam filtros comerciais mais ricos.
- Ranking por responsável: há dados de conversão, mas não uma apresentação direta como ranking.
- Documentos: existem no paciente, mas não são específicos de uma oportunidade.
- Contato pelas etapas: existem atalhos e modelos no Motor, mas não uma ação guiada dentro do CRM.
- Pessoa e oportunidade ainda são representadas pelo mesmo registro.

#### Vermelho — não existe

- Formulário público de captação.
- API/iframe específico para receber leads.
- Várias oportunidades por pessoa.
- Várias tarefas por oportunidade.
- Central geral de tarefas comerciais.
- Tarefas comerciais na Agenda.
- Previsão de fechamento.
- Valor estimado e proposta/orçamento da oportunidade.
- Exportação do CRM.
- Gatilho de palavras-chave recebidas no WhatsApp.
- Etiquetas próprias do CRM.
- Resultado estruturado de tarefas.
- Criação de novo interesse dentro do perfil do paciente.

### Ordem recomendada para futuras melhorias do CRM

1. Prevenir duplicidades.
2. Criar várias tarefas comerciais e uma central de tarefas.
3. Exibir tarefas na Agenda por meio de uma camada opcional.
4. Criar `Registrar novo interesse` dentro do paciente.
5. Criar formulário público com UTM e deduplicação.
6. Registrar o resultado das tarefas.
7. Adicionar exportação.
8. Avaliar separação entre contato e oportunidade.
9. Somente depois avaliar valores estimados, propostas e múltiplos funis.

## 5. Motor de Marketing e comunicação

- O Motor contém regras e modelos de follow-up.
- A lógica existente não deve ser alterada sem discussão prévia.
- O CRM pode consumir ou disparar ações do Motor, mas não deve recriar o Motor dentro da tela de interessados.
- WhatsApp e Instagram podem gerar registros no CRM sem que seja necessário armazenar toda a conversa no sistema.
- A automação deve respeitar opt-out, limites de envio e evitar mensagens duplicadas.
- Modelos observados no Clínica Experts incluem aniversário, boas-vindas, retorno, lembrete de agendamento, confirmação, cancelamento, pré-atendimento, pós-procedimento e recuperação de inativos. Nem todos precisam ser copiados porque parte disso já está coberta pelo Motor.

## 6. Marketing, campanhas e atribuição

- Campanhas de Meta Ads e Google Ads podem ser organizadas dentro de Marketing.
- O PAIEMAE não deve prometer ser igual à Utmify sem integrações e validação equivalentes.
- UTMs e links rastreáveis podem identificar a origem de leads.
- Atribuição correta depende da continuidade entre clique, lead, telefone, cliente, agendamento e receita.
- Sem integração financeira, ROAS e receita atribuída são provisórios quando baseados apenas na Agenda.
- A aba Inteligência fica no Marketing porque cruza aquisição, campanhas, públicos, leads e resultados. O CRM executa o atendimento comercial; a Inteligência analisa os resultados dos canais.

## 7. Lousa de ideias e planejamento

- A Lousa Digital deve servir como espaço visual semelhante ao Miro.
- Ideias podem ser conectadas a planejamento, conteúdo, tarefas, campanha e execução real.
- Foi discutida uma estratégia de parcerias como canal de aquisição.
- O banco apresentou uma restrição de canal ao tentar salvar `Parceria`, indicando necessidade de alinhar os valores aceitos pelo banco e pela interface.
- A lousa precisa permitir visualizar a ideia e transformá-la em execução mensurável, sem se tornar apenas um mural de textos.

## 8. Agenda

- Indicadores gerenciais pesados não devem ocupar o topo da Agenda operacional.
- A Agenda deve priorizar o trabalho do dia.
- Indicadores de gestão devem ficar em Relatórios, desde que tenham cálculos reais e úteis.
- A Lista de Espera deve abrir fechada por padrão.
- A Lista de Espera é por dia e deve registrar o horário desejado.
- Somente pacientes já cadastrados devem entrar na Lista de Espera.
- A Lista de Espera deve ficar em uma coluna lateral que abre e fecha.

### Problemas relatados durante a conversa que precisam ser verificados no estado atual

- Agendamento falhando com erro PostgreSQL `operator does not exist: text = date`.
- Pesquisa de paciente mostrando nomes sem relação com o texto digitado.
- Marcações da Agenda desaparecendo após F5 e reaparecendo depois de clicar na tela.
- Lista de Espera iniciando aberta.
- Excesso ou exibição indesejada de informações de horário em determinados pontos.

Alguns desses problemas podem já ter sido corrigidos em alterações posteriores. Sempre verificar antes de refazer.

## 9. Pacientes e fidelização

- Métricas devem ser calculadas apenas com histórico suficiente.
- Origem dos clientes não pode assumir que todos vieram do Instagram.
- Clientes sem origem devem aparecer como `Não informado`.
- Não é necessário recadastrar todos os pacientes do zero; a origem histórica pode permanecer desconhecida e passar a ser capturada corretamente para novos clientes.
- O gráfico de origem foi percebido como pesado e precisa de implementação otimizada.
- A página ficou lenta e deve ser analisada considerando consultas, quantidade de pacientes, processamento no navegador e renderização de gráficos.

### Métricas questionadas

- `Tempo médio entre visitas` só faz sentido para clientes com pelo menos duas visitas.
- `Taxa de indicação` só é confiável quando a origem foi preenchida corretamente.
- Métricas melhores discutidas incluem clientes recorrentes, clientes recuperados, risco de retorno e frequência de recompra.

## 10. Pacotes e assinaturas de sessões

### Decisões

- Deve existir uma área própria de Assinaturas, sem obrigar o usuário a entrar em Pacientes.
- A lista inicial deve mostrar somente pacientes que possuem pacotes.
- Ao abrir o paciente, devem aparecer as sessões do pacote em uma estrutura visual numerada.
- Cada serviço do pacote deve aparecer organizado em coluna, com sessões numeradas nas linhas.
- Uma sessão finalizada deve ficar disponível para assinatura quando estiver corretamente ligada ao pacote.
- A área de assinatura precisa ser visualmente maior e consistente com o restante do sistema.
- Ao clicar em `Disponível`, deve abrir um visualizador/modal para assinatura.

### Regra de repasse

- A identificação de sessão de pacote deve usar o `repasse` da planilha como sinal mais confiável.
- Cada linha marcada como repasse representa uma sessão realizada de pacote.
- Não consumir sessão apenas porque o agendamento foi finalizado; o repasse é a confirmação desejada.

### Seleção na Agenda

- O agendamento deve selecionar apenas o serviço/procedimento.
- Se o paciente possuir pacote ativo compatível, o sistema identifica automaticamente.
- O usuário não deve escolher separadamente `pacote` e `serviço` para o mesmo atendimento.

## 11. Comanda digital

### Objetivo

Substituir a comanda de papel por uma comanda digital parecida com o modelo físico já usado pela clínica.

### Estrutura desejada

- Número/ID da comanda.
- Cliente.
- Data marcada.
- Telefone.
- Profissional.
- Lista de procedimentos/áreas com caixas de seleção.
- Observações.
- Forma de pagamento.
- Total.
- Comprovante/resumo visual semelhante à via destacável da comanda física.

### Regras importantes

- Os serviços devem vir do catálogo atual do sistema, e não de uma lista antiga fixa do papel.
- Uma comanda pode ter vários itens/procedimentos separados.
- Cada item deve continuar separado para rankings, quantidade vendida, faturamento e rentabilidade.
- Não armazenar `Botox, axila, virilha, sobrancelha` como se fosse um único serviço.
- A planilha pode receber o ID da comanda e os itens separados conforme a integração definida.

## 12. Documentos e consentimentos

Documentos desejados:

- Termo de consentimento do procedimento.
- Autorização de uso de imagem.
- Termo de responsabilidade.
- Contrato de prestação de serviço.

Planos de tratamento e termos específicos de procedimentos já fazem parte da lógica de anamnese e não devem ser duplicados sem necessidade.

### Regras

- Deve ser possível excluir um documento criado por engano quando ele ainda não tiver validade jurídica/assinatura.
- `Revogado` significa que o documento existiu e foi invalidado, preservando o histórico.
- Documento revogado não deve simplesmente desaparecer quando houver necessidade de auditoria.

## 13. Financeiro, Relatórios e Franquia

### Motivo da estrutura de franquia

A clínica ainda não é uma franquia. A área foi pensada para medir se a unidade atual é sustentável, lucrativa e replicável antes de oferecer uma franquia a terceiros.

### Informações necessárias

- Receita bruta.
- Deduções, descontos e estornos.
- Impostos sobre vendas.
- Taxas de cartão.
- Comissões.
- Custos diretos por procedimento.
- Materiais e produtos consumidos.
- Folha, encargos e pró-labore.
- Aluguel, energia, água, internet e sistemas.
- Marketing.
- Despesas administrativas e financeiras.
- Investimentos e depreciação quando aplicável.
- Saldo bancário.
- Contas a pagar.
- Eventuais contas a receber.
- Retiradas e aportes dos sócios.

### Métricas essenciais

- Receita líquida.
- Margem de contribuição.
- Lucro bruto.
- EBITDA.
- Lucro líquido.
- Ponto de equilíbrio.
- Geração de caixa.
- Fluxo de caixa projetado.
- Reserva em meses.
- Ticket médio.
- CAC.
- LTV com margem.
- Relação LTV/CAC.
- Retenção e recompra.
- Rentabilidade por serviço.
- Ocupação real.
- Produtividade por profissional.
- Inadimplência, se houver vendas a prazo.

### Metas iniciais discutidas

- Margem de contribuição igual ou superior a 40%.
- EBITDA igual ou superior a 15%.
- Margem líquida igual ou superior a 10%.
- Reserva de caixa de pelo menos três meses.
- Relação LTV/CAC inicial de pelo menos 3x.

Essas são referências iniciais e precisam ser ajustadas ao histórico real da clínica.

### DRE

A estrutura esperada inclui:

1. Receita operacional bruta.
2. Deduções da receita.
3. Receita líquida.
4. Custos dos serviços/produtos vendidos.
5. Lucro bruto.
6. Despesas comerciais.
7. Despesas administrativas.
8. Resultado operacional.
9. Receitas e despesas financeiras.
10. Receitas/despesas não operacionais.
11. Impostos sobre o lucro.
12. Lucro ou prejuízo do período.

### Contas a pagar e receber

- Pró-labore é uma saída financeira e deve aparecer como despesa/retirada conforme a modelagem contábil escolhida.
- Aluguel, fornecedores e contas recorrentes pertencem a contas a pagar.
- Contas a receber podem ser simples se a clínica recebe tudo no mesmo dia, mas continuam relevantes quando houver cartão com prazo, parcelamento, pacotes parcelados ou valores pendentes.
- Fluxo de caixa e extrato de movimentações não são exatamente a mesma coisa: o extrato registra cada entrada/saída; o fluxo consolida e projeta o caixa.

### Limitação sem financeiro integrado

Sem alimentação financeira, o sistema deixa de saber com segurança:

- Lucro real.
- Ponto de equilíbrio.
- Caixa disponível.
- Necessidade de capital.
- Custos por serviço.
- Rentabilidade por profissional.
- EBITDA e margem líquida.
- CAC e LTV completos.
- ROAS real.
- Capacidade de contratar ou investir.
- Sustentabilidade de uma futura franquia.

## 14. Cuidados com cálculos e indicadores

- Crescimento percentual não deve ser calculado de forma normal quando o período anterior é zero ou quase zero.
- Exibir `+844.300%` comparando R$ 8.444 com R$ 1 é matematicamente possível, mas gerencialmente enganoso.
- Nesses casos, mostrar `Sem base comparável`, `Período anterior sem faturamento relevante` ou a diferença absoluta.
- Taxa de ocupação precisa usar horários realmente disponíveis, não uma capacidade teórica inflada.
- Tempo médio de atendimento precisa vir da duração real ou do serviço cadastrado, com indicação da fonte.
- Receita atribuída precisa distinguir dado real de estimativa.

## 15. Edição de vídeo para Marketing

Objetivo discutido:

- Reduzir o trabalho de edição pelo navegador.
- Detectar e remover pausas.
- Gerar legendas.
- Possibilitar B-roll.
- Usar vídeos de referência para entender o estilo dos Reels.
- Retirar a função de zoom automático que não agradou.

Vídeos de referência foram informados na pasta Downloads. Antes de avançar, é necessário definir o processamento no navegador/servidor, os limites de tamanho e a infraestrutura disponível.

## 16. Próximos passos gerais preservados

### Prioridade operacional

1. Garantir que Agenda, busca de pacientes e persistência dos agendamentos estejam estáveis.
2. Garantir que sessões de pacote e assinaturas usem corretamente a regra de repasse.
3. Consolidar a comanda digital com itens separados.
4. Melhorar performance da página de Pacientes.
5. Evoluir o CRM com deduplicação e central de tarefas automáticas.

### Prioridade gerencial

1. Alimentar dados financeiros reais por planilha.
2. Validar DRE, caixa e ponto de equilíbrio.
3. Medir rentabilidade por serviço.
4. Definir metas de negócio saudável com base no histórico.
5. Somente depois avaliar viabilidade real de franquia.

## 17. Observação para retomadas futuras

Antes de implementar uma funcionalidade descrita neste documento:

1. Verificar se ela já foi criada no código atual.
2. Verificar se a migração correspondente já foi executada no Supabase.
3. Conferir se há alterações locais ainda não commitadas.
4. Rodar os testes relacionados.
5. Não alterar o Motor de Marketing sem autorização expressa.
6. Explicar ao usuário quando uma informação for estimada, provisória ou depender de dados financeiros ausentes.

