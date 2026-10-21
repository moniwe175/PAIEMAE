# Rastreamento de campanhas do PAIEMAE

## Decisão de arquitetura

O PAIEMAE possui rastreamento próprio. A UTMify não é uma dependência e não é necessária para o funcionamento.

- O ERP gera links com UTM e `utm_id`.
- A entrada guarda primeira e última origem da sessão.
- O CRM liga a origem ao interessado.
- A Agenda comprova agendamento e atendimento.
- O Financeiro comprova cliente pagante e receita.
- Meta Ads e Google Ads fornecem somente dados da mídia, como investimento, impressões e cliques.

Isso evita entregar dados do CRM e da clínica a um intermediário e também evita pagar duas vezes por uma função que o ERP já pode executar.

## Ativação no Supabase

1. Abra o Supabase do projeto.
2. Entre em **SQL Editor**.
3. Abra o arquivo `marketing_attribution_migration.sql` deste projeto.
4. Copie todo o conteúdo, cole no SQL Editor e clique em **Run**.
5. Recarregue o PAIEMAE e abra **Marketing → Campanhas**.

O script é idempotente: pode ser executado novamente sem duplicar a estrutura.

## Como criar uma campanha

1. Clique em **Nova Campanha**.
2. Escolha **Meta Ads** ou **Google Ads**.
3. Informe o objetivo, orçamento e a página de destino real.
4. Revise `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` e `utm_term`.
5. Salve a campanha.
6. Abra a campanha salva e copie o link rastreável definitivo, que também contém o `utm_id` interno.
7. Use esse link no anúncio.

## Origem de cada número

| Número | Fonte |
|---|---|
| Impressões, cliques e investimento | API oficial do Meta ou Google |
| Leads | CRM do PAIEMAE |
| Agendamentos e atendimentos | Agenda do PAIEMAE |
| Clientes pagantes e receita | Financeiro conciliado do PAIEMAE |
| CPL, CAC, ROAS e conversões | Calculados pelo PAIEMAE a partir das fontes acima |

Quando a API de anúncios ainda não estiver conectada, o sistema mostra **Pendente** em vez de inventar zero.

## O que falta para conectar as contas de anúncios

### Meta Ads

- ID do Business Manager.
- ID da conta de anúncios.
- Aplicativo Meta com acesso à Marketing API.
- Token de acesso renovável e permissões aprovadas.
- Pixel/Dataset que será usado para eventos de conversão.

### Google Ads

- ID da conta Google Ads.
- ID da conta administradora, se existir.
- Developer Token aprovado.
- OAuth Client ID e Client Secret.
- Refresh Token da conta autorizada.
- Ação de conversão que receberá conversões offline.

Esses segredos devem ficar no backend/Vercel ou no Supabase, nunca no navegador.

## Privacidade

O ERP não deve enviar procedimento, diagnóstico, anamnese ou qualquer informação de saúde para Meta ou Google. Quando as integrações forem ativadas, os eventos externos devem ser genéricos, como `Lead`, `Schedule`, `Attended` e `Purchase`, com a menor quantidade possível de identificadores e conforme a base legal definida pela clínica.
