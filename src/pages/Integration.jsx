import { useState, useEffect } from 'react';
import {
  RefreshCw, Table2, Clock, AlertTriangle, Plus, Trash2,
  Copy, ToggleLeft, ToggleRight, Link2, FileSpreadsheet,
  CheckCircle, XCircle, WifiOff,
  ScrollText, BarChart3, ArrowRightLeft
} from 'lucide-react';
import { useSync } from '../contexts/SyncContext';
import useSheetSync from '../hooks/useSheetSync';
import AddSheetModal from '../components/integration/AddSheetModal';
import AuthorizeConnectionModal from '../components/integration/AuthorizeConnectionModal';
import ColumnMappingEditor from '../components/integration/ColumnMappingEditor';
import SyncLogPanel from '../components/integration/SyncLogPanel';

// Default configured spreadsheets
const defaultSheets = [
  {
    id: 'sheet_1',
    nome: 'CONTROLE DE CAIXA 01',
    tipo: 'excel', // 'excel' | 'google'
    tipoLabel: 'Excel Online (Microsoft 365)',
    url: 'https://centauretecombr-my.sharepoint.com/:x:/r/personal/iurydacosta_centau...',
    status: 'aguardando', // 'conectado' | 'aguardando' | 'erro'
    autoSync: true,
    pollingInterval: 60,
    tags: ['Data', 'Cliente', 'Procedimento', 'Valor', 'Profissional', 'Comissão', 'Forma Pagamento'],
    linhasSincronizadas: 0,
    ultimoSync: null,
  },
];

export default function Integration() {
  const { syncStatus, syncConfig, syncLogs, transactions, lastSyncAt, syncedRowCount, addLog } = useSync();
  const { connect, disconnect } = useSheetSync();

  const [authorizeSheet, setAuthorizeSheet] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState('conexoes');
  const [sheets, setSheets] = useState(() => {
    try {
      const saved = localStorage.getItem('erp_configured_sheets');
      return saved ? JSON.parse(saved) : defaultSheets;
    } catch { return defaultSheets; }
  });

  useEffect(() => {
    localStorage.setItem('erp_configured_sheets', JSON.stringify(sheets));
  }, [sheets]);

  const isSheetConnected = syncStatus === 'connected' || syncStatus === 'connecting';

  // Stats
  const conexoesAtivas = sheets.filter(s => s.status === 'conectado').length + (isSheetConnected ? 1 : 0);
  const totalConexoes = sheets.length;
  const linhasSync = syncedRowCount;
  const syncsHoje = syncLogs.filter(l => l.type === 'success').length;
  const filaPendente = sheets.filter(s => s.status === 'aguardando').length;

  const handleConnectSheet = (sheet) => {
    // Open the authorize modal for this specific sheet
    setAuthorizeSheet(sheet);
  };

  const handleToggleAutoSync = (sheetId) => {
    setSheets(prev => prev.map(s =>
      s.id === sheetId ? { ...s, autoSync: !s.autoSync } : s
    ));
  };

  const handleDeleteSheet = (sheetId) => {
    if (confirm('Deseja realmente remover esta planilha?')) {
      setSheets(prev => prev.filter(s => s.id !== sheetId));
    }
  };

  const handleCopyUrl = (url) => {
    navigator.clipboard?.writeText(url);
  };

  const handleAddSheet = (newSheet) => {
    setSheets(prev => [...prev, newSheet]);
  };

  const tabs = [
    { key: 'conexoes', label: 'Conexões', icon: Link2 },
    { key: 'log', label: 'Log de Sync', icon: ScrollText },
    { key: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { key: 'mapeamento', label: 'Mapeamento', icon: ArrowRightLeft },
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
          onAuthorized={(s) => {
            setSheets(prev => prev.map(sh =>
              sh.id === s.id ? { ...sh, status: 'conectado', ultimoSync: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) } : sh
            ));
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
          {sheets.length === 0 ? (
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
                            setSheets(prev => prev.map(s => s.id === sheet.id ? { ...s, status: 'aguardando', ultimoSync: null } : s));
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
    </div>
  );
}
