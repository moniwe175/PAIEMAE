import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Star, XCircle, CheckCircle,
  Clock, Phone, User, Scissors, AlertCircle, Calendar
} from 'lucide-react';
import { useProfissionais } from '../lib/profissionais';

// ─── Config ─────────────────────────────────────────────────

const HORAS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];


const PACIENTES_KEY = 'erp_pacientes';
const DEFAULT_PACIENTES = ['Fernanda Lima','Carla Mendes','Ana Beatriz','Juliana Costa','Patrícia Rocha','Mariana Alves','Isabela Santos'];

function loadPacientes() {
  try {
    const raw = localStorage.getItem(PACIENTES_KEY);
    if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length > 0) return parsed; }
  } catch (e) {}
  localStorage.setItem(PACIENTES_KEY, JSON.stringify(DEFAULT_PACIENTES));
  return [...DEFAULT_PACIENTES];
}
function savePacientes(list) { localStorage.setItem(PACIENTES_KEY, JSON.stringify(list)); }

const STATUS_MAP = {
  confirmado: { label: 'Confirmado', bg: '#DEF7EC', color: '#03543F' },
  aguardando: { label: 'Aguardando', bg: '#FEF3C7', color: '#92400E' },
  concluido:  { label: 'Concluído',  bg: '#E1EFFE', color: '#1E429F' },
  cancelado:  { label: 'Cancelado',  bg: '#FDE8E8', color: '#9B1C1C' },
};

// ─── Helpers ────────────────────────────────────────────────
function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return date;
}

function fmtDate(d) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ─── Calendar Widget ────────────────────────────────────────
function MiniCalendar({ selectedDate, onSelect }) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const days = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));

  const monthLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const weekLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1px solid #F0EBE6' }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ChevronLeft style={{ width: 16, height: 16, color: '#999' }} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize', color: '#1F2937' }}>{monthLabel}</span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ChevronRight style={{ width: 16, height: 16, color: '#999' }} />
        </button>
      </div>

      {/* Week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {weekLabels.map((l, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#9CA3AF' }}>{l}</div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {days.map((d, i) => {
          if (!d) return <div key={i} />;
          const isToday = sameDay(d, today);
          const isSelected = sameDay(d, selectedDate);
          return (
            <button
              key={i}
              onClick={() => onSelect(new Date(d))}
              style={{
                width: 30, height: 30,
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: isToday || isSelected ? 700 : 400,
                background: isSelected ? '#C73B6D' : 'transparent',
                color: isSelected ? '#fff' : isToday ? '#C73B6D' : '#374151',
                outline: isToday && !isSelected ? '2px solid #C73B6D' : 'none',
                outlineOffset: -2,
                transition: 'all 0.15s',
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quick Client Modal ────────────────────────────────────
function QuickClientModal({ onClose, onSave }) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const handleSubmit = () => {
    if (!nome.trim()) return;
    onSave({ nome: nome.trim(), telefone, email });
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <span className="modal-title">Novo Cliente</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-group">
          <label className="form-label">Nome *</label>
          <input className="form-input" placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-input" placeholder="(11) 99999-9999" value={telefone} onChange={e => setTelefone(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit}><Plus />Cadastrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── New Appointment Modal ─────────────────────────────────
function AgendamentoModal({ onClose, date, profissional, hora, profissionais }) {
  const profObj = profissionais.find(p => p.nome === profissional);
  const servicosDisponiveis = profObj ? profObj.servicos : profissionais.flatMap(p => p.servicos);
  const [pacientes, setPacientes] = useState(loadPacientes);
  const [showNewClient, setShowNewClient] = useState(false);

  const [form, setForm] = useState({
    data: date.toISOString().split('T')[0],
    hora: hora || '09:00',
    paciente: '',
    servico: '',
    profissional: profissional || '',
    observacoes: '',
  });
  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    // If professional changes, clear service (it may not be valid for new prof)
    if (k === 'profissional') next.servico = '';
    return next;
  });

  const currentProfObj = profissionais.find(p => p.nome === form.profissional);
  const currentServicos = currentProfObj ? currentProfObj.servicos : servicosDisponiveis;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {showNewClient && (
          <QuickClientModal
            onClose={() => setShowNewClient(false)}
            onSave={(client) => {
              const updated = [...pacientes, client.nome];
              setPacientes(updated);
              savePacientes(updated);
              set('paciente', client.nome);
            }}
          />
        )}
        <div className="modal-header">
          <span className="modal-title">Novo Agendamento</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-group">
          <label className="form-label">Paciente</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <select className="form-select" value={form.paciente} onChange={e => set('paciente', e.target.value)} style={{ flex: 1 }}>
              <option value="">Selecione...</option>
              {pacientes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setShowNewClient(true)}
              title="Cadastrar novo cliente"
              style={{
                background: '#C73B6D', color: '#fff', border: 'none',
                borderRadius: 8, width: 38, height: 38, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#A83158'}
              onMouseLeave={e => e.currentTarget.style.background = '#C73B6D'}
            >
              <Plus style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Data</label>
            <input type="date" className="form-input" value={form.data} onChange={e => set('data', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Horário</label>
            <input type="time" className="form-input" value={form.hora} onChange={e => set('hora', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Profissional</label>
          <select
            className="form-select"
            value={form.profissional}
            onChange={e => set('profissional', e.target.value)}
          >
            <option value="">Selecione...</option>
            {profissionais.map(p => <option key={p.nome} value={p.nome}>{p.nome} — {p.cargo}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Serviço</label>
          <select className="form-select" value={form.servico} onChange={e => set('servico', e.target.value)}>
            <option value="">Selecione...</option>
            {currentServicos.map(s => <option key={s}>{s}</option>)}
          </select>
          {form.profissional && currentProfObj && (
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
              Serviços disponíveis para {form.profissional}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Observações</label>
          <textarea className="form-textarea" placeholder="Observações sobre o agendamento..." value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onClose}><CheckCircle />Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Agenda Component ──────────────────────────────────
export default function Agenda() {
  const { profissionais } = useProfissionais();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modal, setModal] = useState(false);
  const [modalData, setModalData] = useState({ profissional: '', hora: '' });
  const [selectedApt, setSelectedApt] = useState(null);

  const openModal = (profissional = '', hora = '') => {
    setModalData({ profissional, hora });
    setModal(true);
  };

  const dateLabel = useMemo(() => {
    const weekday = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' });
    const day = selectedDate.getDate();
    const month = selectedDate.toLocaleDateString('pt-BR', { month: 'long' });
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} De ${month.charAt(0).toUpperCase() + month.slice(1)}`;
  }, [selectedDate]);

  const navigateDate = (dir) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    setSelectedDate(d);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)' }}>
      {modal && <AgendamentoModal onClose={() => setModal(false)} date={selectedDate} profissional={modalData.profissional} hora={modalData.hora} profissionais={profissionais} />}

      {/* ─── Top Header ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star style={{ width: 14, height: 14, color: '#C73B6D' }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#C73B6D', textTransform: 'uppercase' }}>AGENDA</span>
        </div>

        {/* Date navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigateDate(-1)} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', padding: '4px 8px', display: 'flex' }}>
            <ChevronLeft style={{ width: 16, height: 16, color: '#6B7280' }} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1F2937', minWidth: 200, textAlign: 'center' }}>{dateLabel}</span>
          <button onClick={() => navigateDate(1)} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', padding: '4px 8px', display: 'flex' }}>
            <ChevronRight style={{ width: 16, height: 16, color: '#6B7280' }} />
          </button>
        </div>

        <button
          onClick={() => setSelectedDate(new Date())}
          style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}
        >
          Hoje
        </button>
      </div>

      {/* ─── Main Content ────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

        {/* ─── Left Sidebar ─────────────────────────────── */}
        <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
          <MiniCalendar selectedDate={selectedDate} onSelect={setSelectedDate} />

          {/* New appointment button */}
          <button
            onClick={() => openModal()}
            style={{
              background: '#C73B6D',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#A83158'}
            onMouseLeave={e => e.currentTarget.style.background = '#C73B6D'}
          >
            <Plus style={{ width: 14, height: 14 }} /> Novo Agendamento
          </button>

          {/* Professionals list */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 14, border: '1px solid #F0EBE6' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#9CA3AF', marginBottom: 12, textTransform: 'uppercase' }}>PROFISSIONAIS</div>
            {profissionais.map(p => (
              <div key={p.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: p.cor, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                }}>
                  {p.nome.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1F2937' }}>{p.nome}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{p.cargo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Main Grid ────────────────────────────────── */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 14, border: '1px solid #F0EBE6', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Professional headers */}
          <div style={{ display: 'flex', borderBottom: '1px solid #F0EBE6' }}>
            <div style={{ width: 60, flexShrink: 0 }} />
            {profissionais.map((p, i) => (
              <div key={p.nome} style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '14px 8px',
                borderLeft: i > 0 ? '1px solid #F0EBE6' : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: p.cor, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, marginBottom: 6,
                }}>
                  {p.nome.charAt(0)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1F2937' }}>{p.nome}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>{p.cargo}</div>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {HORAS.map(hora => (
              <div key={hora} style={{ display: 'flex', borderBottom: '1px dashed #F0EBE6', minHeight: 56 }}>
                {/* Time label */}
                <div style={{ width: 60, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 6 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>{hora}</span>
                </div>
                {/* Slots per professional */}
                {profissionais.map((p, i) => (
                  <div
                    key={p.nome}
                    style={{
                      flex: 1,
                      borderLeft: i > 0 ? '1px solid #F0EBE6' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#FDF8F5'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => openModal(p.nome, hora)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
