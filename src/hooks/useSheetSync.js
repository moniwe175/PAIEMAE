import { useCallback } from 'react';
import { useSync } from '../contexts/SyncContext';

/**
 * useSheetSync — Gerencia conexão com planilha e delega sync ao Python ETL
 *
 * O polling direto da Google Sheets API foi REMOVIDO.
 * A sincronização agora é feita pelo script Python (sync_financeiro/sync_financeiro.py)
 * que roda no computador da clínica e escreve no Supabase.
 * O frontend recebe os dados via Supabase Realtime (WebSockets) automaticamente.
 */
export default function useSheetSync() {
  const {
    connectSheet,
    disconnectSheet,
    addLog,
  } = useSync();

  // Auto-detect column mapping from spreadsheet headers (mantido para compatibilidade)
  const autoDetectMapping = useCallback((headers) => {
    const rules = [
      { key: 'cliente',         match: h => /client|pacient|nome/.test(h) },
      { key: 'procedimento',    match: h => /proced|servi[çc]|tratamento/.test(h) },
      { key: 'valor',           match: h => /valor|pre[çc]o|total/.test(h) },
      { key: 'profissional',    match: h => /profiss/.test(h) },
      { key: 'comissao',        match: h => /comiss/.test(h) },
      { key: 'data',            match: h => /data|date/.test(h) },
      { key: 'tipo',            match: h => /tipo|type/.test(h) },
      { key: 'categoria',       match: h => /categ/.test(h) },
      { key: 'forma_pagamento', match: h => /forma|pagamento|m[eé]todo/.test(h) },
    ];
    const mapping = {};
    (headers || []).forEach((raw, idx) => {
      const h = (raw || '').toString().toLowerCase().trim();
      for (const rule of rules) {
        if (mapping[rule.key] === undefined && rule.match(h)) {
          mapping[rule.key] = idx;
          break;
        }
      }
    });
    return mapping;
  }, []);

  /**
   * connect — Marca a planilha como conectada no contexto.
   * O sync real é feito pelo Python ETL; aqui apenas registramos o estado.
   */
  const connect = useCallback((config) => {
    connectSheet(config);
    addLog('info', `Planilha registrada: ${config.sheetName || config.sheetId || 'configurada'}. Aguardando sync do Python.`);
  }, [connectSheet, addLog]);

  /**
   * disconnect — Desconecta a planilha do contexto.
   */
  const disconnect = useCallback(() => {
    disconnectSheet();
  }, [disconnectSheet]);

  return {
    connect,
    disconnect,
    autoDetectMapping,
  };
}
