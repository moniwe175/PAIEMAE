"""
engine/marketing_engine.py — Marketing Engine v2
==================================================
Orquestrador central. Itera as 19 ferramentas do rules.py,
coleta os QueueEntry gerados e insere em marketing_queue.

Grupo A → status 'approved' (Baileys envia automaticamente)
Grupo B → status 'pending'  (recepcionista aprova no Frontend)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from supabase import Client

from engine.rules import ALL_TOOLS, QueueEntry, is_engine_enabled

logger = logging.getLogger("marketing_engine")


class MarketingEngine:
    def __init__(self, db: Client):
        self.db = db

    # ------------------------------------------------------------------
    # Entrada principal — chamada pelo scheduler em main.py
    # ------------------------------------------------------------------

    def process_all_tasks(self):
        if not is_engine_enabled(self.db):
            logger.info("Motor desativado via painel (marketing_engine_settings). Pulando ciclo.")
            return

        logger.info("Iniciando ciclo — %d ferramentas.", len(ALL_TOOLS))
        total_inserted = 0

        for tool_fn in ALL_TOOLS:
            tool_id = int(tool_fn.__name__.split("_")[1])
            try:
                entries: list[QueueEntry] = tool_fn(self.db)
                inserted = self._insert_batch(entries) if entries else 0
                total_inserted += inserted
                logger.info("[%s] %d entrada(s) inserida(s) na fila.", tool_fn.__name__, inserted)
                self._log_cycle(tool_id, tool_fn.__name__, len(entries), inserted, None)
            except Exception as exc:
                logger.exception("Erro na ferramenta '%s'. Seguindo.", tool_fn.__name__)
                self._log_cycle(tool_id, tool_fn.__name__, 0, 0, str(exc))

        logger.info("Ciclo concluído. Total inserido: %d.", total_inserted)

    # ------------------------------------------------------------------
    # Inserção em lote na marketing_queue
    # ------------------------------------------------------------------

    def _insert_batch(self, entries: list[QueueEntry]) -> int:
        rows = []
        for e in entries:
            row = {
                "client_id":     e.client_id,
                "client_name":   e.client_name,
                "client_phone":  e.client_phone,
                "tool_id":       e.tool_id,
                "tool_name":     e.tool_name,
                "group_type":    e.group_type,
                "message_text":  e.message_text,
                "status":        e.status,
                "scheduled_at":  e.scheduled_at.isoformat(),
                "context_data":  e.context_data,
            }
            if e.expires_at:
                row["expires_at"] = e.expires_at.isoformat()
            if e.appointment_id:
                row["appointment_id"] = e.appointment_id
            rows.append(row)

        if not rows:
            return 0

        resp = self.db.table("marketing_queue").insert(rows).execute()
        return len(resp.data or [])

    # ------------------------------------------------------------------
    # Auditoria por ciclo — alimenta marketing_log (Bug C)
    # ------------------------------------------------------------------

    def _log_cycle(self, tool_id: int, tool_name: str, generated: int, inserted: int, error: str | None):
        """Registra o resultado de cada ferramenta a cada ciclo.
        Falha silencioso se a tabela ainda não existir (ver marketing_engine_fixes.sql)."""
        try:
            self.db.table("marketing_log").insert({
                "tool_id":           tool_id,
                "tool_name":         tool_name,
                "entries_generated": generated,
                "entries_inserted":  inserted,
                "error":             error,
            }).execute()
        except Exception:
            pass
