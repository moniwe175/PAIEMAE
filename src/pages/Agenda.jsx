import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Star, XCircle, CheckCircle,
  Clock, User, Scissors, AlertCircle, Calendar, UserPlus,
  Trash2, Edit3, Phone, DollarSign, TrendingUp,
  CalendarCheck, Grid, List, CheckSquare, X,
  Ban, Coffee, UtensilsCrossed, Lock, AlertTriangle,
} from 'lucide-react';
import { useProfissionais } from '../lib/profissionais';

// ─── Constants ───────────────────────────────────────────────

const SLOT_HEIGHT = 48; // px por hora — compacto como na imagem
const HOUR_START = 7;
const HOUR_END = 20;
const PX_PER_MIN = SLOT_HEIGHT / 60;

const HORARIOS_SUGERIDOS = [];
for (let h = HOUR_START; h <= HOUR_END; h++) {
  HORARIOS_SUGERIDOS.push(`${String(h).padStart(2,'0')}:00`);
  if (h < HOUR_END) HORARIOS_SUGERIDOS.push(`${String(h).padStart(2,'0')}:30`);
}

const STATUS_CONFIG = {
  aguardando:     { label: 'Aguardando',     bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B', border: '#FDE68A' },
  confirmado:     { label: 'Confirmado',     bg: '#D1FAE5', color: '#065F46', dot: '#10B981', border: '#A7F3D0' },
  em_atendimento: { label: 'Em Atendimento', bg: '#DBEAFE', color: '#1E40AF', dot: '#3B82F6', border: '#BFDBFE' },
  concluido:      { label: 'Concluído',      bg: '#E0E7FF', color: '#3730A3', dot: '#6366F1', border: '#C7D2FE' },
  cancelado:      { label: 'Cancelado',      bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444', border: '#FECACA' },
  falta:          { label: 'Falta',          bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF', border: '#E5E7EB' },
};

// ─── Bloqueios config ─────────────────────────────────────────
const BLOQUEIO_TIPOS = {
  almoco:         { label: 'Almoço',            icon: UtensilsCrossed, bg: '#D1D5DB', color: '#374151', border: '#9CA3AF', stripe: true },
  pausa:          { label: 'Pausa',              icon: Coffee,          bg: '#E0E7FF', color: '#3730A3', border: '#A5B4FC', stripe: false },
  agenda_fechada: { label: 'Agenda Fechada',     icon: Lock,            bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5', stripe: true },
  ausencia:       { label: 'Ausência',           icon: Ban,             bg: '#D1D5DB', color: '#6B7280', border: '#9CA3AF', stripe: true },
  outro:          { label: 'Outro bloqueio',     icon: AlertTriangle,   bg: '#FEF3C7', color: '#92400E', border: '#FDE68A', stripe: false },
};

// ─── Storage keys ─────────────────────────────────────────────
const AGENDA_KEY    = 'erp_agenda_v3';
const BLOQUEIOS_KEY = 'erp_bloqueios_v1';
const PACIENTES_KEY = 'erp_pacientes';

// ─── Helpers ──────────────────────────────────────────────────
function timeToMinutes(time) {
  const [h, m] = (time || '00:00').split(':').map(Number);
  return h * 60 + m;
}
function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function calcEndTime(hora, duracao) {
  return minutesToTime(timeToMinutes(hora) + (Number(duracao) || 60));
}
function fmtDate(d) {
  return d.toISOString().split('T')[0];
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
function genId() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// ─── Overlap layout algorithm ─────────────────────────────────
// Retorna para cada item: { col, totalCols }
function computeColumns(items) {
  // items: [{ id, startMin, endMin }]
  const result = {};
  const slots = []; // [{ endMin, col }]
  // Ordena por startMin
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  for (const item of sorted) {
    // Encontra grupos que se sobrepõem
    let assignedCol = 0;
    const busyCols = new Set();
    for (const slot of slots) {
      if (slot.endMin > item.startMin) busyCols.add(slot.col);
    }
    while (busyCols.has(assignedCol)) assignedCol++;
    slots.push({ endMin: item.endMin, col: assignedCol });
    result[item.id] = { col: assignedCol };
  }
  // Calcula totalCols por grupo de sobreposição
  // Re-percorre e para cada item calcula quantas colunas no grupo
  for (const item of sorted) {
    let max = result[item.id].col;
    for (const other of sorted) {
      if (other.id !== item.id && other.startMin < item.endMin && other.endMin > item.startMin) {
        max = Math.max(max, result[other.id].col);
      }
    }
    result[item.id].totalCols = max + 1;
  }
  return result;
}

// ─── Load agendamentos ────────────────────────────────────────
function loadAgendamentos() {
  try {
    const raw = localStorage.getItem(AGENDA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  const hoje = new Date();
  const seed = [
    { id:'apt_d1', data:fmtDate(hoje), hora:'09:00', horaFim:'10:00', duracao:60, paciente:'Fernanda Lima', telefone:'(11) 98765-4321', profissional:'Bárbara', servico:'Limpeza de Pele', status:'confirmado', valor:180, observacoes:'' },
    { id:'apt_d2', data:fmtDate(hoje), hora:'10:00', horaFim:'11:00', duracao:60, paciente:'Carla Mendes', telefone:'(11) 91234-5678', profissional:'Evelyn', servico:'Harmonização Facial', status:'aguardando', valor:450, observacoes:'' },
    { id:'apt_d3', data:fmtDate(hoje), hora:'09:22', horaFim:'10:22', duracao:60, paciente:'Marina Silva', telefone:'', profissional:'Bárbara', servico:'Peeling Químico', status:'aguardando', valor:220, observacoes:'' },
    { id:'apt_d4', data:fmtDate(hoje), hora:'14:00', horaFim:'15:00', duracao:60, paciente:'Ana Beatriz', telefone:'(11) 99876-5432', profissional:'Bárbara', servico:'Drenagem Linfática', status:'aguardando', valor:150, observacoes:'' },
  ];
  localStorage.setItem(AGENDA_KEY, JSON.stringify(seed));
  return seed;
}
function saveAgendamentos(list) { localStorage.setItem(AGENDA_KEY, JSON.stringify(list)); }

// ─── Load bloqueios ───────────────────────────────────────────
function loadBloqueios() {
  try {
    const raw = localStorage.getItem(BLOQUEIOS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  const hoje = new Date();
  const seed = [
    { id:'blq_d1', data:fmtDate(hoje), hora:'12:00', horaFim:'13:00', duracao:60, tipo:'almoco', profissional:'Bárbara', observacoes:'Almoço' },
    { id:'blq_d2', data:fmtDate(hoje), hora:'11:30', horaFim:'18:00', duracao:390, tipo:'ausencia', profissional:'Evelyn', observacoes:'Ausência' },
  ];
  localStorage.setItem(BLOQUEIOS_KEY, JSON.stringify(seed));
  return seed;
}
function saveBloqueios(list) { localStorage.setItem(BLOQUEIOS_KEY, JSON.stringify(list)); }

// ─── Pacientes ────────────────────────────────────────────────
const DEFAULT_PACIENTES = [
  { nome: 'Fernanda Lima',  telefone: '(11) 98765-4321', email: 'fernanda@email.com' },
  { nome: 'Carla Mendes',   telefone: '(11) 91234-5678', email: 'carla@email.com' },
  { nome: 'Ana Beatriz',    telefone: '(11) 99876-5432', email: 'ana@email.com' },
  { nome: 'Juliana Costa',  telefone: '(11) 94567-8901', email: '' },
  { nome: 'Marina Silva',   telefone: '', email: '' },
  { nome: 'Patrícia Rocha', telefone: '(11) 93456-7890', email: '' },
];
function loadPacientes() {
  try {
    const raw = localStorage.getItem(PACIENTES_KEY);
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p) && p.length > 0) return p; }
  } catch (e) {}
  localStorage.setItem(PACIENTES_KEY, JSON.stringify(DEFAULT_PACIENTES));
  return [...DEFAULT_PACIENTES];
}
function savePacientes(list) { localStorage.setItem(PACIENTES_KEY, JSON.stringify(list)); }

function getWeekDays(date) {
  const d = new Date(date);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 6 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

// ═══════════════════════════════════════════════════════════════
// ─── MiniCalendar ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function MiniCalendar({ selectedDate, onSelect, agendamentos }) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();

  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const days = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));

  const monthLabel  = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const weekLabels  = ['D','S','T','Q','Q','S','S'];
  const daysWithApts = useMemo(() => {
    const s = new Set(); agendamentos.forEach(a => s.add(a.data)); return s;
  }, [agendamentos]);

  return (
    <div style={{ background:'#fff', borderRadius:16, padding:16, border:'1px solid #F0EBE6', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <button onClick={() => setViewDate(new Date(year, month-1, 1))} style={{ background:'none', border:'none', cursor:'pointer', padding:4, borderRadius:6, color:'#6B7280' }}>
          <ChevronLeft style={{ width:15, height:15 }} />
        </button>
        <span style={{ fontSize:12, fontWeight:700, textTransform:'capitalize', color:'#1F2937' }}>{monthLabel}</span>
        <button onClick={() => setViewDate(new Date(year, month+1, 1))} style={{ background:'none', border:'none', cursor:'pointer', padding:4, borderRadius:6, color:'#6B7280' }}>
          <ChevronRight style={{ width:15, height:15 }} />
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1, marginBottom:4 }}>
        {weekLabels.map((l,i) => <div key={i} style={{ textAlign:'center', fontSize:9, fontWeight:700, color:'#9CA3AF', padding:'2px 0' }}>{l}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1 }}>
        {days.map((d, i) => {
          if (!d) return <div key={i} />;
          const isToday    = sameDay(d, today);
          const isSelected = sameDay(d, selectedDate);
          const hasApt     = daysWithApts.has(fmtDate(d));
          return (
            <button key={i} onClick={() => onSelect(new Date(d))} style={{
              width:28, height:28, borderRadius:'50%', border:'none',
              cursor:'pointer', fontSize:11, position:'relative',
              fontWeight: isToday || isSelected ? 700 : 400,
              background: isToday ? '#C73B6D' : 'transparent',
              color: isToday ? '#fff' : isSelected ? '#C73B6D' : '#374151',
              outline: isSelected && !isToday ? '2px solid #C73B6D' : 'none',
              outlineOffset: -2, transition:'all 0.12s',
            }}>
              {d.getDate()}
              {hasApt && !isToday && (
                <span style={{ position:'absolute', bottom:2, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#C73B6D' }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── QuickClientModal ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function QuickClientModal({ onClose, onSave }) {
  const [nome, setNome]         = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail]       = useState('');
  const [erro, setErro]         = useState('');

  const handleSubmit = () => {
    if (!nome.trim()) { setErro('Nome obrigatório'); return; }
    onSave({ nome: nome.trim(), telefone, email });
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:11000, backdropFilter:'blur(4px)' }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:28, width:420, boxShadow:'0 24px 64px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#C73B6D,#9B2C50)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <UserPlus style={{ width:18, height:18, color:'#fff' }} />
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'#1F2937' }}>Cadastro Rápido</div>
            <div style={{ fontSize:12, color:'#9CA3AF' }}>Novo cliente</div>
          </div>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer' }}>
            <X style={{ width:20, height:20, color:'#9CA3AF' }} />
          </button>
        </div>
        {[
          { label:'Nome completo *', val:nome, set: v => { setNome(v); setErro(''); }, type:'text', placeholder:'Ex: Maria da Silva', err:erro },
          { label:'Telefone', val:telefone, set:setTelefone, type:'tel', placeholder:'(11) 99999-9999' },
          { label:'E-mail', val:email, set:setEmail, type:'email', placeholder:'email@exemplo.com' },
        ].map(({ label, val, set, type, placeholder, err }) => (
          <div key={label} style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>{label}</label>
            <input type={type} placeholder={placeholder} value={val} onChange={e => set(e.target.value)} autoFocus={label.includes('*')}
              style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${err ? '#EF4444' : '#E5E7EB'}`, borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' }} />
            {err && <div style={{ fontSize:11, color:'#EF4444', marginTop:3 }}>{err}</div>}
          </div>
        ))}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
          <button onClick={onClose} style={{ padding:'9px 18px', borderRadius:10, border:'1.5px solid #E5E7EB', background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', color:'#6B7280' }}>Cancelar</button>
          <button onClick={handleSubmit} style={{ padding:'9px 18px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#C73B6D,#A83158)', fontSize:13, fontWeight:700, cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', gap:6 }}>
            <CheckCircle style={{ width:15, height:15 }} /> Cadastrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── BloqueioModal ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function BloqueioModal({ onClose, date, profissional: prefillProf, hora: prefillHora, profissionais, bloqueio, onSave, onDelete }) {
  const isEdit = !!bloqueio;
  const [form, setForm] = useState(() => isEdit ? { ...bloqueio } : {
    data: fmtDate(date),
    hora: prefillHora || '12:00',
    horaFim: calcEndTime(prefillHora || '12:00', 60),
    duracao: 60,
    tipo: 'almoco',
    profissional: prefillProf || '',
    recorrente: false,
    diasSemana: [],
    observacoes: '',
  });

  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === 'hora' || k === 'duracao') {
      next.horaFim = calcEndTime(k === 'hora' ? v : f.hora, k === 'duracao' ? Number(v) : Number(f.duracao));
    }
    return next;
  });

  const inputSt = { width:'100%', padding:'9px 12px', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:13, outline:'none', boxSizing:'border-box', background:'#FAFAFA', fontFamily:'inherit' };
  const canSave = form.profissional && form.tipo && form.hora;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ ...form, id: bloqueio?.id || genId(), duracao: Number(form.duracao), horaFim: calcEndTime(form.hora, Number(form.duracao)) });
    onClose();
  };

  const tipoConfig = BLOQUEIO_TIPOS[form.tipo] || BLOQUEIO_TIPOS.outro;
  const TipoIcon = tipoConfig.icon;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,20,30,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000, backdropFilter:'blur(6px)', padding:16 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:22, width:'100%', maxWidth:500, boxShadow:'0 32px 80px rgba(0,0,0,0.25)', maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding:'22px 26px 18px', borderBottom:'1px solid #F0EBE6', background:'linear-gradient(135deg,#F9FAFB,#fff)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#6B7280,#374151)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Ban style={{ width:18, height:18, color:'#fff' }} />
              </div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#1F2937' }}>{isEdit ? 'Editar Bloqueio' : 'Novo Bloqueio'}</div>
                <div style={{ fontSize:12, color:'#9CA3AF' }}>Marcar período indisponível</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background:'#F3F4F6', border:'none', borderRadius:10, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <X style={{ width:16, height:16, color:'#6B7280' }} />
            </button>
          </div>
        </div>

        <div style={{ padding:'20px 26px 26px' }}>
          {/* Tipo */}
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#6B7280', display:'block', marginBottom:8 }}>Tipo de bloqueio</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {Object.entries(BLOQUEIO_TIPOS).map(([k, v]) => {
                const Icon = v.icon;
                const sel = form.tipo === k;
                return (
                  <button key={k} onClick={() => set('tipo', k)} type="button" style={{
                    display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10,
                    border:`1.5px solid ${sel ? v.border : '#E5E7EB'}`,
                    background: sel ? v.bg : '#fff',
                    cursor:'pointer', transition:'all 0.12s',
                  }}>
                    <Icon style={{ width:14, height:14, color: sel ? v.color : '#9CA3AF', flexShrink:0 }} />
                    <span style={{ fontSize:12, fontWeight:600, color: sel ? v.color : '#6B7280' }}>{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profissional */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#6B7280', display:'block', marginBottom:5 }}>Profissional *</label>
            <select value={form.profissional} onChange={e => set('profissional', e.target.value)} style={inputSt}>
              <option value="">Selecione...</option>
              {profissionais.map(p => <option key={p.nome} value={p.nome}>{p.nome} — {p.cargo}</option>)}
            </select>
          </div>

          {/* Data + Hora + Duração */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#6B7280', display:'block', marginBottom:5 }}>Data</label>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#6B7280', display:'block', marginBottom:5 }}>Início</label>
              <input list="bl-horarios" value={form.hora} onChange={e => set('hora', e.target.value)} style={inputSt} placeholder="00:00" />
              <datalist id="bl-horarios">{HORARIOS_SUGERIDOS.map(h => <option key={h} value={h} />)}</datalist>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#6B7280', display:'block', marginBottom:5 }}>Duração (min)</label>
              <select value={form.duracao} onChange={e => set('duracao', e.target.value)} style={inputSt}>
                {[15,20,30,45,60,90,120,180,240,300,360,480].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          {/* Término */}
          {form.hora && (
            <div style={{ marginBottom:14, padding:'7px 12px', borderRadius:10, background:'#F3F4F6', fontSize:12, color:'#374151', display:'flex', alignItems:'center', gap:6 }}>
              <Clock style={{ width:13, height:13, color:'#6B7280' }} />
              Bloqueado das <strong>{form.hora}</strong> às <strong>{form.horaFim}</strong>
            </div>
          )}

          {/* Observações */}
          <div style={{ marginBottom:22 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#6B7280', display:'block', marginBottom:5 }}>Observações / Motivo</label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder={tipoConfig.label}
              style={{ ...inputSt, minHeight:64, resize:'vertical' }} />
          </div>

          {/* Actions */}
          <div style={{ display:'flex', gap:8, paddingTop:16, borderTop:'1px solid #F0EBE6' }}>
            {isEdit && (
              <button onClick={() => { onDelete(bloqueio.id); onClose(); }} style={{ padding:'9px 14px', borderRadius:10, border:'1.5px solid #FCA5A5', background:'#FFF5F5', fontSize:13, fontWeight:600, cursor:'pointer', color:'#EF4444', display:'flex', alignItems:'center', gap:6 }}>
                <Trash2 style={{ width:14, height:14 }} /> Excluir
              </button>
            )}
            <button onClick={onClose} style={{ padding:'9px 18px', borderRadius:10, border:'1.5px solid #E5E7EB', background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', color:'#6B7280' }}>Cancelar</button>
            <button onClick={handleSave} disabled={!canSave} style={{
              flex:1, padding:'9px 18px', borderRadius:10, border:'none',
              background: canSave ? 'linear-gradient(135deg,#374151,#1F2937)' : '#E5E7EB',
              fontSize:13, fontWeight:700, cursor: canSave ? 'pointer' : 'not-allowed',
              color: canSave ? '#fff' : '#9CA3AF',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            }}>
              <Ban style={{ width:14, height:14 }} /> {isEdit ? 'Salvar Bloqueio' : 'Criar Bloqueio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── AppointmentDetailModal ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function AppointmentDetailModal({ apt, profissionais, onClose, onEdit, onDelete, onStatusChange }) {
  const prof = profissionais.find(p => p.nome === apt.profissional);
  const st   = STATUS_CONFIG[apt.status] || STATUS_CONFIG.aguardando;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000, backdropFilter:'blur(4px)', padding:16 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:460, boxShadow:'0 24px 64px rgba(0,0,0,0.2)', overflow:'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: prof ? `linear-gradient(135deg,${prof.cor},${prof.cor}88)` : 'linear-gradient(135deg,#C73B6D,#9B2C50)', padding:'22px 22px 18px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.7)', letterSpacing:1, textTransform:'uppercase', marginBottom:5 }}>Agendamento</div>
              <div style={{ fontSize:20, fontWeight:700, color:'#fff', marginBottom:4 }}>{apt.paciente}</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.85)', display:'flex', alignItems:'center', gap:5 }}>
                <Scissors style={{ width:13, height:13 }} />{apt.servico}
              </div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:10, width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <X style={{ width:16, height:16, color:'#fff' }} />
            </button>
          </div>
          <div style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.2)', borderRadius:20, padding:'3px 10px' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#fff', display:'block' }} />
            <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{st.label}</span>
          </div>
        </div>
        <div style={{ padding:22 }}>
          {[
            { icon:Calendar, label:'Data', value: new Date(apt.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}) },
            { icon:Clock, label:'Horário', value:`${apt.hora} – ${apt.horaFim} (${apt.duracao} min)` },
            { icon:User, label:'Profissional', value:apt.profissional },
            { icon:DollarSign, label:'Valor', value: apt.valor ? `R$ ${Number(apt.valor).toFixed(2)}` : '—' },
            apt.telefone && { icon:Phone, label:'Telefone', value:apt.telefone },
            apt.observacoes && { icon:Edit3, label:'Obs.', value:apt.observacoes },
          ].filter(Boolean).map(({ icon:Icon, label, value }) => (
            <div key={label} style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:12 }}>
              <div style={{ width:30, height:30, borderRadius:8, background:'#FDF8F5', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon style={{ width:13, height:13, color:'#C73B6D' }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:'#9CA3AF', fontWeight:600, marginBottom:1 }}>{label}</div>
                <div style={{ fontSize:13, color:'#1F2937', fontWeight:500 }}>{value}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop:4, marginBottom:14 }}>
            <div style={{ fontSize:11, color:'#9CA3AF', fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:0.5 }}>Alterar Status</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <button key={k} onClick={() => onStatusChange(apt.id, k)} style={{
                  padding:'4px 9px', borderRadius:20, fontSize:11, fontWeight:600,
                  border:`1.5px solid ${apt.status === k ? v.color : v.border}`,
                  background: apt.status === k ? v.bg : '#fff',
                  color: apt.status === k ? v.color : '#6B7280',
                  cursor:'pointer', transition:'all 0.12s',
                }}>{v.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, paddingTop:14, borderTop:'1px solid #F0EBE6' }}>
            <button onClick={() => onDelete(apt.id)} style={{ padding:'8px 14px', borderRadius:10, border:'1.5px solid #FCA5A5', background:'#FFF5F5', fontSize:13, fontWeight:600, cursor:'pointer', color:'#EF4444', display:'flex', alignItems:'center', gap:5 }}>
              <Trash2 style={{ width:13, height:13 }} />Excluir
            </button>
            <button onClick={() => onEdit(apt)} style={{ flex:1, padding:'8px 14px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#C73B6D,#A83158)', fontSize:13, fontWeight:700, cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
              <Edit3 style={{ width:13, height:13 }} />Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── AgendamentoModal ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function AgendamentoModal({ onClose, date, profissional: prefillProf, hora: prefillHora, profissionais, apt, onSave }) {
  const isEdit = !!apt;
  const [pacientes, setPacientes]       = useState(loadPacientes);
  const [showNewClient, setShowNewClient] = useState(false);

  const [form, setForm] = useState(() => isEdit ? { ...apt } : {
    data: fmtDate(date), hora: prefillHora || '09:00',
    horaFim: calcEndTime(prefillHora || '09:00', 60), duracao: 60,
    paciente:'', telefone:'', profissional: prefillProf || '', servico:'',
    status:'aguardando', valor:'', observacoes:'',
  });

  const set = useCallback((k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === 'profissional') next.servico = '';
    if (k === 'hora' || k === 'duracao') next.horaFim = calcEndTime(k==='hora'?v:f.hora, k==='duracao'?Number(v):Number(f.duracao));
    if (k === 'paciente') { const p = pacientes.find(x => x.nome === v); if (p) next.telefone = p.telefone || ''; }
    if (k === 'servico') {
      const precos = { 'Limpeza de Pele':180,'Peeling Químico':220,'Botox Facial':800,'Design de Sobrancelha':80,'Drenagem Linfática':150,'Harmonização Facial':1200,'Preenchimento Labial':900,'Fio de PDO':1500,'Bioestimulador':1800,'Depilação a Laser':300,'Depilação':80,'Massagem':120,'Microagulhamento':350,'Criolipólise':800,'Radiofrequência':250,'Ultrassom':200,'Carboxiterapia':180 };
      if (precos[v] && !f.valor) next.valor = precos[v];
    }
    return next;
  }), [pacientes]);

  const profObj       = profissionais.find(p => p.nome === form.profissional);
  const servicos      = profObj ? profObj.servicos : [];
  const canSave       = form.paciente && form.profissional && form.servico && form.hora && form.data;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ ...form, id: apt?.id || genId(), horaFim: calcEndTime(form.hora, Number(form.duracao)||60), duracao:Number(form.duracao)||60, valor:Number(form.valor)||0 });
    onClose();
  };

  const inputSt  = { width:'100%', padding:'9px 12px', border:'1.5px solid #E5E7EB', borderRadius:10, fontSize:13, outline:'none', boxSizing:'border-box', background:'#FAFAFA', fontFamily:'inherit' };
  const labelSt  = { fontSize:12, fontWeight:600, color:'#6B7280', display:'block', marginBottom:5 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,20,30,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000, backdropFilter:'blur(6px)', padding:16 }} onClick={onClose}>
      {showNewClient && (
        <QuickClientModal onClose={() => setShowNewClient(false)} onSave={c => {
          const updated = [...pacientes, c]; setPacientes(updated); savePacientes(updated);
          set('paciente', c.nome); set('telefone', c.telefone||''); setShowNewClient(false);
        }} />
      )}
      <div style={{ background:'#fff', borderRadius:22, width:'100%', maxWidth:560, boxShadow:'0 32px 80px rgba(0,0,0,0.25)', maxHeight:'92vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding:'22px 26px 18px', borderBottom:'1px solid #F0EBE6', background:'linear-gradient(135deg,#FDF8F5,#fff)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#C73B6D,#9B2C50)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <CalendarCheck style={{ width:18, height:18, color:'#fff' }} />
              </div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#1F2937' }}>{isEdit ? 'Editar Agendamento' : 'Novo Agendamento'}</div>
                <div style={{ fontSize:12, color:'#9CA3AF' }}>{isEdit ? 'Altere os dados e salve' : 'Preencha os dados abaixo'}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background:'#F3F4F6', border:'none', borderRadius:10, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <X style={{ width:16, height:16, color:'#6B7280' }} />
            </button>
          </div>
        </div>

        <div style={{ padding:'18px 26px 26px' }}>
          {/* Cliente */}
          <div style={{ marginBottom:14 }}>
            <label style={labelSt}><span style={{ display:'flex', alignItems:'center', gap:5 }}><User style={{ width:12, height:12, color:'#C73B6D' }} />Cliente *</span></label>
            <div style={{ display:'flex', gap:6 }}>
              <select value={form.paciente} onChange={e => set('paciente', e.target.value)} style={{ ...inputSt, flex:1 }}>
                <option value="">Selecione o cliente...</option>
                {pacientes.map(p => <option key={p.nome} value={p.nome}>{p.nome}{p.telefone ? ` — ${p.telefone}` : ''}</option>)}
              </select>
              <button onClick={() => setShowNewClient(true)} title="Cadastrar novo cliente" style={{ width:40, height:40, borderRadius:10, border:'none', flexShrink:0, background:'linear-gradient(135deg,#C73B6D,#A83158)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(199,59,109,0.3)' }}>
                <Plus style={{ width:18, height:18, color:'#fff' }} />
              </button>
            </div>
          </div>

          {/* Data + Hora + Duração */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
            <div>
              <label style={labelSt}><span style={{ display:'flex', alignItems:'center', gap:5 }}><Calendar style={{ width:12, height:12, color:'#C73B6D' }} />Data *</span></label>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}><span style={{ display:'flex', alignItems:'center', gap:5 }}><Clock style={{ width:12, height:12, color:'#C73B6D' }} />Horário *</span></label>
              <input list="apt-horarios" value={form.hora} onChange={e => set('hora', e.target.value)} placeholder="09:00" style={inputSt} />
              <datalist id="apt-horarios">{HORARIOS_SUGERIDOS.map(h => <option key={h} value={h} />)}</datalist>
            </div>
            <div>
              <label style={labelSt}>Duração (min)</label>
              <select value={form.duracao} onChange={e => set('duracao', e.target.value)} style={inputSt}>
                {[15,20,30,45,60,75,90,120,150,180].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          {form.hora && form.duracao && (
            <div style={{ marginBottom:14, padding:'7px 12px', borderRadius:10, background:'#F0FDF4', border:'1px solid #BBF7D0', display:'flex', alignItems:'center', gap:7, fontSize:12, color:'#065F46' }}>
              <CheckCircle style={{ width:13, height:13 }} />Término previsto: <strong>{form.horaFim}</strong>
            </div>
          )}

          {/* Profissional */}
          <div style={{ marginBottom:14 }}>
            <label style={labelSt}><span style={{ display:'flex', alignItems:'center', gap:5 }}><Scissors style={{ width:12, height:12, color:'#C73B6D' }} />Profissional *</span></label>
            <select value={form.profissional} onChange={e => set('profissional', e.target.value)} style={inputSt}>
              <option value="">Selecione...</option>
              {profissionais.map(p => <option key={p.nome} value={p.nome}>{p.nome} — {p.cargo}</option>)}
            </select>
            {profObj && (
              <div style={{ marginTop:5, padding:'4px 9px', borderRadius:7, background:'#F0FDF4', fontSize:11, color:'#065F46', fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:profObj.cor, display:'block' }} />{form.profissional} · {servicos.length} serviços
              </div>
            )}
          </div>

          {/* Serviço */}
          <div style={{ marginBottom:14 }}>
            <label style={labelSt}><span style={{ display:'flex', alignItems:'center', gap:5 }}><Star style={{ width:12, height:12, color:'#C73B6D' }} />Serviço *</span></label>
            {!form.profissional ? (
              <div style={{ padding:'10px 12px', borderRadius:10, border:'1.5px dashed #E5E7EB', color:'#9CA3AF', fontSize:13, display:'flex', alignItems:'center', gap:7 }}>
                <AlertCircle style={{ width:14, height:14 }} />Selecione uma profissional primeiro
              </div>
            ) : servicos.length === 0 ? (
              <div style={{ padding:'10px 12px', borderRadius:10, border:'1.5px dashed #FCA5A5', color:'#EF4444', fontSize:13, background:'#FFF5F5' }}>Nenhum serviço cadastrado</div>
            ) : (
              <select value={form.servico} onChange={e => set('servico', e.target.value)} style={inputSt}>
                <option value="">Selecione o serviço...</option>
                {servicos.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>

          {/* Valor + Telefone */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            <div>
              <label style={labelSt}><span style={{ display:'flex', alignItems:'center', gap:5 }}><DollarSign style={{ width:12, height:12, color:'#C73B6D' }} />Valor (R$)</span></label>
              <input type="number" step="0.01" placeholder="0,00" value={form.valor} onChange={e => set('valor', e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}><span style={{ display:'flex', alignItems:'center', gap:5 }}><Phone style={{ width:12, height:12, color:'#C73B6D' }} />Telefone</span></label>
              <input type="tel" placeholder="(11) 99999-9999" value={form.telefone} onChange={e => set('telefone', e.target.value)} style={inputSt} />
            </div>
          </div>

          {/* Status */}
          <div style={{ marginBottom:14 }}>
            <label style={labelSt}>Status</label>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('status', k)} style={{
                  padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:600,
                  border:`1.5px solid ${form.status===k ? v.color : v.border}`,
                  background: form.status===k ? v.bg : '#fff',
                  color: form.status===k ? v.color : '#9CA3AF',
                  cursor:'pointer', transition:'all 0.12s',
                }}>{v.label}</button>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div style={{ marginBottom:22 }}>
            <label style={labelSt}>Observações</label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Notas sobre o atendimento..." style={{ ...inputSt, minHeight:64, resize:'vertical' }} />
          </div>

          <div style={{ display:'flex', gap:8, paddingTop:14, borderTop:'1px solid #F0EBE6' }}>
            <button onClick={onClose} style={{ padding:'9px 18px', borderRadius:10, border:'1.5px solid #E5E7EB', background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', color:'#6B7280' }}>Cancelar</button>
            <button onClick={handleSave} disabled={!canSave} style={{
              flex:1, padding:'9px 18px', borderRadius:10, border:'none',
              background: canSave ? 'linear-gradient(135deg,#C73B6D,#A83158)' : '#E5E7EB',
              fontSize:13, fontWeight:700, cursor: canSave ? 'pointer' : 'not-allowed',
              color: canSave ? '#fff' : '#9CA3AF',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            }}>
              <CheckCircle style={{ width:14, height:14 }} />{isEdit ? 'Salvar Alterações' : 'Confirmar Agendamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── DayStats ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function DayStats({ agendamentos, date }) {
  const dateStr  = fmtDate(date);
  const apts     = agendamentos.filter(a => a.data === dateStr);
  const total    = apts.length;
  const conf     = apts.filter(a => a.status === 'confirmado' || a.status === 'em_atendimento').length;
  const receita  = apts.filter(a => a.status === 'concluido').reduce((s, a) => s + (Number(a.valor)||0), 0);
  const pend     = apts.filter(a => a.status === 'aguardando').length;
  const stats    = [
    { label:'Agendamentos', value:total, icon:CalendarCheck, color:'#C73B6D', bg:'#FDF4F7' },
    { label:'Confirmados',  value:conf,  icon:CheckSquare,   color:'#059669', bg:'#ECFDF5' },
    { label:'Aguardando',   value:pend,  icon:Clock,         color:'#D97706', bg:'#FFFBEB' },
    { label:'Receita do dia', value: receita ? `R$ ${receita.toFixed(0)}` : '—', icon:TrendingUp, color:'#7C3AED', bg:'#F5F3FF' },
  ];
  return (
    <div style={{ display:'flex', gap:10, marginBottom:14 }}>
      {stats.map(({ label, value, icon:Icon, color, bg }) => (
        <div key={label} style={{ flex:1, background:'#fff', borderRadius:14, padding:'10px 14px', border:'1px solid #F0EBE6', display:'flex', alignItems:'center', gap:10, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ width:34, height:34, borderRadius:10, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Icon style={{ width:15, height:15, color }} />
          </div>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'#1F2937', lineHeight:1.1 }}>{value}</div>
            <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:500 }}>{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── BlockCard ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function BlockCard({ blq, onClick, col, totalCols }) {
  const cfg   = BLOQUEIO_TIPOS[blq.tipo] || BLOQUEIO_TIPOS.outro;
  const Icon  = cfg.icon;
  const w     = totalCols > 1 ? `${100 / totalCols}%` : '100%';
  const left  = totalCols > 1 ? `${(col / totalCols) * 100}%` : '0';

  return (
    <div onClick={e => { e.stopPropagation(); onClick(blq); }}
      style={{
        position:'absolute', left:`calc(${left} + 1px)`, width:`calc(${w} - 2px)`,
        backgroundImage: cfg.stripe
          ? `repeating-linear-gradient(-45deg, ${cfg.bg} 0px, ${cfg.bg} 5px, ${cfg.bg}cc 5px, ${cfg.bg}cc 10px)`
          : 'none',
        backgroundColor: cfg.bg,
        border:`1.5px solid ${cfg.border}`,
        borderRadius:6, padding:'3px 7px',
        cursor:'pointer', overflow:'hidden', transition:'opacity 0.12s',
        display:'flex', flexDirection:'column', justifyContent:'center', gap:1,
      }}
      onMouseEnter={e => e.currentTarget.style.opacity='0.8'}
      onMouseLeave={e => e.currentTarget.style.opacity='1'}>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <Icon style={{ width:10, height:10, color:cfg.color, flexShrink:0 }} />
        <span style={{ fontSize:10, fontWeight:700, color:cfg.color, textTransform:'uppercase', letterSpacing:0.5 }}>
          {blq.observacoes || cfg.label}
        </span>
      </div>
      <div style={{ fontSize:9, color:cfg.color, opacity:0.8 }}>{blq.hora} – {blq.horaFim}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── AppointmentCard ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function AppointmentCard({ apt, prof, onClick, col, totalCols }) {
  const st    = STATUS_CONFIG[apt.status] || STATUS_CONFIG.aguardando;
  const color = prof?.cor || '#C73B6D';
  const w     = totalCols > 1 ? `${100 / totalCols}%` : '100%';
  const left  = totalCols > 1 ? `${(col / totalCols) * 100}%` : '0';

  return (
    <div onClick={e => { e.stopPropagation(); onClick(apt); }}
      style={{
        position:'absolute',
        left:`calc(${left} + 2px)`,
        width:`calc(${w} - 4px)`,
        height:'100%',
        background:`${color}18`,
        border:`1.5px solid ${color}50`,
        borderLeft:`3px solid ${color}`,
        borderRadius:6, padding:'3px 6px',
        cursor:'pointer', overflow:'hidden',
        transition:'transform 0.1s, box-shadow 0.1s',
        zIndex:10,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform='scale(1.01)'; e.currentTarget.style.boxShadow=`0 3px 10px ${color}30`; }}
      onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}>
      <div style={{ fontSize:11, fontWeight:700, color, lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
        {apt.paciente}
      </div>
      <div style={{ fontSize:10, color:`${color}cc`, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{apt.servico}</div>
      <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:1 }}>
        <span style={{ width:5, height:5, borderRadius:'50%', background:st.dot, flexShrink:0 }} />
        <span style={{ fontSize:9, color:'#9CA3AF', fontWeight:600 }}>{apt.hora}–{apt.horaFim}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── Main Agenda ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
export default function Agenda() {
  const { profissionais } = useProfissionais();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState(loadAgendamentos);
  const [bloqueios, setBloqueios]       = useState(loadBloqueios);
  const [viewMode, setViewMode]         = useState('day');

  // Modals
  const [formModal,     setFormModal]     = useState({ open:false, apt:null, prefillProf:'', prefillHora:'' });
  const [detailModal,   setDetailModal]   = useState({ open:false, apt:null });
  const [bloqueioModal, setBloqueioModal] = useState({ open:false, bloqueio:null, prefillProf:'', prefillHora:'' });

  // Persist
  useEffect(() => { saveAgendamentos(agendamentos); }, [agendamentos]);
  useEffect(() => { saveBloqueios(bloqueios); },       [bloqueios]);

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const navigateDate = dir => {
    const d = new Date(selectedDate);
    if (viewMode === 'week') d.setDate(d.getDate() + dir*7);
    else d.setDate(d.getDate() + dir);
    setSelectedDate(d);
  };

  const openNew      = (prof='', hora='') => setFormModal({ open:true, apt:null, prefillProf:prof, prefillHora:hora });
  const openEdit     = apt => { setDetailModal({ open:false, apt:null }); setFormModal({ open:true, apt, prefillProf:'', prefillHora:'' }); };
  const openDetail   = apt => setDetailModal({ open:true, apt });
  const openBloqueio = (prof='', hora='', blq=null) => setBloqueioModal({ open:true, bloqueio:blq, prefillProf:prof, prefillHora:hora });

  const handleSave = payload => setAgendamentos(prev => {
    const ex = prev.find(a => a.id === payload.id);
    return ex ? prev.map(a => a.id === payload.id ? payload : a) : [...prev, payload];
  });

  const handleDelete = id => { setAgendamentos(prev => prev.filter(a => a.id !== id)); setDetailModal({ open:false, apt:null }); };
  const handleStatusChange = (id, status) => {
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    setDetailModal(prev => prev.apt?.id === id ? { ...prev, apt:{ ...prev.apt, status } } : prev);
  };

  const handleSaveBloqueio = payload => setBloqueios(prev => {
    const ex = prev.find(b => b.id === payload.id);
    return ex ? prev.map(b => b.id === payload.id ? payload : b) : [...prev, payload];
  });
  const handleDeleteBloqueio = id => setBloqueios(prev => prev.filter(b => b.id !== id));

  const dateLabel = useMemo(() => {
    if (viewMode === 'week') {
      const f = weekDays[0], l = weekDays[weekDays.length-1];
      return `${f.getDate()}/${f.getMonth()+1} – ${l.getDate()}/${l.getMonth()+1}/${l.getFullYear()}`;
    }
    return selectedDate.toLocaleDateString('pt-BR',{ weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }, [selectedDate, viewMode, weekDays]);

  const aptsDodia = useMemo(() => agendamentos.filter(a => a.data === fmtDate(selectedDate)), [agendamentos, selectedDate]);
  const blqDodia  = useMemo(() => bloqueios.filter(b => b.data === fmtDate(selectedDate)),    [bloqueios, selectedDate]);

  // Posição no grid
  function itemPos(item) {
    const startMins = timeToMinutes(item.hora) - HOUR_START * 60;
    const endMins   = timeToMinutes(item.horaFim || calcEndTime(item.hora, item.duracao||60)) - HOUR_START * 60;
    return { top: Math.max(0, startMins * PX_PER_MIN), height: Math.max(18, (endMins-startMins) * PX_PER_MIN) };
  }

  const gridHeight = (HOUR_END - HOUR_START) * SLOT_HEIGHT;
  const today      = new Date();

  // Para cada coluna, calcula layout side-by-side
  function computeColLayout(colItems) {
    if (!colItems.length) return {};
    const forCompute = colItems.map(it => ({
      id: it.id,
      startMin: timeToMinutes(it.hora),
      endMin: timeToMinutes(it.horaFim || calcEndTime(it.hora, it.duracao||60)),
    }));
    return computeColumns(forCompute);
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 40px)', gap:0 }}>

      {/* Modals */}
      {formModal.open && (
        <AgendamentoModal onClose={() => setFormModal({ open:false, apt:null, prefillProf:'', prefillHora:'' })}
          date={selectedDate} profissional={formModal.prefillProf} hora={formModal.prefillHora}
          profissionais={profissionais} apt={formModal.apt} onSave={handleSave} />
      )}
      {detailModal.open && detailModal.apt && (
        <AppointmentDetailModal apt={detailModal.apt} profissionais={profissionais}
          onClose={() => setDetailModal({ open:false, apt:null })}
          onEdit={openEdit} onDelete={handleDelete} onStatusChange={handleStatusChange} />
      )}
      {bloqueioModal.open && (
        <BloqueioModal onClose={() => setBloqueioModal({ open:false, bloqueio:null, prefillProf:'', prefillHora:'' })}
          date={selectedDate} profissional={bloqueioModal.prefillProf} hora={bloqueioModal.prefillHora}
          profissionais={profissionais} bloqueio={bloqueioModal.bloqueio}
          onSave={handleSaveBloqueio} onDelete={handleDeleteBloqueio} />
      )}

      {/* Stats */}
      <DayStats agendamentos={agendamentos} date={selectedDate} />

      {/* Top Nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#C73B6D,#9B2C50)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <CalendarCheck style={{ width:16, height:16, color:'#fff' }} />
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:1, color:'#C73B6D', textTransform:'uppercase' }}>Agenda</div>
            <div style={{ fontSize:13, fontWeight:700, color:'#1F2937', textTransform:'capitalize' }}>{dateLabel}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => navigateDate(-1)} style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, cursor:'pointer', padding:'6px 10px', display:'flex' }}>
            <ChevronLeft style={{ width:16, height:16, color:'#6B7280' }} />
          </button>
          <button onClick={() => setSelectedDate(new Date())} style={{ background: sameDay(selectedDate,today) ? '#C73B6D':'#fff', color: sameDay(selectedDate,today) ? '#fff':'#374151', border:'1px solid #E5E7EB', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>Hoje</button>
          <button onClick={() => navigateDate(1)} style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, cursor:'pointer', padding:'6px 10px', display:'flex' }}>
            <ChevronRight style={{ width:16, height:16, color:'#6B7280' }} />
          </button>
          {/* View toggle */}
          <div style={{ display:'flex', background:'#F3F4F6', borderRadius:8, padding:3 }}>
            {[{k:'day',icon:List,label:'Dia'},{k:'week',icon:Grid,label:'Semana'}].map(({k,icon:Icon,label}) => (
              <button key={k} onClick={() => setViewMode(k)} style={{ padding:'5px 12px', borderRadius:6, border:'none', background:viewMode===k?'#fff':'transparent', color:viewMode===k?'#1F2937':'#9CA3AF', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:4, boxShadow:viewMode===k?'0 1px 4px rgba(0,0,0,0.1)':'none', transition:'all 0.12s' }}>
                <Icon style={{ width:13, height:13 }} />{label}
              </button>
            ))}
          </div>
          {/* Bloquear Horário */}
          <button onClick={() => openBloqueio()} style={{ background:'#F3F4F6', color:'#374151', border:'1px solid #E5E7EB', borderRadius:10, padding:'8px 14px', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5, transition:'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background='#E5E7EB'; }}
            onMouseLeave={e => { e.currentTarget.style.background='#F3F4F6'; }}>
            <Ban style={{ width:14, height:14 }} />Bloquear
          </button>
          {/* Novo Agendamento */}
          <button onClick={() => openNew()} style={{ background:'linear-gradient(135deg,#C73B6D,#9B2C50)', color:'#fff', border:'none', borderRadius:10, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 3px 10px rgba(199,59,109,0.35)', transition:'transform 0.12s,box-shadow 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 18px rgba(199,59,109,0.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 3px 10px rgba(199,59,109,0.35)'; }}>
            <Plus style={{ width:15, height:15 }} />Novo Agendamento
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display:'flex', gap:12, flex:1, minHeight:0 }}>

        {/* Sidebar */}
        <div style={{ width:220, display:'flex', flexDirection:'column', gap:10, flexShrink:0, overflowY:'auto' }}>
          <MiniCalendar selectedDate={selectedDate} onSelect={setSelectedDate} agendamentos={agendamentos} />

          {/* Equipe */}
          <div style={{ background:'#fff', borderRadius:16, padding:14, border:'1px solid #F0EBE6', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:'#9CA3AF', marginBottom:10, textTransform:'uppercase' }}>Equipe</div>
            {profissionais.map(p => {
              const count = aptsDodia.filter(a => a.profissional === p.nome).length;
              return (
                <div key={p.nome} style={{ display:'flex', alignItems:'center', gap:9, marginBottom:7, cursor:'pointer', borderRadius:10, padding:'5px 7px', transition:'background 0.12s' }}
                  onClick={() => openNew(p.nome, '')}
                  onMouseEnter={e => e.currentTarget.style.background='#FDF8F5'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:p.cor, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0, boxShadow:`0 2px 5px ${p.cor}44` }}>{p.nome.charAt(0)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#1F2937' }}>{p.nome}</div>
                    <div style={{ fontSize:10, color:'#9CA3AF' }}>{p.cargo}</div>
                  </div>
                  {count > 0 && (
                    <span style={{ minWidth:18, height:18, borderRadius:9, background:p.cor, color:'#fff', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{count}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legenda Status */}
          <div style={{ background:'#fff', borderRadius:16, padding:14, border:'1px solid #F0EBE6', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:'#9CA3AF', marginBottom:8, textTransform:'uppercase' }}>Status</div>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:v.dot, flexShrink:0 }} />
                <span style={{ fontSize:11, color:'#6B7280', fontWeight:500 }}>{v.label}</span>
              </div>
            ))}
          </div>

          {/* Legenda Bloqueios */}
          <div style={{ background:'#fff', borderRadius:16, padding:14, border:'1px solid #F0EBE6', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:'#9CA3AF', marginBottom:8, textTransform:'uppercase' }}>Bloqueios</div>
            {Object.entries(BLOQUEIO_TIPOS).map(([k, v]) => {
              const Icon = v.icon;
              return (
                <div key={k} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                  <Icon style={{ width:10, height:10, color:v.color, flexShrink:0 }} />
                  <span style={{ fontSize:11, color:'#6B7280', fontWeight:500 }}>{v.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex:1, background:'#fff', borderRadius:16, border:'1px solid #F0EBE6', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>

          {/* Header colunas */}
          <div style={{ display:'flex', borderBottom:'2px solid #F0EBE6', background:'#FAFAFA', flexShrink:0 }}>
            <div style={{ width:52, flexShrink:0 }} />
            {(viewMode === 'day' ? profissionais : weekDays).map((item, i) => {
              if (viewMode === 'day') {
                const p   = item;
                const cnt = aptsDodia.filter(a => a.profissional === p.nome).length;
                const blqCnt = blqDodia.filter(b => b.profissional === p.nome).length;
                return (
                  <div key={p.nome} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 6px', borderLeft: i>0 ? '1px solid #F0EBE6' : 'none', cursor:'pointer', transition:'background 0.12s' }}
                    onClick={() => openNew(p.nome, '')}
                    onMouseEnter={e => e.currentTarget.style.background='#FDF8F5'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:p.cor, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, marginBottom:4, boxShadow:`0 2px 8px ${p.cor}44` }}>{p.nome.charAt(0)}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#1F2937' }}>{p.nome}</div>
                    <div style={{ fontSize:10, color:'#9CA3AF' }}>{p.cargo}</div>
                    <div style={{ display:'flex', gap:5, marginTop:4 }}>
                      {cnt > 0 && <div style={{ fontSize:10, color:p.cor, fontWeight:700, background:`${p.cor}15`, padding:'1px 7px', borderRadius:10 }}>{cnt} apt{cnt>1?'s':''}</div>}
                      {blqCnt > 0 && <div style={{ fontSize:10, color:'#6B7280', fontWeight:700, background:'#F3F4F6', padding:'1px 7px', borderRadius:10 }}>{blqCnt} blq</div>}
                    </div>
                  </div>
                );
              } else {
                const d      = item;
                const isT    = sameDay(d, today);
                const isSel  = sameDay(d, selectedDate);
                const cnt    = agendamentos.filter(a => a.data === fmtDate(d)).length;
                return (
                  <div key={fmtDate(d)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 5px', borderLeft: i>0 ? '1px solid #F0EBE6' : 'none', cursor:'pointer', background: isSel ? '#FDF4F7' : 'transparent', transition:'background 0.12s' }}
                    onClick={() => { setSelectedDate(new Date(d)); setViewMode('day'); }}>
                    <div style={{ fontSize:9, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase' }}>{d.toLocaleDateString('pt-BR',{weekday:'short'})}</div>
                    <div style={{ width:28, height:28, borderRadius:'50%', marginTop:3, background: isT ? '#C73B6D' : isSel ? '#FDF4F7' : 'transparent', border: isSel && !isT ? '2px solid #C73B6D' : 'none', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color: isT ? '#fff' : isSel ? '#C73B6D' : '#374151' }}>
                      {d.getDate()}
                    </div>
                    {cnt > 0 && <span style={{ marginTop:2, width:5, height:5, borderRadius:'50%', background:'#C73B6D' }} />}
                  </div>
                );
              }
            })}
          </div>

          {/* Time Grid */}
          <div style={{ flex:1, overflowY:'auto', position:'relative' }}>
            <div style={{ position:'relative', minHeight:gridHeight+'px', display:'flex' }}>

              {/* Coluna de horas */}
              <div style={{ width:52, flexShrink:0, position:'relative', background:'#FAFAFA', borderRight:'1px solid #F0EBE6' }}>
                {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => {
                  const h   = HOUR_START + i;
                  const top = i * SLOT_HEIGHT;
                  return (
                    <div key={h} style={{ position:'absolute', top: top-7, left:0, width:52, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:8 }}>
                      <span style={{ fontSize:10, color:'#9CA3AF', fontWeight:600 }}>{String(h).padStart(2,'0')}h</span>
                    </div>
                  );
                })}
              </div>

              {/* Colunas das profissionais */}
              {(viewMode === 'day' ? profissionais : weekDays).map((item, colIdx) => {
                const key      = viewMode === 'day' ? item.nome : fmtDate(item);
                const colApts  = viewMode === 'day'
                  ? aptsDodia.filter(a => a.profissional === item.nome)
                  : agendamentos.filter(a => a.data === fmtDate(item));
                const colBlqs  = viewMode === 'day'
                  ? blqDodia.filter(b => b.profissional === item.nome)
                  : bloqueios.filter(b => b.data === fmtDate(item));
                const colColor = viewMode === 'day' ? item.cor : '#C73B6D';

                // Computar layout side-by-side para apts e bloqueios juntos
                const allItems = [
                  ...colApts.map(a => ({ ...a, _kind:'apt' })),
                  ...colBlqs.map(b => ({ ...b, _kind:'blq' })),
                ];
                const layout = computeColLayout(allItems);

                return (
                  <div key={key} style={{ flex:1, position:'relative', borderLeft: colIdx>0 ? '1px solid #F0EBE6' : 'none' }}>
                    {/* Linhas de hora — sem gap entre elas */}
                    {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => (
                      <div key={i} style={{ position:'absolute', top: i * SLOT_HEIGHT, left:0, right:0, height:SLOT_HEIGHT, borderTop:`1px solid ${i===0 ? 'transparent' : '#F0EBE6'}`, zIndex:0 }}>
                        <div style={{ position:'absolute', top: SLOT_HEIGHT/2, left:0, right:0, borderTop:'1px dashed #F3F4F6' }} />
                      </div>
                    ))}

                    {/* Zona clicável */}
                    <div style={{ position:'absolute', inset:0, zIndex:1 }}
                      onClick={() => {
                        if (viewMode === 'day') openNew(item.nome, '');
                        else { setSelectedDate(new Date(item)); setViewMode('day'); }
                      }}
                      onMouseEnter={e => e.currentTarget.style.background=`${colColor}06`}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}
                    />

                    {/* Bloqueios */}
                    {colBlqs.map(blq => {
                      const { top, height } = itemPos(blq);
                      const lay = layout[blq.id] || { col:0, totalCols:1 };
                      return (
                        <div key={blq.id} style={{ position:'absolute', top, left:0, right:0, height, zIndex:4 }}>
                          <BlockCard blq={blq} onClick={() => openBloqueio(blq.profissional, blq.hora, blq)} col={lay.col} totalCols={lay.totalCols} />
                        </div>
                      );
                    })}

                    {/* Agendamentos */}
                    {colApts.map(apt => {
                      const { top, height } = itemPos(apt);
                      const lay = layout[apt.id] || { col:0, totalCols:1 };
                      const profItem = viewMode === 'day' ? item : profissionais.find(p => p.nome === apt.profissional);
                      return (
                        <div key={apt.id} style={{ position:'absolute', top, left:0, right:0, height, zIndex:5 }}>
                          <AppointmentCard apt={apt} prof={profItem} onClick={openDetail} col={lay.col} totalCols={lay.totalCols} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
