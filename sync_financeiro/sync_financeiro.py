"""
sync_financeiro.py
==================
ETL: Google Sheets → Supabase (full sync com reconciliação)

Fluxo:
  1. Lê TODAS as linhas da planilha via gspread (Service Account)
  2. Mapeia cada linha → transação (usando COMANDA como ID único)
  3. Full sync no Supabase:
     - upsert de todos os registros
     - deleta do banco os IDs que não estão mais na planilha
  4. Registra logs na tabela sync_logs
  5. Roda em loop (SYNC_INTERVAL segundos)

Estrutura esperada da planilha:
  Coluna 0: cliente
  Coluna 1: profissional
  Coluna 2: CRÉDITO
  Coluna 3: DÉBITO
  Coluna 4: DINHEIRO
  Coluna 5: PIX
  Coluna 6: (extra / ignorado)  ← ajuste se necessário
  Coluna 7: COMANDA  (ID único)

"""

import os
import sys
import time
import logging
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import gspread
from supabase import create_client, Client
from dotenv import load_dotenv

# ─── Configuração de logging ─────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("sync_financeiro")

# ─── Carregar variáveis de ambiente ──────────────────────────────────────────
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()
SHEET_ID = os.getenv("SHEET_ID", "").strip()
SHEET_NAME = os.getenv("SHEET_NAME", "").strip()      # nome da aba, ex: "CAIXA 01"
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL", "30")) # segundos entre cada sync
CREDENTIALS_FILE = os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json").strip()

# Índices de colunas (0-indexado) — ajuste conforme sua planilha
COL_CLIENTE      = int(os.getenv("COL_CLIENTE", "0"))
COL_PROFISSIONAL = int(os.getenv("COL_PROFISSIONAL", "1"))
COL_CREDITO      = int(os.getenv("COL_CREDITO", "2"))
COL_DEBITO       = int(os.getenv("COL_DEBITO", "3"))
COL_DINHEIRO     = int(os.getenv("COL_DINHEIRO", "4"))
COL_PIX          = int(os.getenv("COL_PIX", "5"))
COL_COMANDA      = int(os.getenv("COL_COMANDA", "7"))  # ID único

# ─── Inicializar clientes ────────────────────────────────────────────────────
def init_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def init_gspread():
    if not os.path.exists(CREDENTIALS_FILE):
        log.error(f"Arquivo de credenciais não encontrado: {CREDENTIALS_FILE}")
        log.error("Veja o README.md para instruções de como criar a Service Account.")
        sys.exit(1)
    gc = gspread.service_account(filename=CREDENTIALS_FILE)
    return gc


# ─── Helpers ─────────────────────────────────────────────────────────────────
def parse_value(raw) -> float:
    """Converte uma célula da planilha para float. Retorna 0.0 se inválido."""
    if raw is None or str(raw).strip() == "":
        return 0.0
    # Remove R$, espaços, converte vírgula para ponto
    cleaned = (
        str(raw)
        .strip()
        .replace("R$", "")
        .replace("\xa0", "")  # non-breaking space
        .replace(" ", "")
        .replace(".", "")     # milhar brasileiro: 1.000 → 1000
        .replace(",", ".")    # decimal: 100,50 → 100.50
    )
    try:
        return float(Decimal(cleaned))
    except (InvalidOperation, ValueError):
        return 0.0


def detectar_pagamento(row: list) -> tuple[float, str]:
    """
    Detecta o valor e a forma de pagamento da linha.
    Regra: primeiro campo > 0 dentre CRÉDITO, DÉBITO, DINHEIRO, PIX.
    Retorna (valor, forma_pagamento).
    """
    colunas = [
        (COL_CREDITO,  "credito"),
        (COL_DEBITO,   "debito"),
        (COL_DINHEIRO, "dinheiro"),
        (COL_PIX,      "pix"),
    ]
    for col_idx, nome in colunas:
        if col_idx < len(row):
            v = parse_value(row[col_idx])
            if v > 0:
                return v, nome
    return 0.0, "pix"


def safe_get(row: list, idx: int, default: str = "") -> str:
    """Retorna o valor de uma coluna ou default se fora do range."""
    try:
        val = row[idx]
        return str(val).strip() if val is not None else default
    except IndexError:
        return default


def linha_e_cabecalho(row: list) -> bool:
    """Detecta se a linha é um cabeçalho (ex: 'CLIENTE', 'PROFISSIONAL')."""
    if not row:
        return True
    primeiro = safe_get(row, COL_CLIENTE).upper()
    return primeiro in ("CLIENTE", "PACIENTE", "", "--")


# ─── Leitura da planilha ─────────────────────────────────────────────────────
def ler_planilha(gc, sheet_id: str, sheet_name: str) -> list[list]:
    """
    Abre a planilha e retorna todas as linhas como lista de listas.
    Se sheet_name estiver vazio, usa a primeira aba.
    """
    spreadsheet = gc.open_by_key(sheet_id)
    if sheet_name:
        worksheet = spreadsheet.worksheet(sheet_name)
    else:
        worksheet = spreadsheet.get_worksheet(0)
    rows = worksheet.get_all_values()
    log.info(f"Planilha '{worksheet.title}' lida: {len(rows)} linhas brutas")
    return rows


# ─── Mapeamento de linhas ────────────────────────────────────────────────────
def mapear_linhas(rows: list[list]) -> list[dict]:
    """
    Converte as linhas da planilha em transações prontas para o Supabase.
    Retorna lista de dicts com schema da tabela 'transactions'.
    """
    transactions = []
    data_hoje = datetime.now().strftime("%d/%m/%Y")

    for i, row in enumerate(rows):
        # Ignorar cabeçalho e linhas vazias
        if linha_e_cabecalho(row):
            continue

        comanda_raw = safe_get(row, COL_COMANDA)
        if not comanda_raw:
            # Sem comanda = sem ID único, ignorar linha
            continue

        comanda_id = comanda_raw.strip()

        cliente     = safe_get(row, COL_CLIENTE) or "—"
        profissional = safe_get(row, COL_PROFISSIONAL) or "—"

        valor, pagamento = detectar_pagamento(row)

        # Ignorar linhas sem valor
        if valor == 0.0:
            continue

        transactions.append({
            "id":               comanda_id,      # PK: exclusivamente a comanda
            "cliente":          cliente,
            "profissional":     profissional_nome(profissional),
            "valor":            valor,
            "total":            valor,
            "pagamento":        pagamento,
            "forma_pagamento":  pagamento,
            "comanda":          comanda_id,
            "ordem":            i + 1,            # preserva ordem da planilha
            "tipo":             "receita",
            "status":           "paid",
            "origem":           "planilha",
            "data":             data_hoje,
            # descricao e profissional_nome extras para compatibilidade
            "descricao":        cliente,
            "profissional_nome": profissional,
        })

    return transactions


def profissional_nome(val: str) -> float:
    """
    Compatibilidade com o schema: campo 'profissional' no banco é numérico (repasse).
    Retorna 0 — o nome vai em 'profissional_nome'.
    """
    return 0.0


# ─── Full sync Supabase ───────────────────────────────────────────────────────
def buscar_ids_banco(sb: Client) -> set[str]:
    """Retorna todos os IDs de origem 'planilha' que estão no banco."""
    resultado = sb.table("transactions").select("id").eq("origem", "planilha").execute()
    if resultado.data:
        return {str(row["id"]) for row in resultado.data}
    return set()


def upsert_batch(sb: Client, records: list[dict]) -> int:
    """Faz upsert em lotes de 100 registros. Retorna quantos foram upseridos."""
    BATCH_SIZE = 100
    total = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        resultado = (
            sb.table("transactions")
            .upsert(batch, on_conflict="id")
            .execute()
        )
        total += len(batch)
    return total


def deletar_orfaos(sb: Client, ids_para_deletar: set[str]) -> int:
    """Deleta registros do banco que não existem mais na planilha."""
    if not ids_para_deletar:
        return 0
    lista = list(ids_para_deletar)
    sb.table("transactions").delete().in_("id", lista).execute()
    log.info(f"Deletados {len(lista)} registros órfãos: {lista[:5]}{'...' if len(lista) > 5 else ''}")
    return len(lista)


def registrar_log(sb: Client, event: str, status: str, details: str):
    """Insere um log na tabela sync_logs."""
    try:
        sb.table("sync_logs").insert({
            "event": event,
            "status": status,
            "details": details,
            "type": status,
            "message": details,
        }).execute()
    except Exception as e:
        log.warning(f"Falha ao registrar log: {e}")


# ─── Ciclo de sync ────────────────────────────────────────────────────────────
def executar_sync(sb: Client, gc, sheet_id: str, sheet_name: str) -> dict:
    """
    Executa um ciclo completo de sync. Retorna dict com métricas.
    """
    inicio = time.time()
    log.info("▶ Iniciando ciclo de sync...")

    # 1. Ler planilha
    try:
        rows = ler_planilha(gc, sheet_id, sheet_name)
    except Exception as e:
        msg = f"Erro ao ler planilha: {e}"
        log.error(msg)
        registrar_log(sb, "sync", "error", msg)
        return {"ok": False, "error": str(e)}

    # 2. Mapear linhas → transações
    transactions = mapear_linhas(rows)
    log.info(f"Transações mapeadas: {len(transactions)}")

    # Proteção: se a leitura retornou 0 transações e a planilha tinha linhas,
    # pode ser um erro de parsing — não apaga o banco.
    if len(rows) > 5 and len(transactions) == 0:
        msg = "Proteção ativada: planilha com linhas mas sem transações mapeadas. Sync abortado."
        log.warning(msg)
        registrar_log(sb, "sync", "warning", msg)
        return {"ok": False, "error": msg}

    # 3. Buscar IDs existentes no banco (apenas os de origem 'planilha')
    ids_banco = buscar_ids_banco(sb)
    ids_planilha = {t["id"] for t in transactions}

    # 4. Identificar órfãos (existem no banco mas não na planilha)
    ids_para_deletar = ids_banco - ids_planilha

    # 5. Deletar órfãos
    deletados = deletar_orfaos(sb, ids_para_deletar)

    # 6. Upsert de todos os registros
    upseridos = 0
    if transactions:
        try:
            upseridos = upsert_batch(sb, transactions)
        except Exception as e:
            msg = f"Erro no upsert: {e}"
            log.error(msg)
            registrar_log(sb, "sync", "error", msg)
            return {"ok": False, "error": str(e)}

    duracao = round(time.time() - inicio, 2)
    msg = (
        f"✅ Sync concluído em {duracao}s — "
        f"{upseridos} upseridos, {deletados} deletados, "
        f"total na planilha: {len(transactions)}"
    )
    log.info(msg)
    registrar_log(sb, "sync", "success", msg)

    return {
        "ok": True,
        "upseridos": upseridos,
        "deletados": deletados,
        "total": len(transactions),
        "duracao": duracao,
    }


# ─── Ponto de entrada ─────────────────────────────────────────────────────────
def main():
    log.info("=" * 60)
    log.info("  SYNC FINANCEIRO — Google Sheets → Supabase")
    log.info("=" * 60)

    # Validações
    if not SHEET_ID:
        log.error("SHEET_ID não configurado no .env")
        sys.exit(1)

    log.info(f"Sheet ID : {SHEET_ID}")
    log.info(f"Sheet Aba: {SHEET_NAME or '(primeira aba)'}")
    log.info(f"Intervalo: {SYNC_INTERVAL}s")
    log.info(f"Supabase : {SUPABASE_URL}")
    log.info("")

    # Inicializar clientes
    sb = init_supabase()
    gc = init_gspread()

    log.info("Clientes inicializados com sucesso. Iniciando loop de sync...")
    log.info("")

    ciclo = 0
    while True:
        ciclo += 1
        log.info(f"─── Ciclo #{ciclo} ────────────────────────────")
        try:
            resultado = executar_sync(sb, gc, SHEET_ID, SHEET_NAME)
            if resultado["ok"]:
                log.info(
                    f"✔ Sucesso: {resultado['upseridos']} upseridos, "
                    f"{resultado['deletados']} deletados"
                )
            else:
                log.warning(f"⚠ Falha no ciclo: {resultado.get('error')}")
        except KeyboardInterrupt:
            log.info("\nInterrompido pelo usuário. Encerrando.")
            sys.exit(0)
        except Exception as e:
            log.error(f"Erro inesperado no ciclo #{ciclo}: {e}", exc_info=True)

        log.info(f"Próximo sync em {SYNC_INTERVAL}s...\n")
        time.sleep(SYNC_INTERVAL)


if __name__ == "__main__":
    main()
