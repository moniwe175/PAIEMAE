/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Plus, Search, XCircle, RefreshCw, Phone, Calendar,
  CheckCircle, Clock, AlertTriangle, MessageSquare,
  ChevronRight, Link2, Send, Star, ArrowRight, Flag, ClipboardList,
  Check, X, Inbox, Archive, UserPlus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchCrmLeads, insertCrmLead, updateCrmLead,
  fetchCrmInteractions, insertCrmInteraction,
  fetchClients, fetchAppointments,
} from '../services/supabaseService';

// ─── Constants ────────────────────────────────────────────────

const STATUS_LIST = [
  { key: 'aguardando_resposta', label: 'Responder',         badge: 'badge-warning', color: '#D4956A', icon: Inbox },
  { key: 'aguardando_cliente',  label: 'Aguard. cliente',   badge: 'badge-info',    color: '#7A95B8', icon: Clock },
  { key: 'retorno_agendado',    label: 'Retorno marcado',   badge: 'badge-info',    color: '#5B7FA6', icon: Calendar },
  { key: 'agendado',            label: 'Agendado',          badge: 'badge-success', color: '#6B9B7A', icon: CheckCircle },
  { key: 'encerrado_ganho',     label: 'Concluído',         badge: 'badge-success', color: '#4A8A5A', icon: CheckCircle },
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
  { key: 'hoje',       label: 'Hoje' },
  { key: 'atrasados',  label: 'Atrasados' },
  { key: 'agendados',  label: 'Agendados' },
  { key: 'encerrados', label: 'Encerrados' },
  { key: 'todos',      label: 'Todos' },
];

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

// ─── Nova lead modal ──────────────────────────────────────────

function NovaLeadModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', instagram: '',
    servico_interesse: '', origem: '', origem_outro: '', responsavel: '',
    status: 'aguardando_resposta',
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

// ─── Encerrar como perdido modal ───────────────────────────────

function PerdidoModal({ onClose, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <span className="modal-title" style={{ color: '#C0706A' }}>Encerrar como Perdido</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-medium)', marginBottom: 12 }}>
          Registre o motivo para analisar padrões de perda no futuro.
        </p>
        <div className="form-group">
          <label className="form-label">Motivo da perda *</label>
          <textarea
            className="form-textarea"
            placeholder="Ex: Preço, concorrência, não respondeu mais, mudou de planos..."
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            style={{ minHeight: 80 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            className="btn"
            style={{ background: '#C0706A', color: '#fff' }}
            disabled={!motivo.trim() || saving}
            onClick={async () => {
              setSaving(true);
              await onConfirm(motivo);
              setSaving(false);
              onClose();
            }}
          >
            <X style={{ width: 14, height: 14 }} /> Confirmar perda
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
          <span className="modal-title">Vincular a Paciente / Agendamento</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Ao vincular, o interessado é associado ao cadastro existente. Nenhum paciente adicional é criado.
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
  const [showPerdido, setShowPerdido] = useState(false);
  const [showVincular, setShowVincular] = useState(false);
  const [qualForm, setQualForm] = useState({
    qual_servico:        lead.qual_servico        || '',
    qual_prazo:          lead.qual_prazo          || '',
    qual_disponibilidade:lead.qual_disponibilidade|| '',
    qual_objecao:        lead.qual_objecao        || '',
  });
  const [qualSaving, setQualSaving] = useState(false);
  const [qualError, setQualError] = useState('');
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

  const linkedClient = useMemo(
    () => clientes.find(c => String(c.id) === String(lead.client_id)),
    [clientes, lead.client_id]
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

  // Mudar status
  const handleStatusChange = async (newStatus) => {
    if (newStatus === lead.status) return;
    if (newStatus === 'encerrado_perdido') { setShowPerdido(true); return; }
    const oldStatus = lead.status;
    const updated = await onUpdate(lead.id, { status: newStatus });
    if (updated) {
      await insertCrmInteraction({
        lead_id: lead.id,
        tipo: 'mudanca_status',
        conteudo: `Status: "${statusConfig(oldStatus).label}" → "${statusConfig(newStatus).label}"`,
        autor: currentUser?.email || 'Sistema',
        meta: { de: oldStatus, para: newStatus },
      });
      loadInteractions();
    }
  };

  const confirmPerdido = async (motivo) => {
    const oldStatus = lead.status;
    const updated = await onUpdate(lead.id, { status: 'encerrado_perdido', motivo_perda: motivo });
    if (updated) {
      await insertCrmInteraction({
        lead_id: lead.id,
        tipo: 'mudanca_status',
        conteudo: `Encerrado como perdido. Motivo: ${motivo}`,
        autor: currentUser?.email || 'Sistema',
        meta: { de: oldStatus, para: 'encerrado_perdido', motivo },
      });
      loadInteractions();
    }
  };

  // Qualificação
  const handleQualSave = async () => {
    setQualSaving(true);
    setQualError('');
    const updates = { ...qualForm, qual_updated_at: new Date().toISOString() };
    const updated = await onUpdate(lead.id, updates);
    if (updated) {
      await insertCrmInteraction({
        lead_id: lead.id,
        tipo: 'qualificacao',
        conteudo: 'Qualificação atualizada.',
        autor: currentUser?.email || 'Sistema',
      });
      loadInteractions();
    } else {
      setQualError('Erro ao salvar qualificação. Tente novamente.');
    }
    setQualSaving(false);
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
    if (clientId && appointmentId) updates.status = 'agendado';
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
      {showPerdido && (
        <PerdidoModal onClose={() => setShowPerdido(false)} onConfirm={confirmPerdido} />
      )}
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

            {/* Status bar */}
            {canWrite && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {STATUS_LIST.map(s => {
                  const active = lead.status === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => handleStatusChange(s.key)}
                      style={{
                        padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                        border: `1.5px solid ${s.color}`,
                        background: active ? s.color : 'transparent',
                        color: active ? '#fff' : s.color,
                        cursor: 'pointer', transition: 'all .15s',
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => setShowVincular(true)}
                  style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, border: '1.5px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Link2 style={{ width: 11, height: 11 }} />
                  {linkedClient ? `✓ ${linkedClient.name}` : 'Vincular paciente'}
                </button>
              </div>
            )}
            {!canWrite && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge ${statusConfig(lead.status).badge}`}>{statusConfig(lead.status).label}</span>
                {linkedClient && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→ {linkedClient.name}</span>}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            {[
              { key: 'historico',    label: 'Histórico' },
              { key: 'qualificacao', label: 'Qualificação' },
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

            {/* ── Qualificação ── */}
            {activeTab === 'qualificacao' && (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  Preencha apenas o que foi efetivamente perguntado e respondido. Campos não perguntados devem ficar vazios.
                  {lead.qual_updated_at && <span> Última atualização: {fmtDatetime(lead.qual_updated_at)}</span>}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">O que procura (resposta real)?</label>
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: 60 }}
                      placeholder="O que a pessoa disse que procura..."
                      value={qualForm.qual_servico}
                      onChange={e => setQualForm(f => ({ ...f, qual_servico: e.target.value }))}
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quando pretende agendar?</label>
                    <input
                      className="form-input"
                      placeholder="Ex: O quanto antes, mês que vem, não sabe ainda..."
                      value={qualForm.qual_prazo}
                      onChange={e => setQualForm(f => ({ ...f, qual_prazo: e.target.value }))}
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Disponibilidade de horário</label>
                    <input
                      className="form-input"
                      placeholder="Ex: Manhãs na semana, sábados de tarde..."
                      value={qualForm.qual_disponibilidade}
                      onChange={e => setQualForm(f => ({ ...f, qual_disponibilidade: e.target.value }))}
                      disabled={!canWrite}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Objeção ou dúvida principal</label>
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: 60 }}
                      placeholder="Ex: Preço, procedimento doloroso, concorrente mais barato..."
                      value={qualForm.qual_objecao}
                      onChange={e => setQualForm(f => ({ ...f, qual_objecao: e.target.value }))}
                      disabled={!canWrite}
                    />
                  </div>
                </div>
                {qualError && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>{qualError}</div>}
                {canWrite && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <button className="btn btn-primary" onClick={handleQualSave} disabled={qualSaving}>
                      {qualSaving ? <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <CheckCircle />}
                      Salvar qualificação
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Próxima ação ── */}
            {activeTab === 'proxima_acao' && (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  Defina o que precisa acontecer para avançar com este interessado.
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

function LeadRow({ lead, onClick, overdue, dueToday }) {
  const st = statusConfig(lead.status);
  const StIcon = st.icon;
  return (
    <tr onClick={onClick} style={{ cursor: 'pointer' }} tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <td>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-dark)' }}>{lead.nome}</div>
        {lead.telefone && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Phone style={{ width: 10, height: 10 }} />{lead.telefone}
          </div>
        )}
        {lead.instagram && !lead.telefone && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{lead.instagram}</div>
        )}
      </td>
      <td style={{ fontSize: 12, color: 'var(--text-medium)' }}>{lead.servico_interesse || '—'}</td>
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
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {lead.proxima_acao_concluida ? 'Ação concluída' : 'Sem ação definida'}
          </span>
        )}
      </td>
      <td>
        <span className={`badge ${st.badge}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <StIcon style={{ width: 10, height: 10 }} />{st.label}
        </span>
      </td>
      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDatetime(lead.created_at)}</td>
      <td>
        <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function CrmInteressados() {
  const { user, canEdit, canView, checkIsAdmin } = useAuth();
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
  const [showNova, setShowNova] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const isAdmin = checkIsAdmin();
  const canViewCrm = isAdmin || canView('crm');
  const canWriteCrm = isAdmin || canEdit('crm');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [{ data: leadsData, error: leadsErr }] = await Promise.all([
        fetchCrmLeads(),
      ]);
      if (leadsErr) { setLoadError(true); }
      else { setLeads(leadsData || []); }
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Loads clients/appointments on demand (only when vincular modal is opened)
  const loadAuxData = useCallback(async () => {
    const [{ data: cli }, { data: age }] = await Promise.all([
      fetchClients(), fetchAppointments(),
    ]);
    setClientes(cli || []);
    setAgendamentos(age || []);
  }, []);

  const handleSave = async (form) => {
    const res = await insertCrmLead(form);
    if (res.data) {
      setLeads(prev => [res.data, ...prev]);
      setSelectedLead(res.data);
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
      setSelectedLead(data);
      return data;
    }
    if (error) console.error('updateCrmLead error:', error);
    return null;
  };

  const handleLeadClick = async (lead) => {
    setSelectedLead(lead);
    if (clientes.length === 0) loadAuxData();
  };

  // ── Filtering ──

  const baseLeads = useMemo(() => {
    const q = busca.toLowerCase();
    return leads.filter(l => {
      if (!filtroArquivados && l.arquivado) return false;
      if (filtroArquivados && !l.arquivado) return false;
      if (filtroMeus && l.responsavel?.toLowerCase() !== (user?.email || '').toLowerCase()) return false;
      if (filtroSemAcao && (l.proxima_acao_descricao && !l.proxima_acao_concluida)) return false;
      if (!q) return true;
      return (
        (l.nome || '').toLowerCase().includes(q) ||
        (l.telefone || '').includes(q) ||
        (l.instagram || '').toLowerCase().includes(q) ||
        (l.servico_interesse || '').toLowerCase().includes(q) ||
        (l.responsavel || '').toLowerCase().includes(q)
      );
    });
  }, [leads, busca, filtroMeus, filtroSemAcao, filtroArquivados, user]);

  const byAba = useMemo(() => {
    const active = baseLeads.filter(l => !['encerrado_ganho', 'encerrado_perdido'].includes(l.status));
    return {
      fila:      baseLeads.filter(l => l.status === 'aguardando_resposta'),
      hoje:      active.filter(l => isDueToday(l)),
      atrasados: active.filter(l => isOverdue(l)),
      agendados: baseLeads.filter(l => l.status === 'agendado'),
      encerrados:baseLeads.filter(l => ['encerrado_ganho', 'encerrado_perdido'].includes(l.status)),
      todos:     baseLeads,
    };
  }, [baseLeads]);

  const abaLeads = byAba[aba] || [];

  // Stats use raw leads (not filtered) for badge accuracy
  const stats = useMemo(() => {
    const activeLeads = leads.filter(l => !l.arquivado);
    return {
      fila:       activeLeads.filter(l => l.status === 'aguardando_resposta').length,
      atrasados:  activeLeads.filter(l => isOverdue(l)).length,
      hoje:       activeLeads.filter(l => isDueToday(l) && !['encerrado_ganho','encerrado_perdido'].includes(l.status)).length,
      agendados:  activeLeads.filter(l => l.status === 'agendado').length,
      ganhos:     leads.filter(l => l.status === 'encerrado_ganho').length,
      semAcao:    activeLeads.filter(l => !l.proxima_acao_descricao || l.proxima_acao_concluida).length,
    };
  }, [leads]);

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
            {stats.fila} aguardando resposta
            {stats.atrasados > 0 && <span style={{ color: '#DC2626', marginLeft: 8 }}>· {stats.atrasados} atrasados</span>}
            {stats.semAcao > 0 && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>· {stats.semAcao} sem próxima ação</span>}
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

      {/* KPI Cards */}
      <div className="grid-4 section-gap" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Aguardando resposta', val: stats.fila,      cor: '#D4956A', icon: Inbox },
          { label: 'Ações atrasadas',     val: stats.atrasados, cor: '#DC2626', icon: AlertTriangle },
          { label: 'Para hoje',           val: stats.hoje,      cor: '#D97706', icon: Clock },
          { label: 'Agendados',           val: stats.agendados, cor: '#6B9B7A', icon: Calendar },
        ].map(({ label, val, cor, icon: Icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-icon" style={{ background: `${cor}18` }}><Icon style={{ color: cor }} /></div>
            <div className="stat-value" style={{ color: cor }}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
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
          onClick={() => { setFiltroArquivados(v => !v); setAba('todos'); }}
          style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Archive style={{ width: 12, height: 12 }} /> Arquivados
        </button>
        {(filtroMeus || filtroSemAcao || filtroArquivados || busca) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setFiltroMeus(false); setFiltroSemAcao(false); setFiltroArquivados(false); setBusca(''); }}
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
            const isAlert = (a.key === 'fila' && stats.fila > 0) || (a.key === 'atrasados' && stats.atrasados > 0);
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
            {ABAS.find(a => a.key === aba)?.label}
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
              {busca || filtroMeus || filtroSemAcao || filtroArquivados
                ? 'Nenhum resultado para estes filtros.'
                : aba === 'fila'       ? 'Nenhum interessado aguardando resposta.'
                : aba === 'hoje'       ? 'Nenhuma ação para hoje. Bom trabalho!'
                : aba === 'atrasados'  ? 'Nenhuma ação atrasada.'
                : aba === 'agendados'  ? 'Nenhum interessado agendado.'
                : aba === 'encerrados' ? 'Nenhum atendimento encerrado.'
                : 'Nenhum interessado cadastrado.'}
            </p>
            {(busca || filtroMeus || filtroSemAcao) && (
              <button
                className="btn btn-ghost"
                style={{ marginTop: 8 }}
                onClick={() => { setBusca(''); setFiltroMeus(false); setFiltroSemAcao(false); }}
              >
                Limpar filtros
              </button>
            )}
            {aba === 'fila' && !busca && !filtroMeus && !filtroSemAcao && canWriteCrm && (
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
                  <th>Responsável</th>
                  <th>Próxima ação</th>
                  <th>Status</th>
                  <th>Cadastro</th>
                  <th style={{ width: 24 }}></th>
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
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary: losses breakdown on encerrados tab */}
      {aba === 'encerrados' && byAba.encerrados.length > 0 && (() => {
        const perdidos = byAba.encerrados.filter(l => l.status === 'encerrado_perdido');
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
