import { useState } from 'react';
import { XCircle, FileSpreadsheet, Table2, Zap, Clock, Plus } from 'lucide-react';

const syncModes = [
  { value: 'realtime', label: 'Tempo real (webhook)' },
  { value: 'polling60', label: 'Polling a cada 60s' },
  { value: 'polling30', label: 'Polling a cada 30s' },
  { value: 'polling120', label: 'Polling a cada 2min' },
];

export default function AddSheetModal({ onClose, onAdd }) {
  const [provider, setProvider] = useState('google');
  const [nome, setNome] = useState('');
  const [url, setUrl] = useState('');
  const [syncMode, setSyncMode] = useState('realtime');

  const handleAdd = () => {
    if (!nome.trim()) {
      alert('Preencha o nome da conexão.');
      return;
    }

    const newSheet = {
      id: 'sheet_' + Date.now(),
      nome: nome.trim().toUpperCase(),
      tipo: provider,
      tipoLabel: provider === 'excel' ? 'Excel Online (Microsoft 365)' : 'Google Sheets',
      url: url.trim(),
      status: 'aguardando',
      autoSync: true,
      pollingInterval: syncMode === 'realtime' ? 15 : syncMode === 'polling30' ? 30 : syncMode === 'polling60' ? 60 : 120,
      tags: ['Data', 'Cliente', 'Procedimento', 'Valor', 'Profissional', 'Comissão'],
      linhasSincronizadas: 0,
      ultimoSync: null,
    };

    onAdd(newSheet);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <span className="modal-title">Adicionar Planilha</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Conecte outra planilha para sincronização
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>

        {/* Provider selection */}
        <div style={{ marginBottom: 18 }}>
          <label className="form-label">Provedor</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {/* Google Sheets */}
            <div
              onClick={() => setProvider('google')}
              style={{
                flex: 1,
                padding: '14px 16px',
                borderRadius: 'var(--radius-sm)',
                border: `2px solid ${provider === 'google' ? '#0F9D58' : 'var(--border-color)'}`,
                cursor: 'pointer',
                background: provider === 'google' ? '#0F9D5808' : 'var(--bg-card)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#0F9D5818',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FileSpreadsheet style={{ width: 16, height: 16, color: '#0F9D58' }} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Google Sheets</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: provider === 'google' ? '#0F9D58' : 'var(--text-muted)' }}>
                <Zap style={{ width: 11, height: 11 }} />
                Webhook em tempo real
              </div>
            </div>

            {/* Excel Online */}
            <div
              onClick={() => setProvider('excel')}
              style={{
                flex: 1,
                padding: '14px 16px',
                borderRadius: 'var(--radius-sm)',
                border: `2px solid ${provider === 'excel' ? '#185ABD' : 'var(--border-color)'}`,
                cursor: 'pointer',
                background: provider === 'excel' ? '#185ABD08' : 'var(--bg-card)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#185ABD18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Table2 style={{ width: 16, height: 16, color: '#185ABD' }} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Excel Online</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: provider === 'excel' ? '#185ABD' : 'var(--text-muted)' }}>
                <Clock style={{ width: 11, height: 11 }} />
                Polling a cada 60s
              </div>
            </div>
          </div>
        </div>

        {/* Nome da Conexão */}
        <div className="form-group">
          <label className="form-label">Nome da Conexão</label>
          <input
            className="form-input"
            placeholder="Ex: Lançamentos Diários"
            value={nome}
            onChange={e => setNome(e.target.value)}
          />
        </div>

        {/* URL da Planilha */}
        <div className="form-group">
          <label className="form-label">URL da Planilha</label>
          <input
            className="form-input"
            placeholder="https://..."
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        </div>

        {/* Modo de Sincronização */}
        <div className="form-group">
          <label className="form-label">Modo de Sincronização</label>
          <select
            className="form-select"
            value={syncMode}
            onChange={e => setSyncMode(e.target.value)}
          >
            {syncModes.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            style={{ background: '#2ECC71', borderColor: '#2ECC71' }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            Adicionar Planilha
          </button>
        </div>
      </div>
    </div>
  );
}