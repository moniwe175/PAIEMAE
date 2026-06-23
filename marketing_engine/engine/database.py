"""
engine/database.py
Camada de acesso a dados (Supabase / PostgreSQL).

Schema real do PAIEMAE:
  - Tabela `clients`
      id          integer (PK)
      name        text
      phone       text
      birthdate   date  (YYYY-MM-DD)
      last_visit  date
      status      'active' | 'inactive'

  - Tabela `appointments`
      id                integer (PK)
      client_id         integer (FK → clients.id)
      client_name       text
      client_phone      text
      appointment_date  date
      appointment_time  time
      status            'scheduled'|'confirmed'|'cancelled'|'no_show'|'completed'

  - Tabela `marketing_log`
      id          integer (PK, serial)
      client_id   integer (FK → clients.id)
      tool_name   text
      channel     text
      status      text
      payload     jsonb
      created_at  timestamptz (default now())

  - Tabela `marketing_approval_queue`
      id            integer (PK, serial)
      client_id     integer (FK → clients.id)
      client_name   text
      client_phone  text
      strategy      text
      suggested_message text
      context       jsonb
      status        text  (default 'pending')

  - Tabela `marketing_engine_settings`
      id       integer (PK)
      enabled  boolean

Regra de ouro: nenhum outro módulo fala diretamente com o Supabase —
tudo passa por aqui.
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

def already_notified_today(db: Client, client_id: int, tool_name: str) -> bool:
    """
    Evita duplicar o disparo da mesma ferramenta para o mesmo cliente no
    mesmo dia (o scheduler pode rodar várias vezes ao dia).
    client_id é integer — FK real da tabela clients.
    """
    today_start = datetime.combine(date.today(), datetime.min.time()).isoformat()
    resp = (
        db.table("marketing_log")
        .select("id")
        .eq("client_id", client_id)
        .eq("tool_name", tool_name)
        .gte("created_at", today_start)
        .execute()
    )
    return len(resp.data) > 0


def log_dispatch(
    db: Client,
    client_id: int,
    tool_name: str,
    channel: str,
    status: str,
    payload: dict | None = None,
):
    """Registra todo disparo (auto) ou enfileiramento (approval) para auditoria."""
    db.table("marketing_log").insert(
        {
            "client_id": client_id,
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
# (cada função alimenta o `finder` de um Tool em engine/rules.py)
# ---------------------------------------------------------------------------

def get_clients_with_birthday_today(db: Client) -> list[dict]:
    """
    Clientes cujo aniversário é hoje.
    Usa EXTRACT para comparar apenas dia e mês, ignorando o ano.
    Filtra apenas clients com status='active'.
    """
    today = date.today()
    resp = (
        db.table("clients")
        .select("*")
        .eq("status", "active")
        .not_("birthdate", "is", "null")
        .execute()
    )
    # Filtragem em Python: extrai dia e mês do birthdate e compara com hoje
    result = []
    for c in resp.data:
        bd_str = c.get("birthdate")
        if not bd_str:
            continue
        try:
            if isinstance(bd_str, str):
                bd = date.fromisoformat(bd_str[:10])  # garante só YYYY-MM-DD
            else:
                bd = bd_str
            if bd.day == today.day and bd.month == today.month:
                result.append(c)
        except (ValueError, AttributeError):
            continue
    return result


def get_cold_leads(db: Client, days_inactive: int = 60) -> list[dict]:
    """
    Clientes ativos sem visita há X dias — candidatos a reaquecimento.
    Usa o campo `last_visit` da tabela clients.
    """
    cutoff = (date.today() - timedelta(days=days_inactive)).isoformat()
    resp = (
        db.table("clients")
        .select("*")
        .eq("status", "active")
        .not_("last_visit", "is", "null")
        .lte("last_visit", cutoff)
        .execute()
    )
    return resp.data


def get_no_show_appointments(db: Client, days_window: int = 1) -> list[dict]:
    """
    Agendamentos com status 'no_show' no último dia.
    Faz JOIN com clients via client_id para retornar dados do cliente.
    Retorna lista de dicts com campos de appointments + clients aninhado.
    """
    cutoff = (date.today() - timedelta(days=days_window)).isoformat()
    resp = (
        db.table("appointments")
        .select("*, clients(*)")
        .eq("status", "no_show")
        .gte("appointment_date", cutoff)
        .execute()
    )
    return resp.data
