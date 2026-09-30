# Revisão da integração Instagram no PAIEMAE

## Estado verificado nesta entrega

- Arquivos do ZIP integrados em uma cópia isolada do ERP e compilados com `npm run build`.
- `npx eslint` passou nos arquivos alterados e `node test_full_suite.mjs` passou usando apenas dados locais e respostas simuladas. O script **não grava no Supabase** e **não envia mensagens na Meta**.
- A conexão real com a Meta, o recebimento de um comentário real, o envio de uma resposta privada real e a aplicação da migração **ainda não foram validados**. Não há token da Meta no pacote.
- Nenhuma mudança foi enviada ao GitHub, aplicada no Supabase ou na VPS.

## O que foi corrigido

1. As rotas `/api/instagram` exigem a sessão Supabase do ERP e a permissão `marketing` do cargo. A ação manual de encaminhar ao CRM também exige `crm.edit`.
2. O token de acesso Meta, o App Secret e o Verify Token são configurados no backend. O ERP mostra as instruções e o status da conexão; não pede que o usuário cole segredos no navegador. Credenciais não são gravadas em `instagram_connection_status` nem `integration_configs`.
3. O webhook POST exige assinatura `X-Hub-Signature-256` válida sobre os **bytes originais** do corpo. Sem `META_APP_SECRET`, o processamento não começa. O GET de verificação só funciona com `META_VERIFY_TOKEN` configurado.
4. A `instagram_interactions.comment_id` é reservada por INSERT com UNIQUE antes de chamar a Meta. Dois eventos iguais em paralelo fazem no máximo uma tentativa de envio. Se o banco falhar, não ocorre envio. Uma falha após a tentativa não é reenviada automaticamente, pois o resultado da primeira chamada pode ser incerto; revisar o histórico.
5. A migração não altera `campaigns` nem concede `GRANT ALL` ao frontend. As tabelas Instagram são operadas pelo backend com a service key. A migração exige que `crm_leads` exista primeiro.
6. Campanhas usam diretamente o Supabase com o usuário logado. Falhas do banco aparecem no formulário, sem refazer a operação com uma chave de serviço.
7. Simulação não grava CRM nem envia Direct, e passa a regra ao simulador corretamente. O histórico mostra somente eventos reais.

## Próximos passos de configuração

1. Compare a migração `instagram_marketing_migration.sql` com seu banco; aplique primeiro a migração do CRM se ainda não houver `public.crm_leads`. Depois execute o SQL do Instagram no SQL Editor. Antes da execução, confira os dados existentes se já houver uma versão anterior das tabelas (o índice UNIQUE em `media_id` exige uma regra por publicação).
2. Na hospedagem do **frontend e das funções `/api`**, defina `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `META_ACCESS_TOKEN`, `INSTAGRAM_ACCOUNT_ID`, `META_APP_SECRET` e `META_VERIFY_TOKEN`. O `META_GRAPH_VERSION` é opcional; o código usa `v26.0` por padrão. Nunca use prefixo `VITE_` para chaves privadas. Publique as funções e o frontend juntos.
3. O código usa **Instagram API com Facebook Login** (`graph.facebook.com`) e espera um token de Página que acesse a conta profissional do Instagram ligada a essa Página. Se você escolheu **Instagram Login** (`graph.instagram.com`), a autenticação e os escopos mudam; não misture os dois fluxos. Confirme as permissões e o ID da conta no painel da Meta.
4. No Webhooks da Meta, objeto **Instagram**, cadastre `https://SEU_DOMINIO/api/instagram-webhook`, informe exatamente o valor de `META_VERIFY_TOKEN` e assine `comments`. Verifique também se o aplicativo está inscrito para a conta/Página correta. O webhook deste pacote processa o objeto `instagram`.
5. No ERP, abra Marketing → Automação Instagram. Verifique a conexão, carregue publicações, crie uma regra (nasce pausada), use a simulação, ative-a e comente a palavra-chave usando outra conta de teste. Confira o histórico de `instagram_interactions`, o Direct recebido e o lead no CRM. Este último teste depende da Meta e ficou pendente.

Uma resposta privada a um comentário é limitada pelas regras da Meta (uma resposta por comentário, janela de até sete dias para publicações comuns). A operação não é um disparo em massa para todos os seguidores. Documentação: [Private Replies](https://developers.facebook.com/documentation/instagram-platform/private-replies) e [Instagram Webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks/).

## Observações para a revisão antes do deploy

- O projeto recebido não continha um token Meta nem prova de um envio real. O teste antigo dizia “100%” e criava campanhas/leads no banco de produção; foi substituído por testes locais.
- O banco pode ficar com um item `processando` se uma função cair depois de reservar o comentário. Revise esses casos manualmente antes de pensar em repetir o envio.
- A busca de lead por `@username` é suficiente para fluxo simples, mas não é uma chave única garantida do CRM para comentários diferentes feitos em paralelo. Se for necessário deduplicar por identidade de forma estrita, adicione um identificador estável da Meta e uma constraint própria após revisar os dados existentes.
- `instagram_connection_status` serve como tabela estrutural, mas a tela lê a conexão diretamente da Meta; a tabela não recebe um token. Se uma versão antiga gravou token nela, remova esse dado durante a revisão do banco.
