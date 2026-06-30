import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, Plus, XCircle, Users, TrendingUp, Send, MessageSquare, Camera,
  Star, Search, Edit3, Trash2, CheckCircle, Pause, Play, Archive, Eye,
  BarChart3, Target, DollarSign, Calendar, Filter, RefreshCw, Mail, Smartphone
} from 'lucide-react';
import { getCurrentUser } from '../lib/supabase';
import {
  fetchCampaigns, insertCampaign, updateCampaign, deleteCampaign
} from '../services/supabaseService';

// ─── Constants ─────────────────────────────────────────────────

const CANAIS = ['WhatsApp', 'Instagram', 'Email', 'SMS'];
const STATUS_LIST = ['rascunho', 'ativo', 'pausado', 'concluido'];

const CANAL_ICON = {
  WhatsApp: MessageSquare,
  Instagram: Camera,
  Email: Mail,
  SMS: Smartphone,
};

const CANAL_COLOR = {
  WhatsApp: '#25D366',
  Instagram: '#E1306C',
  Email: '#7A95B8',
  SMS: '#D4956A',
};

const STATUS_CONFIG = {
  rascunho:  { label: 'Rascunho',  badge: 'badge-neutral',  icon: Edit3,   color: '#8C7573' },
  ativo:     { label: 'Ativo',     badge: 'badge-success',  icon: Play,    color: '#6B9B7A' },
  pausado:   { label: 'Pausado',   badge: 'badge-warning',  icon: Pause,   color: '#D4956A' },
  concluido: { label: 'Concluído', badge: 'badge-info',     icon: Archive, color: '#7A95B8' },
};

// ─── Campaign Modal (Create / Edit) ────────────────────────────

function CampanhaModal({ onClose, onSave, campanha }) {
  const isEdit = !!campanha;
  const [form, setForm] = useState({
    nome: campanha?.nome || '',
    canal: campanha?.canal || 'WhatsApp',
    mensagem: campanha?.mensagem || '',
    status: campanha?.status || 'rascunho',
    data_inicio: campanha?.data_inicio || '',
    data_fim: campanha?.data_fim || '',
    publico_alvo: campanha?.publico_alvo || '',
    orcamento: campanha?.orcamento || 0,
    enviados: campanha?.enviados || 0,
    abertos: campanha?.abertos || 0,
    cliques: campanha?.cliques || 0,
    conversoes: campanha?.conversoes || 0,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Editar Campanha' : 'Nova Campanha'}</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-grid-2">
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Nome da Campanha</label>
            <input className="form-input" placeholder="Ex: Promoção de Verão" value={form.nome} onChange={e => set('nome', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Canal</label>
            <select className="form-select" value={form.canal} onChange={e => set('canal', e.target.value)}>
              {CANAIS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUS_LIST.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Data Início</label>
            <input className="form-input" placeholder="dd/mm/aaaa" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Data Fim</label>
            <input className="form-input" placeholder="dd/mm/aaaa" value={form.data_fim} onChange={e => set('data_fim', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Público-Alvo</label>
            <input className="form-input" placeholder="Ex: Clientes sem visita há 60 dias" value={form.publico_alvo} onChange={e => set('publico_alvo', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Orçamento (R$)</label>
            <input className="form-input" type="number" placeholder="0" value={form.orcamento} onChange={e => set('orcamento', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Mensagem / Conteúdo</label>
            <textarea className="form-textarea" style={{ minHeight: 90 }} placeholder="Digite o conteúdo da campanha..." value={form.mensagem} onChange={e => set('mensagem', e.target.value)} />
          </div>
        </div>

        {isEdit && (
          <>
            <div className="divider" />
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 10 }}>Métricas</div>
            <div className="form-grid-2">
              {[
                { k: 'enviados', label: 'Enviados' },
                { k: 'abertos', label: 'Abertos' },
                { k: 'cliques', label: 'Cliques' },
                { k: 'conversoes', label: 'Conversões' },
              ].map(({ k, label }) => (
                <div className="form-group" key={k}>
                  <label className="form-label">{label}</label>
                  <input className="form-input" type="number" value={form[k]} onChange={e => set(k, parseInt(e.target.value) || 0)} />
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <CheckCircle />}
            {isEdit ? 'Salvar' : 'Criar Campanha'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ──────────────────────────────────────

function DeleteConfirmModal({ onClose, onConfirm, nome }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <span className="modal-title" style={{ color: '#DC2626' }}>Excluir Campanha</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.6, margin: '8px 0 16px' }}>
          Tem certeza que deseja excluir <strong>{nome}</strong>? Esta ação não pode ser desfeita.
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

// ─── Campaign Detail Drawer ────────────────────────────────────

function CampanhaDetail({ campanha, onClose, onEdit }) {
  if (!campanha) return null;
  const Icon = CANAL_ICON[campanha.canal] || Send;
  const cor = CANAL_COLOR[campanha.canal] || '#7A95B8';
  const st = STATUS_CONFIG[campanha.status] || STATUS_CONFIG.rascunho;
  const taxaAbertura = campanha.enviados > 0 ? Math.round((campanha.abertos / campanha.enviados) * 100) : (campanha.abertos > 0 ? 100 : 0);
  const taxClique = campanha.abertos > 0 ? Math.round((campanha.cliques / campanha.abertos) * 100) : 0;
  const taxConversao = campanha.cliques > 0 ? Math.round((campanha.conversoes / campanha.cliques) * 100) : 0;
  const custoConversao = campanha.conversoes > 0 && campanha.orcamento > 0 ? Math.round(campanha.orcamento / campanha.conversoes) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${cor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon style={{ width: 18, height: 18, color: cor }} />
            </div>
            <div>
              <span className="modal-title">{campanha.nome}</span>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <span className={`badge ${st.badge}`}>{st.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{campanha.canal}</span>
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>

        {campanha.mensagem && (
          <div style={{ background: 'var(--bg-main)', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.6, borderLeft: `3px solid ${cor}` }}>
            {campanha.mensagem}
          </div>
        )}

        <div className="grid-4" style={{ marginBottom: 16 }}>
          {[
            { label: 'Enviados', val: campanha.enviados || campanha.abertos, cor: 'var(--text-dark)', icon: Send },
            { label: 'Abertos', val: campanha.abertos, cor: 'var(--info)', icon: Eye },
            { label: 'Cliques', val: campanha.cliques, cor: 'var(--warning)', icon: Target },
            { label: 'Conversões', val: campanha.conversoes, cor: 'var(--success)', icon: Users },
          ].map(({ label, val, cor: c, icon: I }) => (
            <div key={label} style={{ textAlign: 'center', padding: 12, background: 'var(--bg-main)', borderRadius: 10 }}>
              <I style={{ width: 16, height: 16, color: c, marginBottom: 4 }} />
              <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{val}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ marginBottom: 16 }}>
          {[
            { label: 'Taxa de Abertura', val: `${taxaAbertura}%` },
            { label: 'Taxa de Cliques', val: `${taxClique}%` },
            { label: 'Taxa de Conversão', val: `${taxConversao}%` },
            { label: 'Custo/Conversão', val: custoConversao > 0 ? `R$ ${custoConversao}` : '—' },
          ].map(({ label, val }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontWeight: 700 }}>{val}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-light)', marginBottom: 16 }}>
          {campanha.publico_alvo && <div><strong>Público:</strong> {campanha.publico_alvo}</div>}
          {campanha.orcamento > 0 && <div><strong>Orçamento:</strong> R$ {campanha.orcamento.toLocaleString('pt-BR')}</div>}
          {campanha.data_inicio && <div><strong>Período:</strong> {campanha.data_inicio} → {campanha.data_fim || '—'}</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
          <button className="btn btn-primary" onClick={() => { onClose(); onEdit(campanha); }}><Edit3 />Editar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────

export default function Marketing() {
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);        // null | 'new' | campaign obj
  const [deleteId, setDeleteId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroCanal, setFiltroCanal] = useState('Todos');

  // ── Load data ──
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await fetchCampaigns();
    setCampanhas(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── CRUD ──
  const handleSave = async (form) => {
    const isEdit = modal && modal !== 'new';
    const user = await getCurrentUser();
    if (isEdit) {
      const { data } = await updateCampaign(modal.id, form);
      if (data) setCampanhas(prev => prev.map(c => c.id === modal.id ? data : c));
    } else {
      const payload = { ...form, id: `camp_${Date.now()}`, user_id: user?.id };
      const { data } = await insertCampaign(payload);
      if (data) setCampanhas(prev => [data, ...prev]);
    }
  };

  const handleDelete = async (id) => {
    await deleteCampaign(id);
    setCampanhas(prev => prev.filter(c => c.id !== id));
  };

  const handleStatusChange = async (campanha, newStatus) => {
    const { data } = await updateCampaign(campanha.id, { status: newStatus });
    if (data) setCampanhas(prev => prev.map(c => c.id === campanha.id ? data : c));
  };

  // ── Filtering ──
  const filtradas = campanhas.filter(c =>
    (filtroStatus === 'Todos' || c.status === filtroStatus) &&
    (filtroCanal === 'Todos' || c.canal === filtroCanal) &&
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  // ── Stats ──
  const ativas = campanhas.filter(c => c.status === 'ativo');
  const totalEnviados = campanhas.reduce((a, c) => a + (c.enviados || 0), 0);
  const totalAbertos = campanhas.reduce((a, c) => a + (c.abertos || 0), 0);
  const totalCliques = campanhas.reduce((a, c) => a + (c.cliques || 0), 0);
  const totalConversoes = campanhas.reduce((a, c) => a + (c.conversoes || 0), 0);
  const totalOrcamento = campanhas.reduce((a, c) => a + (c.orcamento || 0), 0);
  const taxaConversao = totalEnviados > 0 ? Math.round((totalConversoes / totalEnviados) * 100) : (totalAbertos > 0 ? Math.round((totalConversoes / totalAbertos) * 100) : 0);

  const detailCampanha = detailId ? campanhas.find(c => c.id === detailId) : null;
  const deleteCampanha = deleteId ? campanhas.find(c => c.id === deleteId) : null;

  // ── Channel stats ──
  const channelStats = CANAIS.map(canal => {
    const items = campanhas.filter(c => c.canal === canal);
    return {
      canal,
      total: items.length,
      enviados: items.reduce((a, c) => a + (c.enviados || 0), 0),
      conversoes: items.reduce((a, c) => a + (c.conversoes || 0), 0),
      ativas: items.filter(c => c.status === 'ativo').length,
    };
  }).filter(s => s.total > 0);

  return (
    <div>
      {/* Modals */}
      {modal && (
        <CampanhaModal
          campanha={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {deleteId && deleteCampanha && (
        <DeleteConfirmModal
          nome={deleteCampanha.nome}
          onClose={() => setDeleteId(null)}
          onConfirm={() => handleDelete(deleteId)}
        />
      )}
      {detailId && detailCampanha && (
        <CampanhaDetail
          campanha={detailCampanha}
          onClose={() => setDetailId(null)}
          onEdit={(c) => setModal(c)}
        />
      )}

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-header-label"><Megaphone />MARKETING</div>
          <h1 className="page-title">Marketing</h1>
          <p className="page-subtitle">{campanhas.length} campanhas · {ativas.length} ativas</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={load}><RefreshCw style={{ width: 14, height: 14 }} />Atualizar</button>
          <button className="btn btn-primary" onClick={() => setModal('new')}><Plus />Nova Campanha</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4 section-gap">
        {[
          { label: 'Campanhas Ativas', val: ativas.length, cor: 'var(--color-primary)', icon: Megaphone },
          { label: 'Mensagens Enviadas', val: totalEnviados.toLocaleString('pt-BR'), cor: 'var(--info)', icon: Send },
          { label: 'Conversões', val: totalConversoes, cor: 'var(--success)', icon: Users },
          { label: 'Taxa de Conversão', val: `${taxaConversao}%`, cor: 'var(--warning)', icon: TrendingUp },
        ].map(({ label, val, cor, icon: Icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-icon" style={{ background: `${cor}18` }}><Icon style={{ color: cor }} /></div>
            <div className="stat-value" style={{ color: cor }}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Channel Cards */}
      {channelStats.length > 0 && (
        <div className={`grid-${Math.min(channelStats.length, 4)} section-gap`} style={{ gridTemplateColumns: `repeat(${Math.min(channelStats.length, 4)}, 1fr)` }}>
          {channelStats.map(({ canal, total, enviados, conversoes, ativas: at }) => {
            const Icon = CANAL_ICON[canal] || Send;
            const cor = CANAL_COLOR[canal] || '#7A95B8';
            return (
              <div key={canal} className="card" style={{ borderTop: `3px solid ${cor}`, cursor: 'pointer' }} onClick={() => setFiltroCanal(canal === filtroCanal ? 'Todos' : canal)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${cor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon style={{ width: 18, height: 18, color: cor }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{canal}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{total} campanha{total !== 1 ? 's' : ''} · {at} ativa{at !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enviados</div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{enviados.toLocaleString('pt-BR')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Conversões</div>
                  <span style={{ fontWeight: 700, color: cor, fontSize: 16 }}>{conversoes}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="tabs">
            {['Todos', ...STATUS_LIST].map(s => (
              <button key={s} className={`tab-item${filtroStatus === s ? ' active' : ''}`} onClick={() => setFiltroStatus(s)}>
                {s === 'Todos' ? 'Todos' : STATUS_CONFIG[s]?.label}
              </button>
            ))}
          </div>
          {filtroCanal !== 'Todos' && (
            <span className="badge badge-info" style={{ cursor: 'pointer' }} onClick={() => setFiltroCanal('Todos')}>
              {filtroCanal} <XCircle style={{ width: 11, height: 11 }} />
            </span>
          )}
        </div>
        <div className="search-box">
          <Search />
          <input className="search-input" placeholder="Buscar campanha..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Star style={{ width: 14, height: 14, color: 'var(--color-primary)' }} />
            Campanhas {filtradas.length !== campanhas.length && `(${filtradas.length} de ${campanhas.length})`}
          </span>
          {totalOrcamento > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <DollarSign style={{ width: 13, height: 13 }} />Orçamento total: <strong style={{ color: 'var(--text-dark)' }}>R$ {totalOrcamento.toLocaleString('pt-BR')}</strong>
            </span>
          )}
        </div>

        {loading ? (
          <div className="empty-state">
            <RefreshCw style={{ animation: 'spin 1s linear infinite' }} />
            <p>Carregando campanhas...</p>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="empty-state">
            <Megaphone />
            <p>{campanhas.length === 0 ? 'Nenhuma campanha criada ainda. Clique em "Nova Campanha" para começar.' : 'Nenhuma campanha encontrada com os filtros atuais.'}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Canal</th>
                  <th>Período</th>
                  <th style={{ textAlign: 'center' }}>Enviados</th>
                  <th style={{ textAlign: 'center' }}>Abertos</th>
                  <th style={{ textAlign: 'center' }}>Cliques</th>
                  <th style={{ textAlign: 'center' }}>Conv.</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(c => {
                  const ChanIcon = CANAL_ICON[c.canal] || Send;
                  const cor = CANAL_COLOR[c.canal] || '#7A95B8';
                  const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.rascunho;
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(c.id)}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nome}</div>
                        {c.publico_alvo && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.publico_alvo}</div>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <ChanIcon style={{ width: 13, height: 13, color: cor }} />
                          <span style={{ fontSize: 12 }}>{c.canal}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-light)' }}>
                        {c.data_inicio || '—'}
                        {c.data_fim && <span> → {c.data_fim}</span>}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.enviados || c.abertos || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--info)' }}>{c.abertos || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--warning)' }}>{c.cliques || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--success)' }}>{c.conversoes || '—'}</td>
                      <td>
                        <span className={`badge ${st.badge}`} style={{ cursor: 'pointer' }} onClick={e => {
                          e.stopPropagation();
                          const next = c.status === 'ativo' ? 'pausado' : c.status === 'pausado' ? 'ativo' : c.status === 'rascunho' ? 'ativo' : 'ativo';
                          handleStatusChange(c, next);
                        }} title="Clique para alternar status">
                          {st.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setDetailId(c.id)} title="Ver detalhes">
                            <Eye style={{ width: 13, height: 13 }} />
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setModal(c)} title="Editar">
                            <Edit3 style={{ width: 13, height: 13 }} />
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: '#DC2626' }} onClick={() => setDeleteId(c.id)} title="Excluir">
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        </div>
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
