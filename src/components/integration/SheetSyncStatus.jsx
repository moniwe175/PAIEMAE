import { Wifi, WifiOff, Loader, Clock, Activity } from 'lucide-react';
import { useSync } from '../../contexts/SyncContext';

const statusConfig = {
  connected: { icon: Wifi, color: 'var(--success)', label: 'Conectado', dotClass: 'sync-dot sync-dot-green' },
  connecting: { icon: Loader, color: 'var(--warning)', label: 'Conectando...', dotClass: 'sync-dot sync-dot-yellow' },
  error: { icon: WifiOff, color: 'var(--danger)', label: 'Erro', dotClass: 'sync-dot sync-dot-red' },
  disconnected: { icon: WifiOff, color: 'var(--text-muted)', label: 'Desconectado', dotClass: 'sync-dot sync-dot-gray' },
};

export default function SheetSyncStatus({ compact = false }) {
  const { syncStatus, lastSyncAt, syncedRowCount, nextSyncIn, syncConfig } = useSync();

  if (syncStatus === 'disconnected' && compact) return null;

  const config = statusConfig[syncStatus] || statusConfig.disconnected;
  const Icon = config.icon;

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 99,
        background: syncStatus === 'connected' ? 'var(--success-bg)' : syncStatus === 'error' ? 'var(--danger-bg)' : 'var(--color-accent-soft)',
        fontSize: 11,
        fontWeight: 600,
        color: config.color,
      }}>
        <span className={config.dotClass} />
        {config.label}
        {lastSyncAt && <span style={{ fontWeight: 400, opacity: 0.8 }}>| {lastSyncAt}</span>}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: syncStatus === 'connected' ? 'var(--success-bg)' : syncStatus === 'error' ? 'var(--danger-bg)' : 'var(--warning-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon style={{ width: 18, height: 18, color: config.color }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={config.dotClass} />
              <span style={{ fontWeight: 700, fontSize: 13, color: config.color }}>{config.label}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {syncConfig.provider === 'demo' ? 'Modo Demo' : 'Google Sheets'}
              {syncConfig.sheetName && ` - ${syncConfig.sheetName}`}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          {lastSyncAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <Clock style={{ width: 11, height: 11, color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-light)' }}>Último sync: {lastSyncAt}</span>
            </div>
          )}
          {nextSyncIn !== null && nextSyncIn > 0 && syncStatus === 'connected' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
              <Activity style={{ width: 11, height: 11, color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Próximo em {nextSyncIn}s</span>
            </div>
          )}
          {syncedRowCount > 0 && (
            <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, marginTop: 2 }}>
              {syncedRowCount} linhas sincronizadas
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
