import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Zap, ToggleLeft, ToggleRight, Edit3, CheckCircle, XCircle,
  Clock, AlertTriangle, Send, RefreshCw, Loader2, ChevronDown,
  ChevronRight, MessageSquare, Users, Filter, Calendar,
  TrendingUp, CheckSquare, X, Info, Bell
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  fetchTemplates, updateTemplate, toggleTemplate,
  fetchQueue, fetchQueueHistory, approveMessage, discardMessage,
} from '../services/supabaseService';

// ─── Constants ────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:   { label: 'Aguardando aprovação', color: '#F39C12',  bg: '#FFF8E1', border: '#FFD966' },
  approved:  { label: 'Pronto para enviar',   color: '#3498DB',  bg: '#EBF5FB', border: '#85C1E9' },
  sent:      { label: 'Enviado',               color: '#27AE60',  bg: '#EAFAF1', border: '#82E0AA' },
  failed:    { label: 'Falhou',                color: '#E74C3C',  bg: '#FDEDEC', border: '#F1948A' },
  cancelled: { label: 'Cancelado',             color: '#95A5A6',  bg: '#F4F6F7', border: '#BDC3C7' },
  expired:   { label: 'Expirado',              color: '#95A5A6',  bg: '#F4F6F7', border: '#BDC3C7' },
};

const TEMPLATE_TAGS = [
  { tag: '{{nome_paciente}}',     desc: 'Nome do paciente' },
  { tag: '{{hora_consulta}}',     desc: 'Hora da consulta' },
  { tag: '{{data_consulta}}',     desc: 'Data da consulta' },
  { tag: '{{nome_servico}}',      desc: 'Nome do serviço' },
  { tag: '{{nome_profissional}}', desc: 'Nome do profissional' },
  { tag: '{{link_google}}',       desc: 'Link do Google Maps' },
  { tag: '{{dias_retorno}}',      desc: 'Dias até o retorno' },
  { tag: '{{sessoes_restantes}}', desc: 'Sessões restantes do pacote' },
];

// ─── Helpers ──────────────────────────────────────────────────

function fmtDatetime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch { return iso; }
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
}

function isThisMonth(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ─── Edit Template Modal ──────────────────────────────────────

function EditTemplateModal({ template, onClose, onSaved }) {
  const [text, setText] = useState(template?.template_text || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    const { error } = await updateTemplate(template.tool_id, text);
    setSaving(false);
    if (error) { setErr('Erro ao salvar. Tente novamente.'); return; }
    onSaved({ ...template, template_text: text });
    onClose();
  };

  const insertTag = (tag) => {
    setText(prev => prev + tag);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <span className="modal-title">
              Ferramenta {template?.tool_id} — {template?.tool_name || template?.name}
            </span>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {template?.description}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X /></button>
        </div>

        {/* Template Text */}
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Texto do Template</label>
          <textarea
            className="form-textarea"
            style={{ minHeight: 130, fontFamily: 'monospace', fontSize: 13 }}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Digite a mensagem aqui..."
          />
        </div>

        {/* Tags Reference */}
        <div style={{
          background: 'var(--bg-main)', borderRadius: 8, padding: '12px 14px',
          marginBottom: 14, border: '1px solid var(--border-light)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Tags disponíveis — clique para inserir
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TEMPLATE_TAGS.map(({ tag, desc }) => (
              <button
                key={tag}
                title={desc}
                onClick={() => insertTag(tag)}
                style={{
                  padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                  background: '#6C63FF18', color: '#6C63FF', border: '1px solid #6C63FF30',
                  cursor: 'pointer', fontFamily: 'monospace',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Notice */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14,
          background: '#FFF8E1', border: '1px solid #FFD966', borderRadius: 6, padding: '8px 12px',
          fontSize: 12, color: '#8B6914',
        }}>
          <Info style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          Editar o texto não reinicia o cronômetro da ferramenta
        </div>

        {err && (
          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 10 }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
              : <CheckCircle style={{ width: 14, height: 14 }} />
            }
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tool Card ────────────────────────────────────────────────

function ToolCard({ template, onToggle, onEdit }) {
  const isGroupA = template.group_type === 'A';
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    await onToggle(template.tool_id, !template.active);
    setToggling(false);
  };

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      border: `1px solid ${template.active ? 'var(--border-color)' : '#e0e0e0'}`,
      borderTop: `3px solid ${isGroupA ? '#27AE60' : '#F39C12'}`,
      padding: '16px 18px',
      opacity: template.active ? 1 : 0.65,
      transition: 'all 0.2s ease',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Group badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: isGroupA ? '#27AE6018' : '#F39C1218',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: isGroupA ? '#27AE60' : '#F39C12' }}>
              {template.tool_id}
            </span>
          </div>
          <span style={{
            padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
            background: isGroupA ? '#EAFAF1' : '#FFF8E1',
            color: isGroupA ? '#27AE60' : '#F39C12',
            border: `1px solid ${isGroupA ? '#82E0AA' : '#FFD966'}`,
          }}>
            {isGroupA ? '⚡ Automático' : '👁 Revisão humana'}
          </span>
        </div>
        {/* Toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: toggling ? 0.5 : 1 }}
          title={template.active ? 'Desativar ferramenta' : 'Ativar ferramenta'}
        >
          {toggling
            ? <Loader2 style={{ width: 28, height: 28, color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
            : template.active
              ? <ToggleRight style={{ width: 32, height: 32, color: '#27AE60' }} />
              : <ToggleLeft style={{ width: 32, height: 32, color: '#BDC3C7' }} />
          }
        </button>
      </div>

      {/* Name */}
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-dark)', marginBottom: 4 }}>
        {template.tool_name || template.name || `Ferramenta ${template.tool_id}`}
      </div>

      {/* Description */}
      {template.description && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
          {template.description}
        </div>
      )}

      {/* Preview of template */}
      {template.template_text && (
        <div style={{
          fontSize: 11, color: 'var(--text-medium)', lineHeight: 1.5,
          background: 'var(--bg-main)', borderRadius: 6, padding: '8px 10px',
          marginBottom: 12, fontFamily: 'monospace',
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {template.template_text}
        </div>
      )}

      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onEdit(template)}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <Edit3 style={{ width: 12, height: 12 }} />
        Editar mensagem
      </button>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.cancelled;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      {status === 'pending'   && <Clock style={{ width: 9, height: 9 }} />}
      {status === 'approved'  && <CheckCircle style={{ width: 9, height: 9 }} />}
      {status === 'sent'      && <Send style={{ width: 9, height: 9 }} />}
      {status === 'failed'    && <XCircle style={{ width: 9, height: 9 }} />}
      {status === 'cancelled' && <X style={{ width: 9, height: 9 }} />}
      {status === 'expired'   && <AlertTriangle style={{ width: 9, height: 9 }} />}
      {cfg.label}
    </span>
  );
}

// ─── Queue Item ───────────────────────────────────────────────

function QueueItem({ item, onApprove, onDiscard }) {
  const [acting, setActing] = useState(null); // 'approve' | 'discard'
  const clientName = item.client_name || item.nome_cliente || item.patient_name || '—';
  const phone = item.phone || item.telefone || item.phone_number || '—';
  const toolName = item.tool_name || item.ferramenta || `Ferramenta ${item.tool_id}`;
  const msgPreview = (item.message_text || item.body || item.mensagem || '').slice(0, 100);

  const handleApprove = async () => {
    setActing('approve');
    await onApprove(item.id);
    setActing(null);
  };
  const handleDiscard = async () => {
    setActing('discard');
    await onDiscard(item.id);
    setActing(null);
  };

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 10,
      border: '1px solid var(--border-color)',
      borderLeft: `4px solid ${STATUS_CONFIG[item.status]?.color || '#BDC3C7'}`,
      padding: '14px 16px', marginBottom: 8,
      display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-dark)' }}>{clientName}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{phone}</span>
          <StatusBadge status={item.status} />
        </div>
        <div style={{ fontSize: 11, color: '#6C63FF', fontWeight: 600, marginBottom: 4 }}>
          ⚙ {toolName}
        </div>
        {msgPreview && (
          <div style={{ fontSize: 12, color: 'var(--text-medium)', lineHeight: 1.5, fontStyle: 'italic' }}>
            "{msgPreview}{(item.message_text || item.body || '').length > 100 ? '...' : ''}"
          </div>
        )}
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          Agendado para: {fmtDatetime(item.scheduled_at)}
        </div>
      </div>

      {item.status === 'pending' && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          <button
            className="btn btn-sm"
            onClick={handleApprove}
            disabled={!!acting}
            style={{ background: '#27AE60', color: '#fff', borderColor: '#27AE60', fontSize: 11, padding: '5px 10px' }}
          >
            {acting === 'approve'
              ? <Loader2 style={{ width: 11, height: 11, animation: 'spin 1s linear infinite' }} />
              : <CheckCircle style={{ width: 11, height: 11 }} />
            }
            Aprovar
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDiscard}
            disabled={!!acting}
            style={{ fontSize: 11, padding: '5px 10px', color: '#E74C3C' }}
          >
            {acting === 'discard'
              ? <Loader2 style={{ width: 11, height: 11, animation: 'spin 1s linear infinite' }} />
              : <X style={{ width: 11, height: 11 }} />
            }
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── History Group (by tool/queue) ───────────────────────────

function HistoryGroup({ toolName, items }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const sent = items.filter(i => i.status === 'sent').length;
  const failed = items.filter(i => i.status === 'failed').length;
  const cancelled = items.filter(i => i.status === 'cancelled').length;

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 10,
      border: '1px solid var(--border-color)', marginBottom: 8, overflow: 'hidden',
    }}>
      {/* Group Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: '#6C63FF18',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <MessageSquare style={{ width: 15, height: 15, color: '#6C63FF' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-dark)' }}>{toolName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {items.length} mensagem{items.length !== 1 ? 's' : ''} · {' '}
            <span style={{ color: '#27AE60' }}>{sent} enviada{sent !== 1 ? 's' : ''}</span>
            {failed > 0 && <> · <span style={{ color: '#E74C3C' }}>{failed} falha{failed !== 1 ? 's' : ''}</span></>}
            {cancelled > 0 && <> · <span style={{ color: '#95A5A6' }}>{cancelled} cancelada{cancelled !== 1 ? 's' : ''}</span></>}
          </div>
        </div>
        {expanded
          ? <ChevronDown style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
          : <ChevronRight style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
        }
      </button>

      {/* Table */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-light)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-main)' }}>
                <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Data/Hora</th>
                <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Cliente</th>
                <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Status</th>
                <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const clientName = item.client_name || item.nome_cliente || item.patient_name || '—';
                const fullMsg = item.message_text || item.body || item.mensagem || '';
                const isExpanded = expandedRow === item.id;
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderTop: '1px solid var(--border-light)',
                      cursor: fullMsg ? 'pointer' : 'default',
                      background: isExpanded ? 'var(--bg-main)' : 'transparent',
                    }}
                    onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                  >
                    <td style={{ padding: '8px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {fmtDatetime(item.updated_at || item.sent_at)}
                    </td>
                    <td style={{ padding: '8px 14px', fontWeight: 600, color: 'var(--text-dark)' }}>
                      {clientName}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <StatusBadge status={item.status} />
                    </td>
                    <td style={{ padding: '8px 14px', color: 'var(--text-medium)' }}>
                      {isExpanded ? (
                        <div style={{ lineHeight: 1.6, fontStyle: 'italic', maxWidth: 400 }}>
                          "{fullMsg}"
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          {fullMsg ? fullMsg.slice(0, 60) + (fullMsg.length > 60 ? '...' : '') : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Aba Ferramentas ──────────────────────────────────────────

function AbaFerramentas() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTemplate, setEditTemplate] = useState(null);
  const [filter, setFilter] = useState('todos'); // 'todos' | 'ativos' | 'A' | 'B'

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await fetchTemplates();
    setTemplates(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (toolId, active) => {
    const { data } = await toggleTemplate(toolId, active);
    if (data) setTemplates(prev => prev.map(t => t.tool_id === toolId ? data : t));
  };

  const handleSaved = (updated) => {
    setTemplates(prev => prev.map(t => t.tool_id === updated.tool_id ? updated : t));
  };

  const filtered = templates.filter(t => {
    if (filter === 'ativos') return t.active;
    if (filter === 'A') return t.group_type === 'A';
    if (filter === 'B') return t.group_type === 'B';
    return true;
  });

  const activeCount = templates.filter(t => t.active).length;
  const groupA = templates.filter(t => t.group_type === 'A').length;
  const groupB = templates.filter(t => t.group_type === 'B').length;

  return (
    <div>
      {editTemplate && (
        <EditTemplateModal
          template={editTemplate}
          onClose={() => setEditTemplate(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', val: templates.length, color: 'var(--text-dark)' },
          { label: 'Ativas', val: activeCount, color: '#27AE60' },
          { label: 'Automáticas (A)', val: groupA, color: '#27AE60' },
          { label: 'Revisão humana (B)', val: groupB, color: '#F39C12' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, minWidth: 120,
            background: 'var(--bg-card)', borderRadius: 10, padding: '12px 16px',
            border: '1px solid var(--border-color)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { key: 'todos', label: 'Todas' },
          { key: 'ativos', label: 'Ativas' },
          { key: 'A', label: '⚡ Automático' },
          { key: 'B', label: '👁 Revisão humana' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: '1px solid',
              borderColor: filter === f.key ? 'var(--color-primary)' : 'var(--border-color)',
              background: filter === f.key ? 'var(--color-primary)' : 'none',
              color: filter === f.key ? '#fff' : 'var(--text-medium)',
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={load}
          style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          title="Recarregar"
        >
          <RefreshCw style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Loader2 style={{ width: 32, height: 32, animation: 'spin 1s linear infinite', color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando ferramentas...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 13 }}>
          Nenhuma ferramenta encontrada.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map(t => (
            <ToolCard
              key={t.tool_id}
              template={t}
              onToggle={handleToggle}
              onEdit={setEditTemplate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Aba Fila ─────────────────────────────────────────────────

function AbaFila() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('todos');
  const channelRef = useRef(null);

  const load = useCallback(async (status) => {
    setLoading(true);
    const { data } = await fetchQueue(status === 'todos' ? null : status);
    setQueue(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(filterStatus);
  }, [filterStatus, load]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('motor-queue-' + Date.now())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'marketing_queue',
      }, (payload) => {
        const newItem = payload.new;
        if (!newItem) return;
        if (payload.eventType === 'INSERT') {
          setQueue(prev => {
            const exists = prev.find(i => i.id === newItem.id);
            if (exists) return prev;
            return [newItem, ...prev].sort((a, b) =>
              new Date(a.scheduled_at) - new Date(b.scheduled_at)
            );
          });
        } else if (payload.eventType === 'UPDATE') {
          setQueue(prev => prev.map(i => i.id === newItem.id ? newItem : i));
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, []);

  const handleApprove = async (id) => {
    const { data } = await approveMessage(id);
    if (data) setQueue(prev => prev.map(i => i.id === id ? data : i));
  };

  const handleDiscard = async (id) => {
    const { data } = await discardMessage(id);
    if (data) setQueue(prev => prev.map(i => i.id === id ? data : i));
  };

  const FILTERS = [
    { key: 'todos', label: 'Todos' },
    { key: 'pending', label: 'Pendentes' },
    { key: 'approved', label: 'Aprovados' },
    { key: 'sent', label: 'Enviados' },
    { key: 'cancelled', label: 'Cancelados' },
  ];

  const filtered = filterStatus === 'todos'
    ? queue
    : queue.filter(i => i.status === filterStatus);

  const pendingCount = queue.filter(i => i.status === 'pending').length;

  return (
    <div>
      {/* Realtime indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span className="sync-dot sync-dot-green" style={{ width: 8, height: 8, borderRadius: '50%', background: '#27AE60', display: 'inline-block' }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Atualização em tempo real ativa</span>
        {pendingCount > 0 && (
          <span style={{
            marginLeft: 8, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
            background: '#FFF8E1', color: '#F39C12', border: '1px solid #FFD966',
          }}>
            <Bell style={{ width: 10, height: 10 }} /> {pendingCount} aguardando aprovação
          </span>
        )}
        <button onClick={() => load(filterStatus)} style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <RefreshCw style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border-color)' }}>
        {FILTERS.map(f => {
          const cnt = f.key === 'todos' ? queue.length : queue.filter(i => i.status === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              style={{
                padding: '8px 16px', fontSize: 12, fontWeight: 600,
                background: 'none', border: 'none',
                borderBottom: filterStatus === f.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: filterStatus === f.key ? 'var(--text-dark)' : 'var(--text-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {f.label}
              {cnt > 0 && (
                <span style={{
                  padding: '1px 6px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                  background: f.key === 'pending' ? '#FFF8E1' : 'var(--bg-main)',
                  color: f.key === 'pending' ? '#F39C12' : 'var(--text-muted)',
                }}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Loader2 style={{ width: 32, height: 32, animation: 'spin 1s linear infinite', color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando fila...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <CheckSquare style={{ width: 40, height: 40, color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma mensagem nesta categoria.</p>
        </div>
      ) : (
        <div>
          {filtered.map(item => (
            <QueueItem
              key={item.id}
              item={item}
              onApprove={handleApprove}
              onDiscard={handleDiscard}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Aba Histórico ────────────────────────────────────────────

function AbaHistorico() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await fetchQueueHistory();
    setHistory(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Totalizadores
  const today = history.filter(i => i.status === 'sent' && isToday(i.updated_at || i.sent_at));
  const thisMonth = history.filter(i => i.status === 'sent' && isThisMonth(i.updated_at || i.sent_at));
  const failed = history.filter(i => i.status === 'failed');
  const cancelled = history.filter(i => i.status === 'cancelled');

  // Agrupar por ferramenta (tool_name)
  const groups = {};
  history.forEach(item => {
    const key = item.tool_name || item.ferramenta || (item.tool_id ? `Ferramenta ${item.tool_id}` : 'Sem ferramenta');
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  const sortedGroups = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

  return (
    <div>
      {/* Totalizadores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Enviados hoje', val: today.length, color: '#27AE60', bg: '#EAFAF1', icon: Send },
          { label: 'Enviados no mês', val: thisMonth.length, color: '#3498DB', bg: '#EBF5FB', icon: TrendingUp },
          { label: 'Falharam', val: failed.length, color: '#E74C3C', bg: '#FDEDEC', icon: XCircle },
          { label: 'Cancelados', val: cancelled.length, color: '#95A5A6', bg: '#F4F6F7', icon: X },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{
              background: s.bg, borderRadius: 10, padding: '14px 16px',
              border: `1px solid ${s.color}30`, textAlign: 'center',
            }}>
              <Icon style={{ width: 20, height: 20, color: s.color, margin: '0 auto 6px', display: 'block' }} />
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, color: s.color, fontWeight: 600, opacity: 0.8 }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Reload */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>
          Histórico por Fila
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          ({sortedGroups.length} fila{sortedGroups.length !== 1 ? 's' : ''} · {history.length} mensagens)
        </span>
        <button
          onClick={load}
          style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <RefreshCw style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Loader2 style={{ width: 32, height: 32, animation: 'spin 1s linear infinite', color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando histórico...</p>
        </div>
      ) : sortedGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 13 }}>
          Nenhum histórico ainda. As mensagens enviadas aparecerão aqui.
        </div>
      ) : (
        sortedGroups.map(([toolName, items]) => (
          <HistoryGroup key={toolName} toolName={toolName} items={items} />
        ))
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function MotorMarketing() {
  const [activeTab, setActiveTab] = useState('ferramentas');
  const [pendingCount, setPendingCount] = useState(0);

  // Poll pending count for header badge
  useEffect(() => {
    const fetchCount = async () => {
      const { data } = await import('../services/supabaseService').then(m =>
        m.fetchQueuePendingCount()
      );
      setPendingCount(data || 0);
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Realtime pending count update
  useEffect(() => {
    const channel = supabase
      .channel('motor-pending-count-' + Date.now())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'marketing_queue',
      }, async () => {
        const { fetchQueuePendingCount } = await import('../services/supabaseService');
        const { data } = await fetchQueuePendingCount();
        setPendingCount(data || 0);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const TABS = [
    { key: 'ferramentas', label: 'Ferramentas', icon: Zap },
    { key: 'fila', label: 'Fila de Mensagens', icon: MessageSquare, badge: pendingCount },
    { key: 'historico', label: 'Histórico', icon: TrendingUp },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-header-label">
            <Zap style={{ width: 14, height: 14 }} />
            MOTOR DE MARKETING
          </div>
          <h1 className="page-title">Motor de Marketing</h1>
          <p className="page-subtitle">Gerencie as 19 ferramentas automáticas de envio de mensagens via WhatsApp</p>
        </div>
        {pendingCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#FFF8E1', border: '1px solid #FFD966',
            borderRadius: 10, padding: '10px 16px',
          }}>
            <Bell style={{ width: 16, height: 16, color: '#F39C12' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#8B6914' }}>
                {pendingCount} mensagem{pendingCount !== 1 ? 's' : ''} aguardando
              </div>
              <div style={{ fontSize: 11, color: '#A0880F' }}>Clique em "Fila de Mensagens"</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '10px 20px', fontSize: 13, fontWeight: 600,
                  color: activeTab === tab.key ? 'var(--text-dark)' : 'var(--text-muted)',
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                  transition: 'all 0.15s',
                }}
              >
                <Icon style={{ width: 14, height: 14 }} />
                {tab.label}
                {tab.badge > 0 && (
                  <span style={{
                    padding: '1px 6px', borderRadius: 99, fontSize: 10, fontWeight: 800,
                    background: '#F39C12', color: '#fff', minWidth: 18, textAlign: 'center',
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'ferramentas' && <AbaFerramentas />}
      {activeTab === 'fila' && <AbaFila />}
      {activeTab === 'historico' && <AbaHistorico />}
    </div>
  );
}
