"""
engine/rules.py — Marketing Engine (Versão Final Consolidada)
=============================================================
Coração do sistema. Define as 19 ferramentas divididas em:
  Grupo A (11): disparo automático → status 'approved'
  Grupo B  (8): edição humana      → status 'pending'

REGRAS FUNDAMENTAIS:
  1. ZERO texto fixo neste arquivo. Todo template vem de SELECT em message_templates.
  2. O Python decide QUEM e QUANDO — nunca O QUÊ dizer.
  3. Cronômetros imutáveis: editar o template no Frontend não reinicia nenhuma contagem.
  4. expires_at é definido aqui para gatilhos com janela crítica (Regra de Vencimento).
  5. already_queued() garante idempotência — nunca duplica um disparo.

PADRÃO DE RETORNO:
  Cada tool_* retorna list[QueueEntry].
  O MarketingEngine (marketing_engine.py) insere esses entries em marketing_queue.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Callable, Literal
from zoneinfo import ZoneInfo

from supabase import Client

from config.settings import settings

logger = logging.getLogger("rules")

# ─── Fuso horário e vocabulário de status ────────────────────────────────
# Os horários dos agendamentos (appointment_date/appointment_time) são
# gravados pelo site como horário LOCAL da clínica. Janelas de data/hora
# usam now_clinic(); now_utc() só compara colunas timestamptz
# (created_at/updated_at).
CLINIC_TZ = ZoneInfo("America/Sao_Paulo")


def now_clinic() -> datetime:
    """Agora no fuso da clínica (comparável com appointment_time)."""
    return datetime.now(CLINIC_TZ)


# Status que o SITE realmente grava (aceita também legados em inglês):
STATUS_ATIVOS = ["aguardando_confirmacao", "agendado", "confirmado",
                 "em_atendimento", "scheduled", "confirmed"]
STATUS_CONCLUIDO = ["finalizado", "completed"]
STATUS_NOSHOW = ["cliente_faltou", "falta", "no_show"]
STATUS_CANCELADO = ["cancelado", "cancelled"]
STATUS_CLIENTE_ATIVO = ["ativo", "active"]

# ---------------------------------------------------------------------------
# Tipos
# ---------------------------------------------------------------------------

Group = Literal["A", "B"]


@dataclass
class QueueEntry:
    """Representa uma mensagem pronta para inserção em marketing_queue."""
    client_id:      int
    client_name:    str
    client_phone:   str
    tool_id:        int
    tool_name:      str
    group_type:     Group
    message_text:   str             # template já renderizado (tags substituídas)
    scheduled_at:   datetime
    expires_at:     datetime | None = None
    appointment_id: str | None = None
    context_data:   dict = field(default_factory=dict)

    @property
    def status(self) -> str:
        return "approved" if self.group_type == "A" else "pending"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def render(template_text: str, tags: dict) -> str:
    """Substitui as tags {{chave}} pelos valores do dict."""
    result = template_text
    for key, value in tags.items():
        result = result.replace(f"{{{{{key}}}}}", str(value) if value is not None else "")
    return result


def get_template(db: Client, tool_id: int) -> dict | None:
    """
    Busca o template ativo da ferramenta.
    Retorna None se a ferramenta não existir ou estiver desativada (active = false).
    """
    resp = (
        db.table("message_templates")
        .select("tool_id, tool_name, group_type, template_text, active")
        .eq("tool_id", tool_id)
        .single()
        .execute()
    )
    if not resp.data or not resp.data.get("active"):
        return None
    return resp.data


def get_config(db: Client, key: str, default: str = "") -> str:
    """Lê um valor de integration_configs. Retorna default se não encontrar."""
    try:
        resp = (
            db.table("integration_configs")
            .select("value")
            .eq("key", key)
            .single()
            .execute()
        )
        return resp.data.get("value", default) if resp.data else default
    except Exception:
        return default


def already_queued(db: Client, client_id: int, tool_id: int, window_hours: int = 24) -> bool:
    """
    Idempotência: verifica se já existe entrada na fila para este (cliente, ferramenta)
    nas últimas `window_hours` horas. Evita duplicar disparos quando o scheduler
    roda múltiplas vezes ao dia.
    """
    cutoff = (now_utc() - timedelta(hours=window_hours)).isoformat()
    resp = (
        db.table("marketing_queue")
        .select("id")
        .eq("client_id", client_id)
        .eq("tool_id", tool_id)
        .gte("created_at", cutoff)
        .in_("status", ["pending", "approved", "sent"])
        .execute()
    )
    return len(resp.data) > 0


def is_engine_enabled(db: Client) -> bool:
    """Lê o toggle liga/desliga do motor em marketing_engine_settings."""
    try:
        resp = (
            db.table("marketing_engine_settings")
            .select("enabled")
            .eq("id", 1)
            .single()
            .execute()
        )
        return resp.data.get("enabled", True) if resp.data else True
    except Exception:
        return True  # default: habilitado se tabela não existir


# ===========================================================================
# GRUPO A — 11 ferramentas automáticas (→ status: 'approved')
# ===========================================================================

def tool_01_lembrete_24h(db: Client) -> list[QueueEntry]:
    """Consultas agendadas para amanhã ainda sem lembrete enviado."""
    tmpl = get_template(db, 1)
    if not tmpl:
        return []

    tomorrow = (now_clinic().date() + timedelta(days=1)).isoformat()
    resp = (
        db.table("appointments")
        .select("id, client_id, client_name, client_phone, appointment_date, appointment_time, procedure, professional")
        .eq("appointment_date", tomorrow)
        .in_("status", STATUS_ATIVOS)
        .execute()
    )

    entries = []
    for appt in resp.data or []:
        if not appt.get("client_id") or not appt.get("client_phone"):
            continue
        if already_queued(db, appt["client_id"], 1):
            continue

        tags = {
            "nome_paciente":     appt.get("client_name", ""),
            "nome_profissional": appt.get("professional", "nossa equipe"),
            "hora_consulta":     str(appt.get("appointment_time", ""))[:5],
            "data_consulta":     appt.get("appointment_date", ""),
        }
        entries.append(QueueEntry(
            client_id=appt["client_id"],
            client_name=appt["client_name"],
            client_phone=appt["client_phone"],
            tool_id=1,
            tool_name=tmpl["tool_name"],
            group_type="A",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            appointment_id=appt["id"],
        ))
    return entries


def tool_02_lembrete_2h(db: Client) -> list[QueueEntry]:
    """Consultas em aproximadamente 2h a partir de agora (janela ±5min)."""
    tmpl = get_template(db, 2)
    if not tmpl:
        return []

    now = now_clinic()
    target_start = now + timedelta(hours=1, minutes=55)
    target_end   = now + timedelta(hours=2, minutes=5)
    today = now.date().isoformat()

    resp = (
        db.table("appointments")
        .select("id, client_id, client_name, client_phone, appointment_time, procedure, professional")
        .eq("appointment_date", today)
        .in_("status", STATUS_ATIVOS)
        .execute()
    )

    entries = []
    for appt in resp.data or []:
        if not appt.get("client_id") or not appt.get("appointment_time"):
            continue

        appt_dt = datetime.fromisoformat(f"{today}T{appt['appointment_time']}").replace(
            tzinfo=CLINIC_TZ
        )
        if not (target_start <= appt_dt <= target_end):
            continue
        if already_queued(db, appt["client_id"], 2, window_hours=4):
            continue

        tags = {
            "nome_paciente":     appt.get("client_name", ""),
            "nome_profissional": appt.get("professional", "nossa equipe"),
            "hora_consulta":     str(appt["appointment_time"])[:5],
        }
        entries.append(QueueEntry(
            client_id=appt["client_id"],
            client_name=appt["client_name"],
            client_phone=appt["client_phone"],
            tool_id=2,
            tool_name=tmpl["tool_name"],
            group_type="A",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            appointment_id=appt["id"],
        ))
    return entries


def tool_03_alerta_atraso_15min(db: Client) -> list[QueueEntry]:
    """
    Paciente não chegou 15min após horário da consulta.
    ⚠️ REGRA DE VENCIMENTO: expires_at = horário_consulta + 1h
    Se o Baileys ligar depois disso, muda para 'expired' automaticamente.
    """
    tmpl = get_template(db, 3)
    if not tmpl:
        return []

    now      = now_clinic()
    win_start = now - timedelta(minutes=20)
    win_end   = now - timedelta(minutes=10)
    today    = now.date().isoformat()

    resp = (
        db.table("appointments")
        .select("id, client_id, client_name, client_phone, appointment_time, professional")
        .eq("appointment_date", today)
        .in_("status", STATUS_ATIVOS)
        .execute()
    )

    entries = []
    for appt in resp.data or []:
        if not appt.get("client_id") or not appt.get("appointment_time"):
            continue

        appt_dt = datetime.fromisoformat(f"{today}T{appt['appointment_time']}").replace(
            tzinfo=CLINIC_TZ
        )
        if not (win_start <= appt_dt <= win_end):
            continue
        if already_queued(db, appt["client_id"], 3, window_hours=2):
            continue

        tags = {
            "nome_paciente": appt.get("client_name", ""),
            "hora_consulta": str(appt["appointment_time"])[:5],
        }
        entries.append(QueueEntry(
            client_id=appt["client_id"],
            client_name=appt["client_name"],
            client_phone=appt["client_phone"],
            tool_id=3,
            tool_name=tmpl["tool_name"],
            group_type="A",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            expires_at=appt_dt + timedelta(hours=1),  # ← Regra de Vencimento
            appointment_id=appt["id"],
        ))
    return entries


def tool_04_no_show_24h(db: Client) -> list[QueueEntry]:
    """Consultas com status no_show nas últimas 24h."""
    tmpl = get_template(db, 4)
    if not tmpl:
        return []

    yesterday = (now_clinic().date() - timedelta(days=1)).isoformat()
    resp = (
        db.table("appointments")
        .select("id, client_id, client_name, client_phone, appointment_time")
        .eq("appointment_date", yesterday)
        .in_("status", STATUS_NOSHOW)
        .execute()
    )

    entries = []
    for appt in resp.data or []:
        if not appt.get("client_id"):
            continue
        if already_queued(db, appt["client_id"], 4):
            continue

        tags = {
            "nome_paciente": appt.get("client_name", ""),
            "hora_consulta": str(appt.get("appointment_time", ""))[:5],
        }
        entries.append(QueueEntry(
            client_id=appt["client_id"],
            client_name=appt["client_name"],
            client_phone=appt["client_phone"],
            tool_id=4,
            tool_name=tmpl["tool_name"],
            group_type="A",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            appointment_id=appt["id"],
        ))
    return entries


def tool_05_aniversario(db: Client) -> list[QueueEntry]:
    """Clientes que fazem aniversário hoje. Filtra whatsapp_opt_out = false."""
    tmpl = get_template(db, 5)
    if not tmpl:
        return []

    today = now_clinic().date()
    resp = (
        db.table("clients")
        .select("id, name, phone, birthdate")
        .in_("status", STATUS_CLIENTE_ATIVO)
        .not_.is_("birthdate", "null")
        .eq("whatsapp_opt_out", False)
        .execute()
    )

    entries = []
    for client in resp.data or []:
        try:
            bd = date.fromisoformat(str(client["birthdate"])[:10])
        except (TypeError, ValueError):
            continue
        if bd.day != today.day or bd.month != today.month:
            continue
        if not client.get("phone"):
            continue
        if already_queued(db, client["id"], 5):
            continue

        tags = {"nome_paciente": client["name"].split()[0]}
        entries.append(QueueEntry(
            client_id=client["id"],
            client_name=client["name"],
            client_phone=client["phone"],
            tool_id=5,
            tool_name=tmpl["tool_name"],
            group_type="A",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
        ))
    return entries


def tool_06_boas_vindas(db: Client) -> list[QueueEntry]:
    """
    Clientes com exatamente 1 consulta concluída (primeira visita).
    Gatilho: total_consultas_concluidas = 1 (incrementado pelo backend ao concluir).
    Busca consultas concluídas nas últimas 2h para capturar recém-concluídas.
    """
    tmpl = get_template(db, 6)
    if not tmpl:
        return []

    link_google = get_config(db, "google_review_link")

    cutoff = (now_utc() - timedelta(hours=2)).isoformat()
    resp = (
        db.table("appointments")
        .select("id, client_id, client_name, client_phone")
        .in_("status", STATUS_CONCLUIDO)
        .gte("updated_at", cutoff)
        .execute()
    )

    entries = []
    for appt in resp.data or []:
        if not appt.get("client_id"):
            continue

        # Confirmar que é exatamente a 1ª consulta concluída
        count_resp = (
            db.table("appointments")
            .select("id", count="exact")
            .eq("client_id", appt["client_id"])
            .in_("status", STATUS_CONCLUIDO)
            .execute()
        )
        if count_resp.count != 1:
            continue
        if already_queued(db, appt["client_id"], 6):
            continue

        tags = {
            "nome_paciente": appt["client_name"].split()[0],
            "link_google":   link_google,
        }
        entries.append(QueueEntry(
            client_id=appt["client_id"],
            client_name=appt["client_name"],
            client_phone=appt["client_phone"],
            tool_id=6,
            tool_name=tmpl["tool_name"],
            group_type="A",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            appointment_id=appt["id"],
        ))
    return entries


def tool_07_confirmacao_agendamento(db: Client) -> list[QueueEntry]:
    """
    Novos agendamentos criados nos últimos 30 minutos.
    Disparo imediato ao marcar no sistema.
    """
    tmpl = get_template(db, 7)
    if not tmpl:
        return []

    cutoff = (now_utc() - timedelta(minutes=30)).isoformat()
    resp = (
        db.table("appointments")
        .select("id, client_id, client_name, client_phone, appointment_date, appointment_time, procedure, professional")
        .gte("created_at", cutoff)
        .in_("status", STATUS_ATIVOS)
        .execute()
    )

    entries = []
    for appt in resp.data or []:
        if not appt.get("client_id"):
            continue
        if already_queued(db, appt["client_id"], 7, window_hours=1):
            continue

        tags = {
            "nome_paciente":     appt.get("client_name", "").split()[0],
            "nome_servico":      appt.get("procedure", "procedimento"),
            "nome_profissional": appt.get("professional", "nossa equipe"),
            "data_consulta":     appt.get("appointment_date", ""),
            "hora_consulta":     str(appt.get("appointment_time", ""))[:5],
        }
        entries.append(QueueEntry(
            client_id=appt["client_id"],
            client_name=appt["client_name"],
            client_phone=appt["client_phone"],
            tool_id=7,
            tool_name=tmpl["tool_name"],
            group_type="A",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            appointment_id=appt["id"],
        ))
    return entries


def tool_08_pre_procedimento(db: Client) -> list[QueueEntry]:
    """
    Consultas de amanhã para serviços com exige_preparo = true.
    Dispara orientações 24h antes.
    """
    tmpl = get_template(db, 8)
    if not tmpl:
        return []

    tomorrow = (now_clinic().date() + timedelta(days=1)).isoformat()

    servicos_resp = (
        db.table("servicos")
        .select("nome")
        .eq("exige_preparo", True)
        .eq("ativo", True)
        .execute()
    )
    nomes_preparo = {s["nome"].lower() for s in (servicos_resp.data or [])}
    if not nomes_preparo:
        return []

    resp = (
        db.table("appointments")
        .select("id, client_id, client_name, client_phone, appointment_time, procedure, professional")
        .eq("appointment_date", tomorrow)
        .in_("status", STATUS_ATIVOS)
        .execute()
    )

    entries = []
    for appt in resp.data or []:
        if not appt.get("client_id"):
            continue
        if (appt.get("procedure") or "").lower() not in nomes_preparo:
            continue
        if already_queued(db, appt["client_id"], 8):
            continue

        tags = {
            "nome_paciente": appt.get("client_name", "").split()[0],
            "nome_servico":  appt.get("procedure", "procedimento"),
        }
        entries.append(QueueEntry(
            client_id=appt["client_id"],
            client_name=appt["client_name"],
            client_phone=appt["client_phone"],
            tool_id=8,
            tool_name=tmpl["tool_name"],
            group_type="A",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            appointment_id=appt["id"],
        ))
    return entries


def tool_09_pos_procedimento(db: Client) -> list[QueueEntry]:
    """
    Consultas concluídas ontem para serviços com exige_pos_procedimento = true.
    Dispara dicas 24h após o procedimento.
    """
    tmpl = get_template(db, 9)
    if not tmpl:
        return []

    yesterday = (now_clinic().date() - timedelta(days=1)).isoformat()

    servicos_resp = (
        db.table("servicos")
        .select("nome")
        .eq("exige_pos_procedimento", True)
        .eq("ativo", True)
        .execute()
    )
    nomes_pos = {s["nome"].lower() for s in (servicos_resp.data or [])}
    if not nomes_pos:
        return []

    resp = (
        db.table("appointments")
        .select("id, client_id, client_name, client_phone, procedure")
        .eq("appointment_date", yesterday)
        .in_("status", STATUS_CONCLUIDO)
        .execute()
    )

    entries = []
    for appt in resp.data or []:
        if not appt.get("client_id"):
            continue
        if (appt.get("procedure") or "").lower() not in nomes_pos:
            continue
        if already_queued(db, appt["client_id"], 9):
            continue

        tags = {
            "nome_paciente": appt.get("client_name", "").split()[0],
            "nome_servico":  appt.get("procedure", "procedimento"),
        }
        entries.append(QueueEntry(
            client_id=appt["client_id"],
            client_name=appt["client_name"],
            client_phone=appt["client_phone"],
            tool_id=9,
            tool_name=tmpl["tool_name"],
            group_type="A",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            appointment_id=appt["id"],
        ))
    return entries


def tool_10_lembrete_exames(db: Client) -> list[QueueEntry]:
    """
    Consultas de amanhã com flag exames_pendentes = true.
    A recepcionista marca esse flag no agendamento.
    """
    tmpl = get_template(db, 10)
    if not tmpl:
        return []

    tomorrow = (now_clinic().date() + timedelta(days=1)).isoformat()
    resp = (
        db.table("appointments")
        .select("id, client_id, client_name, client_phone")
        .eq("appointment_date", tomorrow)
        .eq("exames_pendentes", True)
        .in_("status", STATUS_ATIVOS)
        .execute()
    )

    entries = []
    for appt in resp.data or []:
        if not appt.get("client_id"):
            continue
        if already_queued(db, appt["client_id"], 10, window_hours=24 * 7):
            continue

        tags = {"nome_paciente": appt.get("client_name", "").split()[0]}
        entries.append(QueueEntry(
            client_id=appt["client_id"],
            client_name=appt["client_name"],
            client_phone=appt["client_phone"],
            tool_id=10,
            tool_name=tmpl["tool_name"],
            group_type="A",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            appointment_id=appt["id"],
        ))
    return entries


def tool_11_nps(db: Client, dias_apos_consulta: int = settings.NPS_DIAS_APOS_CONSULTA) -> list[QueueEntry]:
    """
    Pesquisa de satisfação X dias após consulta concluída.
    Configurável via settings.NPS_DIAS_APOS_CONSULTA.
    """
    tmpl = get_template(db, 11)
    if not tmpl:
        return []

    target_date = (now_clinic().date() - timedelta(days=dias_apos_consulta)).isoformat()
    resp = (
        db.table("appointments")
        .select("id, client_id, client_name, client_phone")
        .eq("appointment_date", target_date)
        .in_("status", STATUS_CONCLUIDO)
        .execute()
    )

    entries = []
    for appt in resp.data or []:
        if not appt.get("client_id"):
            continue
        if already_queued(db, appt["client_id"], 11, window_hours=24 * 7):
            continue

        tags = {"nome_paciente": appt.get("client_name", "").split()[0]}
        entries.append(QueueEntry(
            client_id=appt["client_id"],
            client_name=appt["client_name"],
            client_phone=appt["client_phone"],
            tool_id=11,
            tool_name=tmpl["tool_name"],
            group_type="A",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            appointment_id=appt["id"],
        ))
    return entries


# ===========================================================================
# GRUPO B — 8 ferramentas com edição humana (→ status: 'pending')
# ===========================================================================

def tool_12_recuperacao_orcamento(db: Client, dias: int = 7) -> list[QueueEntry]:
    """
    Orçamentos pendentes cujo prazo de validade expirou sem conversão.
    Requer tabela orcamentos no schema.
    """
    tmpl = get_template(db, 12)
    if not tmpl:
        return []

    cutoff = (now_clinic().date() - timedelta(days=dias)).isoformat()
    try:
        resp = (
            db.table("orcamentos")
            .select("id, client_id, servico_id, created_at")
            .eq("status", "pendente")
            .lte("created_at", cutoff)
            .execute()
        )
    except Exception as exc:
        logger.warning("tool_12: tabela 'orcamentos' indisponível (%s). Ferramenta pausada até a feature de orçamentos existir.", exc)
        return []

    entries = []
    for orc in resp.data or []:
        if not orc.get("client_id"):
            continue
        if already_queued(db, orc["client_id"], 12, window_hours=24 * 7):
            continue

        # Busca nome do serviço e dados do cliente
        nome_servico = "o procedimento"
        if orc.get("servico_id"):
            srv = (
                db.table("servicos")
                .select("nome")
                .eq("id", orc["servico_id"])
                .maybe_single()
                .execute()
            )
            if srv.data:
                nome_servico = srv.data.get("nome", nome_servico)

        cli = (
            db.table("clients")
            .select("name, phone")
            .eq("id", orc["client_id"])
            .maybe_single()
            .execute()
        )
        if not cli.data or not cli.data.get("phone"):
            continue

        tags = {
            "nome_paciente": cli.data["name"].split()[0],
            "nome_servico":  nome_servico,
        }
        entries.append(QueueEntry(
            client_id=orc["client_id"],
            client_name=cli.data["name"],
            client_phone=cli.data["phone"],
            tool_id=12,
            tool_name=tmpl["tool_name"],
            group_type="B",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            context_data={"orcamento_id": orc["id"], "servico": nome_servico},
        ))
    return entries


def tool_13_inativo_30d(db: Client) -> list[QueueEntry]:
    """Clientes cuja last_visit foi exatamente há 30 dias (janela de 24h)."""
    tmpl = get_template(db, 13)
    if not tmpl:
        return []

    cutoff_fim = (now_clinic().date() - timedelta(days=30)).isoformat()
    cutoff_ini = (now_clinic().date() - timedelta(days=31)).isoformat()

    resp = (
        db.table("clients")
        .select("id, name, phone, last_visit")
        .in_("status", STATUS_CLIENTE_ATIVO)
        .lte("last_visit", cutoff_fim)
        .gte("last_visit", cutoff_ini)
        .not_.is_("phone", "null")
        .eq("whatsapp_opt_out", False)
        .execute()
    )

    entries = []
    for client in resp.data or []:
        if already_queued(db, client["id"], 13, window_hours=24 * 30):
            continue
        tags = {"nome_paciente": client["name"].split()[0]}
        entries.append(QueueEntry(
            client_id=client["id"],
            client_name=client["name"],
            client_phone=client["phone"],
            tool_id=13,
            tool_name=tmpl["tool_name"],
            group_type="B",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            context_data={"last_visit": client.get("last_visit"), "dias_inativo": 30},
        ))
    return entries


def tool_14_inativo_90d(db: Client) -> list[QueueEntry]:
    """Clientes cuja last_visit foi exatamente há 90 dias (win-back)."""
    tmpl = get_template(db, 14)
    if not tmpl:
        return []

    cutoff_fim = (now_clinic().date() - timedelta(days=90)).isoformat()
    cutoff_ini = (now_clinic().date() - timedelta(days=91)).isoformat()

    resp = (
        db.table("clients")
        .select("id, name, phone, last_visit")
        .in_("status", STATUS_CLIENTE_ATIVO)
        .lte("last_visit", cutoff_fim)
        .gte("last_visit", cutoff_ini)
        .not_.is_("phone", "null")
        .eq("whatsapp_opt_out", False)
        .execute()
    )

    entries = []
    for client in resp.data or []:
        if already_queued(db, client["id"], 14, window_hours=24 * 90):
            continue
        tags = {"nome_paciente": client["name"].split()[0]}
        entries.append(QueueEntry(
            client_id=client["id"],
            client_name=client["name"],
            client_phone=client["phone"],
            tool_id=14,
            tool_name=tmpl["tool_name"],
            group_type="B",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            context_data={"last_visit": client.get("last_visit"), "dias_inativo": 90},
        ))
    return entries


def tool_15_pacote_proximo_fim(db: Client) -> list[QueueEntry]:
    """
    Pacotes ativos com 1 ou 2 sessões restantes.
    Requer tabela orcamentos/pacotes com controle de sessões.
    Estratégia alternativa: usa servicos.sessoes_pacote + contagem de appointments.
    """
    tmpl = get_template(db, 15)
    if not tmpl:
        return []

    # Busca serviços que têm pacote configurado
    servicos_resp = (
        db.table("servicos")
        .select("id, nome, sessoes_pacote")
        .not_.is_("sessoes_pacote", "null")
        .eq("ativo", True)
        .execute()
    )

    entries = []
    for servico in servicos_resp.data or []:
        total_sessoes = servico["sessoes_pacote"]

        # Para cada serviço com pacote, conta appointments por cliente
        appts_resp = (
            db.table("appointments")
            .select("client_id, client_name, client_phone")
            .eq("procedure", servico["nome"])
            .in_("status", STATUS_CONCLUIDO)
            .execute()
        )

        # Agrupa por cliente
        por_cliente: dict[int, dict] = {}
        for appt in appts_resp.data or []:
            cid = appt["client_id"]
            if cid not in por_cliente:
                por_cliente[cid] = {"count": 0, **appt}
            por_cliente[cid]["count"] += 1

        for cid, data in por_cliente.items():
            sessoes_usadas = data["count"]
            restantes = total_sessoes - sessoes_usadas
            if not (1 <= restantes <= 2):
                continue
            if already_queued(db, cid, 15, window_hours=24 * 30):
                continue
            if not data.get("client_phone"):
                continue

            tags = {
                "nome_paciente":    data["client_name"].split()[0],
                "nome_servico":     servico["nome"],
                "sessoes_restantes": restantes,
            }
            entries.append(QueueEntry(
                client_id=cid,
                client_name=data["client_name"],
                client_phone=data["client_phone"],
                tool_id=15,
                tool_name=tmpl["tool_name"],
                group_type="B",
                message_text=render(tmpl["template_text"], tags),
                scheduled_at=now_utc(),
                context_data={
                    "servico":          servico["nome"],
                    "sessoes_restantes": restantes,
                    "sessoes_total":    total_sessoes,
                },
            ))
    return entries


def tool_16_retorno_inteligente(db: Client) -> list[QueueEntry]:
    """
    1º Lembrete de manutenção por serviço.

    FONTE DE VERDADE: Histórico do Paciente.
    O Dia 0 é a data do ÚLTIMO appointment com status finalizado para aquele
    serviço específico — nunca a data de agendamento original.

    Dispara quando: hoje = data_último_finalizado + dias_para_retorno (janela 24h).
    Cada serviço tem seu próprio cronômetro independente.
    Editar o template NÃO reinicia nenhuma contagem.
    """
    tmpl = get_template(db, 16)
    if not tmpl:
        return []

    servicos_resp = (
        db.table("servicos")
        .select("nome, dias_para_retorno")
        .not_.is_("dias_para_retorno", "null")
        .gt("dias_para_retorno", 0)
        .eq("ativo", True)
        .execute()
    )

    entries = []
    for servico in servicos_resp.data or []:
        dias = int(servico["dias_para_retorno"])
        nome_servico = servico["nome"]

        # Janela 24h: o último finalizado deste serviço foi exatamente há `dias` dias
        target_fim = (now_clinic().date() - timedelta(days=dias)).isoformat()
        target_ini = (now_clinic().date() - timedelta(days=dias + 1)).isoformat()

        appts_resp = (
            db.table("appointments")
            .select("id, client_id, client_name, client_phone, appointment_date")
            .in_("status", STATUS_CONCLUIDO)
            .ilike("procedure", nome_servico)
            .lte("appointment_date", target_fim)
            .gte("appointment_date", target_ini)
            .execute()
        )

        for appt in appts_resp.data or []:
            if not appt.get("client_id") or not appt.get("client_phone"):
                continue

            # Confirma que este é o ÚLTIMO finalizado desse serviço para o cliente.
            # Se existir um appointment mais recente e finalizado, o cronômetro
            # já foi reiniciado — não notificar.
            check_mais_recente = (
                db.table("appointments")
                .select("id", count="exact")
                .eq("client_id", appt["client_id"])
                .ilike("procedure", nome_servico)
                .in_("status", STATUS_CONCLUIDO)
                .gt("appointment_date", appt["appointment_date"])
                .execute()
            )
            if check_mais_recente.count and check_mais_recente.count > 0:
                continue  # Serviço já foi refeito — cronômetro reiniciado

            if already_queued(db, appt["client_id"], 16, window_hours=24 * dias):
                continue

            tags = {
                "nome_paciente": appt["client_name"].split()[0],
                "nome_servico":  nome_servico,
                "dias_retorno":  str(dias),
            }
            entries.append(QueueEntry(
                client_id=appt["client_id"],
                client_name=appt["client_name"],
                client_phone=appt["client_phone"],
                tool_id=16,
                tool_name=tmpl["tool_name"],
                group_type="B",
                message_text=render(tmpl["template_text"], tags),
                scheduled_at=now_utc(),
                appointment_id=appt["id"],
                context_data={
                    "servico":      nome_servico,
                    "dias_retorno": dias,
                    "data_base":    appt["appointment_date"],
                    "etapa":        "1_lembrete",
                },
            ))
    return entries


def tool_17_recuperacao_cancelamento(db: Client, dias: int = settings.CANCELAMENTO_DIAS) -> list[QueueEntry]:
    """Pacientes que cancelaram e não reagendaram em X dias."""
    tmpl = get_template(db, 17)
    if not tmpl:
        return []

    cutoff_fim = (now_clinic().date() - timedelta(days=dias)).isoformat()
    cutoff_ini = (now_clinic().date() - timedelta(days=dias + 1)).isoformat()

    resp = (
        db.table("appointments")
        .select("id, client_id, client_name, client_phone")
        .in_("status", STATUS_CANCELADO)
        .lte("appointment_date", cutoff_fim)
        .gte("appointment_date", cutoff_ini)
        .execute()
    )

    entries = []
    for appt in resp.data or []:
        if not appt.get("client_id"):
            continue

        # Verificar se não reagendou depois do cancelamento
        reagendou = (
            db.table("appointments")
            .select("id", count="exact")
            .eq("client_id", appt["client_id"])
            .gte("created_at", cutoff_ini)
            .in_("status", STATUS_ATIVOS)
            .execute()
        )
        if reagendou.count and reagendou.count > 0:
            continue
        if already_queued(db, appt["client_id"], 17, window_hours=24 * dias):
            continue

        tags = {"nome_paciente": appt["client_name"].split()[0]}
        entries.append(QueueEntry(
            client_id=appt["client_id"],
            client_name=appt["client_name"],
            client_phone=appt["client_phone"],
            tool_id=17,
            tool_name=tmpl["tool_name"],
            group_type="B",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            appointment_id=appt["id"],
        ))
    return entries


def tool_18_upgrade_crosssell(db: Client, dias_apos: int = settings.CROSSSELL_DIAS_APOS) -> list[QueueEntry]:
    """
    Sugestão de procedimento complementar X dias após serviço base.
    Configurável via settings.CROSSSELL_DIAS_APOS.
    """
    tmpl = get_template(db, 18)
    if not tmpl:
        return []

    target_date = (now_clinic().date() - timedelta(days=dias_apos)).isoformat()
    resp = (
        db.table("appointments")
        .select("id, client_id, client_name, client_phone, procedure")
        .eq("appointment_date", target_date)
        .in_("status", STATUS_CONCLUIDO)
        .execute()
    )

    entries = []
    for appt in resp.data or []:
        if not appt.get("client_id"):
            continue
        if already_queued(db, appt["client_id"], 18, window_hours=24 * dias_apos):
            continue

        tags = {
            "nome_paciente": appt["client_name"].split()[0],
            "nome_servico":  appt.get("procedure", "procedimento"),
        }
        entries.append(QueueEntry(
            client_id=appt["client_id"],
            client_name=appt["client_name"],
            client_phone=appt["client_phone"],
            tool_id=18,
            tool_name=tmpl["tool_name"],
            group_type="B",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            appointment_id=appt["id"],
            context_data={"servico_base": appt.get("procedure")},
        ))
    return entries


def tool_19_data_comemorativa(db: Client) -> list[QueueEntry]:
    """
    Gatilho baseado em datas comemorativas.
    Mapa de datas: (mês, dia) → nome da data.
    Disparado para todos os clientes ativos com pelo menos 1 visita.
    """
    tmpl = get_template(db, 19)
    if not tmpl:
        return []

    today = now_clinic().date()

    # Adicione ou remova datas conforme o calendário da clínica
    datas_comemorativas: dict[tuple, str] = {
        (3, 8):  "Dia Internacional da Mulher",
        (5, 12): "Dia das Mães",
        (6, 12): "Dia dos Namorados",
        (10, 12): "Dia das Crianças",
        (12, 25): "Natal",
    }

    contexto = datas_comemorativas.get((today.month, today.day))
    if not contexto:
        return []

    resp = (
        db.table("clients")
        .select("id, name, phone")
        .in_("status", STATUS_CLIENTE_ATIVO)
        .not_.is_("phone", "null")
        .not_.is_("last_visit", "null")
        .eq("whatsapp_opt_out", False)
        .execute()
    )

    entries = []
    for client in resp.data or []:
        if already_queued(db, client["id"], 19, window_hours=24 * 365):
            continue

        tags = {"nome_paciente": client["name"].split()[0]}
        entries.append(QueueEntry(
            client_id=client["id"],
            client_name=client["name"],
            client_phone=client["phone"],
            tool_id=19,
            tool_name=tmpl["tool_name"],
            group_type="B",
            message_text=render(tmpl["template_text"], tags),
            scheduled_at=now_utc(),
            context_data={"data_comemorativa": contexto},
        ))
    return entries


def tool_20_segunda_cobranca(db: Client, carencia_dias: int = 15) -> list[QueueEntry]:
    """
    2º Lembrete de manutenção por serviço + entrada na geladeira (Etapa 4).

    FONTE DE VERDADE: Histórico do Paciente (mesmo critério da tool_16).
    Dispara quando: hoje = data_último_finalizado + dias_para_retorno + carencia_dias.
    Carência padrão: 15 dias após o 1º lembrete.

    Só dispara se o cliente NÃO agendou nem realizou o serviço desde então.
    Status pending: recepcionista revisa antes do envio e pode ajustar o texto.
    Após envio, a cliente é considerada em 'geladeira' para esse serviço específico.
    O status GLOBAL da cliente permanece Ativo — apenas o cronômetro do serviço
    específico está em espera.
    """
    tmpl = get_template(db, 20)
    if not tmpl:
        return []

    servicos_resp = (
        db.table("servicos")
        .select("nome, dias_para_retorno")
        .not_.is_("dias_para_retorno", "null")
        .gt("dias_para_retorno", 0)
        .eq("ativo", True)
        .execute()
    )

    entries = []
    for servico in servicos_resp.data or []:
        dias = int(servico["dias_para_retorno"])
        nome_servico = servico["nome"]
        offset = dias + carencia_dias  # Ex: 30 + 15 = Dia 45

        target_fim = (now_clinic().date() - timedelta(days=offset)).isoformat()
        target_ini = (now_clinic().date() - timedelta(days=offset + 1)).isoformat()

        appts_resp = (
            db.table("appointments")
            .select("id, client_id, client_name, client_phone, appointment_date")
            .in_("status", STATUS_CONCLUIDO)
            .ilike("procedure", nome_servico)
            .lte("appointment_date", target_fim)
            .gte("appointment_date", target_ini)
            .execute()
        )

        for appt in appts_resp.data or []:
            if not appt.get("client_id") or not appt.get("client_phone"):
                continue

            # Confirma que o serviço NÃO foi refeito (finalizado) desde a data base
            check_finalizado = (
                db.table("appointments")
                .select("id", count="exact")
                .eq("client_id", appt["client_id"])
                .ilike("procedure", nome_servico)
                .in_("status", STATUS_CONCLUIDO)
                .gt("appointment_date", appt["appointment_date"])
                .execute()
            )
            if check_finalizado.count and check_finalizado.count > 0:
                continue  # Serviço já foi refeito — cronômetro reiniciado

            # Confirma que o serviço NÃO está ativamente agendado
            check_agendado = (
                db.table("appointments")
                .select("id", count="exact")
                .eq("client_id", appt["client_id"])
                .ilike("procedure", nome_servico)
                .in_("status", STATUS_ATIVOS)
                .gt("appointment_date", appt["appointment_date"])
                .execute()
            )
            if check_agendado.count and check_agendado.count > 0:
                continue  # Já reagendou — não cobrar

            if already_queued(db, appt["client_id"], 20, window_hours=24 * offset):
                continue

            tags = {
                "nome_paciente": appt["client_name"].split()[0],
                "nome_servico":  nome_servico,
                "dias_retorno":  str(dias),
            }
            entries.append(QueueEntry(
                client_id=appt["client_id"],
                client_name=appt["client_name"],
                client_phone=appt["client_phone"],
                tool_id=20,
                tool_name=tmpl["tool_name"],
                group_type="B",
                message_text=render(tmpl["template_text"], tags),
                scheduled_at=now_utc(),
                appointment_id=appt["id"],
                context_data={
                    "servico":      nome_servico,
                    "dias_retorno": dias,
                    "data_base":    appt["appointment_date"],
                    "etapa":        "2_geladeira",
                    "geladeira_em": now_clinic().date().isoformat(),
                },
            ))
    return entries


def tool_21_resgate_inteligente(db: Client, carencia_dias: int = 15, geladeira_dias: int = 30) -> list[QueueEntry]:
    """
    Resgate inteligente com oferta personalizada (Etapa 5).

    FONTE DE VERDADE: Histórico do Paciente.
    Dispara quando: hoje = data_último_finalizado + dias_para_retorno + carencia_dias + geladeira_dias.
    Padrões: carência = 15 dias, geladeira = 30 dias → Dia 75 para serviço de 30 dias.

    Verifica se a cliente continua frequentando a clínica (outros serviços)
    para personalizar a mensagem de resgate com cross-sell.
    Status pending: recepcionista revisa e define o percentual de desconto antes do envio.
    """
    tmpl = get_template(db, 21)
    if not tmpl:
        return []

    servicos_resp = (
        db.table("servicos")
        .select("nome, dias_para_retorno")
        .not_.is_("dias_para_retorno", "null")
        .gt("dias_para_retorno", 0)
        .eq("ativo", True)
        .execute()
    )

    entries = []
    for servico in servicos_resp.data or []:
        dias = int(servico["dias_para_retorno"])
        nome_servico = servico["nome"]
        offset = dias + carencia_dias + geladeira_dias  # Ex: 30 + 15 + 30 = Dia 75

        target_fim = (now_clinic().date() - timedelta(days=offset)).isoformat()
        target_ini = (now_clinic().date() - timedelta(days=offset + 1)).isoformat()

        appts_resp = (
            db.table("appointments")
            .select("id, client_id, client_name, client_phone, appointment_date")
            .in_("status", STATUS_CONCLUIDO)
            .ilike("procedure", nome_servico)
            .lte("appointment_date", target_fim)
            .gte("appointment_date", target_ini)
            .execute()
        )

        for appt in appts_resp.data or []:
            if not appt.get("client_id") or not appt.get("client_phone"):
                continue

            # Confirma que o serviço NÃO foi refeito (finalizado) desde a data base
            check_finalizado = (
                db.table("appointments")
                .select("id", count="exact")
                .eq("client_id", appt["client_id"])
                .ilike("procedure", nome_servico)
                .in_("status", STATUS_CONCLUIDO)
                .gt("appointment_date", appt["appointment_date"])
                .execute()
            )
            if check_finalizado.count and check_finalizado.count > 0:
                continue  # Serviço já foi refeito — cronômetro reiniciado

            # Confirma que o serviço NÃO está ativamente agendado
            check_agendado = (
                db.table("appointments")
                .select("id", count="exact")
                .eq("client_id", appt["client_id"])
                .ilike("procedure", nome_servico)
                .in_("status", STATUS_ATIVOS)
                .gt("appointment_date", appt["appointment_date"])
                .execute()
            )
            if check_agendado.count and check_agendado.count > 0:
                continue  # Já reagendou — não cobrar

            if already_queued(db, appt["client_id"], 21, window_hours=24 * offset):
                continue

            # Busca o serviço mais recente que a cliente realizou (para cross-sell personalizado)
            outros_resp = (
                db.table("appointments")
                .select("procedure")
                .eq("client_id", appt["client_id"])
                .in_("status", STATUS_CONCLUIDO)
                .not_.ilike("procedure", nome_servico)
                .gt("appointment_date", appt["appointment_date"])
                .order("appointment_date", desc=True)
                .limit(1)
                .execute()
            )
            outro_servico = ""
            if outros_resp.data:
                outro_servico = outros_resp.data[0].get("procedure", "")

            tags = {
                "nome_paciente":  appt["client_name"].split()[0],
                "nome_servico":   nome_servico,
                "outro_servico":  outro_servico,
                "dias_retorno":   str(dias),
            }
            entries.append(QueueEntry(
                client_id=appt["client_id"],
                client_name=appt["client_name"],
                client_phone=appt["client_phone"],
                tool_id=21,
                tool_name=tmpl["tool_name"],
                group_type="B",
                message_text=render(tmpl["template_text"], tags),
                scheduled_at=now_utc(),
                appointment_id=appt["id"],
                context_data={
                    "servico":       nome_servico,
                    "dias_retorno":  dias,
                    "data_base":     appt["appointment_date"],
                    "etapa":         "3_resgate",
                    "outro_servico": outro_servico,
                },
            ))
    return entries


# ===========================================================================
# REGISTRY — consumido pelo MarketingEngine.process_all_tasks()
# ===========================================================================

ALL_TOOLS: list[Callable] = [
    # Grupo A — 11 ferramentas automáticas
    tool_01_lembrete_24h,
    tool_02_lembrete_2h,
    tool_03_alerta_atraso_15min,
    tool_04_no_show_24h,
    tool_05_aniversario,
    tool_06_boas_vindas,
    tool_07_confirmacao_agendamento,
    tool_08_pre_procedimento,
    tool_09_pos_procedimento,
    tool_10_lembrete_exames,
    tool_11_nps,
    # Grupo B — 8 ferramentas com edição humana
    tool_12_recuperacao_orcamento,
    tool_13_inativo_30d,
    tool_14_inativo_90d,
    tool_15_pacote_proximo_fim,
    tool_16_retorno_inteligente,
    tool_17_recuperacao_cancelamento,
    tool_18_upgrade_crosssell,
    tool_19_data_comemorativa,
    # Fluxo de manutenção por serviço (Etapas 4 e 5)
    tool_20_segunda_cobranca,
    tool_21_resgate_inteligente,
]
