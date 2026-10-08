# PAIEMAE — Lousa de ideias com aprovação e execução

Versão 1.0 — 08/10/2026  
Especificação para implementação pelo Antigravity

## 1. Pedido do usuário e resultado esperado

Substituir a apresentação atual de **Marketing → Ideias e Planejamento** por uma **lousa digital simples, inspirada no uso do Miro**. A lousa será a tela principal dessa sub-aba.

O usuário não gostou dos quatro contadores grandes e da tela vazia mostrada na captura. Quer colocar ideias no espaço, fazer anotações, ligá-las com setas e enxergar se cada ideia foi aprovada e se está em execução.

Esta especificação substitui a exigência anterior de Lista/Quadro como apresentação principal. Preserva os requisitos funcionais de `PAIEMAE_IDEIAS_PLANEJAMENTO_MARKETING.md`: ficha completa, tarefas, histórico, arquivamento, duplicação, persistência e vínculo com campanhas. Não implementar dois módulos concorrentes.

**Exemplo visível em um cartão:**

> Live da Evelyn — Botox sem mistério  
> Aprovação: Aprovada  
> Etapa: Em execução  
> Responsável: a definir · Data: a definir  
> Abrir ficha

Aprovação e execução são informações separadas. Uma ideia aprovada pode ainda estar em planejamento; concluir a execução não apaga o registro de aprovação.

Esta é uma especificação. Não representa código implementado, migração aplicada ou deploy concluído.

## 2. Restrição obrigatória: preservar o Instagram

**Não alterar nada da API ou da automação do Instagram.**

Não modificar `api/instagram.js`, `api/instagram-webhook.js`, `src/services/instagramService.js`, componentes específicos do Instagram, testes dessa integração ou `instagram_marketing_migration.sql`. Não alterar tabelas `instagram_*`, Insights, endpoints, regras, DM, resposta pública, webhook, deduplicação, credenciais, permissões Meta, variáveis de ambiente ou configuração da Vercel.

Em `Marketing.jsx`, limitar o diff à apresentação de Ideias e Planejamento e ao carregamento dos seus componentes. Preservar os blocos e chamadas das outras sub-abas.

As setas da lousa representam o raciocínio da equipe. **Não disparam automações, não enviam mensagens, não publicam conteúdo e não ativam campanhas ou anúncios.**

Não fazer chamadas reais à Meta durante desenvolvimento e testes. Não executar uma suíte ampla sem antes confirmar que ela usa apenas mocks para integrações externas e não escreve no banco de produção. Verificar a preservação do Instagram pelo diff e por build/verificações locais sem efeitos externos.

## 3. Inspecionar o estado local antes de implementar

A primeira migração de ideias já foi executada pelo usuário no Supabase. Tratar os registros e tabelas existentes como dados a preservar.

O Antigravity relatou correções posteriores, incluindo `marketing_ideas_migration_v2.sql`, serviço dedicado, ficha completa e RPCs transacionais de campanhas. Esse relato não substitui a leitura dos arquivos reais.

Na consulta de 08/10/2026, `main` no GitHub ainda apontava para `4254bd0b9597c653d1842bb1dc698b1f26d3e1ff`. O `package.json` dessa versão usa React 18.2 e ainda não declara `@xyflow/react`. Mudanças adicionais podem existir no workspace local.

Antes de editar:

1. Conferir `git status`, histórico recente e arquivos locais de ideias.
2. Ler a implementação atual de ideias, tarefas, histórico, campanhas e permissões.
3. Confirmar o esquema real das tabelas envolvidas por consultas somente de leitura, sem listar contatos/pacientes desnecessariamente.
4. Identificar quais migrações já foram aplicadas.
5. Reaproveitar e corrigir o trabalho existente; preparar migração incremental para o que faltar.

Não reaplicar o SQL antigo supondo que `CREATE TABLE IF NOT EXISTS` atualizará colunas, defaults e constraints de tabelas existentes. Não apagar tabelas, recriar campanhas, anular IDs ou converter dados com `USING NULL`.

## 4. Apresentação principal

### Layout

- Manter as sub-abas existentes de Marketing.
- Ao abrir Ideias e Planejamento, mostrar a lousa por padrão.
- Retirar os quatro grandes cards de indicadores dessa apresentação.
- Usar fundo claro com grade discreta, cartões legíveis e cores compatíveis com o ERP.
- Dar a maior parte da área útil à lousa.
- Usar barra compacta com **Nova ideia**, **Post-it**, **Texto**, **Conectar** e **Buscar/filtrar**.
- Manter seleção/movimentação como modo padrão.
- Colocar zoom, ajuste à tela e desfazer em controles pequenos.
- Oferecer **Lista** como apresentação secundária dos mesmos registros, útil para teclado e celular. Não criar outra sub-aba ou menu lateral para a mesma função.

Não impor colunas de Kanban à lousa. O usuário organiza os elementos livremente. Etapas e aprovação aparecem nos cartões, independentemente da posição.

### Primeira abertura e ideias já existentes

Todas as ideias ativas existentes devem aparecer como cartões. Se ainda não tiverem posição salva, distribuí-las de forma previsível, sem sobreposição, e persistir esse posicionamento. Não criar cópias dos registros a cada abertura.

Sem ideias cadastradas, mostrar uma instrução curta dentro da lousa: **“Adicione uma ideia ou um post-it para começar.”** Oferecer Nova ideia e Usar modelo de Live, sem inserir dados de demonstração automaticamente.

Carregamento, vazio, filtro sem resultado, migração ausente, erro de consulta e falta de permissão são estados distintos. Erro de API nunca deve virar “nenhuma ideia”.

## 5. Elementos da lousa

| Elemento | Comportamento | Relação com o ERP |
|---|---|---|
| Cartão de ideia | Título, selos, resumo opcional, responsável/data e Abrir ficha | Referencia uma ideia real por ID |
| Post-it livre | Texto editável e poucas opções de cor | Anotação interna; não cria campanha nem ideia por si só |
| Texto | Título ou explicação solta no espaço | Organização visual |
| Seta | Liga dois elementos existentes | Ligação visual sem automação |

Permitir criar, selecionar, mover e remover anotações/setas. Editar texto com clique ou ação explícita; arrastar o elemento não pode selecionar involuntariamente seu texto.

Usar um conjunto pequeno de cores. Não incluir biblioteca extensa de figuras, arquivos pesados, vídeos, desenho livre, IA ou colaboração em tempo real nesta primeira entrega.

### Cartão de ideia

Mostrar sempre:

- Título.
- Selo de aprovação com texto e ícone.
- Selo de etapa com texto e ícone.
- Abrir ficha.

Mostrar responsável, data e campanha vinculada quando existirem. Não obrigar esses campos para capturar uma ideia.

Ao abrir a ficha, carregar o mesmo registro usado na lista e na lousa. Tarefas, roteiro e planejamento detalhado ficam na ficha; não ocupar cada cartão com o formulário inteiro.

Mudar a cor de um post-it ou arrastar um cartão não altera a aprovação ou etapa.

## 6. Aprovação e execução separadas

### Aprovação

Na primeira versão, usar duas situações:

| Situação | Significado |
|---|---|
| Pendente de aprovação | A equipe ainda não aprovou a proposta |
| Aprovada | Um usuário autorizado aprovou explicitamente |

Novas ideias começam pendentes. Botão **Aprovar ideia** registra autor e data reais do servidor e acrescenta evento ao histórico. Usuário com edição de Marketing pode aprovar; consulta somente leitura não pode.

Oferecer **Retirar aprovação**, com confirmação e motivo curto. Preservar o evento da aprovação anterior. Se a ação já estiver em execução ou concluída, impedir a retirada até que a etapa seja corrigida explicitamente e registrada no histórico.

Aprovar não agenda, não executa, não cria campanha e não publica nada.

Edições comuns não retiram aprovação silenciosamente. Exibir a data da aprovação na ficha; se a equipe quiser revisar a decisão após mudanças, usar a ação explícita de retirada.

### Etapa de execução

A interface deve apresentar estas etapas:

| Etapa | Uso |
|---|---|
| Ideia | Proposta capturada |
| Em planejamento | Preparação e organização |
| Agendada | Ação definida com responsável e data |
| Em execução | A equipe iniciou a execução |
| Concluída | A ação aconteceu e foi concluída |

Adaptar os valores técnicos ao contrato real do serviço e do banco. Se já houver `planejando`, `em_execucao`, `concluida` ou `executada`, documentar um mapeamento único; não renomear dados às cegas.

Preservar as validações da especificação anterior: responsável/data/objetivo/canal para agendar e confirmação/data real para concluir. Permitir salvar a ideia incompleta enquanto estiver em elaboração.

Para novas transições a Agendada, Em execução ou Concluída, exigir aprovação. O backend deve validar, além do formulário. Não usar posição, seta, passagem de tempo ou status da campanha como evidência de aprovação/execução.

**Registros antigos:** não atribuir aprovação automaticamente e não rebaixar etapas existentes. Preservar a etapa e mostrar Pendente de aprovação quando a decisão não estiver registrada. A equipe pode confirmar a aprovação; não inventar autor nem data histórica.

Arquivamento permanece separado do planejamento. Preservar registros antigos que o modelavam como status e migrar somente após verificar como recuperar a etapa anterior. Uma ideia arquivada continua acessível pelo filtro e mantém histórico/campanha.

### Sinalização

| Exemplo | Selos visíveis |
|---|---|
| Proposta ainda em elaboração | Pendente de aprovação · Em planejamento |
| Aprovada, esperando a data | Aprovada · Agendada |
| Trabalho iniciado | Aprovada · Em execução |
| Ação realizada | Aprovada · Concluída |

Usar texto e ícone, além de cor. Destacar execução com azul e aprovação com verde, mantendo contraste. Não transformar toda ideia aprovada em um cartão verde que esconda as outras informações.

## 7. Ficha, histórico e campanhas

Preservar a ficha completa: descrição, formato, serviço/tema, objetivo, público/região, canais planejados, destino/CTA, orçamento estimado, roteiro, participantes, materiais, responsável, datas, tarefas e aprendizados.

Registrar criação, aprovação/retirada, mudanças de etapa, alterações relevantes e vínculos com campanha com autor/data e valores anteriores/novos. Não reescrever eventos históricos para apagar decisões.

Manter:

- Criar, editar e duplicar ideia.
- Arquivar e restaurar.
- Criar/editar/concluir tarefas.
- Vincular campanha existente.
- Transformar em campanha de rascunho.
- Abrir a campanha vinculada e ver suas ideias.

A conversão em campanha deve continuar transacional e idempotente: duplo clique, chamada repetida ou duas sessões simultâneas não podem gerar duas campanhas para a mesma ideia. Se falhar o vínculo, não deixar campanha órfã.

A etapa da ideia, a aprovação e o status da campanha são campos independentes. Converter em rascunho não aprova a ideia. Proteger exclusão de campanha vinculada e manter histórico de desvinculação.

Ao duplicar, criar uma ideia pendente, na etapa Ideia, sem campanha, data real ou tarefas concluídas. Posicionar seu cartão próximo ao original sem sobreposição.

## 8. Remover, arquivar e desfazer

**Remover um post-it, texto ou seta** é uma ação visual. Pode ser desfeita.

**Uma ideia de negócio é arquivada, não apagada pelo Delete do canvas.** Selecionar um cartão e pedir sua remoção deve explicar que o registro será arquivado e preservado. Cancelar não altera nada. Não permitir que o cartão desapareça enquanto o registro continua ativo e inacessível.

Restaurar uma ideia arquivada devolve o cartão com posição anterior ou outra posição livre.

**Desfazer** cobre ações visuais locais: mover, criar/remover anotação e conectar/desconectar. Aprovação, etapa, campanha e arquivamento usam suas ações explícitas e histórico, sem reversão silenciosa por Ctrl+Z.

Não interceptar atalhos de digitação quando o foco estiver em campo de texto. Em caso de edição concorrente, invalidar os passos de desfazer afetados após recarregar a versão remota.

## 9. Persistência e consistência

### Separar dados do negócio e layout

A tabela de ideias continua sendo a fonte da aprovação, etapa, título, responsável e campanha. Não copiar esses campos como uma segunda versão dentro do JSON da lousa.

Proposta adaptável após inspeção do esquema:

- **Ideia:** situação da aprovação, quem aprovou, quando aprovou; etapa existente ampliada quando necessário; demais dados atuais.
- **Histórico:** eventos de aprovação e execução com a autoria real.
- **Lousa compartilhada:** um registro por contexto autorizado da clínica, versão, quem alterou e quando.
- **Layout:** posições dos cartões referenciando `idea_id`; texto/cor/posição de anotações; setas referenciando elementos.

O layout pode ser um JSON validado dentro da lousa ou uma estrutura normalizada. Para a primeira versão pequena, escolher uma solução única e documentar os limites de tamanho/quantidade, sem criar um sistema complexo de documentos.

Selos são calculados a partir da ideia real. Uma edição na ficha deve atualizar o cartão e a lista sem uma segunda gravação manual.

A criação de uma ideia deve resultar em ficha e cartão acessíveis. Se salvar o posicionamento falhar depois da ideia, preservar o registro, mostrar o erro e recuperá-lo na próxima carga; não repetir a criação do negócio.

### Salvamento

- Salvar posição ao terminar o arraste, não em cada movimento do ponteiro.
- Agrupar mudanças de texto com debounce e descarregar a última alteração ao sair do campo.
- Mostrar **Alterações pendentes**, **Salvando**, **Salvo** ou **Falha ao salvar**.
- Só apresentar Salvo após confirmação do banco.
- Preservar edição local quando houver erro e permitir tentar novamente.
- Avisar ao sair com alterações pendentes; não depender apenas de uma requisição no fechamento da página.
- localStorage pode guardar recuperação temporária, mas não é a persistência definitiva.

### Concorrência simples

Esta versão não precisa editar simultaneamente como o Miro. Precisa evitar perda silenciosa quando duas pessoas abrirem a mesma lousa.

Salvar com versão esperada, verificada atomicamente no servidor. Se a versão mudou, recusar a gravação antiga, preservar o trabalho local e oferecer recarregar/comparar antes de reaplicar. Não substituir o estado remoto inteiro com uma cópia desatualizada.

Aprovação e etapa também devem ter operações consistentes com histórico. Autor/data vêm da sessão e do servidor, sem aceitar autoria arbitrária enviada pelo navegador.

### Permissões

Reutilizar `marketing.ver` para leitura e `marketing.edit` para alterações, seguindo a precedência real de cargos/perfil e administrador.

A lousa é compartilhada pela equipe autorizada da clínica. Autoria não significa propriedade exclusiva. Se o projeto tiver separação por organização, aplicar o contexto real; não inventar isolamento por criador nem acesso global entre clínicas.

Habilitar RLS e grants coerentes nas novas tabelas expostas. Aprovação, etapa e gravação com versão precisam validar autorização no banco/backend. Perfis somente leitura podem navegar/consultar, sem salvar mutações.

## 10. Implementação enxuta

A base recomendada é **React Flow (`@xyflow/react`)**, com nós próprios para cartões/post-its/textos e conexões visuais. Verificar a versão estável e compatibilidade com o React real do projeto antes de instalar; fixar versão e atualizar lockfile.

Não embutir o site do Miro nem exigir serviço externo, licença Pro ou modelos pagos.

- Criar componentes próprios da lousa dentro de Marketing.
- Manter o serviço de ideias dedicado.
- Carregar a lousa sob demanda ao abrir a sub-aba, evitando incluí-la no carregamento inicial das outras telas.
- Não refatorar serviços compartilhados ou atualizar dependências sem necessidade desta entrega.
- Evitar recarregar todas as ideias a cada movimento.
- Memorizar nós e callbacks quando isso resolver trabalho repetido observado.
- Não baixar anexos/vídeos na lousa; materiais permanecem links na ficha.
- Escrever texto simples; não executar HTML/código de anotações.

Organização sugerida, adaptável:

- `MarketingWhiteboard.jsx`: lousa e controles.
- `MarketingIdeaNode.jsx`: cartão ligado à ideia real.
- `MarketingNoteNode.jsx`: anotação.
- Serviço dedicado de layout, separado das integrações externas.
- Reutilizar a ficha de `IdeiasPlanejamento.jsx` ou extraí-la sem mudar seu contrato.
- Testes do fluxo novo e migração incremental.

Esses nomes são sugestões, não autorização para criar outra tela paralela e abandonar o componente existente.

## 11. Celular e teclado

A captura enviada é de celular. A lousa precisa funcionar nesse uso.

- Controles compactos e tocáveis; evitar botões minúsculos.
- Separar gesto de mover a área do gesto de arrastar um cartão.
- Zoom e Ajustar à tela acessíveis.
- No celular, permitir selecionar origem e destino para conectar, sem depender exclusivamente de arrastar uma alça pequena.
- Ficha legível como painel/tela adequada ao espaço.
- Lista secundária com os mesmos selos e ações para quem preferir editar sem canvas.
- Foco visível, rótulos acessíveis e ações por teclado.
- Não ocultar aprovação ou execução no celular.

Não prometer fluidez por escolha de biblioteca. Validar no navegador com uma lousa representativa, incluindo títulos longos, notas e setas.

## 12. Exemplo da Live da Evelyn

O usuário pode criar a ideia **“Live da Evelyn — Botox sem mistério”** e colocá-la no centro da lousa.

Ao redor, acrescenta post-its para:

- Convidadas e temas da conversa.
- Perguntas e receios para esclarecer.
- Divulgação para a região.
- Página de inscrição planejada.
- Tarefas de preparação.

Setas mostram as relações entre essas anotações e a ideia. Somente o cartão da ideia tem aprovação/etapa; uma nota “Página de inscrição” não significa que uma página pública já foi implementada.

Fluxo de uso:

1. Salvar o título: Pendente de aprovação · Ideia.
2. Desenvolver a ficha: Pendente de aprovação · Em planejamento.
3. Aprovar explicitamente: Aprovada · Em planejamento.
4. Definir responsável/data e agendar: Aprovada · Agendada.
5. Iniciar explicitamente: Aprovada · Em execução.
6. Registrar realização e data real: Aprovada · Concluída.

Não pré-aprovar nem preencher data, equipe, orçamento ou resultado fictício. Usar o modelo de Live apenas quando o usuário escolher.

## 13. Critérios de aceite e evidência

| Verificação | Resultado necessário |
|---|---|
| Abrir a sub-aba | Lousa principal; sem os quatro grandes contadores |
| Carregar registros antigos | Ideias preservadas, sem duplicação ou perda de etapa |
| Nova ideia só com título | Ficha e cartão acessíveis após recarga |
| Mover, editar nota e conectar | Posições/textos/setas persistem em outra sessão autorizada |
| Aprovar uma ideia | Selo muda; autoria/data/histórico reais |
| Iniciar execução | Aprovação permanece visível junto de Em execução |
| Arrastar/conectar | Não muda aprovação, etapa ou campanha |
| Ficha e lista | Exibem os mesmos dados do cartão |
| Falha de consulta/gravação | Erro explícito, texto preservado e sem falso Salvo |
| Duas sessões | Gravação desatualizada não sobrescreve outra silenciosamente |
| Arquivar/restaurar | Registro, tarefas, histórico e campanha preservados |
| Desfazer | Reverte ação visual, sem desfazer decisão de negócio |
| Converter em campanha | Repetição/concorrência não gera duplicata ou vínculo incompleto |
| Usuário somente leitura | Consulta sem mutações; backend também nega alteração |
| Celular | Criar, editar, aprovar e iniciar execução sem depender do desktop |
| Carga representativa | Validar, por exemplo, 30 ideias, 20 notas e 30 setas; medir resposta e requisições |
| Outros módulos | Diff preserva Instagram/Insights/webhook e campanhas existentes |

Executar build e lint dos arquivos alterados. Testes devem verificar comportamento, especialmente versão concorrente, aprovação/etapa, preservação de histórico e conversão em campanha. Teste de componente ou navegador deve confirmar uso da lousa; build sozinho não prova arrastar, editar ou salvar.

Usar banco local/de teste para validar a migração e persistência. Distinguir no relatório testes com mocks, testes com banco de teste e verificações em navegador. Não chamar um teste de simulação de fluxo real em produção.

Entregar:

1. Código e lockfile quando necessário.
2. SQL incremental com prechecagens e instruções de aplicação, indicando dependências de v2 se existirem.
3. Resumo dos arquivos alterados e limitações.
4. Evidência de build/lint/testes e captura da lousa em desktop/celular.
5. Confirmação pelo diff de que a integração do Instagram não foi alterada.
6. Commit/hash e situação do push, sem afirmar publicação se a mudança ainda estiver apenas local.

## 14. Fora desta entrega

Colaboração em tempo real, cursores de outras pessoas, múltiplas lousas complexas, anexos pesados, transmissão de Live, página pública, inscrições automáticas, integração de anúncios/UTMify, IA e novas automações ficam para etapas futuras.

A entrega atual é uma lousa funcional, pequena, persistida e integrada ao planejamento/campanhas do ERP, com aprovação e execução visíveis.

## Referências técnicas

Consultar versões atuais antes da implementação:

- React Flow — nós personalizados: https://reactflow.dev/learn/customization/custom-nodes
- React Flow — navegação e zoom: https://reactflow.dev/learn/concepts/the-viewport
- Supabase — funções de banco: https://supabase.com/docs/guides/database/functions
- Supabase — Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security

