/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Users, Plus, Search, XCircle, RefreshCw, Phone, Calendar,
  CheckCircle, Clock, AlertTriangle, MessageSquare,
  ChevronRight, Link2, Send, Star, ArrowRight, Flag, ClipboardList,
  Check, X, Inbox, Archive, UserPlus, Filter, Camera,
  BadgeDollarSign, Repeat2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchCrmLeads, insertCrmLead, updateCrmLead,
  fetchCrmInteractions, insertCrmInteraction,
  fetchClients, fetchAppointments,
} from '../services/supabaseService';
import {
  CRM_JOURNEY_STATUS,
  enrichCrmLeads,
  matchesCrmJourneyFilter,
  summarizeCrmRevenueFromAgenda,
} from '../lib/crmJourney';

// ─── Constants ────────────────────────────────────────────────

const STATUS_LIST = [
  { key: 'aguardando_resposta', label: 'Responder',         badge: 'badge-warning', color: '#D4956A', icon: Inbox },
  { key: 'aguardando_cliente',  label: 'Aguard. cliente',   badge: 'badge-info',    color: '#7A95B8', icon: Clock },
  { key: 'retorno_agendado',    label: 'Retorno marcado',   badge: 'badge-info',    color: '#5B7FA6', icon: Calendar },
  { key: 'agendado',            label: 'Agendado',          badge: 'badge-success', color: '#6B9B7A', icon: CheckCircle },
  { key: 'encerrado_ganho',     label: 'Venda pela Agenda', badge: 'badge-success', color: '#4A8A5A', icon: CheckCircle },
  { key: 'encerrado_perdido',   label: 'Perdido',           badge: 'badge-danger',  color: '#C0706A', icon: X },
];

const ORIGENS = [
  'Instagram', 'Indicação', 'Google', 'WhatsApp', 'Passou na rua', 'Outro',
];

const TIPO_INTERACAO = [
  { key: 'nota',    label: 'Nota interna' },
  { key: 'contato', label: 'Contato realizado' },
  { key: 'retorno', label: 'Retorno' },
];

const ABAS = [
  { key: 'fila',       label: 'Responder' },
  { key: 'agendados',  label: 'Agendados' },
  { key: 'atendidos',  label: 'Atendidos' },
  { key: 'perdidos',   label: 'Perdidos' },
];

const JOURNEY_FILTER_LABELS = {
  sem_agendamento: 'Interessadas sem agendamento',
  faltaram: 'Faltaram e precisam reagendar',
  em_risco: 'Clientes em risco ou inativas',
  agendadas: 'Com agendamento futuro',
  clientes: 'Clientes atendidas e recorrentes',
  pos_venda: 'Pós-atendimento dos últimos 7 dias',
};

// ─── Helpers ──────────────────────────────────────────────────

function statusConfig(key) {
  return STATUS_LIST.find(s => s.key === key) || STATUS_LIST[0];
}

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function fmtDatetime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  });
}

function fmtMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function JourneyBadge({ journey, compact = false }) {
  if (!journey) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: compact ? '3px 8px' : '5px 10px', borderRadius: 99,
      fontSize: compact ? 10 : 11, fontWeight: 800,
      color: journey.color, background: journey.background,
      border: `1px solid ${journey.color}33`, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: journey.color }} />
      {compact ? journey.shortLabel : journey.label}
    </span>
  );
}

function isOverdue(lead) {
  if (!lead.proxima_acao_prazo || lead.proxima_acao_concluida) return false;
  return lead.proxima_acao_prazo < todayStr();
}

function isDueToday(lead) {
  if (!lead.proxima_acao_prazo || lead.proxima_acao_concluida) return false;
  return lead.proxima_acao_prazo === todayStr();
}

function normPhone(tel) {
  if (!tel) return '';
  return tel.replace(/\D/g, '');
}

function fmtRelativeTime(ts) {
  if (!ts) return '—';
  const diffMs = Date.now() - new Date(ts).getTime();
  if (diffMs < 0) return 'agora mesmo';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'ontem';
  if (diffDays < 30) return `há ${diffDays} dias`;
  return fmtDatetime(ts);
}

function openWhatsApp(telefone) {
  const raw = normPhone(telefone);
  if (!raw || raw.length < 10) return;
  const num = raw.startsWith('55') ? raw : `55${raw}`;
  window.open(`https://wa.me/${num}`, '_blank', 'noopener,noreferrer');
}

function openInstagram(instagram) {
  const handle = (instagram || '').replace(/^@/, '').trim();
  if (!handle) return;
  window.open(`https://instagram.com/${encodeURIComponent(handle)}`, '_blank', 'noopener,noreferrer');
}

function compareAutomaticPriority(a, b) {
  const priority = Number(b?._journey?.recommendation?.priority || 0)
    - Number(a?._journey?.recommendation?.priority || 0);
  if (priority !== 0) return priority;

  const aDate = a?._journey?.recommendation?.dueDate || a?._journey?.nextAppointmentDate || '9999-12-31';
  const bDate = b?._journey?.recommendation?.dueDate || b?._journey?.nextAppointmentDate || '9999-12-31';
  const dateOrder = aDate.localeCompare(bDate);
  if (dateOrder !== 0) return dateOrder;
  return String(a?.created_at || '').localeCompare(String(b?.created_at || ''));
}

// ─── Nova lead modal ──────────────────────────────────────────

function NovaLeadModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', instagram: '',
    servico_interesse: '', origem: '', origem_outro: '', responsavel: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const hasContact = form.telefone.trim() || form.email.trim() || form.instagram.trim();

  const handleSubmit = async () => {
    if (!form.nome.trim()) { setError('O nome é obrigatório.'); return; }
    if (!hasContact) { setError('Informe ao menos telefone, e-mail ou Instagram.'); return; }
    setError('');
    setSaving(true);
    const { data, error: saveErr } = await onSave(form);
    setSaving(false);
    if (saveErr) {
      setError('Erro ao salvar. Tente novamente.');
      return;
    }
    if (data) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title">Novo Interessado</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#DC2626', display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />{error}
          </div>
        )}

        <div className="form-grid-2">
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Nome *</label>
            <input className="form-input" placeholder="Nome completo" value={form.nome}
              onChange={e => { set('nome', e.target.value); setError(''); }} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Telefone / WhatsApp</label>
            <input className="form-input" placeholder="(00) 00000-0000" value={form.telefone}
              onChange={e => { set('telefone', e.target.value); setError(''); }} />
          </div>
          <div className="form-group">
            <label className="form-label">Instagram</label>
            <input className="form-input" placeholder="@perfil" value={form.instagram}
              onChange={e => { set('instagram', e.target.value); setError(''); }} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" placeholder="exemplo@email.com" value={form.email}
              onChange={e => { set('email', e.target.value); setError(''); }} />
          </div>
          <div className="form-group">
            <label className="form-label">Serviço de interesse</label>
            <input className="form-input" placeholder="Ex: Limpeza de pele" value={form.servico_interesse}
              onChange={e => set('servico_interesse', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Origem</label>
            <select className="form-select" value={form.origem} onChange={e => set('origem', e.target.value)}>
              <option value="">— Desconhecida —</option>
              {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {form.origem === 'Outro' && (
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Descreva a origem</label>
              <input className="form-input" placeholder="Como conheceu a clínica?" value={form.origem_outro}
                onChange={e => set('origem_outro', e.target.value)} />
            </div>
          )}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Responsável pelo atendimento</label>
            <input className="form-input" placeholder="Nome da pessoa responsável" value={form.responsavel}
              onChange={e => set('responsavel', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving || !form.nome.trim() || !hasContact}
          >
            {saving
              ? <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
              : <Plus />}
            Cadastrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Vincular paciente / agendamento modal ─────────────────────

function VincularModal({ onClose, onConfirm, clientes = [], agendamentos = [], lead }) {
  const [busca, setBusca] = useState(lead?.nome || '');
  const [clienteSel, setClienteSel] = useState(lead?.client_id || null);
  const [agendSel, setAgendSel] = useState(lead?.appointment_id || null);
  const [saving, setSaving] = useState(false);

  const clientesFiltrados = useMemo(() => {
    const q = busca.toLowerCase();
    return clientes.filter(c =>
      (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
    ).slice(0, 20);
  }, [busca, clientes]);

  const agendFiltrados = useMemo(() => {
    if (!clienteSel) return [];
    return agendamentos.filter(a => String(a.client_id) === String(clienteSel)).slice(0, 10);
  }, [clienteSel, agendamentos]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <span className="modal-title">Corrigir vínculo</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          A Agenda faz este vínculo automaticamente pelo telefone. Use esta tela somente para corrigir uma associação incorreta; nenhum paciente adicional será criado.
        </p>

        <div className="form-group">
          <label className="form-label">Buscar paciente</label>
          <div className="search-box" style={{ marginBottom: 8 }}>
            <Search />
            <input className="search-input" placeholder="Nome ou telefone..." value={busca}
              onChange={e => setBusca(e.target.value)} />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
            <div
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}
              onClick={() => { setClienteSel(null); setAgendSel(null); }}
            >
              — Sem vínculo —
            </div>
            {clientesFiltrados.map(c => (
              <div
                key={c.id}
                onClick={() => { setClienteSel(c.id); setAgendSel(null); }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                  background: String(clienteSel) === String(c.id) ? 'var(--color-primary-light)' : 'transparent',
                  borderBottom: '1px solid var(--border-light)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: String(clienteSel) === String(c.id) ? 700 : 400 }}>{c.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{c.phone}</span>
              </div>
            ))}
          </div>
        </div>

        {agendFiltrados.length > 0 && (
          <div className="form-group">
            <label className="form-label">Vincular a um agendamento (opcional)</label>
            <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              <div
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}
                onClick={() => setAgendSel(null)}
              >
                — Sem agendamento específico —
              </div>
              {agendFiltrados.map(a => (
                <div
                  key={a.id}
                  onClick={() => setAgendSel(a.id)}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                    background: agendSel === a.id ? 'var(--color-primary-light)' : 'transparent',
                    borderBottom: '1px solid var(--border-light)',
                  }}
                >
                  {a.appointment_date} {a.appointment_time} — {a.procedure || 'Sem procedimento'}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            className="btn btn-primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onConfirm(clienteSel, agendSel);
              setSaving(false);
              onClose();
            }}
          >
            <Link2 style={{ width: 14, height: 14 }} /> Confirmar vínculo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Detail Drawer ───────────────────────────────────────

function LeadDrawer({ lead, onClose, onUpdate, clientes = [], agendamentos = [], currentUser, canWrite }) {
  const [interactions, setInteractions] = useState([]);
  const [loadingInter, setLoadingInter] = useState(true);
  const [errorInter, setErrorInter] = useState(false);
  const [activeTab, setActiveTab] = useState('historico');
  const [novaMsg, setNovaMsg] = useState('');
  const [tipoMsg, setTipoMsg] = useState('nota');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [showVincular, setShowVincular] = useState(false);
  const [acaoForm, setAcaoForm] = useState({
    proxima_acao_descricao:   lead.proxima_acao_descricao   || '',
    proxima_acao_responsavel: lead.proxima_acao_responsavel || lead.responsavel || '',
    proxima_acao_prazo:       lead.proxima_acao_prazo       || '',
    proxima_acao_concluida:   lead.proxima_acao_concluida   || false,
  });
  const [acaoSaving, setAcaoSaving] = useState(false);
  const [acaoError, setAcaoError] = useState('');
  const [sendError, setSendError] = useState('');

  const loadInteractions = useCallback(async () => {
    setLoadingInter(true);
    setErrorInter(false);
    const { data, error } = await fetchCrmInteractions(lead.id);
    if (error) { setErrorInter(true); }
    else { setInteractions(data || []); }
    setLoadingInter(false);
  }, [lead.id]);

  useEffect(() => { loadInteractions(); }, [loadInteractions]);

  const journey = lead._journey;
  const linkedClient = useMemo(
    () => clientes.find(c => String(c.id) === String(lead.client_id)) || journey?.client || null,
    [clientes, lead.client_id, journey?.client]
  );

  // Registrar nota / contato
  const handleSend = async () => {
    if (!novaMsg.trim()) return;
    setSendingMsg(true);
    setSendError('');
    const { data: inter, error: sendErr } = await insertCrmInteraction({
      lead_id: lead.id,
      tipo: tipoMsg,
      conteudo: novaMsg.trim(),
      autor: currentUser?.email || 'Sistema',
    });
    if (sendErr) { setSendError('Erro ao registrar. Tente novamente.'); }
    else if (inter) {
      setInteractions(prev => [...prev, inter]);
      setNovaMsg('');
    }
    setSendingMsg(false);
  };

  // Próxima ação
  const handleAcaoSave = async () => {
    setAcaoSaving(true);
    setAcaoError('');
    const updated = await onUpdate(lead.id, {
      ...acaoForm,
      proxima_acao_concluida: false,
    });
    if (!updated) setAcaoError('Erro ao salvar ação. Tente novamente.');
    setAcaoSaving(false);
  };

  const handleConcluirAcao = async () => {
    setAcaoSaving(true);
    setAcaoError('');
    const updated = await onUpdate(lead.id, { proxima_acao_concluida: true });
    if (updated) {
      setAcaoForm(f => ({ ...f, proxima_acao_concluida: true }));
      await insertCrmInteraction({
        lead_id: lead.id,
        tipo: 'contato',
        conteudo: `Ação concluída: ${lead.proxima_acao_descricao || 'Sem descrição'}`,
        autor: currentUser?.email || 'Sistema',
      });
      loadInteractions();
    } else {
      setAcaoError('Erro ao concluir ação. Tente novamente.');
    }
    setAcaoSaving(false);
  };

  // Vínculo
  const handleVincular = async (clientId, appointmentId) => {
    const updates = {
      client_id: clientId || null,
      appointment_id: appointmentId || null,
    };
    await onUpdate(lead.id, updates);
    const nomeCliente = clientes.find(c => String(c.id) === String(clientId))?.name || clientId;
    await insertCrmInteraction({
      lead_id: lead.id,
      tipo: 'vinculo',
      conteudo: clientId
        ? `Vinculado ao paciente: ${nomeCliente}${appointmentId ? ' (com agendamento)' : ''}`
        : 'Vínculo com paciente removido.',
      autor: currentUser?.email || 'Sistema',
    });
    loadInteractions();
  };

  // Arquivar
  const handleArchivar = async () => {
    if (!window.confirm('Arquivar este interessado? Ele continuará acessível pelo filtro Arquivados.')) return;
    const updated = await onUpdate(lead.id, { arquivado: true, arquivado_at: new Date().toISOString() });
    if (updated) {
      await insertCrmInteraction({
        lead_id: lead.id,
        tipo: 'arquivamento',
        conteudo: 'Interessado arquivado.',
        autor: currentUser?.email || 'Sistema',
      });
      onClose();
    }
  };

  // WhatsApp
  const handleWhatsApp = () => {
    const raw = normPhone(lead.telefone);
    if (!raw || raw.length < 10) return;
    const num = raw.startsWith('55') ? raw : `55${raw}`;
    window.open(`https://wa.me/${num}`, '_blank', 'noopener,noreferrer');
  };

  const overdue = isOverdue(lead);
  const dueToday = isDueToday(lead);

  return (
    <>
      {showVincular && (
        <VincularModal
          lead={lead}
          clientes={clientes}
          agendamentos={agendamentos}
          onClose={() => setShowVincular(false)}
          onConfirm={handleVincular}
        />
      )}

      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal"
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: 700, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Ficha de ${lead.nome}`}
        >
          {/* Header */}
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-dark)', margin: 0 }}>{lead.nome}</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  {lead.telefone && (
                    <button
                      onClick={handleWhatsApp}
                      title="Abrir conversa no WhatsApp"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#128C7E', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <Phone style={{ width: 11, height: 11 }} />{lead.telefone}
                    </button>
                  )}
                  {!lead.telefone && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem telefone para WhatsApp</span>
                  )}
                  {lead.servico_interesse && (
                    <span style={{ fontSize: 11, background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                      {lead.servico_interesse}
                    </span>
                  )}
                  {lead.origem && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>via {lead.origem}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {canWrite && !lead.arquivado && (
                  <button
                    onClick={handleArchivar}
                    title="Arquivar interessado"
                    style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}
                  >
                    <Archive style={{ width: 12, height: 12 }} /> Arquivar
                  </button>
                )}
                <button className="modal-close" onClick={onClose} aria-label="Fechar ficha"><XCircle /></button>
              </div>
            </div>

            {/* Etapa persistida e mantida pela Agenda */}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Etapa automática · atualizada pela Agenda
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={`badge ${statusConfig(lead.status).badge}`}>{statusConfig(lead.status).label}</span>
                {linkedClient && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→ {linkedClient.name}</span>}
                {canWrite && (
                  <button
                    onClick={() => setShowVincular(true)}
                    title="Use somente para corrigir um vínculo identificado incorretamente"
                    style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, border: '1.5px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Link2 style={{ width: 11, height: 11 }} /> Corrigir vínculo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Jornada calculada a partir da Agenda */}
          {journey && (
            <div style={{
              margin: '14px 22px 0', padding: '12px 14px', borderRadius: 12,
              background: journey.background, border: `1px solid ${journey.color}33`,
              display: 'grid', gridTemplateColumns: 'minmax(150px, 1.3fr) repeat(3, minmax(90px, 1fr))',
              gap: 12, alignItems: 'center', flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>
                  Situação automática
                </div>
                <div style={{ marginTop: 5 }}><JourneyBadge journey={journey} /></div>
                <div style={{ marginTop: 6, fontSize: 11, color: journey.color, fontWeight: 700 }}>
                  {journey.recommendation?.label}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Último atendimento</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)', marginTop: 3 }}>
                  {journey.lastVisitDate ? fmtDate(journey.lastVisitDate) : 'Ainda não veio'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Próximo agendamento</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)', marginTop: 3 }}>
                  {journey.nextAppointmentDate ? fmtDate(journey.nextAppointmentDate) : 'Nenhum'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Receita pela Agenda</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)', marginTop: 3 }}>
                  {journey.completedCount} atendimento(s)
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{fmtMoney(journey.revenueFromAgenda)}</div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            {[
              { key: 'historico',    label: 'Histórico' },
              { key: 'proxima_acao', label: 'Próxima ação' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '10px 18px', fontSize: 13, fontWeight: 600,
                  borderBottom: activeTab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                  color: activeTab === t.key ? 'var(--color-primary)' : 'var(--text-muted)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

            {/* ── Histórico ── */}
            {activeTab === 'historico' && (
              <>
                {/* Next action banner */}
                {lead.proxima_acao_descricao && !lead.proxima_acao_concluida && (
                  <div style={{
                    background: overdue ? '#FEF2F2' : dueToday ? '#FFFBEB' : 'var(--bg-card)',
                    border: `1px solid ${overdue ? '#FECACA' : dueToday ? '#FCD34D' : 'var(--border-light)'}`,
                    borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: overdue ? '#DC2626' : dueToday ? '#D97706' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {overdue ? '⚠ Ação atrasada' : dueToday ? '📅 Ação para hoje' : '📌 Próxima ação'}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-dark)', marginTop: 2 }}>{lead.proxima_acao_descricao}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {lead.proxima_acao_responsavel && <span>{lead.proxima_acao_responsavel} · </span>}
                        {lead.proxima_acao_prazo && <span>Prazo: {fmtDate(lead.proxima_acao_prazo)}</span>}
                      </div>
                    </div>
                    {canWrite && (
                      <button
                        onClick={handleConcluirAcao}
                        disabled={acaoSaving}
                        className="btn btn-sm"
                        style={{ background: '#6B9B7A', color: '#fff', whiteSpace: 'nowrap', padding: '5px 12px', fontSize: 12 }}
                      >
                        <Check style={{ width: 12, height: 12 }} /> Concluída
                      </button>
                    )}
                  </div>
                )}

                {/* Interaction log */}
                {loadingInter ? (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    <RefreshCw style={{ animation: 'spin 1s linear infinite', width: 20, height: 20 }} />
                    <p style={{ marginTop: 8, fontSize: 13 }}>Carregando histórico...</p>
                  </div>
                ) : errorInter ? (
                  <div style={{ textAlign: 'center', padding: 32, color: '#C0706A' }}>
                    <AlertTriangle style={{ width: 24, height: 24 }} />
                    <p style={{ marginTop: 8, fontSize: 13 }}>Erro ao carregar histórico.</p>
                    <button className="btn btn-ghost" onClick={loadInteractions} style={{ marginTop: 8 }}>Tentar novamente</button>
                  </div>
                ) : interactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
                    Nenhuma interação registrada ainda.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    {interactions.map(inter => (
                      <div key={inter.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: inter.tipo === 'mudanca_status' ? '#F0FDF4' : inter.tipo === 'contato' ? '#EFF6FF' : 'var(--bg-main)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {inter.tipo === 'mudanca_status' ? <ArrowRight style={{ width: 14, height: 14, color: '#6B9B7A' }} /> :
                           inter.tipo === 'contato'        ? <Phone style={{ width: 14, height: 14, color: '#7A95B8' }} /> :
                           inter.tipo === 'qualificacao'   ? <ClipboardList style={{ width: 14, height: 14, color: '#D4956A' }} /> :
                           inter.tipo === 'vinculo'        ? <Link2 style={{ width: 14, height: 14, color: '#D4956A' }} /> :
                           inter.tipo === 'arquivamento'   ? <Archive style={{ width: 14, height: 14, color: 'var(--text-muted)' }} /> :
                           <MessageSquare style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: 'var(--text-dark)', lineHeight: 1.5 }}>{inter.conteudo}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {inter.autor && <span>{inter.autor} · </span>}
                            {fmtDatetime(inter.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* New interaction input */}
                {canWrite && (
                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      {TIPO_INTERACAO.map(t => (
                        <button
                          key={t.key}
                          onClick={() => setTipoMsg(t.key)}
                          style={{
                            padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                            border: '1.5px solid var(--border-color)',
                            background: tipoMsg === t.key ? 'var(--color-primary)' : 'transparent',
                            color: tipoMsg === t.key ? '#fff' : 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {sendError && (
                      <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{sendError}</div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <textarea
                        className="form-textarea"
                        style={{ minHeight: 64, flex: 1 }}
                        placeholder="Registrar contato, retorno ou observação..."
                        value={novaMsg}
                        onChange={e => { setNovaMsg(e.target.value); setSendError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend(); }}
                        aria-label="Registrar interação"
                      />
                      <button
                        className="btn btn-primary"
                        style={{ alignSelf: 'flex-end', padding: '8px 14px' }}
                        onClick={handleSend}
                        disabled={sendingMsg || !novaMsg.trim()}
                        aria-label="Enviar"
                      >
                        <Send style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Ctrl+Enter para enviar</div>
                  </div>
                )}
              </>
            )}

            {/* ── Próxima ação ── */}
            {activeTab === 'proxima_acao' && (
              <>
                {journey?.recommendation && (
                  <div style={{
                    padding: '12px 14px', marginBottom: 16, borderRadius: 10,
                    background: journey.background, border: `1px solid ${journey.color}33`,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: journey.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Próxima ação sugerida automaticamente
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-dark)', marginTop: 5 }}>
                      {journey.recommendation.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                      {journey.recommendation.reason}
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  A recomendação acima vem da Agenda. Use os campos abaixo somente quando uma conversa exigir um combinado específico.
                </p>
                {lead.proxima_acao_concluida && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #6B9B7A', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#166534', display: 'flex', gap: 8 }}>
                    <Check style={{ width: 16, height: 16 }} />
                    Última ação concluída. Defina a próxima abaixo.
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Descrição da próxima ação *</label>
                    <input
                      className="form-input"
                      placeholder="Ex: Ligar e confirmar horário, enviar tabela de preços..."
                      value={acaoForm.proxima_acao_descricao}
                      onChange={e => setAcaoForm(f => ({ ...f, proxima_acao_descricao: e.target.value, proxima_acao_concluida: false }))}
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Responsável</label>
                      <input
                        className="form-input"
                        placeholder="Nome do responsável"
                        value={acaoForm.proxima_acao_responsavel}
                        onChange={e => setAcaoForm(f => ({ ...f, proxima_acao_responsavel: e.target.value }))}
                        disabled={!canWrite}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Prazo</label>
                      <input
                        className="form-input"
                        type="date"
                        value={acaoForm.proxima_acao_prazo}
                        onChange={e => setAcaoForm(f => ({ ...f, proxima_acao_prazo: e.target.value }))}
                        disabled={!canWrite}
                      />
                    </div>
                  </div>
                </div>
                {acaoError && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>{acaoError}</div>}
                {canWrite && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    {!lead.proxima_acao_concluida && lead.proxima_acao_descricao && (
                      <button
                        className="btn"
                        style={{ background: '#6B9B7A', color: '#fff' }}
                        onClick={handleConcluirAcao}
                        disabled={acaoSaving}
                      >
                        <Check style={{ width: 14, height: 14 }} /> Marcar como concluída
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={handleAcaoSave}
                      disabled={acaoSaving || !acaoForm.proxima_acao_descricao.trim()}
                    >
                      {acaoSaving ? <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Flag />}
                      Salvar ação
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 22px', borderTop: '1px solid var(--border-light)', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>Responsável: <strong>{lead.responsavel || '—'}</strong></span>
            <span>Cadastrado: {fmtDatetime(lead.created_at)}</span>
            {lead.arquivado && <span style={{ background: 'var(--bg-main)', padding: '2px 8px', borderRadius: 99 }}>Arquivado</span>}
            {lead.motivo_perda && <span style={{ color: '#C0706A' }}>Perda: {lead.motivo_perda}</span>}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Lead Row ─────────────────────────────────────────────────

function LeadRow({ lead, onClick, overdue, dueToday, isFila }) {
  const st = statusConfig(lead.status);
  const StIcon = st.icon;
  const journey = lead._journey;

  const rawPhone = normPhone(lead.telefone);
  const hasPhone = Boolean(rawPhone && rawPhone.length >= 10);
  const cleanIg = (lead.instagram || '').replace(/^@/, '').trim();
  const hasInstagram = Boolean(cleanIg.length > 0);

  return (
    <tr onClick={onClick} style={{ cursor: 'pointer' }} tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <td>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {lead.nome}
          {lead.origem === 'Instagram' && (
            <span style={{ fontSize: 10, background: 'rgba(225, 48, 108, 0.12)', color: '#E1306C', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
              Instagram
            </span>
          )}
        </div>
        {lead.telefone && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Phone style={{ width: 10, height: 10 }} />{lead.telefone}
          </div>
        )}
        {lead.instagram && !lead.telefone && (
          <div style={{ fontSize: 11, color: '#E1306C', marginTop: 2, fontWeight: 600 }}>
            {lead.instagram.startsWith('@') ? lead.instagram : `@${lead.instagram}`}
          </div>
        )}
      </td>
      <td style={{ fontSize: 12, color: 'var(--text-medium)' }}>{lead.servico_interesse || '—'}</td>
      <td>
        <JourneyBadge journey={journey} compact />
        {journey?.recommendation?.label && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, maxWidth: 180 }}>
            {journey.recommendation.label}
          </div>
        )}
      </td>
      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead.responsavel || <em>Sem responsável</em>}</td>
      <td>
        {lead.proxima_acao_descricao && !lead.proxima_acao_concluida ? (
          <div>
            <div style={{
              fontSize: 12,
              color: overdue ? '#DC2626' : dueToday ? '#D97706' : 'var(--text-medium)',
              fontWeight: (overdue || dueToday) ? 700 : 400,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {overdue && <AlertTriangle style={{ width: 11, height: 11 }} />}
              {dueToday && !overdue && <Clock style={{ width: 11, height: 11 }} />}
              {lead.proxima_acao_descricao}
            </div>
            {lead.proxima_acao_prazo && (
              <div style={{ fontSize: 10, color: overdue ? '#DC2626' : 'var(--text-muted)' }}>
                {overdue && <strong>Atrasado · </strong>}{fmtDate(lead.proxima_acao_prazo)}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{
              fontSize: 12,
              color: journey?.recommendation?.priority >= 3 ? journey.color : 'var(--text-medium)',
              fontWeight: journey?.recommendation?.priority >= 3 ? 700 : 500,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {journey?.recommendation?.requiresAction && <Clock style={{ width: 11, height: 11 }} />}
              {journey?.recommendation?.label || 'Acompanhar relacionamento'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              Automática pela Agenda
            </div>
          </div>
        )}
      </td>
      <td>
        <span className={`badge ${st.badge}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <StIcon style={{ width: 10, height: 10 }} />{st.label}
        </span>
      </td>
      <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title={fmtDatetime(lead.created_at)}>
        {isFila ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(212, 149, 106, 0.12)', color: '#C0706A', padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11 }}>
            <Clock style={{ width: 11, height: 11 }} />
            {fmtRelativeTime(lead.created_at)}
          </div>
        ) : (
          fmtDatetime(lead.created_at)
        )}
      </td>
      {isFila ? (
        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
            {hasPhone ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={(e) => { e.stopPropagation(); openWhatsApp(lead.telefone); }}
                title={`Abrir conversa no WhatsApp (${lead.telefone})`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 700, padding: '6px 12px', minHeight: 36,
                  background: 'rgba(37, 211, 102, 0.12)', color: '#15803d', border: '1px solid rgba(37, 211, 102, 0.3)',
                  borderRadius: 6, cursor: 'pointer',
                }}
              >
                <Phone style={{ width: 13, height: 13 }} />
                WhatsApp
              </button>
            ) : hasInstagram ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={(e) => { e.stopPropagation(); openInstagram(lead.instagram); }}
                title={`Abrir perfil do Instagram (@${cleanIg})`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 700, padding: '6px 12px', minHeight: 36,
                  background: 'rgba(225, 48, 108, 0.12)', color: '#E1306C', border: '1px solid rgba(225, 48, 108, 0.3)',
                  borderRadius: 6, cursor: 'pointer',
                }}
              >
                <Camera style={{ width: 13, height: 13 }} />
                Instagram
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                disabled
                title="Nenhum telefone ou Instagram cadastrado"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 600, padding: '6px 12px', minHeight: 36,
                  background: 'var(--bg-main)', color: 'var(--text-muted)', border: '1px solid var(--border-color)',
                  borderRadius: 6, opacity: 0.6, cursor: 'not-allowed',
                }}
              >
                Sem contato
              </button>
            )}

          </div>
        </td>
      ) : (
        <td>
          <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
        </td>
      )}
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function CrmInteressados() {
  const { user, canEdit, canView, checkIsAdmin } = useAuth();
  const location = useLocation();
  const [leads, setLeads] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [aba, setAba] = useState('fila');
  const [busca, setBusca] = useState('');
  const [filtroMeus, setFiltroMeus] = useState(false);
  const [filtroSemAcao, setFiltroSemAcao] = useState(false);
  const [filtroArquivados, setFiltroArquivados] = useState(false);
  const [filtroJornada, setFiltroJornada] = useState(null);
  const [filtroOrigemParam, setFiltroOrigemParam] = useState(null);
  const [showNova, setShowNova] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // Sincroniza aba e filtros vindos da Inteligência Comercial (/crm?filtro=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const f = params.get('filtro');
    if (f === 'atrasados' || f === 'retornos_pendentes') {
      setAba('resultados');
      setFiltroSemAcao(false);
      setFiltroArquivados(false);
      setFiltroJornada(null);
      setFiltroOrigemParam(f);
    } else if (f === 'sem_acao' || f === 'interessados_sem_acao') {
      setAba('resultados');
      setFiltroSemAcao(true);
      setFiltroArquivados(false);
      setFiltroJornada(null);
      setFiltroOrigemParam(f);
    } else if (['sem_agendamento', 'faltaram', 'em_risco', 'agendadas', 'clientes', 'pos_venda'].includes(f)) {
      setAba(f === 'agendadas' ? 'agendados' : 'resultados');
      setFiltroSemAcao(false);
      setFiltroArquivados(false);
      setFiltroJornada(f);
      setFiltroOrigemParam(f);
    } else {
      setFiltroJornada(null);
      setFiltroOrigemParam(null);
    }
  }, [location.search]);

  const isAdmin = checkIsAdmin();
  const canViewCrm = isAdmin || canView('crm');
  const canWriteCrm = isAdmin || canEdit('crm');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [
        { data: leadsData, error: leadsErr },
        { data: clientsData },
        { data: appointmentsData },
      ] = await Promise.all([
        fetchCrmLeads(), fetchClients(), fetchAppointments(),
      ]);
      if (leadsErr) { setLoadError(true); }
      else { setLeads(leadsData || []); }
      setClientes(clientsData || []);
      setAgendamentos(appointmentsData || []);
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    const res = await insertCrmLead(form);
    if (res.data) {
      setLeads(prev => [res.data, ...prev]);
      setSelectedLead(enrichCrmLeads([res.data], clientes, agendamentos)[0]);
      await insertCrmInteraction({
        lead_id: res.data.id,
        tipo: 'sistema',
        conteudo: 'Interessado cadastrado.',
        autor: user?.email || 'Sistema',
      });
    }
    return res;
  };

  const handleUpdate = async (id, updates) => {
    const { data, error } = await updateCrmLead(id, updates);
    if (data) {
      setLeads(prev => prev.map(l => l.id === id ? data : l));
      const decorated = enrichCrmLeads([data], clientes, agendamentos)[0];
      setSelectedLead(decorated);
      return decorated;
    }
    if (error) console.error('updateCrmLead error:', error);
    return null;
  };

  const handleLeadClick = (lead) => {
    setSelectedLead(lead);
  };

  // ── Filtering ──

  const enrichedLeads = useMemo(
    () => enrichCrmLeads(leads, clientes, agendamentos),
    [leads, clientes, agendamentos]
  );

  useEffect(() => {
    setSelectedLead(current => {
      if (!current) return null;
      return enrichedLeads.find(lead => lead.id === current.id) || current;
    });
  }, [enrichedLeads]);

  const baseLeads = useMemo(() => {
    const q = busca.toLowerCase();
    return enrichedLeads.filter(l => {
      if (!filtroArquivados && l.arquivado) return false;
      if (filtroArquivados && !l.arquivado) return false;
      if (filtroMeus && l.responsavel?.toLowerCase() !== (user?.email || '').toLowerCase()) return false;
      if (filtroJornada) {
        if (!matchesCrmJourneyFilter(l, filtroJornada)) return false;
      }
      if (['atrasados', 'retornos_pendentes'].includes(filtroOrigemParam) && !isOverdue(l)) return false;
      if (filtroSemAcao) {
        if (['encerrado_ganho', 'encerrado_perdido', 'arquivado'].includes(l.status)) return false;
        // Lead com tarefa pendente ativa: tem prazo, descrição não vazia E NÃO concluída
        const hasValidPendingAction = Boolean(
          l.proxima_acao_prazo &&
          l.proxima_acao_descricao &&
          l.proxima_acao_descricao.trim() &&
          !l.proxima_acao_concluida
        );
        if (hasValidPendingAction) return false;
      }
      if (!q) return true;
      return (
        (l.nome || '').toLowerCase().includes(q) ||
        (l.telefone || '').includes(q) ||
        (l.instagram || '').toLowerCase().includes(q) ||
        (l.servico_interesse || '').toLowerCase().includes(q) ||
        (l.responsavel || '').toLowerCase().includes(q)
      );
    });
  }, [enrichedLeads, busca, filtroMeus, filtroSemAcao, filtroArquivados, filtroJornada, filtroOrigemParam, user]);

  const byAba = useMemo(() => {
    const prioritized = [...baseLeads].sort(compareAutomaticPriority);
    return {
      // As abas seguem a jornada atual, não apenas o primeiro atendimento.
      // Assim, um cliente antigo com nova consulta volta corretamente para Agendados.
      fila:      prioritized.filter(l => l._journey?.key === 'interessada'),
      agendados: prioritized.filter(l => l._journey?.key === 'agendada'),
      atendidos: prioritized.filter(l => l._journey?.isPayingClient && l._journey?.key !== 'agendada'),
      perdidos:  prioritized.filter(l => l.status === 'encerrado_perdido' && !l._journey?.isPayingClient),
      resultados: prioritized,
    };
  }, [baseLeads]);

  const abaLeads = byAba[aba] || [];

  const revenueSummary = useMemo(
    () => summarizeCrmRevenueFromAgenda(enrichedLeads),
    [enrichedLeads]
  );

  // Stats use raw leads (not filtered) for badge accuracy
  const stats = useMemo(() => {
    const activeLeads = enrichedLeads.filter(l => !l.arquivado);
    const openLeads = activeLeads.filter(l => !l._journey?.isPayingClient && l.status !== 'encerrado_perdido');
    return {
      fila:       activeLeads.filter(l => l._journey?.key === 'interessada').length,
      atrasados:  activeLeads.filter(l => isOverdue(l)).length,
      hoje:       activeLeads.filter(l => isDueToday(l) && !['encerrado_ganho','encerrado_perdido'].includes(l.status)).length,
      agendados:  activeLeads.filter(l => l._journey?.key === 'agendada').length,
      ganhos:     activeLeads.filter(l => l._journey?.isPayingClient).length,
      semAgendamento: openLeads.filter(l => l._journey?.key === 'interessada').length,
      faltaram: activeLeads.filter(l => l._journey?.key === 'faltou').length,
      emRisco: activeLeads.filter(l => l._journey?.isPayingClient && ['em_risco', 'inativa'].includes(l._journey?.key)).length,
      posVenda: activeLeads.filter(l => matchesCrmJourneyFilter(l, 'pos_venda')).length,
      clientes: activeLeads.filter(l => l._journey?.isPayingClient).length,
      semAcao:    activeLeads.filter(l => (
        !['encerrado_ganho', 'encerrado_perdido', 'arquivado'].includes(l.status) &&
        (!l.proxima_acao_prazo || !l.proxima_acao_descricao || !l.proxima_acao_descricao.trim() || l.proxima_acao_concluida === true)
      )).length,
    };
  }, [enrichedLeads]);

  const applyJourneyFilter = (filter) => {
    setFiltroJornada(current => current === filter ? null : filter);
    setFiltroSemAcao(false);
    setFiltroArquivados(false);
    setAba(filter === 'agendadas' ? 'agendados' : 'resultados');
    setFiltroOrigemParam(null);
    window.history.replaceState({}, '', '/crm');
  };

  if (!canViewCrm) {
    return (
      <div className="empty-state" style={{ marginTop: 80 }}>
        <Users style={{ width: 48, height: 48, color: 'var(--text-muted)' }} />
        <p style={{ marginTop: 16, fontSize: 15 }}>Você não tem permissão para acessar o CRM.</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Solicite ao administrador a liberação do módulo Interessados.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Modals */}
      {showNova && (
        <NovaLeadModal
          onClose={() => setShowNova(false)}
          onSave={handleSave}
        />
      )}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleUpdate}
          clientes={clientes}
          agendamentos={agendamentos}
          currentUser={user}
          canWrite={canWriteCrm}
        />
      )}

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-header-label"><UserPlus />CRM</div>
          <h1 className="page-title">Interessados</h1>
          <p className="page-subtitle">
            Da primeira conversa ao retorno · a Agenda atualiza a jornada automaticamente
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
          {canWriteCrm && (
            <button className="btn btn-primary" onClick={() => setShowNova(true)}>
              <Plus />Novo Interessado
            </button>
          )}
        </div>
      </div>

      {/* Banner de filtro vindo da Inteligência Comercial */}
      {filtroOrigemParam && (
        <div style={{
          marginBottom: 16,
          padding: '10px 16px',
          background: '#8B5CF614',
          border: '1px solid #8B5CF644',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6D28D9' }}>
            <Filter style={{ width: 16, height: 16 }} />
            <span>
              Filtro da Inteligência Comercial ativo:{' '}
              <strong>
                {JOURNEY_FILTER_LABELS[filtroOrigemParam]
                  || (filtroOrigemParam === 'atrasados' || filtroOrigemParam === 'retornos_pendentes'
                    ? 'Retornos pendentes (próxima ação vencida e não concluída)'
                    : 'Interessados sem próxima ação definida')}
              </strong>
            </span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: '4px 10px', color: '#6D28D9' }}
            onClick={() => {
              window.history.replaceState({}, '', '/crm');
              setFiltroOrigemParam(null);
              setFiltroSemAcao(false);
              setFiltroJornada(null);
              setAba('fila');
            }}
          >
            Limpar filtro
          </button>
        </div>
      )}

      {/* Filas automáticas baseadas na Agenda */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-dark)' }}>Visão automática do CRM</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Vendas, relacionamento e prioridades calculados pela Agenda.</div>
        </div>
        {filtroJornada && (
          <button className="btn btn-ghost btn-sm" onClick={() => applyJourneyFilter(filtroJornada)} style={{ fontSize: 11 }}>
            <XCircle style={{ width: 12, height: 12 }} /> Ver todos
          </button>
        )}
      </div>

      <div role="note" style={{
        marginBottom: 16, padding: '10px 14px', borderRadius: 10,
        background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF',
        fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.5,
      }}>
        <CheckCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
        <span><strong>Regra provisória ativa:</strong> cada atendimento finalizado é considerado uma venda paga. Os valores abaixo vêm da Agenda e poderão ser substituídos pelo Financeiro integrado no futuro.</span>
      </div>

      <div className="grid-4 section-gap" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {[
          { label: 'Para responder', val: revenueSummary.waitingResponse, detail: 'interessados sem agendamento', cor: '#D97706', icon: Inbox },
          { label: 'Agenda futura', val: revenueSummary.scheduled, detail: 'pessoas com horário ativo', cor: '#2563EB', icon: Calendar },
          { label: 'Vendas do CRM no mês', val: revenueSummary.salesThisMonth, detail: 'atendimentos finalizados e vinculados', cor: '#059669', icon: CheckCircle },
          { label: 'Receita atribuída ao CRM', val: fmtMoney(revenueSummary.revenueThisMonth), detail: 'valor informado na Agenda neste mês', cor: '#047857', icon: BadgeDollarSign },
        ].map(({ label, val, detail, cor, icon: Icon }) => (
          <div className="stat-card" key={label}>
            <div className="stat-card-icon" style={{ background: `${cor}18` }}><Icon style={{ color: cor }} /></div>
            <div className="stat-value" style={{ color: cor }}>{val}</div>
            <div className="stat-label">{label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{detail}</div>
          </div>
        ))}
      </div>

      <div className="card section-gap" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-dark)' }}>Máquina de relacionamento</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Da entrada no CRM até compra, recorrência e reativação.</div>
          </div>
          <span style={{ fontSize: 10, color: '#1E40AF', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '4px 8px', borderRadius: 99, fontWeight: 700 }}>
            Fonte atual: Agenda
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          {[
            { label: 'Base do CRM', value: revenueSummary.leads },
            { label: 'Clientes pagantes*', value: revenueSummary.payingClients },
            { label: 'Conversão', value: revenueSummary.conversionRate == null ? '—' : `${revenueSummary.conversionRate.toFixed(1)}%` },
            { label: 'Recorrentes', value: revenueSummary.recurringClients },
            { label: 'Precisam reativar', value: revenueSummary.atRiskClients },
          ].map(item => (
            <div key={item.label} style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--bg-main)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 18, fontWeight: 850, color: 'var(--text-dark)' }}>{item.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 8 }}>*Pagante = possui pelo menos um atendimento finalizado enquanto o Financeiro não está integrado.</div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-dark)' }}>Quem precisa de atenção</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>As filas abaixo mudam sozinhas conforme a Agenda avança.</div>
      </div>

      <div className="grid-4 section-gap" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {[
          { key: 'sem_agendamento', label: 'Sem agendamento', val: stats.semAgendamento, cor: '#D97706', icon: Inbox },
          { key: 'faltaram', label: 'Faltaram', val: stats.faltaram, cor: '#DC2626', icon: AlertTriangle },
          { key: 'pos_venda', label: 'Pós-atendimento', val: stats.posVenda, cor: '#059669', icon: Repeat2 },
          { key: 'em_risco', label: 'Reativar clientes', val: stats.emRisco, cor: '#C2410C', icon: Clock },
        ].map(({ key, label, val, cor, icon: Icon }) => (
          <button
            type="button"
            key={key}
            className="stat-card"
            onClick={() => applyJourneyFilter(key)}
            aria-pressed={filtroJornada === key}
            style={{ textAlign: 'left', cursor: 'pointer', border: filtroJornada === key ? `2px solid ${cor}` : undefined }}
          >
            <div className="stat-card-icon" style={{ background: `${cor}18` }}><Icon style={{ color: cor }} /></div>
            <div className="stat-value" style={{ color: cor }}>{val}</div>
            <div className="stat-label">{label}</div>
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className={`btn btn-sm ${filtroMeus ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFiltroMeus(v => !v)}
          style={{ fontSize: 12 }}
        >
          Meus atendimentos
        </button>
        <button
          className={`btn btn-sm ${filtroSemAcao ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFiltroSemAcao(v => !v)}
          style={{ fontSize: 12 }}
        >
          Sem próxima ação
        </button>
        <button
          className={`btn btn-sm ${filtroArquivados ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => { setFiltroArquivados(v => !v); setAba('resultados'); }}
          style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Archive style={{ width: 12, height: 12 }} /> Arquivados
        </button>
        {filtroJornada && (
          <span style={{ fontSize: 11, color: CRM_JOURNEY_STATUS[filtroJornada === 'faltaram' ? 'faltou' : filtroJornada === 'agendadas' ? 'agendada' : filtroJornada === 'sem_agendamento' ? 'interessada' : filtroJornada === 'pos_venda' ? 'cliente' : 'em_risco']?.color, fontWeight: 700 }}>
            {JOURNEY_FILTER_LABELS[filtroJornada]}
          </span>
        )}
        {(filtroMeus || filtroSemAcao || filtroArquivados || filtroJornada || busca) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setFiltroMeus(false); setFiltroSemAcao(false); setFiltroArquivados(false); setFiltroJornada(null); setBusca(''); }}
            style={{ fontSize: 12, color: 'var(--text-muted)' }}
          >
            <XCircle style={{ width: 12, height: 12 }} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div className="tabs">
          {ABAS.map(a => {
            const count = byAba[a.key]?.length || 0;
            const isAlert = (a.key === 'fila' && stats.fila > 0) || (a.key === 'perdidos' && byAba.perdidos.length > 0);
            return (
              <button
                key={a.key}
                className={`tab-item${aba === a.key ? ' active' : ''}`}
                onClick={() => setAba(a.key)}
              >
                {a.label}
                {count > 0 && (
                  <span style={{
                    marginLeft: 6, minWidth: 18, height: 18, padding: '0 5px',
                    borderRadius: 99, fontSize: 10, fontWeight: 800,
                    background: isAlert ? '#DC2626' : 'var(--color-primary)',
                    color: '#fff', display: 'inline-flex', alignItems: 'center',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="search-box">
          <Search />
          <input
            className="search-input"
            placeholder="Buscar por nome, telefone, Instagram..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            aria-label="Buscar interessados"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Star style={{ width: 14, height: 14, color: 'var(--color-primary)' }} />
            {ABAS.find(a => a.key === aba)?.label || JOURNEY_FILTER_LABELS[filtroOrigemParam] || 'Resultados filtrados'}
            {abaLeads.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— {abaLeads.length}</span>}
          </span>
        </div>

        {loading ? (
          <div className="empty-state">
            <RefreshCw style={{ animation: 'spin 1s linear infinite', width: 32, height: 32 }} />
            <p style={{ marginTop: 12 }}>Carregando interessados...</p>
          </div>
        ) : loadError ? (
          <div className="empty-state" style={{ color: '#C0706A' }}>
            <AlertTriangle style={{ width: 32, height: 32 }} />
            <p style={{ marginTop: 12 }}>Erro ao carregar os dados.</p>
            <button className="btn btn-ghost" onClick={load} style={{ marginTop: 8 }}>Tentar novamente</button>
          </div>
        ) : abaLeads.length === 0 ? (
          <div className="empty-state">
            <Users style={{ width: 32, height: 32, color: 'var(--text-muted)' }} />
            <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>
              {busca || filtroMeus || filtroSemAcao || filtroArquivados || filtroJornada
                ? 'Nenhum resultado para estes filtros.'
                : aba === 'fila'       ? 'Tudo respondido por enquanto.'
                : aba === 'agendados'  ? 'Nenhum interessado agendado.'
                : aba === 'atendidos'  ? 'Nenhum interessado atendido ainda.'
                : aba === 'perdidos'   ? 'Nenhum interessado perdido.'
                : 'Nenhum interessado cadastrado.'}
            </p>
            {(busca || filtroMeus || filtroSemAcao || filtroJornada) && (
              <button
                className="btn btn-ghost"
                style={{ marginTop: 8 }}
                onClick={() => { setBusca(''); setFiltroMeus(false); setFiltroSemAcao(false); setFiltroJornada(null); }}
              >
                Limpar filtros
              </button>
            )}
            {aba === 'fila' && !busca && !filtroMeus && !filtroSemAcao && !filtroJornada && canWriteCrm && (
              <button className="btn btn-primary" onClick={() => setShowNova(true)} style={{ marginTop: 12 }}>
                <Plus />Cadastrar primeiro interessado
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Serviço</th>
                  <th>Situação automática</th>
                  <th>Responsável</th>
                  <th>Próxima ação</th>
                  <th>Etapa automática</th>
                  <th>{aba === 'fila' ? 'Espera' : 'Cadastro'}</th>
                  {aba === 'fila' ? (
                    <th style={{ textAlign: 'right', minWidth: 130 }}>Contato</th>
                  ) : (
                    <th style={{ width: 24 }}></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {abaLeads.map(lead => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    onClick={() => handleLeadClick(lead)}
                    overdue={isOverdue(lead)}
                    dueToday={isDueToday(lead)}
                    isFila={aba === 'fila'}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary: losses breakdown */}
      {aba === 'perdidos' && byAba.perdidos.length > 0 && (() => {
        const perdidos = byAba.perdidos;
        const motivoMap = {};
        perdidos.forEach(l => {
          const m = l.motivo_perda || 'Sem motivo';
          motivoMap[m] = (motivoMap[m] || 0) + 1;
        });
        const motivos = Object.entries(motivoMap).sort((a, b) => b[1] - a[1]);
        return motivos.length > 0 ? (
          <div className="card section-gap">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-dark)' }}>
              Perdas por motivo
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {motivos.map(([motivo, qtd]) => (
                <div key={motivo} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-medium)' }}>{motivo}</span>
                  <span style={{ fontWeight: 700, color: '#C0706A' }}>{qtd}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

    </div>
  );
}
