# Deploy no Railway

Voce precisa de **2 servicos dentro do mesmo projeto Railway** (mesmo projeto = mesma
rede privada, entao eles se enxergam sem precisar expor nada na internet):

1. `wppconnect-server` (Node.js) -- segura a sessao do WhatsApp
2. `marketing-engine` (este projeto, Python) -- roda as regras e fala com o Supabase

## Passo 1 -- Criar a conta e o projeto

1. Crie uma conta em railway.app (da pra logar com GitHub).
2. "New Project" -> "Empty Project".

## Passo 2 -- Deploy do wppconnect-server

1. No GitHub, de fork (ou clone e suba pro seu proprio repo) de
   `wppconnect-team/wppconnect-server` -- o repositorio ja vem com `Dockerfile`
   e `docker-compose.yml` prontos.
2. No projeto Railway: "New" -> "GitHub Repo" -> selecione esse repositorio.
   O Railway detecta o `Dockerfile` automaticamente.
3. Renomeie o servico para `wppconnect` (Settings -> nome do servico) -- esse
   nome importa, e como o `marketing-engine` vai encontra-lo na rede interna.
4. Adicione um **Volume** (botao direito no canvas -> "Add Volume", ou cmd+K):
   - Mount path: `/usr/src/wpp-server/tokens`
   - Isso e o que garante que voce nao precisa escanear o QR Code de novo
     a cada redeploy.
5. Configure as variaveis de ambiente do servico (ou edite `config.ts` antes
   de subir): defina um `secretKey` forte -- e a chave que o `marketing_engine`
   vai usar pra gerar token de acesso a API.
6. Deploy. Acompanhe os logs -- na primeira vez ele vai pedir o QR Code
   (a forma de capturar isso varia: logs do Railway mostram o base64,
   ou voce chama a rota `/api/{session}/start-session` manualmente uma vez).

## Passo 3 -- Deploy do marketing_engine

1. Suba a pasta `marketing_engine/` (este projeto) pro seu repositorio GitHub
   (pode ser um repo separado, ou uma subpasta do monorepo do seu sistema --
   tanto faz, contanto que tenha o `Dockerfile` na raiz dessa pasta).
2. No mesmo projeto Railway: "New" -> "GitHub Repo" -> selecione esse repositorio.
   Se for subpasta de um monorepo, configure "Root Directory" para `marketing_engine/`
   nas configuracoes do servico.
3. Renomeie o servico para `marketing-engine`.
4. Configure as variaveis de ambiente (Settings -> Variables):

   ```
   SUPABASE_URL=https://SEU-PROJETO.supabase.co
   SUPABASE_SERVICE_KEY=sua-service-role-key

   WPP_SERVER_URL=http://${{wppconnect.RAILWAY_PRIVATE_DOMAIN}}:21465
   WPP_SESSION_NAME=clinica-marketing
   WPP_SECRET_KEY=a-mesma-secretKey-do-passo-2

   DRY_RUN=true
   SCHEDULER_INTERVAL_MINUTES=30
   ```

   O `WPP_SERVER_URL` usando `${{wppconnect.RAILWAY_PRIVATE_DOMAIN}}` e a
   referencia de variavel do Railway -- ele resolve automaticamente para o
   endereco interno do servico `wppconnect` dentro da mesma rede privada do
   projeto. **Use `http://`, nao `https://`**, na rede interna.

5. Deploy. Com `DRY_RUN=true`, ele vai rodar todo o ciclo e so logar o que
   enviaria -- confira os logs pra validar antes de desligar o DRY_RUN.

## Checklist antes de ligar de vez (DRY_RUN=false)

- [ ] QR Code do WhatsApp escaneado e sessao conectada (confirme nos logs do `wppconnect`)
- [ ] Tabelas `pacientes`, `agendamentos`, `marketing_approval_queue` e `marketing_log`
      criadas no Supabase (rodar `schema_paiemae.sql`)
- [ ] Tabela `marketing_engine_settings` criada no Supabase (rodar `schema_engine_settings.sql`)
- [ ] Rodou pelo menos um ciclo em `DRY_RUN=true` e os logs fazem sentido
- [ ] Confirmou que `engine/database.py` esta lendo das tabelas REAIS do seu sistema
      (ja adaptado para nomes em portugues: pacientes, agendamentos, etc.)
- [ ] Coluna `whatsapp_opt_out` (LGPD) existe na tabela `pacientes` e esta sendo filtrada
