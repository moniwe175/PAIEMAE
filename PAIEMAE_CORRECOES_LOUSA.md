# PAIEMAE — Correções da lousa de Marketing

Revisão de 08/10/2026  
Base: main em `637685d4f1a5b8f69344ea136e36bddd757a0a4d`

## 1. Conclusão e estado do trabalho

A lousa foi implementada e os commits `2b9dba6` e `637685d` estão no GitHub. O código inclui React Flow, post-its, textos, setas e cartões com aprovação e etapa separadas.

A revisão encontrou falhas no contrato com o banco e na preservação/salvamento do layout. Corrigir esses pontos antes de considerar a entrega concluída.

O usuário informou que o SQL completo retornou **Success. No rows returned**. Não repetir v1/v2/v3 por causa desta revisão. Preparar uma correção incremental para o banco que já recebeu a migração completa.

A revisão não consultou o banco de produção nem verificou o deployment na Vercel. A confirmação de execução veio do usuário; o GitHub foi conferido diretamente. Build e execução de SQL, por si sós, não validam o fluxo de editar e salvar na interface.

**Restrição mantida: não alterar nada da API ou automação do Instagram, nem executar chamadas reais à Meta.**

## 2. Cadastro usa uma coluna ausente na migração

**Arquivos:** `marketing_ideas_migration_completa.sql` e `src/services/marketingIdeasService.js`, função `insertIdea`.

O serviço sempre envia `formato` ao inserir uma ideia. A migração completa não cria nem adiciona essa coluna. Ela também é usada no filtro e na consulta de ideias vinculadas à campanha.

Com um banco que só tinha a estrutura v1, conforme o relato, o SQL completo não resolve esse contrato. O cadastro pode falhar com coluna ausente.

**Correção:**

- Confirmar por consulta somente de leitura se `formato` existe no banco atual.
- Adicionar a coluna de forma incremental se estiver ausente, com contrato compatível com o formulário.
- Revisar todos os campos enviados/consultados pelo serviço contra o esquema real.
- Não renomear `tipo` ou apagar seu conteúdo automaticamente; são dados existentes.
- Validar criação só com título, abertura da ficha, edição, duplicação e vínculo com campanha num banco de teste equivalente à v1 migrada.

## 3. Hidratação da lousa apaga alterações locais

**Arquivo:** `src/components/marketing/whiteboard/MarketingWhiteboard.jsx`.

O efeito que inicializa os elementos também depende de `isConnectingMode`, `connectionSourceId` e da lista de ideias exibida. Quando esses valores mudam, ele executa novamente `setNodes`, `setEdges` e `setCurrentVersion` usando o layout que foi carregado anteriormente.

No teste isolado, editar uma nota e ativar Conectar fez o texto voltar para o conteúdo salvo anteriormente.

**Correção:**

- Separar carregamento inicial do layout, atualização dos dados de negócio dos cartões e alteração do modo Conectar.
- Atualizar callbacks/indicadores de conexão sem reconstruir posições, textos e setas.
- Preservar o estado local pendente ao aprovar uma ideia, abrir ficha ou atualizar seus dados.
- Não recarregar/desmontar a lousa inteira como efeito colateral de uma atualização de aprovação.
- Não redefinir a versão confirmada para uma versão antiga do carregamento inicial.
- Se o usuário pedir uma recarga explícita, avisar sobre alterações pendentes e preservar a edição para recuperação.

## 4. A segunda edição de um post-it usa versão antiga

**Arquivo:** `MarketingWhiteboard.jsx`.

Callbacks guardados em `node.data` continuam referenciando a função de salvamento criada anteriormente. Depois que a primeira edição é salva e a versão avança, a segunda edição pode continuar enviando a versão anterior.

Reprodução isolada: primeira gravação enviou versão 1 e recebeu versão 2; segunda gravação enviou versão 1 novamente e terminou em erro. O banco simulado guardou só a primeira edição.

**Correção:**

- Manter handlers estáveis que leiam estado e versão atuais, ou atualizar os callbacks sem reidratar o layout.
- Serializar gravações: não manter duas gravações concorrentes da mesma sessão usando a mesma versão esperada.
- Após a confirmação, avançar a versão antes da próxima gravação.
- Se houver edição enquanto uma gravação está em andamento, manter a nova alteração pendente para a próxima gravação.
- Marcar Salvo apenas quando a revisão local correspondente tiver sido confirmada. Uma resposta atrasada não pode limpar alterações mais recentes.
- Cancelar timers na desmontagem de forma controlada e oferecer salvamento/aviso antes de sair com alterações pendentes.
- Mostrar conflito real entre usuários sem perder o texto local ou sobrescrever o layout remoto.

## 5. Filtros estão alterando o layout persistido

**Arquivos:** `IdeiasPlanejamento.jsx` e `MarketingWhiteboard.jsx`.

O componente pai passa `ideiasFiltradas` como a lista da lousa. O canvas reconstrói os cartões a partir dessa lista e depois salva apenas os elementos presentes. Assim, editar uma nota enquanto o filtro oculta uma ideia remove a posição dessa ideia do layout persistido.

Isso não exclui a ideia da tabela de negócio, mas pode fazer o cartão reaparecer em outra posição e prejudicar suas conexões.

**Correção:**

- Manter o layout completo como fonte da persistência.
- Aplicar filtros somente à visibilidade dos cartões e das setas.
- Não eliminar elementos ocultos ao salvar outro elemento.
- Separar filtro de arquivamento/restauração, que é uma ação explícita do negócio.
- Preservar posições e ligações ao filtrar, editar, recarregar e limpar os filtros.

## 6. Desfazer salva o estado anterior ao próprio desfazer

**Arquivo:** `MarketingWhiteboard.jsx`, função `handleUndo`.

A função muda nós/setas e chama `triggerSave()` sem passar o resultado novo. Como a atualização de estado não é imediata, o salvamento usa o estado anterior.

Na reprodução isolada, o post-it desapareceu visualmente após Desfazer, mas continuou no layout gravado.

Há outras lacunas: arrastes não entram na pilha de desfazer; a conexão criada por arraste é registrada antes de receber seu ID; excluir uma nota não guarda todas as setas necessárias para restauração completa.

**Correção:**

- Calcular a alteração visual e seu resultado antes de solicitar a persistência.
- Salvar exatamente o estado após Desfazer.
- Guardar IDs reais de conexões.
- Incluir posição anterior/seguinte dos arrastes.
- Ao desfazer a exclusão de uma anotação, recuperar também suas conexões.
- Manter aprovação, etapas, campanhas e arquivamento fora do desfazer visual.
- Interceptar a remoção de cartão antes que o React Flow o retire. Cancelar a confirmação de arquivamento deve deixar o cartão e suas ligações intactos.

## 7. Erros de leitura e rejeições do servidor viram sucesso

**Arquivo:** `src/services/marketingIdeasService.js`.

### Leitura

`fetchWhiteboardLayout` converte erros retornados pelo Supabase em layout vazio e `error: null`. O componente pai também não trata `resLayout.error` e `resLayout.structureMissing`.

Teste isolado: erro de permissão `42501` voltou como lousa vazia sem erro.

**Correção:** propagar o erro, diferenciar ausência de registro de falha de leitura/migração e impedir autosave enquanto o layout real não tiver sido carregado. Reconhecer também os códigos relevantes do schema cache da Data API.

### Gravação

`saveWhiteboardLayout` faz gravação direta quando a RPC falha ou devolve certas rejeições. Esse caminho separa consulta e upsert, perdendo a garantia atômica de versão.

Teste isolado: a RPC respondeu `ok: false`; o serviço usou o fallback e retornou `ok: true`.

**Correção:**

- Usar uma única operação atômica autorizada para persistência.
- Propagar conflito, erro técnico e rejeição de negócio.
- Não contornar rejeições usando update/upsert direto.
- Validar versão esperada no servidor, sem aceitar versão ausente/zero como forma de sobrescrever.
- Tratar a criação simultânea da primeira lousa sem perder uma versão por fallback.
- Aplicar o mesmo princípio a aprovação, arquivamento e vínculo: não ignorar o resultado de uma RPC nem confirmar sucesso quando o histórico falhou.

## 8. Preservação de legados e regras do negócio

A migração completa adiciona `etapa` com default `ideia`, mas não transforma os valores v1 de `status` em etapas equivalentes. Também não migra `status = arquivada` para o campo `arquivada`.

Portanto, registros antigos podem aparecer como ideias novas ou ativas apesar de seu estado anterior. A migração de histórico para eventos também deixa de copiar `autor_id`.

**Correção incremental controlada:**

- Conferir se existem registros legados e quais campos/eventos indicam seu estado original.
- Mapear planejamento, execução, conclusão e arquivamento sem sobrescrever decisões tomadas após a migração.
- Não inferir aprovação nem inventar autor/data.
- Preservar informações antigas de datas e autoria; evitar mudar registros ambíguos sem evidência.
- Não executar um UPDATE geral apenas porque o SQL foi rotulado como completo.

A edição de ideia usa consulta da versão seguida de update só pelo ID. Isso também permite que duas sessões passem pela checagem e sobrescrevam uma à outra. Tornar a comparação e atualização atômicas.

As regras de agendamento/execução/conclusão devem ser validadas no servidor, com histórico na mesma transação. Edição comum de ficha não deve reenviar aprovação, autoria e versão antigas como se fossem campos livres.

O SQL atual concede acesso de alteração a todos os usuários autenticados, sem verificar `marketing.ver/edit`. Adequar as operações às permissões efetivas já existentes no ERP e obter autoria da sessão validada. Não refatorar permissões do Instagram.

## 9. Evidência executada nesta revisão

Foram lidos os arquivos publicados e executados testes isolados usando a lógica original do serviço/componente com dependências substituídas por mocks.

| Caso | Resultado observado |
|---|---|
| Payload de cadastro versus migração | Serviço envia formato; SQL não declara a coluna |
| Erro ao carregar layout | Retorna vazio e error null |
| RPC rejeita gravação | Fallback direto retorna sucesso |
| Duas edições sequenciais de post-it | Segunda usa versão antiga e falha |
| Conectar após editar nota | Texto local volta ao conteúdo carregado |
| Editar com filtro ativo | Layout salvo perde o cartão oculto |
| Adicionar nota e Desfazer | Nota removida visualmente continua no layout gravado |

Esses testes não usaram React DOM nem navegador. Não houve consulta/escrita no Supabase de produção, comentário, DM ou chamada à Meta. O Antigravity deve acrescentar testes reais de componente/navegador e banco de teste antes de confirmar funcionamento.

O diff dos dois commits não altera os arquivos específicos da API, webhook, serviço e componentes de Instagram. Existe alteração no cliente Supabase compartilhado; a revisão dessa mudança não comprova sozinho funcionamento de todos os módulos.

## 10. Entrega corretiva solicitada

Preservar o design e corrigir o fluxo; não recomeçar a feature do zero.

Entregar:

1. Migração incremental adequada ao banco que já recebeu o SQL completo.
2. Correções do serviço e da lousa, com persistência canônica, versionamento e erros explícitos.
3. Testes regressivos para todos os casos reproduzidos.
4. Validação em navegador: cadastro só com título, duas edições com salvamento entre elas, conexão, filtro, desfazer, arquivamento cancelado, aprovação e etapa.
5. Validação de concorrência em banco de teste: duas sessões e primeira criação da lousa.
6. Build, lint dos arquivos alterados, arquivos/diff e commit/hash.

Aceite mínimo: editar → salvar → editar novamente → salvar → recarregar deve preservar a última edição; usar filtros/Conectar/Desfazer não pode perder dados; cadastro e aprovação precisam funcionar contra o esquema migrado.

Não repetir SQL antigo, não usar credenciais reais nos testes, não alterar configuração/deploy da Vercel nem a API/automação do Instagram para resolver esses problemas.

## Fontes conferidas

- [Commit da lousa — 2b9dba6](https://github.com/moniwe175/PAIEMAE/commit/2b9dba66d835d77a3b9dabd9c3ad189d10018173)
- [Commit da migração completa — 637685d](https://github.com/moniwe175/PAIEMAE/commit/637685d4f1a5b8f69344ea136e36bddd757a0a4d)
- [SQL completo revisado](https://github.com/moniwe175/PAIEMAE/blob/637685d4f1a5b8f69344ea136e36bddd757a0a4d/marketing_ideas_migration_completa.sql)
- [Serviço revisado](https://github.com/moniwe175/PAIEMAE/blob/637685d4f1a5b8f69344ea136e36bddd757a0a4d/src/services/marketingIdeasService.js)
- [Canvas revisado](https://github.com/moniwe175/PAIEMAE/blob/637685d4f1a5b8f69344ea136e36bddd757a0a4d/src/components/marketing/whiteboard/MarketingWhiteboard.jsx)
- [Tela de ideias revisada](https://github.com/moniwe175/PAIEMAE/blob/637685d4f1a5b8f69344ea136e36bddd757a0a4d/src/components/marketing/IdeiasPlanejamento.jsx)

