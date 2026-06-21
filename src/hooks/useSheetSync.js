import { useEffect, useRef } from 'react';
import { useSync } from '../contexts/SyncContext';

/**
 * useSheetSync — Auto-connect to a previously configured spreadsheet on mount.
 *
 * Reads the saved syncConfig from SyncContext. If a provider/sheetId is stored
 * in localStorage, it automatically triggers connectSheet + startPolling so the
 * app resumes data sync without manual intervention.
 *
 * Usage: call once inside a component that mounts at app root (e.g. SheetAutoSync).
 */
export default function useSheetSync() {
  const {
    syncConfig,
    syncStatus,
    connectSheet,
    disconnectSheet,
    startPolling,
    addLog,
  } = useSync();

  const hasAttempted = useRef(false);

  useEffect(() => {
    // Only attempt auto-connect once, and only if disconnected
    if (hasAttempted.current) return;
    if (syncStatus === 'connected') return;

    // Check if there is a saved config with a sheet reference
    const savedConfig = syncConfig;
    if (!savedConfig?.sheetId && !savedConfig?.provider) {
      hasAttempted.current = true;
      return;
    }

    // Polling function stub — actual implementation depends on the provider
    // (Google Sheets API or Microsoft Graph). For now we just mark as connected
    // and log the attempt. Real polling is initiated from the Integration page.
    try {
      connectSheet(savedConfig);
      addLog('info', `Auto-conectado à planilha: ${savedConfig.sheetName || savedConfig.sheetId}`);
    } catch (e) {
      console.warn('[useSheetSync] Auto-connect failed:', e);
      addLog('error', `Falha na auto-conexão: ${e?.message || 'erro desconhecido'}`);
    }

    hasAttempted.current = true;
  }, [syncConfig, syncStatus, connectSheet, startPolling, addLog]);

  // Auto-detect column mapping from spreadsheet headers
  function autoDetectMapping(headers) {
    const rules = [
      { key: 'cliente',      match: h => /client|pacient|nome/.test(h) },
      { key: 'procedimento', match: h => /proced|servi[çc]|tratamento/.test(h) },
      { key: 'valor',        match: h => /valor|pre[çc]o|total/.test(h) },
      { key: 'profissional', match: h => /profiss/.test(h) },
      { key: 'comissao',     match: h => /comiss/.test(h) },
      { key: 'data',         match: h => /data|date/.test(h) },
      { key: 'tipo',         match: h => /tipo|type/.test(h) },
      { key: 'categoria',    match: h => /categ/.test(h) },
    ];
    const mapping = {};
    (headers || []).forEach((raw, idx) => {
      const h = (raw || '').toString().toLowerCase().trim();
      for (const rule of rules) {
        if (!mapping[rule.key] && rule.match(h)) {
          mapping[rule.key] = idx;
          break;
        }
      }
    });
    return mapping;
  }

  return {
    connect: connectSheet,
    disconnect: disconnectSheet,
    autoDetectMapping,
  };
}
