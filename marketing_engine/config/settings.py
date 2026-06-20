"""
config/settings.py
Carrega todas as variáveis de ambiente em um único lugar. Nenhum outro
módulo deve chamar os.getenv diretamente — sempre importar `settings` daqui.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # --- Supabase -----------------------------------------------------
    SUPABASE_URL: str | None = os.getenv("SUPABASE_URL")
    # Use a service_role key (uso interno/back-end). NUNCA exponha essa
    # chave em código client-side / front-end.
    SUPABASE_KEY: str | None = os.getenv("SUPABASE_SERVICE_KEY")

    # --- WhatsApp (wppconnect-server) ---------------------------------
    WPP_SERVER_URL: str = os.getenv("WPP_SERVER_URL", "http://localhost:21465")
    WPP_SESSION_NAME: str = os.getenv("WPP_SESSION_NAME", "clinica-marketing")
    WPP_SECRET_KEY: str | None = os.getenv("WPP_SECRET_KEY")
    # Pasta onde o token da sessão fica salvo -> garante QR Code persistente
    # (não pede escaneamento novo a cada restart, enquanto o token for válido)
    WPP_TOKEN_PATH: str = os.getenv("WPP_TOKEN_PATH", "./config/tokens")

    # --- Execução -------------------------------------------------------
    # Em DRY_RUN, nenhuma mensagem real é enviada — só logada. Use em homologação.
    DRY_RUN: bool = os.getenv("DRY_RUN", "false").lower() == "true"
    SCHEDULER_INTERVAL_MINUTES: int = int(os.getenv("SCHEDULER_INTERVAL_MINUTES", "30"))
    TIMEZONE: str = os.getenv("TIMEZONE", "America/Sao_Paulo")


settings = Settings()
