import { useState } from 'react';
import { Award, Plus, XCircle, DollarSign, Percent, Calendar, FileSpreadsheet } from 'lucide-react';
import { useSync } from '../contexts/SyncContext';
import SheetSyncStatus from '../components/integration/SheetSyncStatus';

const profissionais = [
  { id:1, nome:'Evelyn Costa', cargo:'Médica Esteta', avatar:'E', cor:'var(--color-primary)' },
  { id:2, nome:'Juliana Ramos', cargo:'Enfermeira', avatar:'J', cor:'var(--info)' },
  { id:3, nome:'Carla Souza', cargo:'Esteticista', avatar:'C', cor:'var(--success)' },
];

export default function Comissoes() {
  const { comissoes, addComissao, updateComissaoStatus } = useSync();
  const [filtro, setFiltro] = useState('todos');
  const [profFiltro, setProfFiltro] = useState('Todos');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ prof: '', servico: '', paciente: '', valorServ: '', pct: '', data: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const filtradas = comissoes.filter(c =>
    (filtro === 'todos' || c.status === filtro) &&
    (profFiltro === 'Todos' || c.prof === profFiltro)
  );

  const totalPago = comissoes.filter(c => c.status === 'pago').reduce((a, c) => a + c.valorComissao, 0);
  const totalPendente = comissoes.filter(c => c.status === 'pendente').reduce((a, c) => a + c.valorComissao, 0);

  // Unique professionals from commissions
  const allProfs = [...new Set(comissoes.map(c => c.prof))];

  const handleSaveComissao = () => {
    if (!form.prof || !form.servico || !form.valorServ) {
      alert('Preencha profissional, serviço e valor.');
      return;
    }
    const valorServ = parseFloat(form.valorServ) || 0;
    const pct = parseFloat(form.pct) || 30;
    addComissao({
      prof: form.prof,
      servico: form.servico,
      paciente: form.paciente,
      data: form.data || new Date().toLocaleDateString('pt-BR'),
      valorServ,
      pct,
      valorComissao: Math.round(valorServ * (pct / 100) * 100) / 100,
      status: 'pendente',
      origem: 'manual',
    });
    setForm({ prof: '', servico: '', paciente: '', valorServ: '', pct: '', data: '' });
    setModal(false);
  };

  // Count synced commissions
  const syncedCount = comissoes.filter(c => c.origem === 'planilha').length;

  return (
    <div>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Lançar Comissão</span>
              <button className="modal-close" onClick={() => setModal(false)}><XCircle /></button>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Profissional</label>
                <select className="form-select" value={form.prof} onChange={e => set('prof', e.target.value)}>
                  <option value="">Selecione...</option>
                  {profissionais.map(p => <option key={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Serviço</label>
                <input className="form-input" placeholder="Nome do serviço" value={form.servico} onChange={e => set('servico', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Paciente</label>
                <input className="form-input" placeholder="Nome do paciente" value={form.paciente} onChange={e => set('paciente', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Data</label>
                <input className="form-input" type="date" value={form.data} onChange={e => set('data', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor do Serviço (R$)</label>
                <input className="form-input" type="number" placeholder="0,00" value={form.valorServ} onChange={e => set('valorServ', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Comissão (%)</label>
                <input className="form-input" type="number" placeholder="30" value={form.pct} onChange={e => set('pct', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveComissao}><DollarSign style={{ width: 14, height: 14 }} />Salvar</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-header-label"><Award />COMISSÕES</div>
          <h1 className="page-title">Comissões</h1>
          <p className="page-subtitle">Controle de comissões por profissional</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SheetSyncStatus compact />
          <button className="btn btn-primary" onClick={() => setModal(true)}><Plus />Lançar Comissão</button>
        </div>
      </div>

      <div className="grid-3 section-gap">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--success-bg)' }}>
            <DollarSign style={{ color: 'var(--success)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>R$ {totalPago.toLocaleString('pt-BR')}</div>
          <div className="stat-label">Total Pago</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--warning-bg)' }}>
            <DollarSign style={{ color: 'var(--warning)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>R$ {totalPendente.toLocaleString('pt-BR')}</div>
          <div className="stat-label">A Pagar</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--info-bg)' }}>
            <Award style={{ color: 'var(--info)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--info)' }}>{comissoes.length}</div>
          <div className="stat-label">
            Lançamentos no Mês
            {syncedCount > 0 && <span style={{ fontWeight: 400, fontSize: 11, display: 'block', color: 'var(--text-muted)' }}>{syncedCount} da planilha</span>}
          </div>
        </div>
      </div>

      {/* Por profissional */}
      <div className="grid-3 section-gap">
        {allProfs.map((profName, idx) => {
          const profInfo = profissionais.find(p => p.nome === profName) || { cargo: '', avatar: profName.charAt(0), cor: 'var(--color-primary)', id: idx };
          const total = comissoes.filter(c => c.prof === profName).reduce((a, c) => a + c.valorComissao, 0);
          const pendente = comissoes.filter(c => c.prof === profName && c.status === 'pendente').reduce((a, c) => a + c.valorComissao, 0);
          const profCor = profInfo.cor || 'var(--color-primary)';
          return (
            <div key={profName} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div className="avatar avatar-lg" style={{ background: `linear-gradient(135deg, ${profCor}, ${profCor}88)` }}>{profInfo.avatar}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{profName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{profInfo.cargo}</div>
                </div>
              </div>
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Total do mês</span>
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>R$ {total.toLocaleString('pt-BR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>A receber</span>
                <span style={{ fontWeight: 700, color: 'var(--warning)' }}>R$ {pendente.toLocaleString('pt-BR')}</span>
              </div>
              {pendente > 0 && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}
                  onClick={() => {
                    comissoes
                      .filter(c => c.prof === profName && c.status === 'pendente')
                      .forEach(c => updateComissaoStatus(c.id, 'pago'));
                  }}
                >
                  <DollarSign style={{ width: 12, height: 12 }} />Pagar Comissão
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>Histórico de Comissões</span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select className="form-select" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} value={profFiltro} onChange={e => setProfFiltro(e.target.value)}>
              <option>Todos</option>
              {allProfs.map((p, i) => <option key={i}>{p}</option>)}
            </select>
            <div className="tabs">
              {[{ k: 'todos', l: 'Todos' }, { k: 'pago', l: 'Pagos' }, { k: 'pendente', l: 'Pendentes' }].map(({ k, l }) => (
                <button key={k} className={`tab-item${filtro === k ? ' active' : ''}`} onClick={() => setFiltro(k)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Profissional</th><th>Serviço</th><th>Paciente</th><th>Data</th>
              <th style={{ textAlign: 'right' }}>Valor Serv.</th>
              <th style={{ textAlign: 'center' }}>%</th>
              <th style={{ textAlign: 'right' }}>Comissão</th>
              <th>Origem</th>
              <th>Status</th>
            </tr></thead>
            <tbody>
              {filtradas.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{c.prof.charAt(0)}</div>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{c.prof}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{c.servico}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-light)' }}>{c.paciente}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-light)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar style={{ width: 11, height: 11 }} />{c.data}</div></td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>R$ {c.valorServ.toLocaleString('pt-BR')}</td>
                  <td style={{ textAlign: 'center' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 12 }}><Percent style={{ width: 11, height: 11, color: 'var(--text-muted)' }} />{c.pct}</div></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>R$ {c.valorComissao.toLocaleString('pt-BR')}</td>
                  <td>
                    <span className={`origem-badge ${c.origem === 'planilha' ? 'origem-planilha' : 'origem-manual'}`}>
                      {c.origem === 'planilha'
                        ? <><FileSpreadsheet style={{ width: 10, height: 10 }} />Planilha</>
                        : 'Manual'}
                    </span>
                  </td>
                  <td><span className={`badge ${c.status === 'pago' ? 'badge-success' : 'badge-warning'}`}>{c.status === 'pago' ? 'Pago' : 'Pendente'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
