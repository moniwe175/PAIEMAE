import { useState } from 'react';
import { XCircle, CheckCircle, AlertTriangle, Shield, Table2, FileSpreadsheet, Loader2, RefreshCw } from 'lucide-react';
import { useSync } from '../../contexts/SyncContext';
import useSheetSync from '../../hooks/useSheetSync';
import { syncSheetToSupabase } from '../../services/googleSheetsSync';

export default function AuthorizeConnectionModal({ sheet, onClose, onAuthorized }) {
  const { connectSheet, addLog, setSyncedRowCount, setLastSyncAt } = useSync();
  const { connect } = useSheetSync();
  const [authorizing, setAuthorizing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  if (!sheet) return null;

  const isGoogle = sheet.tipo === 'google' || !sheet.tipo || sheet.tipo === '';
  const providerLabel = isGoogle ? 'Google Sheets' : 'Excel Online (Microsoft 365)';
  const providerSubLabel = isGoogle ? 'Google Workspace' : 'Microsoft 365 — SharePoint';
  const ProviderIcon = isGoogle ? FileSpreadsheet : Table2;
  const providerColor = isGoogle ? '#0F9D58' : '#185ABD';

  const actions = [
    { text: `Ler os dados da planilha a cada ${sheet.pollingInterval || 60} segundos`, warn: false },
    { text: 'Importar transações para o módulo Financeiro', warn: false },
    { text: 'Atualizar KPIs e gráficos do Dashboard automaticamente', warn: false },
    { text: 'Evitar duplicação usando ID único por linha', warn: false },
    { text: 'Planilha deve estar compartilhada como "qualquer pessoa com o link"', warn: true },
  ];

  const handleAuthorize = async () => {
    setAuthorizing(true);
    setSyncResult(null);

    try {
      // 1. Conectar no contexto local
      connect({
        provider: sheet.tipo || 'google',
        sheetId: sheet.sheetId || sheet.id,
        sheetName: sheet.nome,
        pollingInterval: sheet.pollingInterval || 60,
        range: sheet.range || 'A1:Z1000',
        sheet_url: sheet.url,
        googleApiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
      });

      // 2. Sincronizar dados agora se for Google Sheets e tiver URL
      if (sheet.url && isGoogle) {
        addLog('info', `Iniciando sincronização da planilha "${sheet.nome}"...`);
        const result = await syncSheetToSupabase(sheet.url);
        setSyncResult(result);

        if (result.success) {
          addLog('success', `Conectado! ${result.rowCount} registros importados da planilha "${sheet.nome}"`);
        } else if (result.warning) {
          addLog('warning', result.warning);
        } else {
          addLog('error', `Falha ao importar dados: ${result.error}`);
        }
      } else {
        addLog('success', `Conectado à planilha "${sheet.nome}" com sucesso`);
      }

      onAuthorized(sheet);
    } catch (error) {
      addLog('error', `Falha ao conectar na planilha: ${error.message}`);
      setSyncResult({ success: false, error: error.message });
    } finally {
      setAuthorizing(false);
      if (!syncResult?.error) {
        setTimeout(onClose, 1500);
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `${providerColor}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ProviderIcon style={{ width: 20, height: 20, color: providerColor }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-dark)' }}>
                Conectar {providerLabel}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {providerSubLabel}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>

        {/* Selected spreadsheet */}
        <div style={{
          background: 'var(--bg-main)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 16px',
          marginBottom: 18,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Planilha selecionada:
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-dark)', marginBottom: 4 }}>
            {sheet.nome}
          </div>
          {sheet.url && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sheet.url}
            </div>
          )}
        </div>

        {/* ERP actions */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
            O ERP irá:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actions.map((action, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: action.warn ? 'var(--warning-bg)' : 'var(--bg-main)',
              }}>
                {action.warn
                  ? <AlertTriangle style={{ width: 14, height: 14, color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
                  : <CheckCircle style={{ width: 14, height: 14, color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
                }
                <span style={{ fontSize: 13, color: 'var(--text-dark)', lineHeight: 1.4, fontWeight: action.warn ? 600 : 500 }}>
                  {action.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sync result */}
        {syncResult && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 16,
            background: syncResult.success ? 'var(--success-bg)' : syncResult.warning ? '#FFF8E1' : 'var(--danger-bg)',
            border: `1px solid ${syncResult.success ? 'var(--success)' : syncResult.warning ? '#FFD966' : 'var(--danger)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
          }}>
            {syncResult.success
              ? <CheckCircle style={{ width: 16, height: 16, color: 'var(--success)', flexShrink: 0 }} />
              : <AlertTriangle style={{ width: 16, height: 16, color: syncResult.warning ? '#E6A800' : 'var(--danger)', flexShrink: 0 }} />
            }
            <span style={{ color: 'var(--text-dark)', fontWeight: 500 }}>
              {syncResult.success
                ? `${syncResult.rowCount} registros importados com sucesso!`
                : syncResult.warning || syncResult.error}
            </span>
          </div>
        )}

        {/* Security notice */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--info-bg)',
          marginBottom: 18,
        }}>
          <Shield style={{ width: 14, height: 14, color: 'var(--info)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--info)', lineHeight: 1.5 }}>
            A planilha precisa estar compartilhada com "Qualquer pessoa com o link pode visualizar".
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleAuthorize}
            disabled={authorizing}
            style={{ background: providerColor, borderColor: providerColor, minWidth: 180 }}
          >
            {authorizing
              ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />Sincronizando...</>
              : <><RefreshCw style={{ width: 14, height: 14 }} />Autorizar e Conectar</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}