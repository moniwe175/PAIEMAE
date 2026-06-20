"""
engine/marketing_engine.py
Núcleo do sistema. A classe MarketingEngine não conhece regras de negócio
específicas — ela apenas itera o TOOL_REGISTRY (rules.py) e decide, para
cada paciente elegível, se a mensagem é disparada direto (auto) ou
inserida na fila de aprovação (approval).
"""
import logging

from supabase import Client

from engine import database as db_module
from engine.rules import TOOL_REGISTRY
from engine.whatsapp import WhatsAppConnector

logger = logging.getLogger("marketing_engine")


class MarketingEngine:
    def __init__(self, db_client: Client | None = None, whatsapp: WhatsAppConnector | None = None):
        self.db = db_client or db_module.get_client()
        self.whatsapp = whatsapp or WhatsAppConnector()

    # -----------------------------------------------------------------
    # Orquestração principal — chamada pelo scheduler em main.py
    # -----------------------------------------------------------------

    def process_all_tasks(self):
        if not db_module.is_engine_enabled(self.db):
            logger.info("Motor desativado via Integrações — pulando ciclo.")
            return

        logger.info("Iniciando ciclo — %d ferramentas registradas.", len(TOOL_REGISTRY))

        for tool_name, tool in TOOL_REGISTRY.items():
            try:
                self._process_tool(tool_name, tool)
            except Exception:
                # Uma ferramenta com bug não pode derrubar as outras 13.
                logger.exception("Erro processando '%s'. Seguindo para a próxima.", tool_name)

        logger.info("Ciclo de processamento concluído.")

    def _process_tool(self, tool_name: str, tool):
        patients = tool.finder(self.db) or []
        logger.info("[%s] %d paciente(s) elegível(is).", tool_name, len(patients))

        for patient in patients:
            if not patient.get("id") or not patient.get("telefone"):
                logger.warning("Paciente sem id/telefone — pulando registro: %s", patient)
                continue

            # Idempotência: nunca dispara a mesma regra 2x no mesmo dia
            # para o mesmo paciente, mesmo que o scheduler rode várias vezes.
            if db_module.already_notified_today(self.db, patient["id"], tool_name):
                continue

            if tool.flow == "auto":
                message = tool.build_message(patient)
                self.send_message(patient, message, tool_name)

            elif tool.flow == "approval":
                draft = tool.build_message(patient)  # {strategy, suggested_message, context}
                self.queue_for_review(
                    patient,
                    strategy=draft["strategy"],
                    suggested_msg=draft["suggested_message"],
                    context=draft.get("context", {}),
                    tool_name=tool_name,
                )

    # -----------------------------------------------------------------
    # Fluxo Automático — Python puro, dispara direto
    # -----------------------------------------------------------------

    def send_message(self, patient: dict, message: str, tool_name: str):
        success = self.whatsapp.send_message(patient["telefone"], message)
        db_module.log_dispatch(
            self.db,
            paciente_id=patient["id"],
            tool_name=tool_name,
            channel="whatsapp",
            status="sent" if success else "failed",
            payload={"message": message},
        )
        if not success:
            logger.error("Falha ao enviar '%s' para paciente %s.", tool_name, patient["id"])

    # -----------------------------------------------------------------
    # Fluxo de Aprovação — insere na fila, NUNCA dispara direto
    # -----------------------------------------------------------------

    def queue_for_review(self, patient: dict, strategy: str, suggested_msg: str, context: dict, tool_name: str):
        self.db.table("marketing_approval_queue").insert(
            {
                "paciente_id": patient["id"],
                "paciente_nome": patient.get("nome"),
                "paciente_telefone": patient.get("telefone"),
                "strategy": strategy,
                "suggested_message": suggested_msg,
                "context": context,
                "status": "pending",
            }
        ).execute()

        db_module.log_dispatch(
            self.db,
            paciente_id=patient["id"],
            tool_name=tool_name,
            channel="approval_queue",
            status="queued",
            payload={"strategy": strategy},
        )
        logger.info("Paciente %s enfileirado para aprovação (%s).", patient["id"], strategy)
