"""
engine/marketing_engine.py
Núcleo do sistema. A classe MarketingEngine não conhece regras de negócio
específicas — ela apenas itera o TOOL_REGISTRY (rules.py) e decide, para
cada client elegível, se a mensagem é disparada direto (auto) ou
inserida na fila de aprovação (approval).

Campos reais usados aqui (de clients):
  client["id"]    -> integer (FK real)
  client["phone"] -> telefone
  client["name"]  -> nome
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
        # Verifica se o motor está ligado antes de qualquer coisa
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
        clients = tool.finder(self.db) or []
        logger.info("[%s] %d cliente(s) elegível(is).", tool_name, len(clients))

        for client in clients:
            if not client.get("id") or not client.get("phone"):
                logger.warning("Cliente sem id/phone — pulando registro: %s", client)
                continue

            # Idempotência: nunca dispara a mesma regra 2x no mesmo dia
            # para o mesmo cliente, mesmo que o scheduler rode várias vezes.
            if db_module.already_notified_today(self.db, client["id"], tool_name):
                continue

            if tool.flow == "auto":
                message = tool.build_message(client)
                self.send_message(client, message, tool_name)

            elif tool.flow == "approval":
                draft = tool.build_message(client)  # {strategy, suggested_message, context}
                self.queue_for_review(
                    client,
                    strategy=draft["strategy"],
                    suggested_msg=draft["suggested_message"],
                    context=draft.get("context", {}),
                    tool_name=tool_name,
                )

    # -----------------------------------------------------------------
    # Fluxo Automático — Python puro, dispara direto
    # -----------------------------------------------------------------

    def send_message(self, client: dict, message: str, tool_name: str):
        success = self.whatsapp.send_message(client["phone"], message)
        db_module.log_dispatch(
            self.db,
            client_id=client["id"],
            tool_name=tool_name,
            channel="whatsapp",
            status="sent" if success else "failed",
            payload={"message": message},
        )
        if not success:
            logger.error("Falha ao enviar '%s' para cliente %s.", tool_name, client["id"])

    # -----------------------------------------------------------------
    # Fluxo de Aprovação — insere na fila, NUNCA dispara direto
    # -----------------------------------------------------------------

    def queue_for_review(self, client: dict, strategy: str, suggested_msg: str, context: dict, tool_name: str):
        self.db.table("marketing_approval_queue").insert(
            {
                "client_id": client["id"],
                "client_name": client.get("name"),
                "client_phone": client.get("phone"),
                "strategy": strategy,
                "suggested_message": suggested_msg,
                "context": context,
                "status": "pending",
            }
        ).execute()

        db_module.log_dispatch(
            self.db,
            client_id=client["id"],
            tool_name=tool_name,
            channel="approval_queue",
            status="queued",
            payload={"strategy": strategy},
        )
        logger.info("Cliente %s enfileirado para aprovação (%s).", client["id"], strategy)
