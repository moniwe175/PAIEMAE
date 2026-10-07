/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Lightbulb, Plus, X, ChevronDown, ChevronUp, Edit3, Trash2,
  CheckCircle, CheckSquare, Square, Calendar, RefreshCw, Send,
  Tag, ArrowRight, Sparkles, History, Zap, AlignLeft, Video,
  TrendingUp, Clock, AlertCircle, Archive, Flag, Search,
} from 'lucide-react';
import {
  fetchIdeas, insertIdeia, updateIdeia, deleteIdeia,
  upsertIdeiaTask, deleteIdeiaTask, convertIdeiaToRascunho,
} from '../../services/supabaseService';

// ─── Constantes ────────────────────────────────────────────────────────────────

const CANAIS = ['Instagram','WhatsApp','Email','SMS','Live','Stories','Reels','Outro'];
const TIPOS  = [
  { value: 'conteudo',  label: 'Conteúdo' },
  { value: 'promocao',  label: 'Promoção' },
  { value: 'live',      label: 'Live' },
  { value: 'campanha',  label: 'Campanha' },
  { value: 'outro',     label: 'Outro' },
];
const STATUS_LIST = [
  { value: 'ideia',        label: 'Ideia',        color: '#8B5CF6', bg: '#EDE9FE', icon: Lightbulb },
  { value: 'planejando',   label: 'Planejando',   color: '#3B82F6', bg: '#EFF6FF', icon: Calendar },
  { value: 'em_execucao',  label: 'Em execução',  color: '#F59E0B', bg: '#FFFBEB', icon: Zap },
  { value: 'concluida',    label: 'Concluída',    color: '#10B981', bg: '#ECFDF5', icon: CheckCircle },
  { value: 'arquivada',    label: 'Arquivada',    color: '#6B7280', bg: '#F3F4F6', icon: Archive },
];
const PRIORIDADES = [
  { value: 'baixa',  label: 'Baixa',  color: '#6B7280' },
  { value: 'media',  label: 'Média',  color: '#F59E0B' },
  { value: 'alta',   label: 'Alta',   color: '#EF4444' },
];

// Modelo pré-preenchido "Live da Evelyn"
const MODELO_LIVE_EVELYN = {
  titulo_live: 'Live — Dicas de Estética e Beleza',
  data_hora: '',
  duracao_min: 60,
  tema_principal: 'Cuidados com a pele + novidades da clínica',
  topicos: [
    'Boas-vindas e apresentação da clínica',
    'Dica 1: Rotina de skincare para o dia a dia',
    'Dica 2: Tratamento mais buscado do mês',
    'Antes e Depois (foto ou relato de cliente com autorização)',
    'Promoção exclusiva para quem assistir ao vivo',
    'Q&A — Perguntas dos seguidores',
    'Encerramento e chamada para DM',
  ],
  chamada_acao: 'Mande "LIVE" no Direct para garantir sua avaliação gratuita!',
  materiais_necessarios: ['Iluminação boa','Tripé','Roteiro impresso','Link de agendamento pronto'],
  notas: '',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR'); } catch { return iso; }
}

function getStatusCfg(val) {
  return STATUS_LIST.find(s => s.value === val) || STATUS_LIST[0];
}
function getPrioCfg(val) {
  return PRIORIDADES.find(p => p.value === val) || PRIORIDADES[1];
}

// ─── Modal de Ideia (criar / editar) ──────────────────────────────────────────

function IdeiaModal({ ideia, onClose, onSaved }) {
  const isEdit = !!ideia;
  const [form, setForm] = useState({
    titulo:    ideia?.titulo    || '',
    descricao: ideia?.descricao || '',
    canal:     ideia?.canal     || 'Instagram',
    tipo:      ideia?.tipo      || 'conteudo',
    status:    ideia?.status    || 'ideia',
    prioridade:ideia?.prioridade|| 'media',
    data_alvo: ideia?.data_alvo || '',
    tags:      (ideia?.tags || []).join(', '),
    usarModeloLive: false,
    modelo_live: ideia?.modelo_live || null,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.titulo.trim()) { setErr('O título é obrigatório.'); return; }
    setSaving(true);
    const payload = {
      titulo:    form.titulo.trim(),
      descricao: form.descricao.trim(),
      canal:     form.canal,
      tipo:      form.tipo,
      status:    form.status,
      prioridade:form.prioridade,
      data_alvo: form.data_alvo || null,
      tags:      form.tags.split(',').map(t => t.trim()).filter(Boolean),
      modelo_live: form.usarModeloLive ? { ...MODELO_LIVE_EVELYN, ...form.modelo_live } : (form.modelo_live || null),
    };
    const fn = isEdit ? () => updateIdeia(ideia.id, payload) : () => insertIdeia(payload);
    const res = await fn();
    setSaving(false);
    if (res.error) { setErr(res.error.message || 'Erro ao salvar.'); return; }
    onSaved(res.data);
    onClose();
  };

  const isLive = form.tipo === 'live' || form.canal === 'Live';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lightbulb style={{ width: 18, height: 18, color: '#8B5CF6' }} />
            <span className="modal-title">{isEdit ? 'Editar Ideia' : 'Nova Ideia'}</span>
          </div>
          <button className="modal-close" onClick={onClose}><X /></button>
        </div>

        {/* Campos básicos */}
        <div className="form-group">
          <label className="form-label">Título *</label>
          <input className="form-input" value={form.titulo} onChange={e => set('titulo', e.target.value)}
            placeholder="Ex: Live de skincare para captar novos clientes" />
        </div>

        <div className="form-group">
          <label className="form-label">Descrição / Contexto</label>
          <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="Descreva a ideia, objetivo e contexto..." />
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Canal</label>
            <select className="form-select" value={form.canal} onChange={e => set('canal', e.target.value)}>
              {CANAIS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-select" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUS_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Prioridade</label>
            <select className="form-select" value={form.prioridade} onChange={e => set('prioridade', e.target.value)}>
              {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Data Alvo</label>
            <input className="form-input" type="date" value={form.data_alvo} onChange={e => set('data_alvo', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Tags (separadas por vírgula)</label>
            <input className="form-input" value={form.tags} onChange={e => set('tags', e.target.value)}
              placeholder="Ex: beleza, promoção, skincare" />
          </div>
        </div>

        {/* Modelo Live da Evelyn */}
        {isLive && (
          <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              <input type="checkbox" checked={form.usarModeloLive}
                onChange={e => {
                  set('usarModeloLive', e.target.checked);
                  if (e.target.checked) set('modelo_live', { ...MODELO_LIVE_EVELYN });
                }} />
              <Video style={{ width: 14, height: 14, color: '#7C3AED' }} />
              Usar Modelo Live da Evelyn
            </label>
            <p style={{ fontSize: 12, color: '#6D28D9', margin: '6px 0 0 24px' }}>
              Preenche automaticamente o roteiro, tópicos e chamada para ação. Você pode editar depois.
            </p>
            {form.usarModeloLive && form.modelo_live && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Título da Live</label>
                  <input className="form-input" value={form.modelo_live.titulo_live || ''}
                    onChange={e => set('modelo_live', { ...form.modelo_live, titulo_live: e.target.value })} />
                </div>
                <div className="form-grid-2" style={{ gap: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Data e Hora</label>
                    <input className="form-input" type="datetime-local" value={form.modelo_live.data_hora || ''}
                      onChange={e => set('modelo_live', { ...form.modelo_live, data_hora: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Duração (min)</label>
                    <input className="form-input" type="number" value={form.modelo_live.duracao_min || 60}
                      onChange={e => set('modelo_live', { ...form.modelo_live, duracao_min: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tema Principal</label>
                  <input className="form-input" value={form.modelo_live.tema_principal || ''}
                    onChange={e => set('modelo_live', { ...form.modelo_live, tema_principal: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Chamada para Ação</label>
                  <input className="form-input" value={form.modelo_live.chamada_acao || ''}
                    onChange={e => set('modelo_live', { ...form.modelo_live, chamada_acao: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Notas adicionais</label>
                  <textarea className="form-textarea" style={{ minHeight: 60 }}
                    value={form.modelo_live.notas || ''}
                    onChange={e => set('modelo_live', { ...form.modelo_live, notas: e.target.value })} />
                </div>
              </div>
            )}
          </div>
        )}

        {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', borderColor: 'transparent' }}>
            {saving ? <RefreshCw style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <CheckCircle style={{ width: 13, height: 13 }} />}
            {isEdit ? 'Salvar' : 'Criar Ideia'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card de Ideia expandível ──────────────────────────────────────────────────

function IdeiaCard({ ideia, onEdit, onDelete, onConvertCampanha, onTaskUpdate, campanhas }) {
  const [expanded, setExpanded] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [converting, setConverting] = useState(false);

  const st  = getStatusCfg(ideia.status);
  const pri = getPrioCfg(ideia.prioridade);
  const StIcon  = st.icon;
  const tasks   = ideia.marketing_idea_tasks || [];
  const history = ideia.marketing_idea_history || [];
  const done    = tasks.filter(t => t.concluida).length;

  const handleAddTask = async () => {
    if (!newTask.trim()) return;
    setAddingTask(true);
    const res = await upsertIdeiaTask({ ideia_id: ideia.id, titulo: newTask.trim(), ordem: tasks.length });
    setAddingTask(false);
    if (!res.error) {
      setNewTask('');
      onTaskUpdate(ideia.id, 'add', res.data);
    }
  };

  const handleToggleTask = async (task) => {
    const res = await upsertIdeiaTask({ ...task, concluida: !task.concluida });
    if (!res.error) onTaskUpdate(ideia.id, 'update', res.data);
  };

  const handleDeleteTask = async (taskId) => {
    const res = await deleteIdeiaTask(taskId);
    if (!res.error) onTaskUpdate(ideia.id, 'delete', { id: taskId });
  };

  const handleConvert = async () => {
    if (!confirm(`Converter "${ideia.titulo}" em rascunho de campanha?`)) return;
    setConverting(true);
    await onConvertCampanha(ideia);
    setConverting(false);
  };

  const campanhaVinculada = ideia.campanha_id
    ? campanhas.find(c => String(c.id) === String(ideia.campanha_id))
    : null;

  return (
    <div className="card" style={{
      borderLeft: `4px solid ${st.color}`,
      transition: 'box-shadow 0.2s',
    }}>
      {/* Cabeçalho do card */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <StIcon style={{ width: 16, height: 16, color: st.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-dark)' }}>{ideia.titulo}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
              background: st.bg, color: st.color }}>{st.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
              background: `${pri.color}18`, color: pri.color }}>
              <Flag style={{ width: 9, height: 9, display: 'inline', verticalAlign: 'middle' }} /> {pri.label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ideia.canal}</span>
            {ideia.tipo && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {TIPOS.find(t => t.value === ideia.tipo)?.label}</span>}
            {ideia.data_alvo && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <Calendar style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} /> {fmtDate(ideia.data_alvo)}
              </span>
            )}
            {tasks.length > 0 && (
              <span style={{ fontSize: 11, color: done === tasks.length ? '#10B981' : 'var(--text-muted)' }}>
                <CheckSquare style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} /> {done}/{tasks.length}
              </span>
            )}
          </div>
          {ideia.tags?.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
              {ideia.tags.map(tag => (
                <span key={tag} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99,
                  background: '#F3F4F6', color: '#6B7280', fontWeight: 600 }}>
                  <Tag style={{ width: 8, height: 8, display: 'inline', verticalAlign: 'middle' }} /> {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={e => { e.stopPropagation(); onEdit(ideia); }} title="Editar">
            <Edit3 style={{ width: 13, height: 13 }} />
          </button>
          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: '#DC2626' }}
            onClick={e => { e.stopPropagation(); onDelete(ideia.id); }} title="Excluir">
            <Trash2 style={{ width: 13, height: 13 }} />
          </button>
          {expanded ? <ChevronUp style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
            : <ChevronDown style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />}
        </div>
      </div>

      {/* Conteúdo expandido */}
      {expanded && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border-light)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Descrição */}
          {ideia.descricao && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlignLeft style={{ width: 11, height: 11 }} /> Descrição
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-medium)', lineHeight: 1.6, margin: 0 }}>{ideia.descricao}</p>
            </div>
          )}

          {/* Modelo Live */}
          {ideia.modelo_live && (
            <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#7C3AED', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Video style={{ width: 11, height: 11 }} /> Modelo de Live
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{ideia.modelo_live.titulo_live}</div>
              {ideia.modelo_live.data_hora && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(ideia.modelo_live.data_hora).toLocaleString('pt-BR')}</div>}
              {ideia.modelo_live.tema_principal && <p style={{ fontSize: 12, margin: '6px 0 0', color: 'var(--text-medium)' }}><strong>Tema:</strong> {ideia.modelo_live.tema_principal}</p>}
              {ideia.modelo_live.topicos?.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text-medium)', lineHeight: 1.8 }}>
                  {ideia.modelo_live.topicos.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              )}
              {ideia.modelo_live.chamada_acao && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: '#EDE9FE', borderRadius: 6, fontSize: 12, color: '#6D28D9', fontWeight: 600 }}>
                  📣 {ideia.modelo_live.chamada_acao}
                </div>
              )}
            </div>
          )}

          {/* Tarefas */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckSquare style={{ width: 11, height: 11 }} /> Tarefas ({done}/{tasks.length})
            </div>
            {tasks.sort((a, b) => a.ordem - b.ordem).map(task => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
                borderBottom: '1px solid var(--border-light)', opacity: task.concluida ? 0.6 : 1 }}>
                <button onClick={() => handleToggleTask(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: task.concluida ? '#10B981' : '#D1D5DB' }}>
                  {task.concluida ? <CheckSquare style={{ width: 16, height: 16 }} /> : <Square style={{ width: 16, height: 16 }} />}
                </button>
                <span style={{ flex: 1, fontSize: 13, textDecoration: task.concluida ? 'line-through' : 'none', color: 'var(--text-dark)' }}>{task.titulo}</span>
                {task.prazo && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtDate(task.prazo)}</span>}
                <button onClick={() => handleDeleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 0 }}>
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>
            ))}
            {/* Adicionar tarefa */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input className="form-input" style={{ flex: 1, fontSize: 12, padding: '5px 10px' }}
                value={newTask} onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                placeholder="Adicionar tarefa... (Enter para salvar)" />
              <button className="btn btn-ghost btn-sm" onClick={handleAddTask} disabled={addingTask}>
                {addingTask ? <RefreshCw style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} /> : <Plus style={{ width: 12, height: 12 }} />}
              </button>
            </div>
          </div>

          {/* Histórico */}
          {history.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <History style={{ width: 11, height: 11 }} /> Histórico
              </div>
              {[...history].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(h => (
                <div key={h.id} style={{ display: 'flex', gap: 8, fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--border-light)', alignItems: 'flex-start' }}>
                  <Clock style={{ width: 11, height: 11, color: 'var(--text-muted)', marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>{fmtDate(h.created_at)}</span>
                    {h.status_de && <span> · {getStatusCfg(h.status_de).label}</span>}
                    <ArrowRight style={{ width: 9, height: 9, display: 'inline', margin: '0 3px', verticalAlign: 'middle' }} />
                    <span style={{ fontWeight: 700, color: getStatusCfg(h.status_para).color }}>{getStatusCfg(h.status_para).label}</span>
                    {h.nota && <span style={{ color: 'var(--text-muted)' }}> — {h.nota}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ações */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4 }}>
            {/* Alterar status rápido */}
            <select className="form-select" style={{ fontSize: 11, padding: '4px 8px', width: 'auto' }}
              value={ideia.status}
              onChange={e => onEdit({ ...ideia, _quickStatus: e.target.value })}>
              {STATUS_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {/* Converter em campanha */}
            {!campanhaVinculada && ideia.status !== 'arquivada' && (
              <button className="btn btn-ghost btn-sm" onClick={handleConvert} disabled={converting}
                style={{ fontSize: 11, color: '#7C3AED', borderColor: '#DDD6FE' }}>
                {converting
                  ? <RefreshCw style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
                  : <Send style={{ width: 12, height: 12 }} />}
                Converter em Rascunho de Campanha
              </button>
            )}
            {campanhaVinculada && (
              <span style={{ fontSize: 11, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle style={{ width: 12, height: 12 }} />
                Vinculada à campanha: <strong>{campanhaVinculada.nome}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente Principal ──────────────────────────────────────────────────────

export default function IdeiasPlanejamento({ campanhas = [], onCampanhaCreated }) {
  const [ideias, setIdeias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | ideia obj
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroCanal, setFiltroCanal] = useState('Todos');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchIdeas();
    if (!res.error) setIdeias(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta ideia?')) return;
    const res = await deleteIdeia(id);
    if (!res.error) setIdeias(prev => prev.filter(i => i.id !== id));
  };

  const handleSaved = (saved) => {
    setIdeias(prev => {
      const exists = prev.find(i => i.id === saved.id);
      if (exists) return prev.map(i => i.id === saved.id ? { ...i, ...saved } : i);
      return [{ ...saved, marketing_idea_tasks: [], marketing_idea_history: [] }, ...prev];
    });
  };

  const handleEdit = async (ideia) => {
    // Mudança rápida de status via select
    if (ideia._quickStatus && ideia._quickStatus !== ideia.status) {
      const res = await updateIdeia(ideia.id, { status: ideia._quickStatus });
      if (!res.error) {
        const updated = res.data;
        const histEntry = { id: crypto.randomUUID(), ideia_id: ideia.id,
          status_de: ideia.status, status_para: ideia._quickStatus,
          nota: null, created_at: new Date().toISOString() };
        setIdeias(prev => prev.map(i => i.id === ideia.id
          ? { ...i, ...updated, marketing_idea_history: [...(i.marketing_idea_history || []), histEntry] }
          : i));
      }
      return;
    }
    setModal(ideia);
  };

  const handleTaskUpdate = (ideiaId, action, taskData) => {
    setIdeias(prev => prev.map(i => {
      if (i.id !== ideiaId) return i;
      const tasks = i.marketing_idea_tasks || [];
      if (action === 'add') return { ...i, marketing_idea_tasks: [...tasks, taskData] };
      if (action === 'update') return { ...i, marketing_idea_tasks: tasks.map(t => t.id === taskData.id ? taskData : t) };
      if (action === 'delete') return { ...i, marketing_idea_tasks: tasks.filter(t => t.id !== taskData.id) };
      return i;
    }));
  };

  const handleConvertCampanha = async (ideia) => {
    const res = await convertIdeiaToRascunho(ideia);
    if (res.error) { alert('Erro ao converter: ' + (res.error.message || res.error)); return; }
    // Atualiza ideia localmente
    setIdeias(prev => prev.map(i => i.id === ideia.id
      ? { ...i, status: 'planejando', campanha_id: res.data.id }
      : i));
    if (onCampanhaCreated) onCampanhaCreated(res.data);
    alert(`Campanha "${res.data.name || ideia.titulo}" criada como rascunho!`);
  };

  // Filtros
  const filtradas = useMemo(() => ideias.filter(i => {
    const matchBusca = i.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      (i.descricao || '').toLowerCase().includes(busca.toLowerCase()) ||
      (i.tags || []).some(t => t.toLowerCase().includes(busca.toLowerCase()));
    const matchStatus = filtroStatus === 'todos' || i.status === filtroStatus;
    const matchCanal  = filtroCanal  === 'Todos' || i.canal  === filtroCanal;
    return matchBusca && matchStatus && matchCanal;
  }), [ideias, busca, filtroStatus, filtroCanal]);

  // KPIs
  const kpis = useMemo(() => {
    const total   = ideias.length;
    const ativas  = ideias.filter(i => i.status === 'em_execucao').length;
    const prontas = ideias.filter(i => i.status === 'planejando').length;
    const concl   = ideias.filter(i => i.status === 'concluida').length;
    return [
      { label: 'Total de Ideias', val: total,   cor: '#8B5CF6', icon: Lightbulb },
      { label: 'Em Execução',     val: ativas,  cor: '#F59E0B', icon: Zap },
      { label: 'Planejando',      val: prontas, cor: '#3B82F6', icon: TrendingUp },
      { label: 'Concluídas',      val: concl,   cor: '#10B981', icon: CheckCircle },
    ];
  }, [ideias]);

  return (
    <div>
      {/* Modal */}
      {modal && (
        <IdeiaModal
          ideia={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {/* KPIs */}
      <div className="grid-4 section-gap">
        {kpis.map(({ label, val, cor, icon: Icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-icon" style={{ background: `${cor}18` }}><Icon style={{ color: cor }} /></div>
            <div className="stat-value" style={{ color: cor }}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Filtros e ação */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="tabs" style={{ fontSize: 11 }}>
            <button className={`tab-item${filtroStatus === 'todos' ? ' active' : ''}`} onClick={() => setFiltroStatus('todos')}>Todas</button>
            {STATUS_LIST.map(s => (
              <button key={s.value} className={`tab-item${filtroStatus === s.value ? ' active' : ''}`}
                onClick={() => setFiltroStatus(s.value)}>{s.label}</button>
            ))}
          </div>
          {filtroCanal !== 'Todos' && (
            <span className="badge badge-info" style={{ cursor: 'pointer' }} onClick={() => setFiltroCanal('Todos')}>
              {filtroCanal} <X style={{ width: 10, height: 10, display: 'inline' }} />
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="search-box">
            <Search />
            <input className="search-input" placeholder="Buscar ideia, tag..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button className="btn btn-primary" onClick={() => setModal('new')}
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', borderColor: 'transparent' }}>
            <Plus style={{ width: 14, height: 14 }} /> Nova Ideia
          </button>
        </div>
      </div>

      {/* Lista de ideias */}
      {loading ? (
        <div className="empty-state">
          <RefreshCw style={{ animation: 'spin 1s linear infinite', width: 24, height: 24, color: '#8B5CF6' }} />
          <p>Carregando ideias...</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state">
          <Lightbulb style={{ width: 32, height: 32, color: '#8B5CF6' }} />
          <p style={{ marginTop: 8 }}>
            {ideias.length === 0
              ? 'Nenhuma ideia ainda. Clique em "Nova Ideia" para começar!'
              : 'Nenhuma ideia com os filtros atuais.'}
          </p>
          {ideias.length === 0 && (
            <button className="btn btn-primary" onClick={() => setModal('new')}
              style={{ marginTop: 12, background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', borderColor: 'transparent' }}>
              <Sparkles style={{ width: 14, height: 14 }} /> Criar primeira ideia
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtradas.map(ideia => (
            <IdeiaCard
              key={ideia.id}
              ideia={ideia}
              campanhas={campanhas}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onConvertCampanha={handleConvertCampanha}
              onTaskUpdate={handleTaskUpdate}
            />
          ))}
        </div>
      )}

      {/* Nota regulatória */}
      {ideias.length > 0 && (
        <div style={{ marginTop: 20, padding: '8px 12px', background: 'rgba(139,92,246,0.05)',
          border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, fontSize: 11, color: '#6D28D9',
          display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />
          <span>Ideias convertidas em campanha aparecem como <strong>Rascunho</strong> na aba Campanhas. Só ative após revisar.</span>
        </div>
      )}
    </div>
  );
}
