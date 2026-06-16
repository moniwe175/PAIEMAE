import { useState, useMemo } from 'react';
import {
  Coins, Plus, XCircle, CheckCircle, User, DollarSign, Search,
  FileSpreadsheet, TrendingUp, Clock, Filter, AlertTriangle, Percent,
  Edit3, Trash2, ChevronDown, Calendar, CalendarDays, CalendarRange
} from 'lucide-react';
import { useSync } from '../contexts/SyncContext';

// ─── Helpers ───────────────────────────────────────────────────

function fmtCurrency(v) {
  return v === undefined || v === null || isNaN(v)
    ? 'R$ --'
    : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hoje() { return new Date().toLocaleDateString('pt-BR'); }

// Parse DD/MM/YYYY or YYYY-MM-DD to Date
function parseDate(str) {
  if (!str) return null;
  if (str.includes('/')) {
    const [d, m, y] = str.split('/');
    return new Date(+y, +m - 1, +d);
  }
  if (str.includes('-')) {
    const [y, m, d] = str.split('-');
    return new Date(+y, +m - 1, +d);
  }
  return null;
}

// Check if a date falls inside a period relative to today
function inPeriod(date, period) {
  if (period === 'todos') return true;
  const d = parseDate(date);
  if (!d) return false;
  const now = new Date();
  const months = { mes: 1, trimestre: 3, semestre: 6, anual: 12 }[period] || 0;
  if (months === 0) return true;
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1);
  return d >= cutoff && d <= now;
}

const PERIOD_OPTIONS = [
  { k: 'todos', l: 'Todos', icon: Calendar },
  { k: 'mes', l: 'Mês', icon: CalendarDays },
  { k: 'trimestre', l: 'Trimestre', icon: CalendarRange },
  { k: 'semestre', l: 'Semestre', icon: CalendarRange },
  { k: 'anual', l: 'Anual', icon: Calendar },
];

// ─── Delete Confirm Modal ──────────────────────────────────────

function DeleteConfirmModal({ onClose, onConfirm, nome }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <span className="modal-title" style={{ color: '#DC2626' }}>Excluir Comissão</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.6, margin: '8px 0 16px' }}>
          Tem certeza que deseja excluir a comissão de <strong>{nome}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" style={{ background: '#DC2626', color: '#fff' }} onClick={() => { onConfirm(); onClose(); }}>
            <Trash2 style={{ width: 14, height: 14 }} />Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Commission Modal ─────────────────────────────────────

function ComissaoModal({ onClose, onSave, profissionais, sheetServicosByProf, splitConfig }) {
  const [form, setForm] = useState({
    prof: '',
    servico: '',
    paciente: '',
    valorServ: '',
    pct: '',
    valorComissao: '',
    data: hoje(),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleProfChange = (profNome) => {
    set('prof', profNome);
    // Auto-fill from sheet data if available
    const sheetRows = sheetServicosByProf[profNome];
    if (sheetRows && sheetRows.length > 0) {
      const row = sheetRows[0];
      set('servico', row.servico || '');
      set('paciente', row.paciente || '');
      set('valorServ', row.valorServ || '');
      const split = splitConfig.find(s => s.profissional === profNome);
      set('pct', split?.percentual || row.pct || '');
      const valor = parseFloat(row.valorServ) || 0;
      const pct = split?.percentual || parseFloat(row.pct) || 0;
      set('valorComissao', (valor * pct / 100).toFixed(2));
    } else {
      // Auto-fill pct from splitConfig
      const split = splitConfig.find(s => s.profissional === profNome);
      if (split) set('pct', split.percentual);
    }
  };

  const handleServicoChange = (servico) => {
    set('servico', servico);
    // Find matching sheet row for this professional + service
    const sheetRows = sheetServicosByProf[form.prof] || [];
    const match = sheetRows.find(r => r.servico === servico);
    if (match) {
      set('paciente', match.paciente || form.paciente);
      set('valorServ', match.valorServ || form.valorServ);
      const valor = parseFloat(match.valorServ) || 0;
      const pct = parseFloat(form.pct) || 0;
      set('valorComissao', (valor * pct / 100).toFixed(2));
    }
  };

  const handleValorChange = (val) => {
    set('valorServ', val);
    const pct = parseFloat(form.pct) || 0;
    set('valorComissao', ((parseFloat(val) || 0) * pct / 100).toFixed(2));
  };

  const handlePctChange = (val) => {
    set('pct', val);
    const valor = parseFloat(form.valorServ) || 0;
    set('valorComissao', (valor * (parseFloat(val) || 0) / 100).toFixed(2));
  };

  const handleSubmit = () => {
    if (!form.prof.trim()) { alert('Selecione um profissional.'); return; }
    const valorServ = parseFloat(form.valorServ) || 0;
    const pct = parseFloat(form.pct) || 0;
    onSave({
      prof: form.prof.trim(),
      servico: form.servico.trim() || '—',
      paciente: form.paciente.trim() || '—',
      data: form.data,
      valorServ,
      pct,
      valorComissao: parseFloat(form.valorComissao) || (valorServ * pct / 100),
      status: 'pendente',
      origem: 'manual',
    });
    onClose();
  };

  const servicosDisponiveis = useMemo(() => {
    const prof = profissionais.find(p => p.nome === form.prof);
    const sheetServs = (sheetServicosByProf[form.prof] || []).map(r => r.servico).filter(Boolean);
    const profServs = prof?.servicos || [];
    return [...new Set([...profServs, ...sheetServs])];
  }, [form.prof, profissionais, sheetServicosByProf]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <span className="modal-title"><Coins />Nova Comissão</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-grid-2">
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Profissional</label>
            <select className="form-select" value={form.prof} onChange={e => handleProfChange(e.target.value)}>
              <option value="">Selecione...</option>
              {profissionais.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Serviço</label>
            {servicosDisponiveis.length > 0 ? (
              <select className="form-select" value={form.servico} onChange={e => handleServicoChange(e.target.value)}>
                <option value="">Selecione...</option>
                {servicosDisponiveis.map(s => <option key={s}>{s}</option>)}
              </select>
            ) : (
              <input className="form-input" placeholder="Nome do serviço" value={form.servico} onChange={e => set('servico', e.target.value)} />
            )}
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Paciente</label>
            <input className="form-input" placeholder="Nome do paciente" value={form.paciente} onChange={e => set('paciente', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Valor do Serviço (R$)</label>
            <input className="form-input" type="number" placeholder="0,00" value={form.valorServ} onChange={e => handleValorChange(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Comissão (%)</label>
            <input className="form-input" type="number" placeholder="30" value={form.pct} onChange={e => handlePctChange(e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Valor da Comissão (R$)</label>
            <input className="form-input" type="number" value={form.valorComissao} onChange={e => set('valorComissao', e.target.value)}
              style={{ background: 'var(--success-bg)', fontWeight: 700, color: 'var(--success)' }} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Data</label>
            <input className="form-input" value={form.data} onChange={e => set('data', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit}><CheckCircle />Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function Comissoes() {
  const {
    comissoes, addComissao, removeComissao, updateComissaoStatus,
    splitConfig, supabaseConnected, connectionError, dailySheet,
  } = useSync();

  const [modal, setModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroProf, setFiltroProf] = useState('Todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos');

  // ─── Derive sheet-based commissions ──────────────────────────
  const sheetComissoes = useMemo(() => {
    if (!dailySheet?.rows) return [];
    return dailySheet.rows
      .filter(r => (r.repasse || 0) > 0)
      .map((r, idx) => ({
        id: `sheet_com_${idx}_${r.profNome}`,
        prof: r.profNome || '—',
        servico: r.profissional || '—',
        paciente: r.cliente || '—',
        data: dailySheet.dataCaixa || hoje(),
        valorServ: (r.credito || 0) + (r.debito || 0) + (r.dinheiro || 0) + (r.pix || 0),
        pct: splitConfig.find(s => s.profissional === r.profNome)?.percentual || 30,
        valorComissao: r.repasse || 0,
        status: 'pendente',
        origem: 'planilha',
      }));
  }, [dailySheet, splitConfig]);

  // ─── Merge sheet + manual commissions ────────────────────────
  const allComissoes = useMemo(() => {
    const manualIds = new Set(comissoes.map(c => c.id));
    const uniqueSheet = sheetComissoes.filter(sc => !manualIds.has(sc.id));
    return [...comissoes, ...uniqueSheet];
  }, [comissoes, sheetComissoes]);

  // ─── Professionals from profissionais.js + sheet ────────────
  const profissionais = useMemo(() => {
    try {
      const raw = localStorage.getItem('erp_profissionais');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }, []);

  // ─── Sheet services grouped by professional ──────────────────
  const sheetServicosByProf = useMemo(() => {
    if (!dailySheet?.rows) return {};
    const map = {};
    dailySheet.rows.forEach(r => {
      if (!r.profNome) return;
      if (!map[r.profNome]) map[r.profNome] = [];
      const valorServ = (r.credito || 0) + (r.debito || 0) + (r.dinheiro || 0) + (r.pix || 0);
      map[r.profNome].push({
        servico: r.profissional || '',
        paciente: r.cliente || '',
        valorServ: valorServ.toFixed(2),
        pct: splitConfig.find(s => s.profissional === r.profNome)?.percentual || 30,
      });
    });
    return map;
  }, [dailySheet, splitConfig]);

  // ─── Unique professionals for filter ─────────────────────────
  const profsNomes = useMemo(() => {
    return [...new Set(allComissoes.map(c => c.prof).filter(Boolean))];
  }, [allComissoes]);

  // ─── Filtering ───────────────────────────────────────────────
  const filtradas = useMemo(() => {
    return allComissoes.filter(c =>
      (filtroStatus === 'todos' || c.status === filtroStatus) &&
      (filtroProf === 'Todos' || c.prof === filtroProf) &&
      inPeriod(c.data, filtroPeriodo) &&
      (c.prof?.toLowerCase().includes(busca.toLowerCase()) ||
       c.servico?.toLowerCase().includes(busca.toLowerCase()) ||
       c.paciente?.toLowerCase().includes(busca.toLowerCase()))
    );
  }, [allComissoes, filtroStatus, filtroProf, filtroPeriodo, busca]);

  // ─── Stats (filtered by period) ──────────────────────────────
  const comissoesPeriodo = useMemo(() =>
    allComissoes.filter(c => inPeriod(c.data, filtroPeriodo)),
    [allComissoes, filtroPeriodo]
  );
  const totalPendente = comissoesPeriodo.filter(c => c.status === 'pendente').reduce((a, c) => a + (c.valorComissao || 0), 0);
  const totalPago = comissoesPeriodo.filter(c => c.status === 'pago').reduce((a, c) => a + (c.valorComissao || 0), 0);
  const totalComissoes = comissoesPeriodo.reduce((a, c) => a + (c.valorComissao || 0), 0);
  const pendentesCount = comissoesPeriodo.filter(c => c.status === 'pendente').length;

  // Period label for KPI subtitle
  const periodoLabel = { todos: 'Todo o período', mes: 'Último mês', trimestre: 'Último trimestre', semestre: 'Último semestre', anual: 'Último ano' }[filtroPeriodo] || '';

  const handleSave = (form) => {
    addComissao({ ...form, id: `com_${Date.now()}` });
  };

  const handleDelete = (id) => {
    removeComissao(id);
    setDeleteId(null);
  };

  const handleToggleStatus = (c) => {
    if (c.origem === 'planilha') return; // Can't toggle sheet-derived
    const next = c.status === 'pendente' ? 'pago' : 'pendente';
    updateComissaoStatus(c.id, next);
  };

  return (
    <div>
      {modal && (
        <ComissaoModal
          onClose={() => setModal(false)}
          onSave={handleSave}
          profissionais={profissionais}
          sheetServicosByProf={sheetServicosByProf}
          splitConfig={splitConfig}
        />
      )}
      {deleteId && (
        <DeleteConfirmModal
          nome={allComissoes.find(c => c.id === deleteId)?.prof || ''}
          onClose={() => setDeleteId(null)}
          onConfirm={() => handleDelete(deleteId)}
        />
      )}

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-header-label"><Coins />COMISSÕES</div>
          <h1 className="page-title">Comissões</h1>
          <p className="page-subtitle">{allComissoes.length} comissões · {pendentesCount} pendentes</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus />Nova Comissão</button>
      </div>

      {/* Supabase warning */}
      {!supabaseConnected && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderLeft: '4px solid #EF4444',
          borderRadius: 'var(--radius-sm)', padding: '14px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <AlertTriangle style={{ width: 18, height: 18, color: '#DC2626', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#991B1B', marginBottom: 2 }}>Modo somente leitura</div>
            <p style={{ fontSize: 12, color: '#7F1D1D', margin: 0 }}>{connectionError || 'Supabase desconectado.'}</p>
          </div>
        </div>
      )}

      {/* Period Filter */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Calendar style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Período</span>
        </div>
        <div className="tabs">
          {PERIOD_OPTIONS.map(({ k, l, icon: Icon }) => (
            <button key={k} className={`tab-item${filtroPeriodo === k ? ' active' : ''}`} onClick={() => setFiltroPeriodo(k)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon style={{ width: 12, height: 12 }} />{l}</span>
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4 section-gap">
        {[
          { label: 'Total Comissões', sub: periodoLabel, val: fmtCurrency(totalComissoes), cor: 'var(--color-primary)', icon: Coins },
          { label: 'Pendentes', sub: `${pendentesCount} comissões`, val: fmtCurrency(totalPendente), cor: 'var(--warning)', icon: Clock },
          { label: 'Pagas', sub: periodoLabel, val: fmtCurrency(totalPago), cor: 'var(--success)', icon: CheckCircle },
          { label: 'Qtd Pendentes', sub: periodoLabel, val: pendentesCount, cor: 'var(--info)', icon: TrendingUp },
        ].map(({ label, val, sub, cor, icon: Icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-icon" style={{ background: `${cor}18` }}><Icon style={{ color: cor }} /></div>
            <div className="stat-value" style={{ color: cor }}>{val}</div>
            <div className="stat-label">{label}</div>
            {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="tabs">
            {[{ k: 'todos', l: 'Todos' }, { k: 'pendente', l: 'Pendentes' }, { k: 'pago', l: 'Pagas' }].map(({ k, l }) => (
              <button key={k} className={`tab-item${filtroStatus === k ? ' active' : ''}`} onClick={() => setFiltroStatus(k)}>{l}</button>
            ))}
          </div>
          <select className="form-select" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
            value={filtroProf} onChange={e => setFiltroProf(e.target.value)}>
            <option value="Todos">Todos os profissionais</option>
            {profsNomes.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="search-box">
          <Search />
          <input className="search-input" placeholder="Buscar comissão..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Coins style={{ width: 14, height: 14, color: 'var(--color-primary)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>
            Comissões {filtradas.length !== allComissoes.length && `(${filtradas.length} de ${allComissoes.length})`}
          </span>
        </div>
        {filtradas.length === 0 ? (
          <div className="empty-state">
            <Coins />
            <p>{allComissoes.length === 0
              ? 'Nenhuma comissão registrada. Conecte a planilha ou crie manualmente.'
              : 'Nenhuma comissão encontrada com os filtros atuais.'}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Profissional</th>
                  <th>Serviço</th>
                  <th>Paciente</th>
                  <th>Data</th>
                  <th style={{ textAlign: 'right' }}>Valor Serviço</th>
                  <th style={{ textAlign: 'center' }}>%</th>
                  <th style={{ textAlign: 'right' }}>Comissão</th>
                  <th>Status</th>
                  <th>Origem</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {filtradas.map(c => {
                  const isSheet = c.origem === 'planilha';
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: '50%',
                            background: profissionais.find(p => p.nome === c.prof)?.cor || 'var(--color-primary)',
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, flexShrink: 0,
                          }}>
                            {(c.prof || '?').charAt(0)}
                          </div>
                          {c.prof}
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-medium)' }}>{c.servico || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-light)' }}>{c.paciente || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-light)' }}>{c.data || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>{fmtCurrency(c.valorServ)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-neutral" style={{ fontSize: 10 }}>{c.pct}%</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--success)' }}>
                        {fmtCurrency(c.valorComissao)}
                      </td>
                      <td>
                        <span
                          className={`badge ${c.status === 'pago' ? 'badge-success' : 'badge-warning'}`}
                          style={{ cursor: isSheet ? 'default' : 'pointer' }}
                          onClick={() => handleToggleStatus(c)}
                          title={isSheet ? 'Comissão da planilha' : 'Clique para alternar'}
                        >
                          {c.status === 'pago' ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td>
                        <span className={`origem-badge ${isSheet ? 'origem-planilha' : 'origem-manual'}`} style={{ fontSize: 10 }}>
                          {isSheet ? <><FileSpreadsheet style={{ width: 10, height: 10 }} />Planilha</> : 'Manual'}
                        </span>
                      </td>
                      <td>
                        <button
                          style={{
                            background: 'var(--danger-bg)', border: 'none', cursor: 'pointer',
                            color: '#DC2626', padding: '5px 8px', borderRadius: 6,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.15s',
                          }}
                          onClick={() => setDeleteId(c.id)}
                          title="Excluir comissão"
                          onMouseEnter={e => e.currentTarget.style.background = '#f8dde0'}
                          onMouseLeave={e => e.currentTarget.style.background = 'var(--danger-bg)'}
                        >
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
