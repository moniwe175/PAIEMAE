import { useState } from 'react';
import { XCircle, CheckCircle, AlertTriangle, Shield, Table2, FileSpreadsheet } from 'lucide-react';
import { useSync } from '../../contexts/SyncContext';
import useSheetSync from '../../hooks/useSheetSync';

export default function AuthorizeConnectionModal({ sheet, onClose, onAuthorized }) {
  const { connectSheet, addLog } = useSync();
  const { connect } = useSheetSync();
  const [authorizing, setAuthorizing] = useState(false);

  if (!sheet) return null;

  const isExcel = sheet.tipo === 'excel';
  const providerLabel = isExcel ? 'Excel Online (Microsoft 365)' : 'Google Sheets';
  const providerSubLabel = isExcel ? 'Microsoft 365 — SharePoint' : 'Google Workspace';
  const ProviderIcon = isExcel ? Table2 : FileSpreadsheet;
  const providerColor = isExcel ? '#185ABD' : '#0F9D58';

  const actions = [
    { text: `Ler os dados da planilha a cada ${sheet.pollingInterval || 60} segundos`, warn: false },
    { text: 'Importar transações para o módulo Financeiro', warn: false },
    { text: 'Atualizar KPIs e gráficos do Dashboard automaticamente', warn: false },
    { text: 'Evitar duplicação usando ID único por linha', warn: false },
    { text: `Requer login com a conta que tem acesso à planilha`, warn: true },
  ];

  const handleAuthorize = async () => {
    setAuthorizing(true);
    
    try {
      connect({
        provider: 'google',
        sheetId: sheet.id || sheet.url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1],
        sheetName: sheet.nome,
        pollingInterval: sheet.pollingInterval || 60,
        range: 'A1:Z1000',
        // In a real scenario, this would retrieve credentials safely from user/session
        googleApiKey: import.meta.env.VITE_GOOGLE_API_KEY || ''
      });

      onAuthorized(sheet);
      addLog('success', `Conectado à planilha "${sheet.nome}" com sucesso`);
    } catch (error) {
      addLog('error', `Falha ao conectar na planilha: ${error.message}`);
    } finally {
      setAuthorizing(false);
      onClose();
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
            Ao conectar, o ERP irá:
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
            Suas credenciais ficam salvas apenas no seu navegador e nunca são enviadas para servidores externos.
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleAuthorize}
            disabled={authorizing}
            style={{ background: '#2ECC71', borderColor: '#2ECC71' }}
          >
            {authorizing ? 'Autorizando...' : 'Autorizar e Conectar'}
          </button>
        </div>
      </div>
    </div>
  );
}