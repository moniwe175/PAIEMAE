# Sync Financeiro — Google Sheets → Supabase

Script Python que mantém o Supabase como **espelho exato** da planilha Google Sheets.

---

## Como funciona

```
Google Sheets (fonte da verdade)
       ↓ leitura via gspread (Service Account)
 sync_financeiro.py
       ↓ full sync (upsert + delete de órfãos)
    Supabase → tabela: transactions
       ↓ Realtime WebSockets
    Frontend React (atualização automática)
```

A cada `SYNC_INTERVAL` segundos o script:
1. Lê **todas** as linhas da planilha
2. Mapeia cada linha em uma transação (ID = comanda)
3. Faz upsert no Supabase
4. Deleta do banco registros que foram removidos da planilha

---

## Pré-requisitos

- Python 3.10 ou superior
- Conta Google com acesso à planilha
- Projeto no Google Cloud com a API Google Sheets habilitada

---

## Passo 1 — Criar Service Account no Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto (ou use um existente)
3. Ative a **Google Sheets API**: menu → APIs & Services → Library → pesquise "Google Sheets API" → Ativar
4. Vá em **APIs & Services → Credentials → Create Credentials → Service Account**
5. Dê um nome (ex: `sync-financeiro`) e clique em **Create and continue**
6. Em "Grant this service account access", pode pular → **Done**
7. Clique no e-mail da Service Account criada → aba **Keys** → **Add Key → Create new key → JSON**
8. Baixe o arquivo `.json` e salve como **`credentials.json`** dentro da pasta `sync_financeiro/`

---

## Passo 2 — Compartilhar a planilha com a Service Account

1. Abra o arquivo `credentials.json` e copie o valor do campo `"client_email"`
   - Exemplo: `sync-financeiro@meu-projeto.iam.gserviceaccount.com`
2. Abra sua planilha Google Sheets
3. Clique em **Compartilhar** (botão verde no canto superior direito)
4. Cole o e-mail da Service Account e dê permissão de **Visualizador** (ou Editor se quiser)
5. Clique em **Enviar**

---

## Passo 3 — Configurar o .env

```bash
# Copie o exemplo
cp .env.example .env
```

Edite o arquivo `.env` e preencha:

| Variável | Onde encontrar |
|---|---|
| `SUPABASE_URL` | Painel Supabase → Settings → API → Project URL |
| `SUPABASE_KEY` | Painel Supabase → Settings → API → **service_role** key (não a anon!) |
| `SHEET_ID` | URL da planilha: `spreadsheets/d/**SEU_ID**/edit` |
| `SHEET_NAME` | Nome da aba, ex: `CAIXA 01` |
| `GOOGLE_CREDENTIALS_FILE` | Caminho do JSON baixado, ex: `credentials.json` |

> **⚠ Importante:** Use a `service_role` key do Supabase (não a `anon`). Ela permite operações de delete e upsert sem restrições de RLS.

---

## Passo 4 — Instalar dependências

```bash
# Dentro da pasta sync_financeiro/
pip install -r requirements.txt
```

---

## Passo 5 — Executar

```bash
python sync_financeiro.py
```

Você verá no terminal:
```
2026-07-25 10:30:00 [INFO] ============================================================
2026-07-25 10:30:00 [INFO]   SYNC FINANCEIRO — Google Sheets → Supabase
2026-07-25 10:30:00 [INFO] ============================================================
2026-07-25 10:30:00 [INFO] Clientes inicializados com sucesso. Iniciando loop de sync...
2026-07-25 10:30:01 [INFO] ─── Ciclo #1 ────────────────────────────
2026-07-25 10:30:02 [INFO] Planilha 'CAIXA 01' lida: 47 linhas brutas
2026-07-25 10:30:02 [INFO] Transações mapeadas: 32
2026-07-25 10:30:03 [INFO] ✅ Sync concluído em 2.1s — 32 upseridos, 0 deletados
2026-07-25 10:30:03 [INFO] Próximo sync em 30s...
```

---

## Mapeamento de colunas

A estrutura esperada da planilha (colunas em ordem):

| Índice | Coluna | Variável .env |
|---|---|---|
| 0 | cliente | `COL_CLIENTE=0` |
| 1 | profissional | `COL_PROFISSIONAL=1` |
| 2 | CRÉDITO | `COL_CREDITO=2` |
| 3 | DÉBITO | `COL_DEBITO=3` |
| 4 | DINHEIRO | `COL_DINHEIRO=4` |
| 5 | PIX | `COL_PIX=5` |
| 7 | COMANDA (ID único) | `COL_COMANDA=7` |

Se sua planilha tiver colunas em posições diferentes, ajuste os valores no `.env`.

---

## Rodar como serviço (Windows)

Para rodar automaticamente ao ligar o computador, crie um arquivo `iniciar_sync.bat`:

```batch
@echo off
cd /d C:\caminho\para\sync_financeiro
python sync_financeiro.py
pause
```

Coloque um atalho desse `.bat` em:
`C:\Users\SeuUsuario\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

---

## Proteções implementadas

- **Proteção contra delete em branco:** se a planilha retornar 0 transações mas tiver linhas, o sync é abortado (não apaga o banco)
- **Lotes de 100:** upsert em batches para evitar timeout
- **Logs no Supabase:** cada ciclo registra na tabela `sync_logs`, visível na aba Integração do ERP
- **Retry automático:** erros de rede não param o loop — próximo ciclo tenta novamente
