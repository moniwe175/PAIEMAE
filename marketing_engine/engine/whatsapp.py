"""
engine/whatsapp.py
Conector com o WhatsApp via wppconnect-server (servidor Node.js que expõe
o whatsapp-web.js por uma API REST). O Python nunca fala diretamente com o
protocolo do WhatsApp — ele consome essa API HTTP, que cuida da sessão e
do QR Code por baixo dos panos.

Por que essa arquitetura?
- wppconnect-python / wppconnect-server já resolvem reconexão, multi-device
  e geração de QR Code de forma estável; reimplementar isso em Python puro
  seria reinventar a roda e frágil.
- O Python (este módulo) só precisa: (1) garantir sessão ativa, (2) enviar
  mensagens, (3) checar status.

Fluxo de autenticação persistente:
1. Ao iniciar, tentamos reaproveitar o token salvo em WPP_TOKEN_PATH.
2. Se a sessão já está autenticada no wppconnect-server, NÃO pede QR Code
   de novo — reconecta direto.
3. Se não há sessão válida, devolvemos o QR Code (base64) via callback,
   para ser escaneado uma única vez (ex: exibido em um painel admin).
"""
import logging
import time
from pathlib import Path

import requests

from config.settings import settings

logger = logging.getLogger("whatsapp")


class WhatsAppConnector:
    def __init__(self):
        self.base_url = settings.WPP_SERVER_URL.rstrip("/")
        self.session = settings.WPP_SESSION_NAME
        self.secret_key = settings.WPP_SECRET_KEY
        self.token_path = Path(settings.WPP_TOKEN_PATH)
        self.token_path.mkdir(parents=True, exist_ok=True)
        self._bearer_token: str | None = None

    # -- Autenticação --------------------------------------------------

    def _generate_token(self) -> str:
        url = f"{self.base_url}/api/{self.session}/{self.secret_key}/generate-token"
        resp = requests.post(url, timeout=15)
        resp.raise_for_status()
        token = resp.json()["token"]
        self._bearer_token = token
        (self.token_path / f"{self.session}.token").write_text(token)
        return token

    def _load_cached_token(self) -> str | None:
        token_file = self.token_path / f"{self.session}.token"
        if token_file.exists():
            return token_file.read_text().strip()
        return None

    def start_session(self, wait_qr_callback=None) -> bool:
        """
        Inicia a sessão. Se já existir token salvo em disco e válido, a
        sessão reconecta sem pedir QR Code. Caso contrário, devolve o QR
        Code (base64) através de `wait_qr_callback(qr_base64)` e aguarda
        o escaneamento.
        """
        self._bearer_token = self._load_cached_token() or self._generate_token()

        url = f"{self.base_url}/api/{self.session}/start-session"
        headers = {"Authorization": f"Bearer {self._bearer_token}"}
        resp = requests.post(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") == "qrcode" and wait_qr_callback:
            wait_qr_callback(data.get("qrcode"))
            return self._wait_for_connection()

        logger.info("Sessão WhatsApp '%s' conectada (token reaproveitado).", self.session)
        return True

    def _wait_for_connection(self, timeout_seconds: int = 120) -> bool:
        url = f"{self.base_url}/api/{self.session}/check-connection-session"
        headers = {"Authorization": f"Bearer {self._bearer_token}"}
        elapsed = 0
        while elapsed < timeout_seconds:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.ok and resp.json().get("status") is True:
                logger.info("QR Code escaneado — sessão autenticada e persistida.")
                return True
            time.sleep(3)
            elapsed += 3
        logger.warning("Timeout aguardando autenticação via QR Code.")
        return False

    # -- Envio -----------------------------------------------------------

    def send_message(self, phone: str, message: str) -> bool:
        if settings.DRY_RUN:
            logger.info("[DRY_RUN] Para %s: %s", phone, message)
            return True

        if not self._bearer_token:
            self._bearer_token = self._load_cached_token() or self._generate_token()

        url = f"{self.base_url}/api/{self.session}/send-message"
        headers = {"Authorization": f"Bearer {self._bearer_token}"}
        payload = {"phone": phone, "message": message, "isGroup": False}

        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=20)
            resp.raise_for_status()
            return True
        except requests.RequestException as e:
            logger.error("Falha ao enviar WhatsApp para %s: %s", phone, e)
            return False
