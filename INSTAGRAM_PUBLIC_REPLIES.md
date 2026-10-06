# Resposta pública após a DM — PAIEMAE

Na aba **Marketing → Automação Instagram**, cada publicação pode ter uma resposta pública opcional. Exemplo: **“Prontinho! Te enviei as informações no Direct 💜”**.

A pessoa comenta a palavra-chave no post ou Reel selecionado. A automação envia a DM usando o fluxo que já funcionou com `META_PAGE_ID`. Somente quando a Meta confirma esse envio, publica uma resposta abaixo do comentário original. O texto público é editável, aceita emojis e as tags `{{usuario}}`, `{{nome}}` e `{{post}}`. O limite de 500 caracteres é uma escolha da interface do ERP.

## Configuração no banco antes da publicação

Para uma instalação que já usa a automação, execute **somente este bloco** no SQL Editor do Supabase:

```sql
ALTER TABLE public.instagram_rules
  ADD COLUMN IF NOT EXISTS responder_comentario boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resposta_publica text NOT NULL DEFAULT '';
```

O bloco também foi incorporado ao arquivo existente `instagram_marketing_migration.sql` para novas instalações. As regras existentes recebem a opção pública desativada. O histórico da resposta pública usa `instagram_interactions.metadata.public_reply`, sem necessidade de outra tabela ou mudança nas políticas.

Nenhum SQL foi executado no banco remoto durante esta implementação. Não é necessário gerar outro token nem adicionar variável de ambiente para esta funcionalidade.

## Usar no ERP

1. Após a migração e a publicação do código, abra Marketing → Automação Instagram.
2. Selecione a publicação que já possui a regra da DM.
3. Marque **Responder também ao comentário**, escreva a mensagem pública e salve.
4. Use **Simular e Testar Comentário** para ver a DM e o comentário previstos, sem publicar nada.
5. Para testar de verdade, envie um comentário novo, com a palavra-chave, por outra conta. Confira a DM, a resposta pública e o histórico do ERP.

As regras novas continuam começando pausadas. A resposta pública fica visível para quem pode ver a publicação no Instagram.

## Envio e registro dos resultados

| Etapa | Chamada | Confirmação necessária |
| --- | --- | --- |
| DM já funcionando | `POST graph.facebook.com/{versão}/{META_PAGE_ID}/messages`, com `recipient.comment_id` | ID de mensagem retornado pela Meta |
| Resposta pública | `POST graph.facebook.com/{versão}/{commentId}/replies`, com `message` | ID da resposta retornado pela Meta |

A chamada pública é separada da privada. O token de Página existente é usado nas duas chamadas; a resposta pública depende da permissão `instagram_manage_comments`. A configuração da conta para publicações e insights continua usando `INSTAGRAM_ACCOUNT_ID`.

O comentário recebido é reservado no banco antes dos envios. Eventos repetidos não produzem nova DM nem nova resposta pública. A confirmação da DM é gravada antes de tentar publicar o comentário. Comentários da própria conta são ignorados para evitar que a resposta acione a automação.

Se a DM falhar, o comentário público não é enviado. Se apenas o comentário público falhar, a DM mantém sua confirmação; o histórico mostra a falha pública separadamente. Erro de rede, resposta sem ID ou erro HTTP 5xx fica como envio público **não confirmado**, sem repetição automática. É preciso conferir a publicação antes de qualquer intervenção manual.

## Verificação executada

Os testes usam respostas simuladas da Meta e um banco em memória exclusivo do teste. Não enviam mensagens nem criam registros na clínica.

```bash
node --test tests/instagramPublicReplies.test.mjs tests/instagramInsights.test.mjs
node test_full_suite.mjs
npx eslint api/instagram.js src/components/marketing/InstagramRuleEditor.jsx src/components/marketing/InstagramHistoryTable.jsx src/components/marketing/InstagramTestModal.jsx
npm run build
```

Cobertura: ordem DM → comentário, checkpoint da DM, concorrência e duplicados, falha da DM, falha pública, rede sem confirmação, HTTP 200 sem ID, simulação sem efeitos externos, regras antigas, regra pausada, ausência da palavra-chave e comentários da própria conta. Os testes existentes de insights e webhook também continuam válidos.

O envio público real ainda precisa ser confirmado com um comentário novo depois da migração e do deploy. Testes locais não comprovam a disponibilidade da Meta nem as permissões efetivas do token em produção.

## Referência primária

Coleção oficial da Meta, seção Comment Moderation / Reply to a comment:
https://github.com/fbsamples/messenger-platform-samples/blob/main/postman/instagram-platform-api.postman_collection.json

A coleção exemplifica `POST /{ig_comment_id}/replies` com o campo `message`. Esta implementação usa o host `graph.facebook.com` do fluxo Facebook Login já adotado no ERP; não altera o fluxo privado confirmado em produção.
