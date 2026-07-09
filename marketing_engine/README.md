# Marketing Engine v2 — Clínica EvelynEstheticCenter

Motor de automação de marketing e comunicação via WhatsApp para a clínica. 

Esta versão (v2) adota uma arquitetura híbrida robusta composta por:
1. **Orquestrador Python**: Analisa regras de negócio e agenda as mensagens na fila do Supabase.
2. **Worker Node.js (Baileys) local**: Roda no computador da clínica, gerencia a sessão do WhatsApp, lê as mensagens aprovadas e faz o envio real.
3. **Frontend React**: Permite que a recepcionista gerencie templates, aprove mensagens do Grupo B e escaneie o QR Code de conexão (que é renderizado em tempo real).

---

## Estrutura de Pastas

```text
marketing_engine/
├── main.py                  # Orquestrador com APScheduler (dispara ciclos do motor)
├── requirements.txt         # Dependências do orquestrador Python
├── schema.sql               # Estruturas e sementes (templates, status) para o Supabase
├── config/
│   ├── settings.py          # Centralização e leitura das variáveis de ambiente (.env)
│   └── .env.example         # Exemplo de configuração para o Python
├── engine/
│   ├── marketing_engine.py  # Orquestrador central (processa as ferramentas e faz insert batch)
│   └── rules.py             # Lógica das 19 ferramentas (regras, templates e tags)
└── worker_whatsapp/         # Worker Node.js que realiza a conexão do WhatsApp
    ├── index.js             # Lógica de polling, conexão Baileys, Retenção e Vencimento
    ├── package.json         # Dependências do worker (Baileys, Supabase, pino, qrcode)
    └── .env.example         # Exemplo de configuração para o Worker Node.js
```

---

## Guia de Instalação e Setup

### Passo 1: Preparação do Banco de Dados (Supabase)
Rode o arquivo [schema.sql](file:///c:/Users/Iury/Desktop/01-07/PAIEMAE/marketing_engine/schema.sql) no **SQL Editor** do Supabase.
*   **O que ele faz**: Adiciona colunas extras necessárias para controle nas tabelas existentes (`servicos`, `clients`, `appointments`), cria as tabelas de configuração (`integration_configs`, `message_templates`, `marketing_queue`, `whatsapp_connection_status`, `marketing_engine_settings`), insere os seeds iniciais com templates padrão para as 19 ferramentas e configura políticas de RLS e Supabase Realtime.
*   *Nota*: Assume que o banco principal do sistema (`supabase_schema.sql`) já foi criado previamente.

### Passo 2: Configuração e Execução do Motor Python
1. Navegue até a pasta `marketing_engine/`.
2. Copie o arquivo `config/.env.example` para `config/.env`:
   ```bash
   cp config/.env.example config/.env
   ```
3. Preencha as credenciais `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` (use a **service_role** key para ter permissões de escrita/bypass de RLS na fila).
4. Crie um ambiente virtual (opcional) e instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```
5. Execute o motor:
   ```bash
   python main.py
   ```
   *O script irá rodar imediatamente o primeiro ciclo e ficará agendado para rodar a cada N minutos (padrão: 30 min, ajustável via `SCHEDULER_INTERVAL_MINUTES`).*

### Passo 3: Configuração e Execução do Worker WhatsApp (Baileys)
1. Navegue até a pasta `marketing_engine/worker_whatsapp/`.
2. Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
3. Preencha o `.env` com a `SUPABASE_URL` e `SUPABASE_SERVICE_KEY`.
4. Instale as dependências:
   ```bash
   npm install
   ```
5. Inicie o worker:
   ```bash
   # Para rodar em produção
   npm start

   # Para rodar em desenvolvimento com hot-reload (Node.js >= 18)
   npm run dev
   ```
6. **Conexão**: O worker publicará o QR Code gerado em formato Base64 diretamente na tabela `whatsapp_connection_status` do Supabase. Acesse a aba **Integrações** no painel administrativo do React para escanear o código e autenticar. A sessão será salva localmente na pasta `auth_info_baileys/` para reconexão automática nos próximos restarts.

---

## As 19 Ferramentas de Engajamento

As ferramentas são divididas em dois grupos em [rules.py](file:///c:/Users/Iury/Desktop/01-07/PAIEMAE/marketing_engine/engine/rules.py):

### Grupo A — Automáticos (Disparo direto via status `approved`)
| ID | Ferramenta | Gatilho / Momento |
| :--- | :--- | :--- |
| **1** | Lembrete 24h | 24h antes do horário da consulta agendada. |
| **2** | Lembrete 2h | 2h antes do horário da consulta agendada. |
| **3** | Alerta de Atraso 15min | 15min após o horário da consulta se o status ainda for `scheduled` ou `confirmed`. |
| **4** | No-Show 24h | 24h após a consulta ser marcada com status `no_show` (falta). |
| **5** | Feliz Aniversário | Disparado às 09:00 do dia do aniversário cadastrado do cliente. |
| **6** | Boas-Vindas & Prova Social | Enviado logo após a conclusão da **primeira** consulta do cliente (avaliação do Google). |
| **7** | Confirmação de Agendamento | Enviado imediatamente quando um novo agendamento é criado. |
| **8** | Orientações Pré-Procedimento | 24h antes para serviços que possuem `exige_preparo = true` (ex. Botox). |
| **9** | Dicas Pós-Procedimento | 24h após consulta concluída para serviços com `exige_pos_procedimento = true`. |
| **10** | Lembrete de Exames | Dispara lembretes para agendamentos que contêm a flag `exames_pendentes = true`. |
| **11** | NPS / Pesquisa de Satisfação | Enviado X dias (padrão: 3) após qualquer consulta ser concluída. |

### Grupo B — Edição Humana (Fila de aprovação via status `pending`)
| ID | Ferramenta | Gatilho / Momento |
| :--- | :--- | :--- |
| **12** | Recuperação de Orçamento | Enviado X dias após um orçamento não convertido. Recepcionista revisa e envia. |
| **13** | Inativo 30 dias | Identifica clientes cujo `last_visit` passou de 30 dias para reaquecimento. |
| **14** | Inativo 90 dias | Identifica clientes inativos a mais de 90 dias para oferta de win-back agressiva. |
| **15** | Pacote Próximo do Fim | Dispara quando restam 1 ou 2 sessões no pacote do cliente (`sessoes_pacote`). |
| **16** | Retorno Inteligente | Baseia-se no tempo biológico ideal cadastrado em `dias_para_retorno` por serviço. |
| **17** | Recuperação de Cancelamento | Dispara se um agendamento foi cancelado e o cliente não remarcou em até 3 dias. |
| **18** | Upgrade / Cross-sell | Sugere procedimentos complementares X dias (padrão: 14) após um serviço base concluído. |
| **19** | Datas Comemorativas | Dispara em datas especiais (Dia das Mães, Natal, etc.) para clientes ativos. |

---

## Recursos e Regras Avançadas de Confiabilidade

*   **Regra da Retenção (Retention)**: Ao iniciar a conexão (por exemplo, ao ligar o computador da clínica pela manhã), o worker busca todas as mensagens com status `approved` cuja data agendada (`scheduled_at`) já passou e as envia de forma segura, garantindo que nada gerado durante a noite/madrugada seja perdido.
*   **Regra de Vencimento (Expiration)**: Para mensagens críticas e com janela de tempo curta (exemplo: *Alerta de Atraso 15min* ou *Lembrete 2h*), a fila define um `expires_at`. Caso o worker fique offline e volte depois desse prazo, o próprio worker altera o status para `expired` ao invés de enviar a mensagem atrasada, evitando constrangimento ao paciente.
*   **Idempotência**: A função `already_queued()` em Python garante que mensagens da mesma ferramenta para o mesmo cliente não sejam duplicadas na fila dentro de uma janela operacional de segurança, mesmo com o scheduler rodando várias vezes ao dia.
*   **Liga/Desliga Global**: O motor lê a tabela `marketing_engine_settings` no Supabase em cada ciclo. Se a opção `enabled` estiver configurada como `false` pelo administrador no painel, o motor suspende o processamento de regras temporariamente sem necessidade de derrubar o processo do backend.
*   **Templates Dinâmicos**: O arquivo Python não possui textos fixados (*hardcoded*). Todas as mensagens são renderizadas a partir dos templates da tabela `message_templates`, permitindo customização dinâmica de variáveis como `{{nome_paciente}}`, `{{hora_consulta}}`, `{{link_google}}`, etc., direto pelo Frontend.
- **Observabilidade**: Recomenda-se configurar alertas e auditoria nos logs do Python e do Node.js, ou conectar a um serviço como o Sentry para rastrear falhas operacionais e exceções nas ferramentas.
