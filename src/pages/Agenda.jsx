import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Star, XCircle, CheckCircle,
  Clock, User, Scissors, AlertCircle, Calendar, UserPlus,
  Trash2, Edit3, Phone, DollarSign, TrendingUp,
  CalendarCheck, Grid, List, CheckSquare, X,
  Ban, Coffee, UtensilsCrossed, Lock, AlertTriangle, Repeat2,
} from 'lucide-react';
import { useProfissionais } from '../lib/profissionais';
import {
  fetchClients,
  insertClient,
  fetchAppointments,
  insertAppointment,
  updateAppointment,
  deleteAppointment
} from '../services/supabaseService';

// ─── Constants ───────────────────────────────────────────────

const SLOT_HEIGHT = 80; // px por hora — maior para melhor visualização
const HOUR_START = 7;
const HOUR_END = 20;
const PX_PER_MIN = SLOT_HEIGHT / 60;

const HORARIOS_SUGERIDOS = [];
for (let h = HOUR_START; h <= HOUR_END; h++) {
  HORARIOS_SUGERIDOS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < HOUR_END) HORARIOS_SUGERIDOS.push(`${String(h).padStart(2, '0')}:30`);
}

const STATUS_CONFIG = {
  aguardando_confirmacao: { label: 'Aguardando Confirmação', bg: '#FDF2E9', color: '#E67E22', dot: '#E67E22', border: '#F5CBA7' },
  confirmado: { label: 'Confirmado', bg: '#EAFAF1', color: '#27AE60', dot: '#27AE60', border: '#ABEBC6' },
  cliente_faltou: { label: 'Cliente Faltou', bg: '#F2F3F4', color: '#7F8C8D', dot: '#95A5A6', border: '#D5DBDB' },
  em_atendimento: { label: 'Em Atendimento', bg: '#E5FAF6', color: '#46D6BF', dot: '#46D6BF', border: '#A8E8DA' },
  finalizado: { label: 'Finalizado', bg: '#EBF5FB', color: '#3498DB', dot: '#3498DB', border: '#AED6F1' },
};

// ─── Bloqueios config ─────────────────────────────────────────
const BLOQUEIO_TIPOS = {
  almoco: { label: 'Almoço', icon: UtensilsCrossed, bg: '#D1D5DB', color: '#374151', border: '#9CA3AF', stripe: true },
  pausa: { label: 'Pausa', icon: Coffee, bg: '#E0E7FF', color: '#3730A3', border: '#A5B4FC', stripe: false },
  agenda_fechada: { label: 'Agenda Fechada', icon: Lock, bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5', stripe: true },
  ausencia: { label: 'ausencia', icon: null, bg: '#D1D5DB', color: '#6B7280', border: '#9CA3AF', stripe: false },
  outro: { label: 'Outro bloqueio', icon: AlertTriangle, bg: '#FEF3C7', color: '#92400E', border: '#FDE68A', stripe: false },
};

// ─── Storage keys ─────────────────────────────────────────────
const AGENDA_KEY = 'erp_agenda_v3';
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
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

function mapToSupabase(item, isBlock = false) {
  const time = item.hora.length === 5 ? `${item.hora}:00` : item.hora;
  if (isBlock) {
    return {
      client_name: 'BLOQUEIO',
      procedure: item.tipo,
      professional: item.profissional,
      appointment_date: item.data,
      appointment_time: time,
      status: 'bloqueado',
      notes: item.observacoes || ''
    };
  } else {
    return {
      client_name: item.paciente,
      client_phone: item.telefone || '',
      procedure: item.servico,
      professional: item.profissional,
      appointment_date: item.data,
      appointment_time: time,
      status: item.status,
      notes: JSON.stringify({
        valor: item.valor,
        duracao: item.duracao,
        observacoes: item.observacoes,
        fixo: item.fixo
      })
    };
  }
}

function mapFromSupabase(item) {
  const time = item.appointment_time ? item.appointment_time.substring(0, 5) : '00:00';
  if (item.status === 'bloqueado') {
    return {
      id: item.id,
      data: item.appointment_date,
      hora: time,
      horaFim: calcEndTime(time, 60),
      duracao: 60,
      tipo: item.procedure || 'almoco',
      profissional: item.professional,
      observacoes: item.notes || ''
    };
  } else {
    let extra = { valor: 0, duracao: 60, observacoes: '', fixo: false };
    try {
      if (item.notes && item.notes.startsWith('{')) {
        extra = JSON.parse(item.notes);
      } else {
        extra.observacoes = item.notes || '';
      }
    } catch (e) {}

    return {
      id: item.id,
      data: item.appointment_date,
      hora: time,
      horaFim: calcEndTime(time, extra.duracao || 60),
      duracao: extra.duracao || 60,
      paciente: item.client_name,
      telefone: item.client_phone || '',
      profissional: item.professional,
      servico: item.procedure,
      status: item.status || 'aguardando_confirmacao',
      valor: extra.valor || 0,
      observacoes: extra.observacoes || '',
      fixo: extra.fixo || false
    };
  }
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

function loadAgendamentos() { return []; }
function saveAgendamentos(list) {}
function loadBloqueios() { return []; }
function saveBloqueios(list) {}
function loadPacientes() { return []; }
function savePacientes(list) {}

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

  useEffect(() => {
    setViewDate(new Date(selectedDate));
  }, [selectedDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const days = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));

  const monthLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const weekLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const daysWithApts = useMemo(() => {
    const s = new Set(); agendamentos.forEach(a => s.add(a.data)); return s;
  }, [agendamentos]);

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: '1px solid #F0EBE6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: '#6B7280' }}>
          <ChevronLeft style={{ width: 15, height: 15 }} />
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'capitalize', color: '#1F2937' }}>{monthLabel}</span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: '#6B7280' }}>
          <ChevronRight style={{ width: 15, height: 15 }} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, marginBottom: 4 }}>
        {weekLabels.map((l, i) => <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#9CA3AF', padding: '2px 0' }}>{l}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1 }}>
        {days.map((d, i) => {
          if (!d) return <div key={i} />;
          const isToday = sameDay(d, today);
          const isSelected = sameDay(d, selectedDate);
          const hasApt = daysWithApts.has(fmtDate(d));
          return (
            <button key={i} onClick={() => onSelect(new Date(d))} style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              cursor: 'pointer', fontSize: 11, position: 'relative',
              fontWeight: isToday || isSelected ? 700 : 400,
              background: isToday ? '#C73B6D' : 'transparent',
              color: isToday ? '#fff' : isSelected ? '#C73B6D' : '#374151',
              outline: isSelected && !isToday ? '2px solid #C73B6D' : 'none',
              outlineOffset: -2, transition: 'all 0.12s',
            }}>
              {d.getDate()}
              {hasApt && !isToday && (
                <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#C73B6D' }} />
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
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [erro, setErro] = useState('');
  const [erroTelefone, setErroTelefone] = useState('');
  const [erroNascimento, setErroNascimento] = useState('');

  const handleSubmit = () => {
    let hasError = false;
    if (!nome.trim()) { setErro('Nome obrigatório'); hasError = true; }
    if (!telefone.trim()) { setErroTelefone('Telefone obrigatório'); hasError = true; }
    if (!dataNascimento) { setErroNascimento('Data de nascimento obrigatória'); hasError = true; }
    if (hasError) return;
    onSave({ nome: nome.trim(), telefone, email, data_nascimento: dataNascimento });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#C73B6D,#9B2C50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserPlus style={{ width: 18, height: 18, color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1F2937' }}>Cadastro Rápido</div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>Novo cliente</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: 20, height: 20, color: '#9CA3AF' }} />
          </button>
        </div>
        {[
          { label: 'Nome completo *', val: nome, set: v => { setNome(v); setErro(''); }, type: 'text', placeholder: 'Ex: Maria da Silva', err: erro },
          { label: 'Telefone *', val: telefone, set: v => { setTelefone(v); setErroTelefone(''); }, type: 'tel', placeholder: '(11) 99999-9999', err: erroTelefone },
          { label: 'E-mail', val: email, set: setEmail, type: 'email', placeholder: 'email@exemplo.com' },
          { label: 'Data de Nascimento *', val: dataNascimento, set: v => { setDataNascimento(v); setErroNascimento(''); }, type: 'date', placeholder: '', err: erroNascimento },
        ].map(({ label, val, set, type, placeholder, err }) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{label}</label>
            <input type={type} placeholder={placeholder} value={val} onChange={e => set(e.target.value)} autoFocus={label === 'Nome completo *'}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${err ? '#EF4444' : '#E5E7EB'}`, borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            {err && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{err}</div>}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6B7280' }}>Cancelar</button>
          <button onClick={handleSubmit} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#C73B6D,#A83158)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle style={{ width: 15, height: 15 }} /> Cadastrar
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

  const inputSt = { width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#FAFAFA', fontFamily: 'inherit' };
  const canSave = form.profissional && form.tipo && form.hora;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ ...form, id: bloqueio?.id || genId(), duracao: Number(form.duracao), horaFim: calcEndTime(form.hora, Number(form.duracao)) });
    onClose();
  };

  const tipoConfig = BLOQUEIO_TIPOS[form.tipo] || BLOQUEIO_TIPOS.outro;
  const TipoIcon = tipoConfig.icon;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,30,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(6px)', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 500, boxShadow: '0 32px 80px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid #F0EBE6', background: 'linear-gradient(135deg,#F9FAFB,#fff)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#6B7280,#374151)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ban style={{ width: 18, height: 18, color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1F2937' }}>{isEdit ? 'Editar Bloqueio' : 'Novo Bloqueio'}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>Marcar período indisponível</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: 16, height: 16, color: '#6B7280' }} />
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 26px 26px' }}>
          {/* Tipo */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 8 }}>Tipo de bloqueio</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(BLOQUEIO_TIPOS).map(([k, v]) => {
                const Icon = v.icon;
                const sel = form.tipo === k;
                return (
                  <button key={k} onClick={() => set('tipo', k)} type="button" style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10,
                    border: `1.5px solid ${sel ? v.border : '#E5E7EB'}`,
                    background: sel ? v.bg : '#fff',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}>
                    {Icon ? <Icon style={{ width: 14, height: 14, color: sel ? v.color : '#9CA3AF', flexShrink: 0 }} /> : null}
                    <span style={{ fontSize: 12, fontWeight: 600, color: sel ? v.color : '#6B7280' }}>{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profissional */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 5 }}>Profissional *</label>
            <select value={form.profissional} onChange={e => set('profissional', e.target.value)} style={inputSt}>
              <option value="">Selecione...</option>
              {profissionais.map(p => <option key={p.nome} value={p.nome}>{p.nome} — {p.cargo}</option>)}
            </select>
          </div>

          {/* Data + Hora + Duração */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 5 }}>Data</label>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 5 }}>Início</label>
              <input list="bl-horarios" value={form.hora} onChange={e => set('hora', e.target.value)} style={inputSt} placeholder="00:00" />
              <datalist id="bl-horarios">{HORARIOS_SUGERIDOS.map(h => <option key={h} value={h} />)}</datalist>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 5 }}>Duração (min)</label>
              <select value={form.duracao} onChange={e => set('duracao', e.target.value)} style={inputSt}>
                {[15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          {/* Término */}
          {form.hora && (
            <div style={{ marginBottom: 14, padding: '7px 12px', borderRadius: 10, background: '#F3F4F6', fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock style={{ width: 13, height: 13, color: '#6B7280' }} />
              Bloqueado das <strong>{form.hora}</strong> às <strong>{form.horaFim}</strong>
            </div>
          )}

          {/* Observações */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 5 }}>Observações / Motivo</label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder={tipoConfig.label}
              style={{ ...inputSt, minHeight: 64, resize: 'vertical' }} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 16, borderTop: '1px solid #F0EBE6' }}>
            {isEdit && (
              <button onClick={() => { onDelete(bloqueio.id); onClose(); }} style={{ padding: '9px 14px', borderRadius: 10, border: '1.5px solid #FCA5A5', background: '#FFF5F5', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trash2 style={{ width: 14, height: 14 }} /> Excluir
              </button>
            )}
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6B7280' }}>Cancelar</button>
            <button onClick={handleSave} disabled={!canSave} style={{
              flex: 1, padding: '9px 18px', borderRadius: 10, border: 'none',
              background: canSave ? 'linear-gradient(135deg,#374151,#1F2937)' : '#E5E7EB',
              fontSize: 13, fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed',
              color: canSave ? '#fff' : '#9CA3AF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Ban style={{ width: 14, height: 14 }} /> {isEdit ? 'Salvar Bloqueio' : 'Criar Bloqueio'}
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
function AppointmentDetailModal({ apt, profissionais, onClose, onEdit, onDelete, onDeleteAll, onStatusChange }) {
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const prof = profissionais.find(p => p.nome === apt.profissional);
  const st = STATUS_CONFIG[apt.status] || STATUS_CONFIG.aguardando_confirmacao;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(4px)', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden', position: 'relative' }} onClick={e => e.stopPropagation()}>
        
        {showConfirmDeleteAll && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.35)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#fff', border: '1px solid #FCA5A5', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: 320 }}>
              <AlertTriangle style={{ width: 44, height: 44, color: '#EF4444', margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1F2937', marginBottom: 8 }}>Excluir Todos</h3>
              <p style={{ fontSize: 14, color: '#4B5563', marginBottom: 24, lineHeight: 1.4 }}>
                Deseja realmente excluir TODOS os agendamentos fixos desta pessoa?
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => setShowConfirmDeleteAll(false)} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#6B7280' }}>
                  Voltar
                </button>
                <button onClick={() => onDeleteAll(apt)} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#EF4444', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  Excluir Todos
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ background: prof ? `linear-gradient(135deg,${prof.cor},${prof.cor}88)` : 'linear-gradient(135deg,#C73B6D,#9B2C50)', padding: '22px 22px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Agendamento</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                {apt.paciente}
                {apt.fixo && (
                  <div title="Cliente Fixo" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#3B82F6', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                    <Repeat2 style={{ width: 10, height: 10 }} />FIXO
                  </div>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Scissors style={{ width: 13, height: 13 }} />{apt.servico}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: 16, height: 16, color: '#fff' }} />
            </button>
          </div>
          <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '3px 10px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'block' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{st.label}</span>
          </div>
        </div>
        <div style={{ padding: 22 }}>
          {[
            { icon: Calendar, label: 'Data', value: new Date(apt.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) },
            { icon: Clock, label: 'Horário', value: `${apt.hora} – ${apt.horaFim} (${apt.duracao} min)` },
            { icon: User, label: 'Profissional', value: apt.profissional },
            { icon: DollarSign, label: 'Valor', value: apt.valor ? `R$ ${Number(apt.valor).toFixed(2)}` : '—' },
            apt.telefone && { icon: Phone, label: 'Telefone', value: apt.telefone },
            apt.observacoes && { icon: Edit3, label: 'Obs.', value: apt.observacoes },
          ].filter(Boolean).map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#FDF8F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon style={{ width: 13, height: 13, color: '#C73B6D' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginBottom: 1 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 500 }}>{value}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 4, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Alterar Status</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <button key={k} onClick={() => onStatusChange(apt.id, k)} style={{
                  padding: '4px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  border: `1.5px solid ${apt.status === k ? v.color : v.border}`,
                  background: apt.status === k ? v.bg : '#fff',
                  color: apt.status === k ? v.color : '#6B7280',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}>{v.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 14, borderTop: '1px solid #F0EBE6' }}>
            <button onClick={() => onDelete(apt.id)} style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #FCA5A5', background: '#FFF5F5', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Trash2 style={{ width: 13, height: 13 }} />Excluir
            </button>
            {apt.fixo && (
              <button onClick={() => setShowConfirmDeleteAll(true)} style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #EF4444', background: '#FEF2F2', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 style={{ width: 13, height: 13 }} />Excluir Todos
              </button>
            )}
            <button onClick={() => onEdit(apt)} style={{ flex: 1, padding: '8px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#C73B6D,#A83158)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Edit3 style={{ width: 13, height: 13 }} />Editar
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
  const [pacientes, setPacientes] = useState([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [clienteBusca, setClienteBusca] = useState(isEdit ? apt.paciente : '');
  const [showClienteList, setShowClienteList] = useState(false);
  const clienteRef = useRef(null);

  useEffect(() => {
    async function load() {
      const { data } = await fetchClients();
      if (data) {
        setPacientes(data.map(item => ({
          nome: item.name,
          telefone: item.phone,
          email: item.email
        })));
      }
    }
    load();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (clienteRef.current && !clienteRef.current.contains(e.target)) setShowClienteList(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const clientesFiltrados = useMemo(() => {
    const q = clienteBusca.toLowerCase().trim();
    if (!q) return pacientes.slice(0, 8);

    const filtered = pacientes.filter(p => {
      const nome = (p.nome || '').toLowerCase();
      return nome.includes(q) || (p.telefone && p.telefone.includes(q));
    });

    // Sort by relevance: names that START with the search term come first
    filtered.sort((a, b) => {
      const aName = (a.nome || '').toLowerCase();
      const bName = (b.nome || '').toLowerCase();
      const aStarts = aName.startsWith(q);
      const bStarts = bName.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aName.localeCompare(bName, 'pt-BR');
    });

    return filtered;
  }, [pacientes, clienteBusca]);

  const [form, setForm] = useState(() => isEdit ? { ...apt } : {
    data: fmtDate(date), hora: prefillHora || '09:00',
    horaFim: calcEndTime(prefillHora || '09:00', 60), duracao: 60,
    paciente: '', telefone: '', profissional: prefillProf || '', servico: '',
    status: 'aguardando_confirmacao', valor: '', observacoes: '',
  });
  const [repetir, setRepetir] = useState(false);
  const [recFreq, setRecFreq] = useState('semanal');
  const [recAte, setRecAte] = useState('');

  const REC_FREQ = [
    { k: 'semanal', l: 'Toda semana' },
    { k: 'quinzenal', l: 'Semana sim, semana não' },
    { k: '3semanas', l: 'A cada 3 semanas' },
    { k: '4semanas', l: 'A cada 4 semanas' },
    { k: '6semanas', l: 'A cada 6 semanas' },
    { k: '8semanas', l: 'A cada 8 semanas' },
    { k: '12semanas', l: 'A cada 12 semanas' },
  ];

  const previewRecDates = useMemo(() => {
    if (!repetir || !recAte || !form.data) return [];
    const dates = [];
    const base = new Date(form.data + 'T12:00:00');
    const until = new Date(recAte + 'T23:59:59');
    const step = { semanal: 7, quinzenal: 14, '3semanas': 21, '4semanas': 28, '6semanas': 42, '8semanas': 56, '12semanas': 84 }[recFreq] || 7;
    let cur = new Date(base);
    cur.setDate(cur.getDate() + step);
    while (cur <= until && dates.length < 52) {
      dates.push(cur.toISOString().split('T')[0]);
      cur = new Date(cur);
      cur.setDate(cur.getDate() + step);
    }
    return dates;
  }, [repetir, recAte, recFreq, form.data]);

  const set = useCallback((k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === 'profissional') next.servico = '';
    if (k === 'hora' || k === 'duracao') next.horaFim = calcEndTime(k === 'hora' ? v : f.hora, k === 'duracao' ? Number(v) : Number(f.duracao));
    if (k === 'paciente') { const p = pacientes.find(x => x.nome === v); if (p) next.telefone = p.telefone || ''; }
    if (k === 'servico') {
      const precos = { 'Limpeza de Pele': 180, 'Peeling Químico': 220, 'Botox Facial': 800, 'Design de Sobrancelha': 80, 'Drenagem Linfática': 150, 'Harmonização Facial': 1200, 'Preenchimento Labial': 900, 'Fio de PDO': 1500, 'Bioestimulador': 1800, 'Depilação a Laser': 300, 'Depilação': 80, 'Massagem': 120, 'Microagulhamento': 350, 'Criolipólise': 800, 'Radiofrequência': 250, 'Ultrassom': 200, 'Carboxiterapia': 180 };
      if (precos[v] && !f.valor) next.valor = precos[v];
    }
    return next;
  }), [pacientes]);

  const profObj = profissionais.find(p => p.nome === form.profissional);
  const servicos = profObj ? profObj.servicos : [];
  const canSave = form.paciente && form.profissional && form.servico && form.hora && form.data;

  const handleSave = () => {
    if (!canSave) return;
    const isFixo = repetir && previewRecDates.length > 0;
    const base = { ...form, horaFim: calcEndTime(form.hora, Number(form.duracao) || 60), duracao: Number(form.duracao) || 60, valor: Number(form.valor) || 0, fixo: isFixo || false };
    if (isFixo && !isEdit) {
      const all = [{ ...base, id: genId() }];
      previewRecDates.forEach(d => all.push({ ...base, id: genId(), data: d }));
      onSave(all);
    } else {
      onSave({ ...base, id: apt?.id || genId() });
    }
    onClose();
  };

  const inputSt = { width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#FAFAFA', fontFamily: 'inherit' };
  const labelSt = { fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 5 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,30,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(6px)', padding: 16 }} onClick={onClose}>
      {showNewClient && (
        <QuickClientModal onClose={() => setShowNewClient(false)} onSave={async (c) => {
          const clientData = {
            name: c.nome,
            phone: c.telefone,
            email: c.email || '',
            birthdate: c.data_nascimento || null,
            status: 'ativo'
          };
          const { data } = await insertClient(clientData);
          if (data) {
            const mapped = { nome: data.name, telefone: data.phone, email: data.email };
            setPacientes(prev => [...prev, mapped]);
            set('paciente', mapped.nome);
            set('telefone', mapped.telefone || '');
            setClienteBusca(mapped.nome);
          }
          setShowNewClient(false);
        }} />
      )}
      <div style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 560, boxShadow: '0 32px 80px rgba(0,0,0,0.25)', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid #F0EBE6', background: 'linear-gradient(135deg,#FDF8F5,#fff)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#C73B6D,#9B2C50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarCheck style={{ width: 18, height: 18, color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1F2937' }}>{isEdit ? 'Editar Agendamento' : 'Novo Agendamento'}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{isEdit ? 'Altere os dados e salve' : 'Preencha os dados abaixo'}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: 16, height: 16, color: '#6B7280' }} />
            </button>
          </div>
        </div>

        <div style={{ padding: '18px 26px 26px' }}>
          {/* Cliente */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><User style={{ width: 12, height: 12, color: '#C73B6D' }} />Cliente *</span></label>
            <div style={{ display: 'flex', gap: 6 }}>
              <div ref={clienteRef} style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  value={clienteBusca}
                  onChange={e => { setClienteBusca(e.target.value); setShowClienteList(true); set('paciente', e.target.value); }}
                  onFocus={() => setShowClienteList(true)}
                  placeholder="Digite o nome do cliente..."
                  style={inputSt}
                  autoComplete="off"
                />
                {showClienteList && clientesFiltrados.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10,
                    marginTop: 4, maxHeight: 180, overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  }}>
                    {clientesFiltrados.map(p => {
                      const isSelected = form.paciente === p.nome;
                      return (
                        <div key={p.nome} onClick={() => { set('paciente', p.nome); setClienteBusca(p.nome); setShowClienteList(false); }}
                          style={{
                            padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                            background: isSelected ? '#FDF4F7' : '#fff',
                            borderBottom: '1px solid #F3F4F6',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F9FAFB'; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff'; }}>
                          <span style={{ fontWeight: 500, color: '#1F2937' }}>{p.nome}</span>
                          {p.telefone && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{p.telefone}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <button onClick={() => setShowNewClient(true)} title="Cadastrar novo cliente" style={{ width: 40, height: 40, borderRadius: 10, border: 'none', flexShrink: 0, background: 'linear-gradient(135deg,#C73B6D,#A83158)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(199,59,109,0.3)' }}>
                <Plus style={{ width: 18, height: 18, color: '#fff' }} />
              </button>
            </div>
          </div>

          {/* Data + Hora + Duração */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelSt}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Calendar style={{ width: 12, height: 12, color: '#C73B6D' }} />Data *</span></label>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Clock style={{ width: 12, height: 12, color: '#C73B6D' }} />Horário *</span></label>
              <input list="apt-horarios" value={form.hora} onChange={e => set('hora', e.target.value)} placeholder="09:00" style={inputSt} />
              <datalist id="apt-horarios">{HORARIOS_SUGERIDOS.map(h => <option key={h} value={h} />)}</datalist>
            </div>
            <div>
              <label style={labelSt}>Duração (min)</label>
              <select value={form.duracao} onChange={e => set('duracao', e.target.value)} style={inputSt}>
                {[15, 20, 30, 45, 60, 75, 90, 120, 150, 180].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          {form.hora && form.duracao && (
            <div style={{ marginBottom: 14, padding: '7px 12px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#065F46' }}>
              <CheckCircle style={{ width: 13, height: 13 }} />Término previsto: <strong>{form.horaFim}</strong>
            </div>
          )}

          {/* Profissional */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Scissors style={{ width: 12, height: 12, color: '#C73B6D' }} />Profissional *</span></label>
            <select value={form.profissional} onChange={e => set('profissional', e.target.value)} style={inputSt}>
              <option value="">Selecione...</option>
              {profissionais.map(p => <option key={p.nome} value={p.nome}>{p.nome} — {p.cargo}</option>)}
            </select>
          </div>

          {/* Serviço */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Star style={{ width: 12, height: 12, color: '#C73B6D' }} />Serviço *</span></label>
            {!form.profissional ? (
              <div style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px dashed #E5E7EB', color: '#9CA3AF', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
                <AlertCircle style={{ width: 14, height: 14 }} />Selecione uma profissional primeiro
              </div>
            ) : servicos.length === 0 ? (
              <div style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px dashed #FCA5A5', color: '#EF4444', fontSize: 13, background: '#FFF5F5' }}>Nenhum serviço cadastrado</div>
            ) : (
              <select value={form.servico} onChange={e => set('servico', e.target.value)} style={inputSt}>
                <option value="">Selecione o serviço...</option>
                {servicos.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>

          {/* Valor + Telefone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelSt}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><DollarSign style={{ width: 12, height: 12, color: '#C73B6D' }} />Valor (R$)</span></label>
              <input type="number" step="0.01" placeholder="0,00" value={form.valor} onChange={e => set('valor', e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Phone style={{ width: 12, height: 12, color: '#C73B6D' }} />Telefone</span></label>
              <input type="tel" placeholder="(11) 99999-9999" value={form.telefone} onChange={e => set('telefone', e.target.value)} style={inputSt} />
            </div>
          </div>

          {/* Status */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Status</label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('status', k)} style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  border: `1.5px solid ${form.status === k ? v.color : v.border}`,
                  background: form.status === k ? v.bg : '#fff',
                  color: form.status === k ? v.color : '#9CA3AF',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}>{v.label}</button>
              ))}
            </div>
          </div>

          {/* Repetir */}
          <div style={{ marginBottom: 14, padding: 14, borderRadius: 12, border: '1.5px solid #E5E7EB', background: '#F9FAFB' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ ...labelSt, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0, whiteSpace: 'nowrap' }}>
                <Repeat2 style={{ width: 14, height: 14, color: '#C73B6D' }} />Repetir:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: !repetir ? '#1F2937' : '#9CA3AF' }}>
                  <input type="radio" name="repetir" checked={!repetir} onChange={() => setRepetir(false)} style={{ width: 16, height: 16, accentColor: '#C73B6D', cursor: 'pointer' }} />
                  Não
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: repetir ? '#1F2937' : '#9CA3AF' }}>
                  <input type="radio" name="repetir" checked={repetir} onChange={() => setRepetir(true)} style={{ width: 16, height: 16, accentColor: '#C73B6D', cursor: 'pointer' }} />
                  Sim
                </label>
              </div>
            </div>
            {repetir && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ ...labelSt, fontSize: 11 }}>Frequência</label>
                  <select value={recFreq} onChange={e => setRecFreq(e.target.value)} style={inputSt}>
                    {REC_FREQ.map(o => <option key={o.k} value={o.k}>{o.l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...labelSt, fontSize: 11 }}>Repetir até</label>
                  <input type="date" value={recAte} min={form.data} onChange={e => setRecAte(e.target.value)} style={inputSt} />
                </div>
                {previewRecDates.length > 0 && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>{previewRecDates.length} agendamento(s) adicionais:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 60, overflowY: 'auto' }}>
                      {previewRecDates.map(d => {
                        const [y, m, dd] = d.split('-');
                        return <span key={d} style={{ fontSize: 10, background: '#FDF2F8', color: '#C73B6D', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>{dd}/{m}</span>;
                      })}
                    </div>
                  </div>
                )}
                {repetir && !recAte && (
                  <div style={{ gridColumn: 'span 2', fontSize: 11, color: '#E67E22' }}>Selecione a data final da recorrência</div>
                )}
              </div>
            )}
          </div>

          {/* Observações */}
          <div style={{ marginBottom: 22 }}>
            <label style={labelSt}>Observações (opcional):</label>
            <textarea value={form.observacoes} maxLength={400} onChange={e => set('observacoes', e.target.value)} placeholder="Notas sobre o atendimento..." style={{ ...inputSt, minHeight: 64, resize: 'vertical' }} />
            <div style={{ textAlign: 'right', fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{(form.observacoes || '').length} de 400 caracteres</div>
          </div>

          <div style={{ display: 'flex', gap: 8, paddingTop: 14, borderTop: '1px solid #F0EBE6' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6B7280' }}>Cancelar</button>
            <button onClick={handleSave} disabled={!canSave} style={{
              flex: 1, padding: '9px 18px', borderRadius: 10, border: 'none',
              background: canSave ? 'linear-gradient(135deg,#C73B6D,#A83158)' : '#E5E7EB',
              fontSize: 13, fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed',
              color: canSave ? '#fff' : '#9CA3AF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <CheckCircle style={{ width: 14, height: 14 }} />{isEdit ? 'Salvar Alterações' : 'Confirmar Agendamento'}
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
  const dateStr = fmtDate(date);
  const apts = agendamentos.filter(a => a.data === dateStr);
  const total = apts.length;

  const conf = apts.filter(a => a.status === 'confirmado').length;
  const pend = apts.filter(a => a.status === 'aguardando_confirmacao').length;
  const atend = apts.filter(a => a.status === 'em_atendimento').length;
  const finalizado = apts.filter(a => a.status === 'finalizado').length;
  const faltou = apts.filter(a => a.status === 'cliente_faltou').length;

  const getPct = (val) => total > 0 ? Math.round((val / total) * 100) : 0;

  const confPct = getPct(conf);
  const pendPct = getPct(pend);
  const atendPct = getPct(atend);
  const finalizadoPct = getPct(finalizado);
  const faltouPct = getPct(faltou);

  const items = [
    { label: 'Confirmados', value: conf, pct: confPct, icon: CheckSquare, color: '#27AE60', bg: '#EAFAF1' },
    { label: 'Aguardando', value: pend, pct: pendPct, icon: Clock, color: '#E67E22', bg: '#FDF2E9' },
    { label: 'Em Atendimento', value: atend, pct: atendPct, icon: Scissors, color: '#46D6BF', bg: '#E5FAF6' },
    { label: 'Finalizado', value: finalizado, pct: finalizadoPct, icon: CheckCircle, color: '#3498DB', bg: '#EBF5FB' },
    { label: 'Cliente Faltou', value: faltou, pct: faltouPct, icon: XCircle, color: '#7F8C8D', bg: '#F2F3F4' },
  ];

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 14, border: '1px solid #F0EBE6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#9CA3AF', marginBottom: 2, textTransform: 'uppercase' }}>Resumo do Dia</div>
      
      {/* Total Card Hero */}
      <div style={{ background: 'linear-gradient(135deg, #FDF4F7, #FFF5F8)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#C73B6D', lineHeight: 1 }}>{total}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#852A4B', marginTop: 2 }}>Agendamentos</div>
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(199,59,109,0.1)' }}>
          <CalendarCheck style={{ width: 14, height: 14, color: '#C73B6D' }} />
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#F3F4F6' }}>
          <div style={{ width: `${confPct}%`, background: '#27AE60', transition: 'width 0.3s ease' }} title={`Confirmados: ${confPct}%`} />
          <div style={{ width: `${pendPct}%`, background: '#E67E22', transition: 'width 0.3s ease' }} title={`Aguardando: ${pendPct}%`} />
          <div style={{ width: `${atendPct}%`, background: '#46D6BF', transition: 'width 0.3s ease' }} title={`Em Atendimento: ${atendPct}%`} />
          <div style={{ width: `${finalizadoPct}%`, background: '#3498DB', transition: 'width 0.3s ease' }} title={`Finalizado: ${finalizadoPct}%`} />
          <div style={{ width: `${faltouPct}%`, background: '#7F8C8D', transition: 'width 0.3s ease' }} title={`Cliente Faltou: ${faltouPct}%`} />
        </div>
      )}

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon style={{ width: 11, height: 11, color: item.color }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#4B5563' }}>{item.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1F2937' }}>{item.value}</span>
                {total > 0 && (
                  <span style={{ fontSize: 9, color: '#6B7280', background: '#F3F4F6', padding: '1px 4px', borderRadius: 4 }}>
                    {item.pct}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── BlockCard ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function BlockCard({ blq, onClick, col, totalCols }) {
  const cfg = BLOQUEIO_TIPOS[blq.tipo] || BLOQUEIO_TIPOS.outro;
  const Icon = cfg.icon;
  const w = totalCols > 1 ? `${100 / totalCols}%` : '100%';
  const left = totalCols > 1 ? `${(col / totalCols) * 100}%` : '0';

  return (
    <div onClick={e => { e.stopPropagation(); onClick(blq); }}
      style={{
        position: 'absolute', left: `calc(${left} + 1px)`, width: `calc(${w} - 2px)`, height: '100%',
        backgroundImage: cfg.stripe
          ? `repeating-linear-gradient(-45deg, ${cfg.bg} 0px, ${cfg.bg} 5px, ${cfg.bg}cc 5px, ${cfg.bg}cc 10px)`
          : 'none',
        backgroundColor: cfg.bg,
        border: `1.5px solid ${cfg.border}`,
        borderRadius: 6, padding: '3px 7px',
        cursor: 'pointer', overflow: 'hidden', transition: 'opacity 0.12s',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1,
        boxSizing: 'border-box',
        pointerEvents: 'auto',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {Icon ? <Icon style={{ width: 10, height: 10, color: cfg.color, flexShrink: 0 }} /> : null}
        <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {blq.observacoes || cfg.label}
        </span>
      </div>
      <div style={{ fontSize: 9, color: cfg.color, opacity: 0.8 }}>{blq.hora} – {blq.horaFim}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── AppointmentCard ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function AppointmentCard({ apt, prof, onClick, col, totalCols }) {
  const st = STATUS_CONFIG[apt.status] || STATUS_CONFIG.aguardando_confirmacao;
  const w = totalCols > 1 ? `${100 / totalCols}%` : '100%';
  const left = totalCols > 1 ? `${(col / totalCols) * 100}%` : '0';

  return (
    <div onClick={e => { e.stopPropagation(); onClick(apt); }}
      style={{
        position: 'absolute',
        left: `calc(${left} + 2px)`,
        width: `calc(${w} - 4px)`,
        height: '100%',
        background: st.bg,
        border: `1.5px solid ${st.border}`,
        borderLeft: `3px solid ${st.color}`,
        borderRadius: 6, padding: '3px 6px',
        cursor: 'pointer', overflow: 'hidden',
        transition: 'transform 0.1s, box-shadow 0.1s',
        zIndex: 10,
        pointerEvents: 'auto',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = `0 3px 10px ${st.color}30`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: st.color, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {apt.paciente}
        </div>
        {apt.fixo && (
          <div title="Cliente Fixo" style={{ width: 14, height: 14, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Repeat2 style={{ width: 8, height: 8, color: '#fff' }} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, color: `${st.color}cc`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{apt.servico}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600 }}>{apt.hora}–{apt.horaFim}</span>
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
  const [agendamentos, setAgendamentos] = useState([]);
  const [bloqueios, setBloqueios] = useState([]);
  const [viewMode, setViewMode] = useState('day');

  // Modals
  const [formModal, setFormModal] = useState({ open: false, apt: null, prefillProf: '', prefillHora: '' });
  const [detailModal, setDetailModal] = useState({ open: false, apt: null });
  const [bloqueioModal, setBloqueioModal] = useState({ open: false, bloqueio: null, prefillProf: '', prefillHora: '' });

  // Load from Supabase on mount
  useEffect(() => {
    async function loadData() {
      const { data: aptData } = await fetchAppointments();
      if (aptData) {
        const mappedApts = [];
        const mappedBloqueios = [];
        aptData.forEach(item => {
          const mapped = mapFromSupabase(item);
          if (item.status === 'bloqueado') {
            mappedBloqueios.push(mapped);
          } else {
            mappedApts.push(mapped);
          }
        });
        setAgendamentos(mappedApts);
        setBloqueios(mappedBloqueios);
      }
    }
    loadData();
  }, []);

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const navigateDate = dir => {
    const d = new Date(selectedDate);
    if (viewMode === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setSelectedDate(d);
  };

  const openNew = (prof = '', hora = '') => setFormModal({ open: true, apt: null, prefillProf: prof, prefillHora: hora });
  const openEdit = apt => { setDetailModal({ open: false, apt: null }); setFormModal({ open: true, apt, prefillProf: '', prefillHora: '' }); };
  const openDetail = apt => setDetailModal({ open: true, apt });
  const openBloqueio = (prof = '', hora = '', blq = null) => setBloqueioModal({ open: true, bloqueio: blq, prefillProf: prof, prefillHora: hora });

  const handleSave = async (payload) => {
    const list = Array.isArray(payload) ? payload : [payload];
    const updatedApts = [];
    for (const item of list) {
      const sbItem = mapToSupabase(item, false);
      let res;
      if (item.id && !item.id.startsWith('apt_') && !item.id.startsWith('id_')) {
        res = await updateAppointment(item.id, sbItem);
      } else {
        res = await insertAppointment(sbItem);
      }
      if (res.data) {
        updatedApts.push(mapFromSupabase(res.data));
      }
    }
    setAgendamentos(prev => {
      const ids = new Set(updatedApts.map(a => a.id));
      return [...prev.filter(a => !ids.has(a.id)), ...updatedApts];
    });
  };

  const handleDelete = async (id) => {
    await deleteAppointment(id);
    setAgendamentos(prev => prev.filter(a => a.id !== id));
    setDetailModal({ open: false, apt: null });
  };

  const handleDeleteAllFixo = async (apt) => {
    const toDelete = agendamentos.filter(a => 
      a.fixo && 
      a.paciente === apt.paciente && 
      a.profissional === apt.profissional && 
      a.servico === apt.servico && 
      a.hora === apt.hora
    );
    for (const d of toDelete) {
      await deleteAppointment(d.id);
    }
    const ids = new Set(toDelete.map(a => a.id));
    setAgendamentos(prev => prev.filter(a => !ids.has(a.id)));
    setDetailModal({ open: false, apt: null });
  };

  const handleStatusChange = async (id, status) => {
    const { data } = await updateAppointment(id, { status });
    if (data) {
      const mapped = mapFromSupabase(data);
      setAgendamentos(prev => prev.map(a => a.id === id ? mapped : a));
      setDetailModal(prev => prev.apt?.id === id ? { ...prev, apt: mapped } : prev);
    }
  };

  const handleSaveBloqueio = async (payload) => {
    const sbItem = mapToSupabase(payload, true);
    let res;
    if (payload.id && !payload.id.startsWith('blq_') && !payload.id.startsWith('id_')) {
      res = await updateAppointment(payload.id, sbItem);
    } else {
      res = await insertAppointment(sbItem);
    }
    if (res.data) {
      const mapped = mapFromSupabase(res.data);
      setBloqueios(prev => [...prev.filter(b => b.id !== mapped.id), mapped]);
    }
  };

  const handleDeleteBloqueio = async (id) => {
    await deleteAppointment(id);
    setBloqueios(prev => prev.filter(b => b.id !== id));
  };

  const dateLabel = useMemo(() => {
    if (viewMode === 'week') {
      const f = weekDays[0], l = weekDays[weekDays.length - 1];
      return `${f.getDate()}/${f.getMonth() + 1} – ${l.getDate()}/${l.getMonth() + 1}/${l.getFullYear()}`;
    }
    return selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, [selectedDate, viewMode, weekDays]);

  const aptsDodia = useMemo(() => agendamentos.filter(a => a.data === fmtDate(selectedDate)), [agendamentos, selectedDate]);
  const blqDodia = useMemo(() => bloqueios.filter(b => b.data === fmtDate(selectedDate)), [bloqueios, selectedDate]);

  // Posição no grid
  function itemPos(item) {
    const startMins = timeToMinutes(item.hora) - HOUR_START * 60;
    const endMins = timeToMinutes(item.horaFim || calcEndTime(item.hora, item.duracao || 60)) - HOUR_START * 60;
    return { top: Math.max(0, startMins * PX_PER_MIN), height: Math.max(18, (endMins - startMins) * PX_PER_MIN) };
  }

  const gridHeight = (HOUR_END - HOUR_START) * SLOT_HEIGHT;
  const today = new Date();

  // Para cada coluna, calcula layout side-by-side
  function computeColLayout(colItems) {
    if (!colItems.length) return {};
    const forCompute = colItems.map(it => ({
      id: it.id,
      startMin: timeToMinutes(it.hora),
      endMin: timeToMinutes(it.horaFim || calcEndTime(it.hora, it.duracao || 60)),
    }));
    return computeColumns(forCompute);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', gap: 0 }}>

      {/* Modals */}
      {formModal.open && (
        <AgendamentoModal onClose={() => setFormModal({ open: false, apt: null, prefillProf: '', prefillHora: '' })}
          date={selectedDate} profissional={formModal.prefillProf} hora={formModal.prefillHora}
          profissionais={profissionais} apt={formModal.apt} onSave={handleSave} />
      )}
      {detailModal.open && detailModal.apt && (
        <AppointmentDetailModal apt={detailModal.apt} profissionais={profissionais}
          onClose={() => setDetailModal({ open: false, apt: null })}
          onEdit={openEdit} onDelete={handleDelete} onDeleteAll={handleDeleteAllFixo} onStatusChange={handleStatusChange} />
      )}
      {bloqueioModal.open && (
        <BloqueioModal onClose={() => setBloqueioModal({ open: false, bloqueio: null, prefillProf: '', prefillHora: '' })}
          date={selectedDate} profissional={bloqueioModal.prefillProf} hora={bloqueioModal.prefillHora}
          profissionais={profissionais} bloqueio={bloqueioModal.bloqueio}
          onSave={handleSaveBloqueio} onDelete={handleDeleteBloqueio} />
      )}

      {/* Top Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#C73B6D,#9B2C50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarCheck style={{ width: 16, height: 16, color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#C73B6D', textTransform: 'uppercase' }}>Agenda</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', textTransform: 'capitalize' }}>{dateLabel}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigateDate(-1)} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', padding: '6px 10px', display: 'flex' }}>
            <ChevronLeft style={{ width: 16, height: 16, color: '#6B7280' }} />
          </button>
          <button onClick={() => setSelectedDate(new Date())} style={{ background: sameDay(selectedDate, today) ? '#C73B6D' : '#fff', color: sameDay(selectedDate, today) ? '#fff' : '#374151', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Hoje</button>
          <button onClick={() => navigateDate(1)} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', padding: '6px 10px', display: 'flex' }}>
            <ChevronRight style={{ width: 16, height: 16, color: '#6B7280' }} />
          </button>
          {/* View toggle */}
          <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 8, padding: 3 }}>
            {[{ k: 'day', icon: List, label: 'Dia' }, { k: 'week', icon: Grid, label: 'Semana' }].map(({ k, icon: Icon, label }) => (
              <button key={k} onClick={() => setViewMode(k)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: viewMode === k ? '#fff' : 'transparent', color: viewMode === k ? '#1F2937' : '#9CA3AF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, boxShadow: viewMode === k ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.12s' }}>
                <Icon style={{ width: 13, height: 13 }} />{label}
              </button>
            ))}
          </div>
          {/* Bloquear Horário */}
          <button onClick={() => openBloqueio()} style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E5E7EB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F3F4F6'; }}>
            <Ban style={{ width: 14, height: 14 }} />Ausência
          </button>
          {/* Novo Agendamento */}
          <button onClick={() => openNew()} style={{ background: 'linear-gradient(135deg,#C73B6D,#9B2C50)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 3px 10px rgba(199,59,109,0.35)', transition: 'transform 0.12s,box-shadow 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(199,59,109,0.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(199,59,109,0.35)'; }}>
            <Plus style={{ width: 15, height: 15 }} />Novo Agendamento
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>

        {/* Sidebar */}
        <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, overflowY: 'auto' }}>
          <MiniCalendar selectedDate={selectedDate} onSelect={setSelectedDate} agendamentos={agendamentos} />
          
          {/* Stats */}
          <DayStats agendamentos={agendamentos} date={selectedDate} />



          {/* Legenda Status */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 14, border: '1px solid #F0EBE6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase' }}>Status</div>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: v.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>{v.label}</span>
              </div>
            ))}
          </div>

        </div>

        {/* Grid */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 16, border: '1px solid #F0EBE6', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>

          {/* Header colunas */}
          <div style={{ display: 'flex', borderBottom: '2px solid #F0EBE6', background: '#FAFAFA', flexShrink: 0 }}>
            <div style={{ width: 64, flexShrink: 0 }} />
            {(viewMode === 'day' ? profissionais : weekDays).map((item, i) => {
              if (viewMode === 'day') {
                const p = item;
                const cnt = aptsDodia.filter(a => a.profissional === p.nome).length;
                const blqCnt = blqDodia.filter(b => b.profissional === p.nome).length;
                return (
                  <div key={p.nome} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 6px', borderLeft: i > 0 ? '1px solid #F0EBE6' : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                    onClick={() => openNew(p.nome, '')}
                    onMouseEnter={e => e.currentTarget.style.background = '#FDF8F5'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, marginBottom: 6, position: 'relative' }}>
                      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', zIndex: 0 }}>{p.nome.charAt(0)}</span>
                      <img 
                        src={localStorage.getItem('avatar_' + p.id) || `/${p.nome.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}.png`} 
                        alt={p.nome} 
                        style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'relative', zIndex: 1, backgroundColor: 'transparent' }} 
                        onError={(e) => { e.target.style.display = 'none'; e.target.previousSibling.style.color = p.cor; e.target.previousSibling.style.background = p.cor + '22'; e.target.previousSibling.style.borderRadius = '50%'; }} 
                      />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1F2937' }}>{p.nome}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>{p.cargo}</div>
                  </div>
                );
              } else {
                const d = item;
                const isT = sameDay(d, today);
                const isSel = sameDay(d, selectedDate);
                const cnt = agendamentos.filter(a => a.data === fmtDate(d)).length;
                return (
                  <div key={fmtDate(d)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 5px', borderLeft: i > 0 ? '1px solid #F0EBE6' : 'none', cursor: 'pointer', background: isSel ? '#FDF4F7' : 'transparent', transition: 'background 0.12s' }}
                    onClick={() => { setSelectedDate(new Date(d)); setViewMode('day'); }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>{d.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', marginTop: 3, background: isT ? '#C73B6D' : isSel ? '#FDF4F7' : 'transparent', border: isSel && !isT ? '2px solid #C73B6D' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: isT ? '#fff' : isSel ? '#C73B6D' : '#374151' }}>
                      {d.getDate()}
                    </div>
                    {cnt > 0 && <span style={{ marginTop: 2, width: 5, height: 5, borderRadius: '50%', background: '#C73B6D' }} />}
                  </div>
                );
              }
            })}
          </div>

          {/* Time Grid */}
          <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
            <div style={{ position: 'relative', minHeight: (gridHeight + 32) + 'px', display: 'flex', paddingBottom: 32 }}>

              {/* Coluna de horas */}
              <div style={{ width: 64, flexShrink: 0, position: 'relative', background: '#FAFAFA', borderRight: '1px solid #F0EBE6' }}>
                {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => {
                  const h = HOUR_START + i;
                  const top = i * SLOT_HEIGHT;
                  return (
                    <div key={h} style={{ position: 'absolute', top: top - 7, left: 0, width: 64, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10 }}>
                      <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{String(h).padStart(2, '0')}:00</span>
                    </div>
                  );
                })}
              </div>

              {/* Colunas das profissionais */}
              {(viewMode === 'day' ? profissionais : weekDays).map((item, colIdx) => {
                const key = viewMode === 'day' ? item.nome : fmtDate(item);
                const colApts = viewMode === 'day'
                  ? aptsDodia.filter(a => a.profissional === item.nome)
                  : agendamentos.filter(a => a.data === fmtDate(item));
                const colBlqs = viewMode === 'day'
                  ? blqDodia.filter(b => b.profissional === item.nome)
                  : bloqueios.filter(b => b.data === fmtDate(item));
                const colColor = viewMode === 'day' ? item.cor : '#C73B6D';

                // Computar layout side-by-side para apts e bloqueios juntos
                const allItems = [
                  ...colApts.map(a => ({ ...a, _kind: 'apt' })),
                  ...colBlqs.map(b => ({ ...b, _kind: 'blq' })),
                ];
                const layout = computeColLayout(allItems);

                return (
                  <div key={key} style={{ flex: 1, position: 'relative', borderLeft: colIdx > 0 ? '1px solid #F0EBE6' : 'none' }}>
                    {/* Linhas de hora — sem gap entre elas */}
                    {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => (
                      <div key={i} style={{ position: 'absolute', top: i * SLOT_HEIGHT, left: 0, right: 0, height: SLOT_HEIGHT, borderTop: `1px solid ${i === 0 ? 'transparent' : '#F0EBE6'}`, zIndex: 0 }}>
                        <div style={{ position: 'absolute', top: SLOT_HEIGHT / 2, left: 0, right: 0, borderTop: '1px dashed #F3F4F6' }} />
                      </div>
                    ))}

                    {/* Zona clicável */}
                    <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}
                      onClick={(e) => {
                        if (viewMode === 'day') {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickY = e.clientY - rect.top;
                          const hourIndex = Math.floor(clickY / SLOT_HEIGHT);
                          const minutesFraction = clickY % SLOT_HEIGHT;
                          let clickedHour = HOUR_START + hourIndex;
                          let clickedMinute = minutesFraction >= SLOT_HEIGHT / 2 ? 30 : 0;
                          if (clickedHour >= HOUR_END) {
                            clickedHour = HOUR_END;
                            clickedMinute = 0;
                          }
                          const timeString = `${String(clickedHour).padStart(2, '0')}:${String(clickedMinute).padStart(2, '0')}`;
                          openNew(item.nome, timeString);
                        } else {
                          setSelectedDate(new Date(item));
                          setViewMode('day');
                        }
                      }}
                    />

                    {/* Bloqueios */}
                    {colBlqs.map(blq => {
                      const { top, height } = itemPos(blq);
                      const lay = layout[blq.id] || { col: 0, totalCols: 1 };
                      return (
                        <div key={blq.id} style={{ position: 'absolute', top, left: 0, right: 0, height, zIndex: 4, pointerEvents: 'none' }}>
                          <BlockCard blq={blq} onClick={() => openBloqueio(blq.profissional, blq.hora, blq)} col={lay.col} totalCols={lay.totalCols} />
                        </div>
                      );
                    })}

                    {/* Agendamentos */}
                    {colApts.map(apt => {
                      const { top, height } = itemPos(apt);
                      const lay = layout[apt.id] || { col: 0, totalCols: 1 };
                      const profItem = viewMode === 'day' ? item : profissionais.find(p => p.nome === apt.profissional);
                      return (
                        <div key={apt.id} style={{ position: 'absolute', top, left: 0, right: 0, height, zIndex: 5, pointerEvents: 'none' }}>
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
