import { useState, useEffect } from 'react';
import {
  RefreshCw, Table2, Clock, AlertTriangle, Plus, Trash2,
  Copy, ToggleLeft, ToggleRight, Link2, FileSpreadsheet,
  CheckCircle, XCircle, WifiOff,
  ScrollText, BarChart3, ArrowRightLeft, Zap, Loader2
} from 'lucide-react';
import { useSync } from '../contexts/SyncContext';
import useSheetSync from '../hooks/useSheetSync';
import AddSheetModal from '../components/integration/AddSheetModal';
import AuthorizeConnectionModal from '../components/integration/AuthorizeConnectionModal';
import ColumnMappingEditor from '../components/integration/ColumnMappingEditor';
import SyncLogPanel from '../components/integration/SyncLogPanel';
import {
  getMarketingEngineStatus, setMarketingEngineEnabled,
  fetchSheetConnections, upsertSheetConnection, deleteSheetConnection
} from '../services/supabaseService';
import { supabase, getCurrentUser } from '../lib/supabase';

// Default configured spreadsheet used to seed Supabase when empty
const defaultSheet = {
  id: 'sheet_1',
  nome: 'CONTROLE DE CAIXA 01',
  tipo: 'excel',
  tipoLabel: 'Excel Online (Microsoft 365)',
  url: 'https://centauretecombr-my.sharepoint.com/:x:/r/personal/iurydacosta_centau...',
  status: 'aguardando',
  autoSync: true,
  pollingInterval: 60,
  tags: ['Data', 'Cliente', 'Procedimento', 'Valor', 'Profissional', 'Comissão', 'Forma Pagamento'],
  linhasSincronizadas: 0,
  ultimoSync: null,
};

function mapFromSupabase(conn) {
  return {
    id: conn.id,
    nome: conn.nome,
    tipo: conn.tipo,
    tipoLabel: conn.tipo_label || conn.tipo,
    url: conn.url,
    status: conn.status,
    autoSync: conn.auto_sync,
    pollingInterval: conn.polling_interval,
    tags: conn.tags || [],
    linhasSincronizadas: conn.linhas_sincronizadas || 0,
    ultimoSync: conn.ultimo_sync,
  };
}

function mapToSupabase(sheet) {
  return {
    id: sheet.id,
    nome: sheet.nome,
    tipo: sheet.tipo,
    tipo_label: sheet.tipoLabel,
    url: sheet.url,
    status: sheet.status,
    auto_sync: sheet.autoSync,
    polling_interval: sheet.pollingInterval,
    tags: sheet.tags || [],
    linhas_sincronizadas: sheet.linhasSincronizadas || 0,
    ultimo_sync: sheet.ultimoSync,
  };
}

async function seedSheets() {
  const { data } = await fetchSheetConnections();
  if (!data || data.length === 0) {
    const user = await getCurrentUser();
    await upsertSheetConnection({ ...mapToSupabase(defaultSheet), user_id: user?.id });
  }
}

export default function Integration() {
  const { syncStatus, syncConfig, syncLogs, transactions, lastSyncAt, syncedRowCount, addLog } = useSync();
  const { connect, disconnect } = useSheetSync();

  const [authorizeSheet, setAuthorizeSheet] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState('conexoes');
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Marketing Engine toggle state
  const [engineEnabled, setEngineEnabled] = useState(true);
  const [engineUpdatedAt, setEngineUpdatedAt] = useState(null);
  const [engineLoading, setEngineLoading] = useState(true);
  const [engineSaving, setEngineSaving] = useState(false);
  const [engineError, setEngineError] = useState(null);

  // WhatsApp Connection Status state
  const [waStatus, setWaStatus] = useState(null);

  const loadSheets = async () => {
    setLoading(true);
    await seedSheets();
    const { data } = await fetchSheetConnections();
    if (data) setSheets(data.map(mapFromSupabase));
    setLoading(false);
  };

  useEffect(() => {
    loadSheets();
  }, []);

  // Fetch marketing engine status on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEngineLoading(true);
      const { data } = await getMarketingEngineStatus();
      if (!cancelled && data) {
        setEngineEnabled(data.enabled !== false);
        setEngineUpdatedAt(data.updated_at || null);
      }
      setEngineLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch initial WhatsApp connection status and subscribe to realtime updates
  useEffect(() => {
    let active = true;

    const fetchWaStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('whatsapp_connection_status')
          .select('*')
          .eq('id', 1)
          .maybeSingle();
        
        if (error) throw error;
        if (active && data) {
          setWaStatus(data);
        }
      } catch (err) {
        console.error('Erro ao buscar status inicial do WhatsApp:', err);
      }
    };

    fetchWaStatus();

    const channel = supabase
      .channel('whatsapp-status')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_connection_status'
      }, (payload) => {
        if (active && payload.new) {
          setWaStatus(payload.new);
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const isSheetConnected = syncStatus === 'connected' || syncStatus === 'connecting';

  // Stats
  const conexoesAtivas = sheets.filter(s => s.status === 'conectado').length + (isSheetConnected ? 1 : 0);
  const totalConexoes = sheets.length;
  const linhasSync = syncedRowCount;
  const syncsHoje = syncLogs.filter(l => l.type === 'success').length;
  const filaPendente = sheets.filter(s => s.status === 'aguardando').length;

  const persistSheet = async (sheet) => {
    const user = await getCurrentUser();
    const payload = { ...mapToSupabase(sheet), user_id: user?.id };
    const { data, error } = await upsertSheetConnection(payload);
    if (!error && data) {
      return mapFromSupabase(data);
    }
    return sheet;
  };

  const handleConnectSheet = (sheet) => {
    setAuthorizeSheet(sheet);
  };

  const handleToggleAutoSync = async (sheetId) => {
    const sheet = sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    const updated = { ...sheet, autoSync: !sheet.autoSync };
    const persisted = await persistSheet(updated);
    setSheets(prev => prev.map(s => s.id === sheetId ? persisted : s));
  };

  const handleDeleteSheet = async (sheetId) => {
    if (confirm('Deseja realmente remover esta planilha?')) {
      await deleteSheetConnection(sheetId);
      setSheets(prev => prev.filter(s => s.id !== sheetId));
    }
  };

  const handleCopyUrl = (url) => {
    navigator.clipboard?.writeText(url);
  };

  const handleToggleEngine = async () => {
    const newValue = !engineEnabled;
    setEngineSaving(true);
    setEngineError(null);
    const { error } = await setMarketingEngineEnabled(newValue);
    if (error) {
      setEngineError('Erro ao atualizar status do motor. Tente novamente.');
    } else {
      setEngineEnabled(newValue);
      setEngineUpdatedAt(new Date().toISOString());
    }
    setEngineSaving(false);
  };

  const handleAddSheet = async (newSheet) => {
    const persisted = await persistSheet(newSheet);
    setSheets(prev => [...prev, persisted]);
  };

  const tabs = [
    { key: 'conexoes', label: 'Conexões', icon: Link2 },
    { key: 'log', label: 'Log de Sync', icon: ScrollText },
    { key: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { key: 'mapeamento', label: 'Mapeamento', icon: ArrowRightLeft },
    { key: 'motor', label: 'Motor Marketing', icon: Zap },
  ];

  return (
    <div>
      {showAddModal && (
        <AddSheetModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddSheet}
        />
      )}
      {authorizeSheet && (
        <AuthorizeConnectionModal
          sheet={authorizeSheet}
          onClose={() => setAuthorizeSheet(null)}
          onAuthorized={async (s) => {
            const updated = { ...s, status: 'conectado', ultimoSync: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
            const persisted = await persistSheet(updated);
            setSheets(prev => prev.map(sh => sh.id === s.id ? persisted : sh));
            setAuthorizeSheet(null);
          }}
        />
      )}

      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-label"><FileSpreadsheet />INTEGRAÇÃO COM PLANILHAS</div>
        <h1 className="page-title">Integração com Planilhas</h1>
        <p className="page-subtitle">Sincronize Google Sheets e Excel Online com o ERP em tempo real</p>
      </div>

      {/* Status indicators top-right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: isSheetConnected ? 'var(--success)' : 'var(--text-muted)' }}>
          {isSheetConnected
            ? <><span className="sync-dot sync-dot-green" />Conectado</>
            : <><span className="sync-dot sync-dot-gray" />Sem conexão</>
          }
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <RefreshCw style={{ width: 12, height: 12 }} />
          {lastSyncAt ? `Último sync: ${lastSyncAt}` : 'Nunca sincronizado'}
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid-4 section-gap">
        <div className="stat-card" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: conexoesAtivas > 0 ? 'var(--success-bg)' : 'var(--bg-main)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RefreshCw style={{ width: 18, height: 18, color: conexoesAtivas > 0 ? 'var(--success)' : 'var(--text-muted)' }} />
            </div>
          </div>
          <div className="stat-value" style={{ color: conexoesAtivas > 0 ? 'var(--success)' : 'var(--text-dark)', fontSize: 28 }}>{conexoesAtivas}</div>
          <div className="stat-label">CONEXÕES ATIVAS</div>
          <div className="stat-sub">{conexoesAtivas} de {totalConexoes} conectada{totalConexoes !== 1 ? 's' : ''}</div>
        </div>

        <div className="stat-card" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: linhasSync > 0 ? 'var(--info-bg)' : 'var(--bg-main)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Table2 style={{ width: 18, height: 18, color: linhasSync > 0 ? 'var(--info)' : 'var(--text-muted)' }} />
            </div>
          </div>
          <div className="stat-value" style={{ color: linhasSync > 0 ? 'var(--info)' : 'var(--text-dark)', fontSize: 28 }}>{linhasSync}</div>
          <div className="stat-label">LINHAS SINCRONIZADAS</div>
          <div className="stat-sub">{linhasSync > 0 ? `${linhasSync} linhas importadas` : 'Aguardando sync'}</div>
        </div>

        <div className="stat-card" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: syncsHoje > 0 ? 'var(--success-bg)' : 'var(--bg-main)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RefreshCw style={{ width: 18, height: 18, color: syncsHoje > 0 ? 'var(--success)' : 'var(--text-muted)' }} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: 28 }}>{syncsHoje > 0 ? syncsHoje : '—'}</div>
          <div className="stat-label">SYNCS HOJE</div>
          <div className="stat-sub">{syncsHoje > 0 ? `${syncsHoje} sincronizações` : 'Nenhum sync'}</div>
        </div>

        <div className="stat-card" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: filaPendente > 0 ? 'var(--danger-bg)' : 'var(--bg-main)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Clock style={{ width: 18, height: 18, color: filaPendente > 0 ? '#FF9AA2' : 'var(--text-muted)' }} />
            </div>
          </div>
          <div className="stat-value" style={{ color: filaPendente > 0 ? '#FF9AA2' : 'var(--text-dark)', fontSize: 28 }}>{filaPendente}</div>
          <div className="stat-label">FILA PENDENTE</div>
          <div className="stat-sub" style={{ color: filaPendente > 0 ? 'var(--danger)' : undefined }}>
            {filaPendente > 0 ? 'Aguardando conexão' : 'Tudo em dia'}
          </div>
        </div>
      </div>

      {/* Warning banner for awaiting sheets */}
      {sheets.some(s => s.status === 'aguardando') && (
        <div style={{
          background: '#FFF8E1',
          border: '1px solid #FFD966',
          borderLeft: '4px solid #FFD966',
          borderRadius: 'var(--radius-sm)',
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <AlertTriangle style={{ width: 20, height: 20, color: '#E6A800', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#8B6914', marginBottom: 6 }}>Planilha Excel detectada</div>
            <p style={{ fontSize: 13, color: '#6B5A1E', lineHeight: 1.6, margin: 0 }}>
              A planilha <strong>{sheets.find(s => s.status === 'aguardando')?.nome}</strong> foi configurada como fonte de dados financeiros.
              Clique em <strong>Conectar</strong> para autorizar o acesso via Microsoft 365 e iniciar a sincronização automática.
              Nenhum dado financeiro será exibido no ERP até que a conexão seja estabelecida.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: activeTab === tab.key ? 'var(--text-dark)' : 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab.key ? '2px solid var(--text-dark)' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                <Icon style={{ width: 14, height: 14 }} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content: Conexões */}
      {activeTab === 'conexoes' && (
        <div>
          {/* Planilhas Configuradas header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-dark)' }}>Planilhas Configuradas</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {conexoesAtivas} de {totalConexoes} conectada{totalConexoes !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddModal(true)}
            >
              <Plus style={{ width: 14, height: 14 }} />Adicionar planilha
            </button>
          </div>

          {/* Sheet cards */}
          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <Loader2 style={{ width: 32, height: 32, animation: 'spin 1s linear infinite', margin: '0 auto 12px', color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando planilhas...</p>
            </div>
          ) : sheets.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <FileSpreadsheet style={{ width: 40, height: 40, color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma planilha configurada</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowAddModal(true)}>
                <Plus style={{ width: 14, height: 14 }} />Adicionar planilha
              </button>
            </div>
          ) : (
            sheets.map(sheet => (
              <div key={sheet.id} className="card" style={{ marginBottom: 12, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    {/* Sheet name + status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: sheet.tipo === 'excel' ? '#185ABD18' : '#0F9D5818',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {sheet.tipo === 'excel'
                          ? <Table2 style={{ width: 18, height: 18, color: '#185ABD' }} />
                          : <FileSpreadsheet style={{ width: 18, height: 18, color: '#0F9D58' }} />
                        }
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-dark)' }}>{sheet.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sheet.tipoLabel}</div>
                      </div>
                      <span
                        className="badge"
                        style={{
                          marginLeft: 8,
                          background: sheet.status === 'conectado' ? 'var(--success-bg)' : sheet.status === 'erro' ? 'var(--danger-bg)' : '#FF9AA233',
                          color: sheet.status === 'conectado' ? 'var(--success)' : sheet.status === 'erro' ? 'var(--danger)' : '#FF9AA2',
                          fontSize: 10,
                        }}
                      >
                        {sheet.status === 'conectado' && <><CheckCircle style={{ width: 10, height: 10 }} />Conectado</>}
                        {sheet.status === 'aguardando' && <><Clock style={{ width: 10, height: 10 }} />Aguardando conexão</>}
                        {sheet.status === 'erro' && <><XCircle style={{ width: 10, height: 10 }} />Erro</>}
                      </span>
                    </div>

                    {/* URL */}
                    {sheet.url && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, marginLeft: 46 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400, display: 'inline-block' }}>
                          {sheet.url}
                        </span>
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)' }}
                          onClick={() => handleCopyUrl(sheet.url)}
                          title="Copiar URL"
                        >
                          <Copy style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    )}

                    {/* Auto-sync toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 46 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-medium)', fontWeight: 500 }}>Auto-sync</span>
                      <button
                        onClick={() => handleToggleAutoSync(sheet.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                      >
                        {sheet.autoSync
                          ? <ToggleRight style={{ width: 28, height: 28, color: 'var(--success)' }} />
                          : <ToggleLeft style={{ width: 28, height: 28, color: 'var(--text-muted)' }} />
                        }
                      </button>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, marginLeft: 46 }}>
                      {sheet.status === 'aguardando' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleConnectSheet(sheet)}
                          style={{ background: '#2ECC71', borderColor: '#2ECC71' }}
                        >
                          <Link2 style={{ width: 12, height: 12 }} />Conectar agora
                        </button>
                      )}
                      {sheet.status === 'conectado' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            disconnect();
                            handleToggleAutoSync(sheet.id);
                          }}
                        >
                          <WifiOff style={{ width: 12, height: 12 }} />Desconectar
                        </button>
                      )}
                      <button
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '6px 8px', borderRadius: 6, color: 'var(--text-muted)',
                          display: 'flex', alignItems: 'center',
                        }}
                        onClick={() => handleDeleteSheet(sheet.id)}
                        title="Remover planilha"
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>

                    {/* Metadata */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'var(--text-muted)', marginLeft: 46, marginBottom: sheet.tags?.length > 0 ? 10 : 0 }}>
                      <span>{sheet.linhasSincronizadas || 0} linhas sincronizadas</span>
                      <span>{sheet.ultimoSync ? `Último sync: ${sheet.ultimoSync}` : 'Nunca sincronizado'}</span>
                      <span>Polling a cada {sheet.pollingInterval}s</span>
                    </div>

                    {/* Tags */}
                    {sheet.tags && sheet.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 46 }}>
                        {sheet.tags.map(tag => (
                          <span key={tag} style={{
                            padding: '3px 10px',
                            borderRadius: 99,
                            fontSize: 10,
                            fontWeight: 600,
                            background: '#D4F1E8',
                            color: '#1A7A4C',
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content: Log de Sync */}
      {activeTab === 'log' && (
        <SyncLogPanel />
      )}

      {/* Tab Content: Relatórios */}
      {activeTab === 'relatorios' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title"><BarChart3 />Relatórios de Sincronização</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
            <div style={{ padding: 16, background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Transações por Origem</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>
                    {transactions.filter(t => t.origem === 'manual').length}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Manual</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--info)' }}>
                    {transactions.filter(t => t.origem === 'planilha').length}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Planilha</div>
                </div>
              </div>
            </div>
            <div style={{ padding: 16, background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Faturamento por Origem</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>
                    R$ {transactions.filter(t => t.origem === 'manual' && t.tipo === 'receita').reduce((a, t) => a + t.valor, 0).toLocaleString('pt-BR')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Manual</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--info)' }}>
                    R$ {transactions.filter(t => t.origem === 'planilha' && t.tipo === 'receita').reduce((a, t) => a + t.valor, 0).toLocaleString('pt-BR')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Planilha</div>
                </div>
              </div>
            </div>
          </div>

          {/* Last syncs */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-medium)', marginBottom: 8 }}>Últimas Sincronizações</div>
            {syncLogs.slice(0, 10).map(log => (
              <div key={log.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', borderRadius: 6, marginBottom: 4,
                background: log.type === 'success' ? 'var(--success-bg)' : log.type === 'error' ? 'var(--danger-bg)' : log.type === 'warning' ? 'var(--warning-bg)' : 'var(--info-bg)',
                fontSize: 12,
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>{log.timestamp}</span>
                <span style={{ color: 'var(--text-dark)', fontWeight: 500 }}>{log.message}</span>
              </div>
            ))}
            {syncLogs.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 20 }}>
                Nenhum registro de sincronização
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Mapeamento */}
      {activeTab === 'mapeamento' && (
        <ColumnMappingEditor />
      )}

      {/* Tab Content: Motor Marketing */}
      {activeTab === 'motor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Card 1: Motor Marketing Status */}
          <div className="card" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flex: 1 }}>
                {/* Icon */}
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: engineEnabled ? '#2ECC7118' : '#FF9AA218',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Zap style={{ width: 22, height: 22, color: engineEnabled ? 'var(--success)' : '#FF9AA2' }} />
                </div>

                {/* Text block */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-dark)' }}>
                      Marketing Automático (WhatsApp)
                    </span>
                    <span
                      className="badge"
                      style={{
                        background: engineEnabled ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: engineEnabled ? 'var(--success)' : 'var(--danger)',
                        fontSize: 10,
                      }}
                    >
                      {engineEnabled
                        ? <><CheckCircle style={{ width: 10, height: 10 }} />Ativo</>
                        : <><XCircle style={{ width: 10, height: 10 }} />Desativado</>
                      }
                    </span>
                  </div>

                  <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.6, margin: '0 0 10px' }}>
                    Controla o motor Python que roda no Railway. Quando <strong>desativado</strong>,
                    o ciclo do scheduler pula todas as ferramentas (aniversário, reaquecimento, no-show, etc.)
                    sem enviar nenhuma mensagem.
                  </p>

                  <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 14px' }}>
                    Mudanças entram em vigor no próximo ciclo do motor (a cada 30 minutos),
                    não interrompe instantaneamente um ciclo já em andamento.
                  </p>

                  {engineUpdatedAt && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Última alteração:{' '}
                      {new Date(engineUpdatedAt).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  )}

                  {engineError && (
                    <div style={{
                      background: 'var(--danger-bg)', border: '1px solid #FF9AA2',
                      borderRadius: 'var(--radius-sm)', padding: '8px 12px',
                      fontSize: 12, color: 'var(--danger)', marginBottom: 12,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
                      {engineError}
                    </div>
                  )}
                </div>
              </div>

              {/* Toggle */}
              <button
                onClick={handleToggleEngine}
                disabled={engineLoading || engineSaving}
                style={{
                  background: 'none', border: 'none', cursor: engineLoading || engineSaving ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', padding: 0, opacity: engineLoading || engineSaving ? 0.5 : 1,
                }}
                title={engineEnabled ? 'Desativar motor' : 'Ativar motor'}
              >
                {engineLoading
                  ? <Loader2 style={{ width: 36, height: 36, color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
                  : engineEnabled
                    ? <ToggleRight style={{ width: 40, height: 40, color: 'var(--success)' }} />
                    : <ToggleLeft style={{ width: 40, height: 40, color: 'var(--text-muted)' }} />
                }
              </button>
            </div>
          </div>

          {/* Card 2: Conexão WhatsApp */}
          <div className="card" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {/* Icon status container */}
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 
                  waStatus?.status === 'connected' ? '#2ECC7118' :
                  waStatus?.status === 'connecting' ? '#3498db18' :
                  waStatus?.status === 'qr_ready' ? '#F39C1218' :
                  '#FF9AA218',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {waStatus?.status === 'connected' && <CheckCircle style={{ width: 22, height: 22, color: 'var(--success)' }} />}
                {waStatus?.status === 'connecting' && <Loader2 style={{ width: 22, height: 22, color: '#3498db', animation: 'spin 1s linear infinite' }} />}
                {waStatus?.status === 'qr_ready' && <Clock style={{ width: 22, height: 22, color: '#F39C12' }} />}
                {(!waStatus || waStatus?.status === 'disconnected') && <WifiOff style={{ width: 22, height: 22, color: '#FF9AA2' }} />}
                {waStatus?.status === 'error' && <AlertTriangle style={{ width: 22, height: 22, color: '#FF9AA2' }} />}
              </div>

              {/* Text block */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-dark)' }}>
                    Conexão WhatsApp
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: 
                        waStatus?.status === 'connected' ? 'var(--success-bg)' :
                        waStatus?.status === 'connecting' ? '#3498db1d' :
                        waStatus?.status === 'qr_ready' ? '#F39C121d' :
                        'var(--danger-bg)',
                      color: 
                        waStatus?.status === 'connected' ? 'var(--success)' :
                        waStatus?.status === 'connecting' ? '#3498db' :
                        waStatus?.status === 'qr_ready' ? '#F39C12' :
                        'var(--danger)',
                      fontSize: 10,
                    }}
                  >
                    {!waStatus && 'Conectando'}
                    {waStatus?.status === 'connected' && 'Conectado'}
                    {waStatus?.status === 'connecting' && 'Conectando'}
                    {waStatus?.status === 'qr_ready' && 'QR Code Pronto'}
                    {waStatus?.status === 'disconnected' && 'Desconectado'}
                    {waStatus?.status === 'error' && 'Erro'}
                  </span>
                </div>

                {/* Conditional Rendering based on Status */}
                {(!waStatus || waStatus.status === 'disconnected') && (
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.6, margin: '0 0 10px' }}>
                      WhatsApp desconectado
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                      Inicie o worker no computador da clínica para conectar
                    </p>
                  </div>
                )}

                {waStatus?.status === 'connecting' && (
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.6, margin: '0 0 10px' }}>
                      Conectando...
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                      Tentando estabelecer comunicação com o WhatsApp. Aguarde um instante.
                    </p>
                  </div>
                )}

                {waStatus?.status === 'qr_ready' && (
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-medium)', fontWeight: 600, margin: '0 0 4px' }}>
                      Escaneie o QR Code com o WhatsApp da clínica
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
                      WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho
                    </p>
                    
                    {/* QR Code Card/Box with border and slightly different background */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '16px',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      width: 'fit-content',
                      marginBottom: 12,
                    }}>
                      {waStatus.qr_code_base64 ? (
                        <img 
                          src={waStatus.qr_code_base64} 
                          alt="QR Code WhatsApp" 
                          style={{ width: 220, height: 220, display: 'block' }} 
                        />
                      ) : (
                        <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Loader2 style={{ width: 32, height: 32, color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
                        </div>
                      )}
                    </div>

                    <p style={{ fontSize: 12, color: '#E6A800', fontWeight: 600, margin: 0 }}>
                      ⚠️ O QR Code expira em 60 segundos. Se expirar, reinicie o worker.
                    </p>
                  </div>
                )}

                {waStatus?.status === 'connected' && (
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-medium)', fontWeight: 600, margin: '0 0 6px' }}>
                      WhatsApp conectado ✅
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-dark)', fontWeight: 700, margin: '0 0 10px' }}>
                      Número: {waStatus.phone_number}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      Conexão gerenciada pelo worker local. Para desconectar, encerre o worker.
                    </p>
                  </div>
                )}

                {waStatus?.status === 'error' && (
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-medium)', fontWeight: 600, margin: '0 0 6px', color: 'var(--danger)' }}>
                      Erro na conexão
                    </p>
                    {waStatus.error_message && (
                      <div style={{
                        background: 'var(--danger-bg)', border: '1px solid #FF9AA2',
                        borderRadius: 'var(--radius-sm)', padding: '8px 12px',
                        fontSize: 12, color: 'var(--danger)', marginBottom: 10,
                      }}>
                        {waStatus.error_message}
                      </div>
                    )}
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      Reinicie o worker para tentar novamente.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
