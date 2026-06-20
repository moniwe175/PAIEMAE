"""
main.py
Orquestrador principal. Inicializa a sessão do WhatsApp (QR Code
persistente) e agenda a execução periódica do MarketingEngine.
"""
import logging
from datetime import datetime

from apscheduler.schedulers.blocking import BlockingScheduler

from config.settings import settings
from engine.database import get_client
from engine.marketing_engine import MarketingEngine
from engine.whatsapp import WhatsAppConnector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("main")


def print_qr_to_terminal(qr_base64: str):
    """
    Chamado apenas se NÃO houver sessão WhatsApp persistida ainda.
    Em produção, troque por: salvar como PNG e exibir num painel admin,
    ou enviar para o Telegram/Slack da pessoa responsável pela clínica.
    """
    print("\n>>> Escaneie o QR Code abaixo no WhatsApp da clínica <<<\n")
    print(qr_base64[:80] + "... (base64 truncado para o terminal)")


def bootstrap() -> MarketingEngine:
    db = get_client()

    if settings.DRY_RUN:
        logger.info(
            "DRY_RUN ativo — pulando conexão com WhatsApp, "
            "wppconnect-server não é necessário ainda."
        )
        whatsapp = WhatsAppConnector()  # objeto criado, mas sem start_session()
    else:
        whatsapp = WhatsAppConnector()
        whatsapp.start_session(wait_qr_callback=print_qr_to_terminal)

    return MarketingEngine(db_client=db, whatsapp=whatsapp)


def main():
    engine = bootstrap()

    scheduler = BlockingScheduler(timezone=settings.TIMEZONE)
    scheduler.add_job(
        engine.process_all_tasks,
        trigger="interval",
        minutes=settings.SCHEDULER_INTERVAL_MINUTES,
        id="marketing_cycle",
        next_run_time=datetime.now(),  # roda uma vez imediatamente na subida
    )

    logger.info(
        "MarketingEngine no ar. Ciclo a cada %d minuto(s). DRY_RUN=%s",
        settings.SCHEDULER_INTERVAL_MINUTES,
        settings.DRY_RUN,
    )
    scheduler.start()


if __name__ == "__main__":
    main()
