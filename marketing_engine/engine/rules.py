"""
engine/rules.py
Aqui vivem as 14 ferramentas de marketing. Cada ferramenta é um `Tool`
com três peças:

  1. finder(db)        -> lista de pacientes elegíveis para a regra
  2. flow               -> "auto"     dispara direto via WhatsApp
                            "approval" cai na fila marketing_approval_queue
  3. build_message(p)   -> "auto":     retorna a string final da mensagem
                            "approval": retorna um dict {strategy, suggested_message, context}

O MarketingEngine (marketing_engine.py) só conhece o TOOL_REGISTRY — para
adicionar uma ferramenta nova, basta escrever finder/build_message aqui e
registrar no dicionário no final do arquivo. Nada no engine precisa mudar.
"""
from dataclasses import dataclass
from typing import Callable, Literal

from engine import database as db_module

Flow = Literal["auto", "approval"]


@dataclass
class Tool:
    name: str
    flow: Flow
    finder: Callable
    build_message: Callable
    description: str = ""


# ===========================================================================
# FLUXO AUTOMÁTICO (regras fixas, sem IA)
# ===========================================================================

# --- 1) Aniversário ---------------------------------------------------------

def find_birthday_patients(db) -> list[dict]:
    return db_module.get_patients_with_birthday_today(db)


def build_birthday_message(patient: dict) -> str:
    first_name = patient["nome"].split(" ")[0]
    return (
        f"🎉 Feliz aniversário, {first_name}! A equipe da clínica deseja um dia incrível. "
        f"De presente, você ganhou 15% de desconto em qualquer procedimento este mês. "
        f"Responda essa mensagem para agendar! 💖"
    )


# --- 2) NPS pós-atendimento --------------------------------------------------

def find_nps_targets(db) -> list[dict]:
    """TODO: pacientes com atendimento concluído há ~24h e sem NPS respondido."""
    return []


def build_nps_message(patient: dict) -> str:
    first_name = patient["nome"].split(" ")[0]
    return f"Oi {first_name}! De 0 a 10, qual a chance de você nos indicar a um amigo? 😊"


# --- 3) Escassez / vagas limitadas ------------------------------------------

def find_escassez_targets(db) -> list[dict]:
    """TODO: pacientes com agenda aberta e poucas vagas restantes na semana."""
    return []


def build_escassez_message(patient: dict) -> str:
    first_name = patient["nome"].split(" ")[0]
    return f"⏳ {first_name}, restam poucas vagas essa semana para o seu procedimento. Quer garantir a sua?"


# --- 4) Lembrete de agendamento (24h antes) ---------------------------------

def find_appointment_reminders(db) -> list[dict]:
    """TODO: agendamentos confirmados para as próximas 24h."""
    return []


def build_appointment_reminder_message(patient: dict) -> str:
    first_name = patient["nome"].split(" ")[0]
    return f"Oi {first_name}! Passando para lembrar da sua consulta amanhã. Te esperamos! 🙂"


# --- 5) Confirmação de agendamento ------------------------------------------

def find_confirmation_targets(db) -> list[dict]:
    """TODO: agendamentos recém-criados aguardando confirmação do paciente."""
    return []


def build_confirmation_message(patient: dict) -> str:
    first_name = patient["nome"].split(" ")[0]
    return f"Oi {first_name}, confirma presença na sua consulta? Responda SIM ou NÃO."


# --- 6) Cuidados pós-procedimento -------------------------------------------

def find_post_procedure_targets(db) -> list[dict]:
    """TODO: procedimentos concluídos nas últimas horas."""
    return []


def build_post_procedure_message(patient: dict) -> str:
    first_name = patient["nome"].split(" ")[0]
    return f"Oi {first_name}, segue as orientações de cuidado pós-procedimento. Qualquer dúvida, estamos aqui!"


# --- 7) Pacote de sessões próximo do fim ------------------------------------

def find_package_ending_targets(db) -> list[dict]:
    """TODO: pacientes com 1-2 sessões restantes em pacotes contratados."""
    return []


def build_package_ending_message(patient: dict) -> str:
    first_name = patient["nome"].split(" ")[0]
    return f"{first_name}, seu pacote está acabando! Vamos agendar suas últimas sessões?"


# --- 8) Indicação / Referral -------------------------------------------------

def find_referral_targets(db) -> list[dict]:
    """TODO: pacientes com NPS alto (promotores) nos últimos 30 dias."""
    return []


def build_referral_message(patient: dict) -> str:
    first_name = patient["nome"].split(" ")[0]
    return f"{first_name}, que bom que você gostou! Indique um amigo e ganhem 10% de desconto cada 🎁"


# ===========================================================================
# FLUXO DE APROVAÇÃO (exige análise de IA/humano antes do envio)
# ===========================================================================

# --- 9) Reaquecimento de leads frios ----------------------------------------

def find_cold_leads(db) -> list[dict]:
    return db_module.get_cold_leads(db, days_inactive=60)


def build_reaquecimento_strategy(patient: dict) -> dict:
    """
    Ferramentas de aprovação NÃO retornam a mensagem final — retornam um
    rascunho + contexto. Quem decide o texto/abordagem definitiva é a
    camada de IA (ou um humano) no painel de aprovação, lendo a fila.
    """
    first_name = patient["nome"].split(" ")[0]
    suggested_msg = (
        f"Oi {first_name}, tudo bem? Notamos que faz um tempinho que você não nos visita 😊 "
        f"Separamos uma condição especial pra te receber de novo. Posso te contar mais?"
    )
    return {
        "strategy": "reaquecimento",
        "suggested_message": suggested_msg,
        "context": {
            "last_treatment": patient.get("ultimo_tratamento"),
            "last_appointment_at": patient.get("ultimo_agendamento"),
            "reason": "Lead frio — sem agendamento recente (60+ dias)",
        },
    }


# --- 10) Upsell / Cross-sell -------------------------------------------------

def find_upsell_targets(db) -> list[dict]:
    """TODO: pacientes com histórico de tratamento X, candidatos a tratamento complementar Y."""
    return []


def build_upsell_strategy(patient: dict) -> dict:
    first_name = patient["nome"].split(" ")[0]
    return {
        "strategy": "upsell",
        "suggested_message": f"Oi {first_name}, baseado no seu histórico, temos uma sugestão para você...",
        "context": {"reason": "Histórico de tratamento compatível com oferta complementar"},
    }


# --- 11) Recuperação de no-show ---------------------------------------------

def find_no_show_targets(db) -> list[dict]:
    raw = db_module.get_no_show_patients(db, hours_window=24)
    return [row["pacientes"] for row in raw if row.get("pacientes")]


def build_no_show_strategy(patient: dict) -> dict:
    first_name = patient["nome"].split(" ")[0]
    return {
        "strategy": "no_show",
        "suggested_message": f"Oi {first_name}, sentimos sua falta hoje! Quer remarcar?",
        "context": {"reason": "Faltou à consulta nas últimas 24h"},
    }


# --- 12) Reativação de inativos (longo prazo) -------------------------------

def find_reactivation_targets(db) -> list[dict]:
    """TODO: pacientes inativos há 6+ meses (diferente de reaquecimento, que é 60 dias)."""
    return []


def build_reactivation_strategy(patient: dict) -> dict:
    first_name = patient["nome"].split(" ")[0]
    return {
        "strategy": "reativacao_inativos",
        "suggested_message": f"Oi {first_name}, faz tempo que não nos vemos! Temos novidades para te contar.",
        "context": {"reason": "Inativo há mais de 6 meses"},
    }


# --- 13) Recuperação de orçamento não fechado -------------------------------

def find_open_budget_targets(db) -> list[dict]:
    """TODO: orçamentos enviados e não aprovados/recusados há X dias."""
    return []


def build_open_budget_strategy(patient: dict) -> dict:
    first_name = patient["nome"].split(" ")[0]
    return {
        "strategy": "recuperacao_orcamento",
        "suggested_message": f"Oi {first_name}, vi que seu orçamento ainda está em aberto. Posso ajudar a fechar?",
        "context": {"reason": "Orçamento pendente"},
    }


# --- 14) Pesquisa pós-reclamação (sensível, sempre revisão humana) ---------

def find_post_complaint_targets(db) -> list[dict]:
    """TODO: pacientes que abriram reclamação/NPS detrator nos últimos dias."""
    return []


def build_post_complaint_strategy(patient: dict) -> dict:
    first_name = patient["nome"].split(" ")[0]
    return {
        "strategy": "pos_reclamacao",
        "suggested_message": f"Oi {first_name}, gostaríamos de entender melhor sua experiência conosco.",
        "context": {"reason": "NPS detrator / reclamação registrada", "sensible": True},
    }


# ===========================================================================
# REGISTRO CENTRAL — consumido por MarketingEngine.process_all_tasks()
# ===========================================================================

TOOL_REGISTRY: dict[str, Tool] = {
    # ---- Fluxo Automático (8) ----
    "aniversario": Tool(
        "aniversario", "auto", find_birthday_patients, build_birthday_message,
        "Mensagem automática de aniversário com cupom de desconto.",
    ),
    "nps_pos_atendimento": Tool(
        "nps_pos_atendimento", "auto", find_nps_targets, build_nps_message,
        "Pesquisa de satisfação enviada após a consulta.",
    ),
    "escassez": Tool(
        "escassez", "auto", find_escassez_targets, build_escassez_message,
        "Gatilho de urgência por vagas limitadas na agenda.",
    ),
    "lembrete_agendamento": Tool(
        "lembrete_agendamento", "auto", find_appointment_reminders, build_appointment_reminder_message,
        "Lembrete enviado 24h antes da consulta.",
    ),
    "confirmacao_agendamento": Tool(
        "confirmacao_agendamento", "auto", find_confirmation_targets, build_confirmation_message,
        "Pedido de confirmação de presença para agendamentos recentes.",
    ),
    "cuidados_pos_procedimento": Tool(
        "cuidados_pos_procedimento", "auto", find_post_procedure_targets, build_post_procedure_message,
        "Instruções de cuidado enviadas após o procedimento.",
    ),
    "pacote_proximo_fim": Tool(
        "pacote_proximo_fim", "auto", find_package_ending_targets, build_package_ending_message,
        "Aviso de pacote de sessões próximo do fim (escassez de saldo).",
    ),
    "indicacao_referral": Tool(
        "indicacao_referral", "auto", find_referral_targets, build_referral_message,
        "Convite para indicação, enviado a pacientes promotores (NPS alto).",
    ),

    # ---- Fluxo de Aprovação (6) ----
    "reaquecimento": Tool(
        "reaquecimento", "approval", find_cold_leads, build_reaquecimento_strategy,
        "Reengajamento de leads frios — exige revisão de IA/humano antes do envio.",
    ),
    "upsell": Tool(
        "upsell", "approval", find_upsell_targets, build_upsell_strategy,
        "Oferta de tratamento complementar baseada em histórico — exige revisão.",
    ),
    "no_show": Tool(
        "no_show", "approval", find_no_show_targets, build_no_show_strategy,
        "Recuperação de paciente que faltou à consulta — exige revisão (tom sensível).",
    ),
    "reativacao_inativos": Tool(
        "reativacao_inativos", "approval", find_reactivation_targets, build_reactivation_strategy,
        "Reativação de pacientes inativos há 6+ meses — exige revisão.",
    ),
    "recuperacao_orcamento": Tool(
        "recuperacao_orcamento", "approval", find_open_budget_targets, build_open_budget_strategy,
        "Recuperação de orçamento enviado e não fechado — exige revisão.",
    ),
    "pos_reclamacao": Tool(
        "pos_reclamacao", "approval", find_post_complaint_targets, build_post_complaint_strategy,
        "Follow-up após reclamação/NPS detrator — sempre revisão humana.",
    ),
}
