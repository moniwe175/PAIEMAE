"""
main.py — Marketing Engine v2
==============================
Orquestrador com APScheduler. Roda o ciclo das 19 ferramentas
a cada N minutos, configurável via variável de ambiente.

Como rodar:
    python main.py

Como rodar em produção (Railway ou servidor):
    gunicorn não é necessário — este é um worker background, não HTTP.
    Configure como "Background Worker" no Railway apontando para este arquivo.
"""
import logging
from datetime import datetime

from apscheduler.schedulers.blocking import BlockingScheduler
from supabase import create_client

from config.settings import settings
from engine.marketing_engine import MarketingEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("main")


def main():
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL e SUPABASE_SERVICE_KEY não configurados. Confira o .env")

    db      = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    engine  = MarketingEngine(db)

    scheduler = BlockingScheduler(timezone=settings.TIMEZONE)
    scheduler.add_job(
        engine.process_all_tasks,
        trigger="interval",
        minutes=settings.SCHEDULER_INTERVAL_MINUTES,
        id="marketing_cycle",
        next_run_time=datetime.now(),  # roda imediatamente ao subir
    )

    logger.info(
        "Marketing Engine v2 iniciado. Ciclo a cada %d min. Supabase: %s",
        settings.SCHEDULER_INTERVAL_MINUTES,
        settings.SUPABASE_URL,
    )
    scheduler.start()


if __name__ == "__main__":
    main()
