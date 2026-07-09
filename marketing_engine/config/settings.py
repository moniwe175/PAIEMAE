"""
config/settings.py
Carrega todas as variáveis de ambiente em um único lugar.
Nenhum outro módulo deve chamar os.getenv diretamente.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # Supabase
    SUPABASE_URL: str | None = os.getenv("SUPABASE_URL")
    SUPABASE_KEY: str | None = os.getenv("SUPABASE_SERVICE_KEY")

    # Scheduler
    SCHEDULER_INTERVAL_MINUTES: int = int(os.getenv("SCHEDULER_INTERVAL_MINUTES", "30"))
    TIMEZONE: str = os.getenv("TIMEZONE", "America/Sao_Paulo")

    # NPS: dias após consulta para disparar pesquisa (padrão: 3)
    NPS_DIAS_APOS_CONSULTA: int = int(os.getenv("NPS_DIAS_APOS_CONSULTA", "3"))

    # Cross-sell: dias após serviço base para sugerir upgrade (padrão: 14)
    CROSSSELL_DIAS_APOS: int = int(os.getenv("CROSSSELL_DIAS_APOS", "14"))

    # Recuperação de cancelamento: dias sem reagendar (padrão: 3)
    CANCELAMENTO_DIAS: int = int(os.getenv("CANCELAMENTO_DIAS", "3"))


settings = Settings()
