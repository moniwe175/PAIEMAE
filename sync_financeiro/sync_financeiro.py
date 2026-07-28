"""
sync_financeiro.py
==================
ETL: Google Sheets → Supabase (Espelho Inteligente com Reconciliação + Diff + Hash)

Arquitetura:
  1. Lê TODAS as linhas da planilha via gspread (Service Account)
  2. Camada de Normalização Inteligente de Colunas (Aliases)
     - Não depende de posições fixas ou nomes exatos das colunas.
     - Identifica dinamicamente colunas de cliente, profissional, comanda, e formas de pagamento.
  3. Identificação Única:
     - id = String(comanda).trim() (Apenas a comanda é a fonte de ID)
  4. Detecção Automática de Valor e Pagamento:
     - Percorre colunas de pagamento (crédito, débito, dinheiro, pix) e detecta o 1º valor > 0.
  5. Controle de Integridade:
     - Gera hash MD5 único da linha: hash = md5(cliente + profissional + valor + pagamento)
  6. Ordem Original:
     - ordem = posição da linha na planilha (1-indexed)
  7. Engine de Sync (Full Sync + Diff + Controlled Deletion):
     - Insere/Atualiza apenas se houver diferença no hash ou na ordem.
     - Deleta registros órfãos com validação de segurança.
"""

import os
import sys
import time
import logging
import unicodedata
import re
import hashlib
from datetime import datetime
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

# Dicionário de Aliases para Normalização Inteligente
ALIASES = {
    "credito": ["credito", "crédito", "cred", "cartao_credito", "cartao credito", "cartao de credito", "cartão de crédito"],
    "debito": ["debito", "débito", "cartao_debito", "deb", "cartao debito", "cartão de débito"],
    "dinheiro": ["dinheiro", "cash", "especie", "espécie"],
    "pix": ["pix", "transferencia", "transferência", "qr", "transf"],
    "cliente": ["cliente", "client", "nome", "paciente"],
    "profissional": ["profissional", "atendente", "barbeiro", "cabeleireiro", "medico", "medica", "médico", "médica", "funcionario", "pro"],
    "comanda": ["comanda", "id", "ticket", "codigo", "código", "num_comanda", "numero_comanda"],
}

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


# ─── Helpers de Normalização e Sanitização ──────────────────────────────────
def normalizar_texto(texto: str) -> str:
    """Normaliza texto removendo acentos, espaços extras e convertendo para minúsculo."""
    if not texto:
        return ""
    nfkd = unicodedata.normalize('NFD', str(texto))
    sem_acento = u"".join([c for c in nfkd if not unicodedata.combining(c)])
    limpo = sem_acento.lower().strip()
    limpo = re.sub(r'[\s_\-]+', '_', limpo)
    return limpo


def parse_value(raw) -> float:
    """Converte uma célula da planilha para float. Retorna 0.0 se inválido."""
    if raw is None or str(raw).strip() == "":
        return 0.0
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


def safe_get(row: list, idx: int, default: str = "") -> str:
    """Retorna o valor de uma coluna ou default se fora do range."""
    try:
        val = row[idx]
        return str(val).strip() if val is not None else default
    except IndexError:
        return default


def gerar_hash_linha(cliente: str, profissional: str, valor: float, pagamento: str) -> str:
    """
    Gera um hash MD5 único da linha para controle de integridade:
    hash = md5(cliente + profissional + valor + pagamento)
    """
    conteudo = f"{cliente.strip().lower()}|{profissional.strip().lower()}|{valor:.2f}|{pagamento.strip().lower()}"
    return hashlib.md5(conteudo.encode("utf-8")).hexdigest()


# ─── Reconhecimento Inteligente de Colunas ───────────────────────────────────
def mapear_colunas(rows: list[list]) -> tuple[dict[str, int], int]:
    """
    Detecta dinamicamente as colunas com base nos aliases.
    Retorna (mapa_colunas, indice_linha_cabecalho).
    """
    for row_idx in range(min(5, len(rows))):
        row = rows[row_idx]
        col_map = {}
        row_norm = [normalizar_texto(cell) for cell in row]

        for col_idx, cell_text in enumerate(row_norm):
            if not cell_text:
                continue
            for key, alias_list in ALIASES.items():
                if key in col_map:
                    continue
                for alias in alias_list:
                    alias_norm = normalizar_texto(alias)
                    if cell_text == alias_norm or alias_norm in cell_text or cell_text in alias_norm:
                        col_map[key] = col_idx
                        break

        # Se encontrou a comanda e pelo menos uma outra coluna relevante, valida como cabeçalho
        if "comanda" in col_map and ("cliente" in col_map or "credito" in col_map or "pix" in col_map):
            log.info(f"Cabeçalho normalizado detectado na linha {row_idx + 1}: {col_map}")
            return col_map, row_idx

    # Fallback para índices padrões/env se a detecção não for conclusiva
    log.warning("Cabeçalho inteligente não identificado com certeza nas primeiras 5 linhas. Usando mapeamento fallback.")
    fallback_map = {
        "cliente": int(os.getenv("COL_CLIENTE", "0")),
        "profissional": int(os.getenv("COL_PROFISSIONAL", "1")),
        "credito": int(os.getenv("COL_CREDITO", "2")),
        "debito": int(os.getenv("COL_DEBITO", "3")),
        "dinheiro": int(os.getenv("COL_DINHEIRO", "4")),
        "pix": int(os.getenv("COL_PIX", "5")),
        "comanda": int(os.getenv("COL_COMANDA", "7")),
    }
    return fallback_map, 0


def detectar_pagamento_dinamico(row: list, col_map: dict[str, int]) -> tuple[float, str]:
    """
    Percorre colunas de pagamento (crédito, débito, dinheiro, pix)
    Identifica o primeiro valor > 0.
    Retorna (valor, forma_pagamento).
    """
    formas = [
        ("credito", "credito"),
        ("debito", "debito"),
        ("dinheiro", "dinheiro"),
        ("pix", "pix"),
    ]
    for key, nome in formas:
        if key in col_map:
            idx = col_map[key]
            if idx < len(row):
                v = parse_value(row[idx])
                if v > 0:
                    return v, nome
    return 0.0, "pix"


# ─── Leitura e Mapeamento da Planilha ────────────────────────────────────────
def ler_planilha(gc, sheet_id: str, sheet_name: str) -> list[list]:
    """Abre a planilha e retorna todas as linhas como lista de listas."""
    spreadsheet = gc.open_by_key(sheet_id)
    if sheet_name:
        worksheet = spreadsheet.worksheet(sheet_name)
    else:
        worksheet = spreadsheet.get_worksheet(0)
    rows = worksheet.get_all_values()
    log.info(f"Planilha '{worksheet.title}' lida: {len(rows)} linhas brutas")
    return rows


def mapear_linhas(rows: list[list]) -> list[dict]:
    """
    Converte linhas da planilha em transações normalizadas com Hash e ID único (Comanda).
    """
    if not rows:
        return []

    col_map, header_idx = mapear_colunas(rows)
    transactions = []
    data_hoje = datetime.now().strftime("%d/%m/%Y")

    for i in range(header_idx + 1, len(rows)):
        row = rows[i]
        if not row or all(str(cell).strip() == "" for cell in row):
            continue

        # ID = exclusivamente o valor da comanda limpo
        comanda_idx = col_map.get("comanda", 7)
        comanda_raw = safe_get(row, comanda_idx)
        if not comanda_raw:
            continue

        comanda_id = str(comanda_raw).strip()
        # Ignora rótulos de cabeçalho repetidos ou palavras chave inválidas
        if not comanda_id or comanda_id.lower() in ("comanda", "id", "ticket", "código", "codigo", "--", "total"):
            continue

        cliente_idx = col_map.get("cliente", 0)
        prof_idx = col_map.get("profissional", 1)

        cliente = safe_get(row, cliente_idx) or "—"
        profissional = safe_get(row, prof_idx) or "—"

        valor, pagamento = detectar_pagamento_dinamico(row, col_map)
        if valor == 0.0:
            continue

        # Ordem original da linha na planilha (começando em 1)
        ordem = i - header_idx

        # Hash da linha para detecção de integridade
        line_hash = gerar_hash_linha(cliente, profissional, valor, pagamento)

        transactions.append({
            "id": comanda_id,                # PRIMARY KEY: comanda
            "comanda": comanda_id,
            "cliente": cliente,
            "profissional": profissional,
            "profissional_nome": profissional,
            "valor": valor,
            "total": valor,
            "pagamento": pagamento,
            "forma_pagamento": pagamento,
            "ordem": ordem,
            "hash": line_hash,
            "tipo": "receita",
            "status": "paid",
            "origem": "planilha",
            "data": data_hoje,
            "descricao": f"{cliente} - {profissional}",
        })

    return transactions


# ─── Operações no Supabase ───────────────────────────────────────────────────
def buscar_dados_banco(sb: Client) -> dict[str, dict]:
    """Retorna dict { id: { 'hash': str, 'ordem': int } } dos registros de origem 'planilha'."""
    resultado = sb.table("transactions").select("id, hash, ordem").eq("origem", "planilha").execute()
    if resultado.data:
        return {str(row["id"]): row for row in resultado.data}
    return {}


def upsert_batch(sb: Client, records: list[dict]) -> int:
    """Faz upsert em lotes de 100 registros utilizando onConflict='id'."""
    BATCH_SIZE = 100
    total = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        sb.table("transactions").upsert(batch, on_conflict="id").execute()
        total += len(batch)
    return total


def deletar_orfaos(sb: Client, ids_para_deletar: set[str]) -> int:
    """Deleta registros do banco que foram removidos da planilha."""
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


# ─── Ciclo de Sync Inteligente ────────────────────────────────────────────────
def executar_sync(sb: Client, gc, sheet_id: str, sheet_name: str) -> dict:
    """
    Executa um ciclo completo de sincronização inteligente com diff + hash.
    """
    inicio = time.time()
    log.info("▶ Iniciando ciclo de sync inteligente...")

    # 1. Ler planilha
    try:
        rows = ler_planilha(gc, sheet_id, sheet_name)
    except Exception as e:
        msg = f"Erro ao ler planilha: {e}"
        log.error(msg)
        registrar_log(sb, "sync", "error", msg)
        return {"ok": False, "error": str(e)}

    # 2. Mapear linhas normalizadas
    transactions = mapear_linhas(rows)
    log.info(f"Transações mapeadas da planilha: {len(transactions)}")

    # Proteção de deleção controlada: nunca apagar se a leitura for inválida ou zerada sem motivo
    if len(rows) > 3 and len(transactions) == 0:
        msg = "Proteção ativada: planilha com linhas mas nenhuma transação válida encontrada. Sync abortado."
        log.warning(msg)
        registrar_log(sb, "sync", "warning", msg)
        return {"ok": False, "error": msg}

    # 3. Buscar dados atuais do banco
    banco_map = buscar_dados_banco(sb)
    ids_banco = set(banco_map.keys())
    ids_planilha = {t["id"] for t in transactions}

    # 4. Filtrar quais transações realmente precisam de upsert (novas ou com hash/ordem alterado)
    para_upsert = []
    for tx in transactions:
        tx_id = tx["id"]
        if tx_id not in banco_map:
            para_upsert.append(tx)
        else:
            db_row = banco_map[tx_id]
            if db_row.get("hash") != tx["hash"] or db_row.get("ordem") != tx["ordem"]:
                para_upsert.append(tx)

    # 5. Identificar removidos (deleção controlada de órfãos)
    ids_para_deletar = ids_banco - ids_planilha

    log.info(f"Diff apurado: {len(para_upsert)} para atualizar/inserir, {len(ids_para_deletar)} para deletar")

    # 6. Deletar órfãos se a planilha for válida
    deletados = 0
    if ids_para_deletar:
        deletados = deletar_orfaos(sb, ids_para_deletar)

    # 7. Upsert de alterações/novidades
    upseridos = 0
    if para_upsert:
        try:
            upseridos = upsert_batch(sb, para_upsert)
        except Exception as e:
            msg = f"Erro no upsert: {e}"
            log.error(msg)
            registrar_log(sb, "sync", "error", msg)
            return {"ok": False, "error": str(e)}

    duracao = round(time.time() - inicio, 2)
    msg = (
        f"✅ Sync concluído em {duracao}s — "
        f"{upseridos} atualizados/inseridos, {deletados} deletados, "
        f"total de {len(transactions)} transações espelhadas"
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


# ─── Ponto de Entrada ─────────────────────────────────────────────────────────
def main():
    log.info("=" * 60)
    log.info("  SYNC FINANCEIRO — Google Sheets → Supabase (Espelho Inteligente)")
    log.info("=" * 60)

    if not SHEET_ID:
        log.error("SHEET_ID não configurado no .env")
        sys.exit(1)

    log.info(f"Sheet ID : {SHEET_ID}")
    log.info(f"Sheet Aba: {SHEET_NAME or '(primeira aba)'}")
    log.info(f"Intervalo: {SYNC_INTERVAL}s")
    log.info(f"Supabase : {SUPABASE_URL}")
    log.info("")

    sb = init_supabase()
    gc = init_gspread()

    log.info("Clientes inicializados com sucesso. Loop de sincronização ativo.")
    log.info("")

    ciclo = 0
    while True:
        ciclo += 1
        log.info(f"─── Ciclo #{ciclo} ────────────────────────────")
        try:
            resultado = executar_sync(sb, gc, SHEET_ID, SHEET_NAME)
            if resultado["ok"]:
                log.info(
                    f"✔ Sucesso: {resultado['upseridos']} alterados, "
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
