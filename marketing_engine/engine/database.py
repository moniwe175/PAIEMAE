"""
engine/database.py
Camada de acesso a dados (Supabase / PostgreSQL).

Adaptado para o schema real do PAIEMAE:
  - Tabela `pacientes` (em vez de `patients`)
  - Tabela `agendamentos` (em vez de `appointments`)
  - Campos em português: nome, telefone, data_nascimento, status, etc.
  - Filtro de pacientes ativos via `status = 'ativo'` (em vez de `active = True`)
  - Filtro LGPD via `whatsapp_opt_out = False`

Regra de ouro: nenhum outro módulo do sistema fala diretamente com o
Supabase — tudo passa por aqui.
"""
from datetime import datetime, date, timedelta

from supabase import create_client, Client

from config.settings import settings


def get_client() -> Client:
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_SERVICE_KEY não configurados. Confira o .env"
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


# ---------------------------------------------------------------------------
# Helpers genéricos (idempotência e auditoria)
# ---------------------------------------------------------------------------

def already_notified_today(db: Client, paciente_id: str, tool_name: str) -> bool:
    """
    Evita duplicar o disparo da mesma ferramenta para o mesmo paciente no
    mesmo dia (essencial: o ciclo do scheduler roda várias vezes ao dia).
    """
    today_start = datetime.combine(date.today(), datetime.min.time()).isoformat()
    resp = (
        db.table("marketing_log")
        .select("id")
        .eq("paciente_id", paciente_id)
        .eq("tool_name", tool_name)
        .gte("created_at", today_start)
        .execute()
    )
    return len(resp.data) > 0


def log_dispatch(
    db: Client,
    paciente_id: str,
    tool_name: str,
    channel: str,
    status: str,
    payload: dict | None = None,
):
    """Registra todo disparo (auto) ou enfileiramento (approval) para auditoria."""
    db.table("marketing_log").insert(
        {
            "paciente_id": paciente_id,
            "tool_name": tool_name,
            "channel": channel,   # "whatsapp" | "approval_queue"
            "status": status,     # "sent" | "failed" | "queued"
            "payload": payload or {},
        }
    ).execute()


def is_engine_enabled(db: Client) -> bool:
    """
    Lê `marketing_engine_settings` (linha única, id=1).
    Se a tabela ou a linha não existir, retorna True (motor ligado por padrão).
    """
    try:
        resp = (
            db.table("marketing_engine_settings")
            .select("enabled")
            .eq("id", 1)
            .maybe_single()
            .execute()
        )
        if resp.data is None:
            return True
        return resp.data.get("enabled", True)
    except Exception:
        return True


# ---------------------------------------------------------------------------
# Queries específicas por ferramenta
# (cada função aqui alimenta o `finder` de um Tool em engine/rules.py)
# ---------------------------------------------------------------------------

def get_patients_with_birthday_today(db: Client) -> list[dict]:
    """
    Pacientes cujo aniversário é hoje.
    Filtra por `status = 'ativo'` e `whatsapp_opt_out = False` (LGPD).
    """
    today = date.today()
    resp = (
        db.table("pacientes")
        .select("*")
        .eq("status", "ativo")
        .eq("whatsapp_opt_out", False)
        .not_("data_nascimento", "is", "null")
        .execute()
    )
    return [
        p for p in resp.data
        if p.get("data_nascimento") and _is_same_day_month(p["data_nascimento"], today)
    ]


def _is_same_day_month(birth_date_str: str, today: date) -> bool:
    """Compara dia/mês de uma data (string ISO ou date) com hoje."""
    if isinstance(birth_date_str, str):
        bd = datetime.fromisoformat(birth_date_str).date()
    else:
        bd = birth_date_str
    return bd.day == today.day and bd.month == today.month


def get_cold_leads(db: Client, days_inactive: int = 60) -> list[dict]:
    """
    Pacientes sem agendamento há X dias — candidatos a reaquecimento.
    Usa o campo `ultimo_agendamento` da tabela pacientes.
    """
    cutoff = (datetime.now() - timedelta(days=days_inactive)).isoformat()
    resp = (
        db.table("pacientes")
        .select("*")
        .eq("status", "ativo")
        .eq("whatsapp_opt_out", False)
        .lte("ultimo_agendamento", cutoff)
        .execute()
    )
    return resp.data


def get_no_show_patients(db: Client, hours_window: int = 24) -> list[dict]:
    """
    Pacientes cujo agendamento teve status 'no_show' nas últimas N horas.
    Lê da tabela `agendamentos` e faz join com `pacientes`.
    """
    cutoff = (datetime.now() - timedelta(hours=hours_window)).isoformat()
    resp = (
        db.table("agendamentos")
        .select("*, pacientes(*)")
        .eq("status", "no_show")
        .gte("created_at", cutoff)
        .execute()
    )
    return resp.data

