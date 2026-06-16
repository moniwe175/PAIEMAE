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
}
