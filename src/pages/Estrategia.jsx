import { useState, useEffect, useCallback } from 'react';
import {
  Target, ChevronRight, RefreshCw, StickyNote, TrendingUp,
  CheckCircle2, AlertTriangle, Clock, ArrowRight, XCircle, Plus,
} from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUser } from '../lib/supabase';
import * as okrService from '../services/okrService';

// ─── Seed Data ──────────────────────────────────────────────
const SEED_CICLO = {
  id: 'ciclo_jun2025', nome: 'Junho 2025',
  data_inicio: '2025-06-01', data_fim: '2025-06-30', status: 'ativo',
  dia_atual: 15, total_dias: 30,
};

const SEED_OBJETIVOS = [
  {
    id: 'obj_1', ciclo_id: 'ciclo_jun2025',
    titulo: 'Aumentar Faturamento Mensal para R$68.000',
    subtitulo: 'Dinheiro: Cenário – 3 dias Restantes',
    progresso: 100, status: 'concluido',
    detail: '14/8 dias crítica – aviso imediato e reavaliar',
  },
  {
    id: 'obj_2', ciclo_id: 'ciclo_jun2025',
    titulo: 'Fazer 15 novos pacotes premium',
    progresso: 100, status: 'concluido',
    detail: '15/15 concluídos',
  },
  {
    id: 'obj_3', ciclo_id: 'ciclo_jun2025',
    titulo: 'E-LEAD',
    progresso: null, status: null,
    detail: null,
    is_section: true,
    tasks: [
      { id: 't1', titulo: 'Jogar na lista de leads quentes', status: 'em_andamento' },
      { id: 't2', titulo: 'Enviar proposta para Studio Bello', status: 'em_andamento' },
      { id: 't3', titulo: 'Negociar upgrade com pacientes atuais', status: 'concluido' },
    ],
  },
  {
    id: 'obj_4', ciclo_id: 'ciclo_jun2025',
    titulo: 'Autenticar ticket médio para R$280',
    progresso: 50, status: 'nao_iniciado',
    detail: '213 tickets no mês',
  },
  {
    id: 'obj_5', ciclo_id: 'ciclo_jun2025',
    titulo: 'Reduzir cancelamentos para menos de 5%',
    progresso: 50, status: 'nao_iniciado',
    detail: '138 cancelamentos',
  },
  {
    id: 'obj_6', ciclo_id: 'ciclo_jun2025',
    titulo: 'Expandir Base de Pacientes em 25%',
    subtitulo: 'Dinheiro: Garantido – 3 Dias Restantes',
    progresso: 40, status: 'em_progresso',
    detail: null,
  },
  {
    id: 'obj_7', ciclo_id: 'ciclo_jun2025',
    titulo: 'Elevar Satisfação e Retenção de Pacientes',
    progresso: 30, status: 'atrasado',
    detail: null,
  },
];

const SEED_KPI = {
  mensal_anual: { valor: '39%', label: 'Mensal / Anual', sub: '48.562 seguidores, +2070' },
  tarefas_mes:  { valor: '12/31', label: 'Tarefas do Mês', sub: 'Concluídas' },
  fila_aviso:   { valor: '4/7', label: 'Fila de Aviso', sub: '+ mais agendados' },
  criticos:     { valor: '2', label: 'Apenas Críticos', sub: 'dias com 60% ou mais' },
};

const SEED_PROJECAO = {
  percentual: 77,
  texto: 'Se manter nesse ritmo, você atinge 77% da meta até o final do mês',
  nota: '10 pacientes, 10 consultas – 16 novos pacientes',
};

const SEED_ACOES = [
  { id: 'a1', titulo: 'Fechar 10 novos pacientes premium', progresso: 10 },
  { id: 'a2', titulo: 'Agendar 50 consultas', progresso: 25 },
];

// ─── Status helpers ─────────────────────────────────────────
const STATUS_CONFIG = {
  concluido:    { label: 'concluído',    color: '#10B981', bg: '#ECFDF5', icon: CheckCircle2 },
  em_andamento: { label: 'em andamento', color: '#3B82F6', bg: '#EFF6FF', icon: Clock },
  em_progresso: { label: 'em progresso', color: '#3B82F6', bg: '#EFF6FF', icon: ArrowRight },
  nao_iniciado: { label: 'não iniciado', color: '#6B9B7A', bg: '#EFF7F2', icon: Clock },
  atrasado:     { label: 'atrasado',     color: '#EF4444', bg: '#FEF2F2', icon: AlertTriangle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, color: cfg.color,
      background: cfg.bg, padding: '3px 10px', borderRadius: 99,
      whiteSpace: 'nowrap',
    }}>
      <Icon style={{ width: 11, height: 11 }} />
      {cfg.label}
    </span>
  );
}

function ProgressBar({ percent, color = '#10B981' }) {
  const p = Math.min(100, Math.max(0, percent || 0));
  return (
    <div style={{ height: 6, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${p}%`, background: color, borderRadius: 99, transition: 'width 0.3s' }} />
    </div>
  );
}

// ─── Note Modal ─────────────────────────────────────────────
function NoteModal({ onClose, notes, onAdd, onRemove }) {
  const [text, setText] = useState('');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StickyNote style={{ width: 16, height: 16, color: '#F59E0B' }} />
            Anotações
          </span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="form-input" placeholder="Nova anotação..."
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { onAdd(text.trim()); setText(''); } }}
          />
          <button className="btn btn-primary btn-sm" onClick={() => { if (text.trim()) { onAdd(text.trim()); setText(''); } }}>
            <Plus style={{ width: 12, height: 12 }} />Add
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {notes.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma anotação</div>}
          {notes.map((n, i) => (
            <div key={n.id || i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              background: '#FEF9C3', borderRadius: 8, borderLeft: '3px solid #F59E0B',
            }}>
              <span style={{ flex: 1, fontSize: 13, color: '#1F2937' }}>{n.texto}</span>
              <button onClick={() => onRemove(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <XCircle style={{ width: 13, height: 13, color: '#9CA3AF' }} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Supabase seed/load helpers ─────────────────────────────
async function seedSupabase() {
  if (!isSupabaseConfigured()) return;
  try {
    const { data: ciclos } = await okrService.fetchCiclos();
    if (!ciclos || ciclos.length === 0) {
      const user = await getCurrentUser();
      const cicloPayload = { ...SEED_CICLO, user_id: user?.id };
      await okrService.insertCiclo(cicloPayload);
      for (const obj of SEED_OBJETIVOS) {
        await okrService.insertObjetivo({ ...obj, user_id: user?.id });
      }
    }
  } catch (e) {
    console.warn('[Estrategia] seed error', e);
  }
}

// ─── Main Component ─────────────────────────────────────────
export default function Estrategia() {
  const [ciclos, setCiclos] = useState([]);
  const [objetivos, setObjetivos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activeCicloId, setActiveCicloId] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      await seedSupabase();
      const [ciclosRes, objRes, notesRes] = await Promise.all([
        okrService.fetchCiclos(),
        okrService.fetchObjetivos(activeCicloId),
        okrService.fetchStickyNotes(),
      ]);
      if (ciclosRes.data) {
        setCiclos(ciclosRes.data);
        if (ciclosRes.data.length > 0 && !activeCicloId) {
          setActiveCicloId(ciclosRes.data[0].id);
        }
      }
      if (objRes.data) setObjetivos(objRes.data);
      if (notesRes.data) setNotes(notesRes.data);
    } catch (e) { console.warn('[Estrategia] load error', e); }
    setLoading(false);
  }, [activeCicloId]);

  useEffect(() => { loadFromSupabase(); }, [loadFromSupabase]);

  const activeObjetivos = objetivos.filter(o => o.ciclo_id === activeCicloId || !activeCicloId);
  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const diaAtual = activeCiclo?.dia_atual || 15;
  const totalDias = activeCiclo?.total_dias || 30;
  const diasRestantes = totalDias - diaAtual;

  const kpi = SEED_KPI;

  const allProgress = activeObjetivos.filter(o => o.progresso !== null && o.progresso !== undefined).map(o => o.progresso);
  const projPercent = allProgress.length > 0 ? Math.round(allProgress.reduce((a, b) => a + b, 0) / allProgress.length) : SEED_PROJECAO.percentual;

  const addNote = async (texto) => {
    if (!isSupabaseConfigured()) return;
    const user = await getCurrentUser();
    const note = {
      id: 'n_' + Date.now(),
      texto,
      prioridade: 'medio',
      source: 'estrategia',
      auto_generated: false,
      dismissed: false,
      ordem: notes.length,
      user_id: user?.id,
    };
    const { data, error } = await okrService.insertStickyNote(note);
    if (!error && data) {
      setNotes(prev => [...prev, data]);
    }
  };

  const removeNote = async (id) => {
    if (!isSupabaseConfigured()) return;
    const { error } = await okrService.dismissStickyNote(id);
    if (!error) {
      setNotes(prev => prev.filter(n => n.id !== id));
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div className="page-header-label"><Target />ESTRATÉGIA 2025</div>
          <h1 className="page-title">Junho 2025</h1>
          <p className="page-subtitle">
            Dia {diaAtual} de {totalDias} – {diasRestantes} dias restantes
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={activeCicloId}
            onChange={e => setActiveCicloId(e.target.value)}
            className="form-select"
            style={{ minWidth: 180, fontSize: 12, padding: '8px 12px' }}
          >
            {ciclos.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={loadFromSupabase} title="Recarregar">
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={() => setShowNoteModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#F3F4F6', border: '1px solid var(--border-color)',
              borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: '#D4956A',
            }}
          >
            <StickyNote style={{ width: 13, height: 13 }} />
            Anotação
            {notes.length > 0 && (
              <span style={{ background: '#D4956A', color: '#fff', borderRadius: 99, width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                {notes.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {showNoteModal && (
        <NoteModal onClose={() => setShowNoteModal(false)} notes={notes} onAdd={addNote} onRemove={removeNote} />
      )}

      {/* KPI Summary Cards */}
      <div className="grid-4 section-gap">
        {[
          { ...kpi.mensal_anual, cor: '#432F2D', icon: TrendingUp, bgIcon: '#F3E5E2' },
          { ...kpi.tarefas_mes,  cor: '#432F2D', icon: Target, bgIcon: '#EFF7F2' },
          { ...kpi.fila_aviso,   cor: '#432F2D', icon: Clock, bgIcon: '#EEF3FA' },
          { ...kpi.criticos,     cor: '#EF4444', icon: AlertTriangle, bgIcon: '#FEF2F2' },
        ].map(({ label, valor, sub, cor, icon: Icon, bgIcon }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-icon" style={{ background: bgIcon, marginBottom: 8 }}>
              <Icon style={{ color: cor }} />
            </div>
            <div className="stat-value" style={{ color: cor, fontSize: 28 }}>{valor}</div>
            <div className="stat-label">{label}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Objectives List */}
      <div className="section-gap">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <RefreshCw style={{ width: 20, height: 20, className: 'animate-spin' }} /> Carregando...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {activeObjetivos.map((obj) => {
              // Section header (E-LEAD)
              if (obj.is_section) {
                return (
                  <div key={obj.id} style={{ marginTop: 4, marginBottom: 4 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 800, color: '#9CA3AF',
                      textTransform: 'uppercase', letterSpacing: 1,
                      padding: '10px 0 6px', borderBottom: '1px solid var(--border-color)',
                    }}>
                      {obj.titulo}
                    </div>
                    {(obj.tasks || []).map(task => (
                      <div key={task.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', borderBottom: '1px solid #F3F4F6',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_CONFIG[task.status]?.color || '#9CA3AF' }} />
                          <span style={{ fontSize: 13, color: 'var(--text-dark)', fontWeight: 500 }}>{task.titulo}</span>
                        </div>
                        <StatusBadge status={task.status} />
                      </div>
                    ))}
                    <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
                  </div>
                );
              }

              const cfg = STATUS_CONFIG[obj.status];
              const statusColor = cfg?.color || '#10B981';

              return (
                <div key={obj.id} className="card" style={{ marginBottom: 10, padding: '16px 20px' }}>
                  {/* Title row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', lineHeight: 1.3 }}>
                        {obj.titulo}
                      </div>
                      {obj.subtitulo && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{obj.subtitulo}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {obj.progresso !== null && obj.progresso !== undefined && (
                        <span style={{ fontSize: 18, fontWeight: 800, color: statusColor }}>
                          {obj.progresso}%
                        </span>
                      )}
                      <StatusBadge status={obj.status} />
                    </div>
                  </div>

                  {/* Progress bar + detail */}
                  {obj.progresso !== null && obj.progresso !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <ProgressBar percent={obj.progresso} color={statusColor} />
                      {obj.detail && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{obj.detail}</span>
                      )}
                    </div>
                  )}

                  {/* Detail only (no bar) */}
                  {(obj.progresso === null || obj.progresso === undefined) && obj.detail && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{obj.detail}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Section: Projeção & Insights */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="section-gap">
        {/* Projeção de Conclusão */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{
            fontSize: 10, fontWeight: 800, color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
          }}>
            Projeção de Conclusão
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
            <span style={{ fontSize: 48, fontWeight: 800, color: 'var(--text-dark)', lineHeight: 1 }}>
              {projPercent}%
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5, margin: '10px 0 0' }}>
            {SEED_PROJECAO.texto.replace('77', String(projPercent))}
          </p>
          <div style={{
            marginTop: 12, padding: '8px 12px', background: '#F3F4F6',
            borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 500,
          }}>
            {SEED_PROJECAO.nota}
          </div>
        </div>

        {/* Ações Próximas */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{
            fontSize: 10, fontWeight: 800, color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
          }}>
            Ações Próximas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SEED_ACOES.map((acao, i) => (
              <div key={acao.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: '#FAFAFA',
                borderRadius: 10, border: '1px solid #F3F4F6',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--color-accent-soft)', color: 'var(--color-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dark)' }}>{acao.titulo}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 50, height: 5, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${acao.progresso}%`, background: 'var(--color-primary)', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', minWidth: 28, textAlign: 'right' }}>
                    {acao.progresso}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
