import { useRef, useEffect } from 'react';
import { ScrollText, Trash2, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useSync } from '../../contexts/SyncContext';

const typeConfig = {
  success: { icon: CheckCircle, color: 'var(--success)', bg: 'var(--success-bg)' },
  error: { icon: XCircle, color: 'var(--danger)', bg: 'var(--danger-bg)' },
  warning: { icon: AlertTriangle, color: 'var(--warning)', bg: 'var(--warning-bg)' },
  info: { icon: Info, color: 'var(--info)', bg: 'var(--info-bg)' },
};

export default function SyncLogPanel() {
  const { syncLogs, clearLogs } = useSync();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [syncLogs.length]);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScrollText style={{ width: 16, height: 16, color: 'var(--color-primary)' }} />
          Log de Sincronização
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-neutral" style={{ fontSize: 10 }}>
            {syncLogs.length} entradas
          </span>
          {syncLogs.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={clearLogs}>
              <Trash2 style={{ width: 12, height: 12 }} />Limpar
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          height: 340,
          overflowY: 'auto',
          padding: '10px 14px',
          fontSize: 12,
        }}
      >
        {syncLogs.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            gap: 8,
          }}>
            <ScrollText style={{ width: 28, height: 28, opacity: 0.3 }} />
            <span style={{ fontSize: 12 }}>Nenhum log de sincronização</span>
            <span style={{ fontSize: 11, opacity: 0.6 }}>Conecte uma planilha para iniciar</span>
          </div>
        ) : (
          syncLogs.map(entry => {
            const config = typeConfig[entry.type] || typeConfig.info;
            const Icon = config.icon;
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 4,
                  background: config.bg,
                  borderLeft: `3px solid ${config.color}`,
                }}
              >
                <Icon style={{ width: 13, height: 13, color: config.color, flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: 'var(--text-dark)', fontWeight: 500, fontSize: 12, lineHeight: 1.4 }}>
                    {entry.message}
                  </span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0, marginTop: 1 }}>
                  {entry.timestamp}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}