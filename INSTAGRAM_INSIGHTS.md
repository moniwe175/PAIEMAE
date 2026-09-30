# Insights do Instagram no PAIEMAE

O painel fica em **Marketing → Insights Instagram**. Consulta a Meta Graph API pelo backend existente (`GET /api/instagram?action=insights`), usando a conta profissional configurada em `META_ACCESS_TOKEN` e `INSTAGRAM_ACCOUNT_ID`. Nenhum token é enviado ao React.

## O que o painel mostra

- Alcance diário dos últimos 7 ou 30 dias, visualizações e interações do período quando a Meta disponibilizar os dados.
- Número atual de seguidores, vindo da consulta já existente ao perfil.
- Para uma das 25 publicações mais recentes carregadas pelo ERP: alcance, visualizações, salvamentos, compartilhamentos, curtidas e comentários quando disponíveis.
- Ausência de dados aparece como `—`, sem substituir por zero nem por dados de simulação. O alcance diário não deve ser somado para estimar pessoas únicas no período.

Os Insights orgânicos e os relatórios de anúncios da Meta são recursos distintos. Este painel não gerencia campanhas pagas nem pretende reproduzir todas as telas do aplicativo Instagram.

## Configuração necessária

1. Mantenha a conta profissional vinculada à Página do Facebook usada pela integração atual.
2. No app da Meta, procure a permissão **`instagram_manage_insights`** em *Permissões e recursos* do caso de uso da API com Facebook Login. Para esta integração também são relevantes `instagram_basic` e `pages_read_engagement`. Se a permissão não estiver disponível para o app ou usuário, verifique o acesso e a configuração no painel da Meta antes de gerar o token.
3. Gere novamente o token da Página com a permissão concedida. Salve o valor como **Secret** em `META_ACCESS_TOKEN` na Vercel, sem prefixo `VITE_`. Confirme `INSTAGRAM_ACCOUNT_ID` no mesmo ambiente e faça um novo deploy. Não cole tokens em conversas, testes ou arquivos versionados.
4. Abra **Marketing → Insights Instagram**, selecione 7 ou 30 dias e clique em **Atualizar**. Se a Meta negar o acesso, o painel mostrará a falha, sem números fictícios.

Não há migração SQL nova para este painel. A API recebe dados em tempo real; não grava histórico de métricas no Supabase.

## Verificação

Execute `node --test tests/instagramInsights.test.mjs`, `npx eslint api/instagram.js src/services/instagramService.js src/pages/Marketing.jsx src/components/marketing/InstagramInsightsPanel.jsx tests/instagramInsights.test.mjs` e `npm run build`.

Os testes locais simulam respostas da Meta e verificam dados ausentes e erro de permissão. A consulta com a conta real só pode ser confirmada após conceder `instagram_manage_insights` e configurar o token na hospedagem.

Referência: [Meta — Instagram Insights](https://developers.facebook.com/documentation/instagram-platform/insights).
