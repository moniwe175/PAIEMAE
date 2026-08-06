import React, { useState } from 'react';
import { Calendar, Clock, User, Scissors, CheckCircle, ChevronRight, ChevronLeft, Star } from 'lucide-react';

const SERVICOS = [
  { id:1, nome:'Botox Facial', duracao:45, preco:650 },
  { id:2, nome:'Preenchimento Labial', duracao:60, preco:900 },
  { id:3, nome:'Harmonização Facial', duracao:120, preco:2800 },
  { id:4, nome:'Bioestimulador', duracao:60, preco:1500 },
  { id:5, nome:'Peeling Químico', duracao:60, preco:320 },
  { id:6, nome:'Limpeza de Pele Profunda', duracao:90, preco:180 },
];

const HORARIOS = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00'];
const PROFISSIONAIS = ['Evelyn Costa','Juliana Ramos','Carla Souza'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function buildCalendar(year, month) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}

export default function ClientBooking() {
  const [step, setStep] = useState(1);
  const [sel, setSel] = useState({ servico: null, profissional: '', dia: null, hora: '', nome: '', telefone: '', email: '' });
  const set = (k, v) => setSel(s => ({ ...s, [k]: v }));

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const cells = buildCalendar(calYear, calMonth);
  const mesLabel = new Date(calYear, calMonth, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); };

  const steps = ['Serviço', 'Profissional', 'Data & Hora', 'Seus Dados', 'Confirmação'];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <div className="page-header-label"><Star />AGENDAMENTO ONLINE</div>
        </div>
        <h1 className="page-title">Agende sua Consulta</h1>
        <p className="page-subtitle">Evelyn Esthetic Center • Clínica de Estética Avançada</p>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 }}>
        {steps.map((s, i) => {
          const num = i + 1;
          const done = step > num;
          const active = step === num;
          return (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: done ? 'var(--success)' : active ? 'var(--color-primary)' : 'var(--border-color)',
                  color: done || active ? '#fff' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
                }}>
                  {done ? <CheckCircle style={{ width: 14, height: 14 }} /> : num}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? 'var(--color-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ height: 2, width: 40, background: step > i + 1 ? 'var(--success)' : 'var(--border-color)', margin: '0 4px', marginBottom: 18, flexShrink: 0, transition: 'background 0.2s' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="card">
        {/* Step 1 — Serviço */}
        {step === 1 && (
          <div>
            <div className="card-header"><span className="card-title"><Scissors />Escolha o Serviço</span></div>
            <div className="grid-2">
              {SERVICOS.map(sv => (
                <div key={sv.id} onClick={() => set('servico', sv)}
                  style={{
                    border: `2px solid ${sel.servico?.id === sv.id ? 'var(--color-primary)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)', padding: '14px', cursor: 'pointer',
                    background: sel.servico?.id === sv.id ? 'var(--color-accent-soft)' : 'var(--bg-main)',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{sv.nome}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><Clock style={{ width: 11, height: 11 }} />{sv.duracao} min</span>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>R$ {sv.preco.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Profissional */}
        {step === 2 && (
          <div>
            <div className="card-header"><span className="card-title"><User />Escolha o Profissional</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Sem preferência', ...PROFISSIONAIS].map(p => (
                <div key={p} onClick={() => set('profissional', p)}
                  style={{
                    border: `2px solid ${sel.profissional === p ? 'var(--color-primary)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)', padding: '14px 16px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                    background: sel.profissional === p ? 'var(--color-accent-soft)' : 'var(--bg-main)',
                    transition: 'all 0.15s',
                  }}>
                  <div className="avatar">{p.charAt(0)}</div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p}</span>
                  {sel.profissional === p && <CheckCircle style={{ width: 16, height: 16, color: 'var(--color-primary)', marginLeft: 'auto' }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 — Data & Hora */}
        {step === 3 && (
          <div>
            <div className="card-header"><span className="card-title"><Calendar />Data e Horário</span></div>
            {/* Calendar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft /></button>
                <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>{mesLabel}</span>
                <button className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
                {DIAS_SEMANA.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', paddingBottom: 4 }}>{d}</div>
                ))}
                {cells.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const isPast = new Date(calYear, calMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  const isSelected = sel.dia === d && calMonth === today.getMonth();
                  return (
                    <div key={i} onClick={() => !isPast && set('dia', d)}
                      style={{
                        textAlign: 'center', padding: '7px 0', borderRadius: 8,
                        fontSize: 13, fontWeight: 500, cursor: isPast ? 'not-allowed' : 'pointer',
                        background: isSelected ? 'var(--color-primary)' : 'transparent',
                        color: isPast ? 'var(--border-color)' : isSelected ? '#fff' : 'var(--text-dark)',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => !isPast && !isSelected && (e.currentTarget.style.background = 'var(--color-accent-soft)')}
                      onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                    >{d}</div>
                  );
                })}
              </div>
            </div>
            {/* Horários */}
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--text-medium)' }}>Horários disponíveis</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {HORARIOS.map(h => (
                <button key={h} onClick={() => set('hora', h)}
                  className={sel.hora === h ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4 — Dados */}
        {step === 4 && (
          <div>
            <div className="card-header"><span className="card-title"><User />Seus Dados</span></div>
            <div className="form-group">
              <label className="form-label">Nome completo *</label>
              <input className="form-input" placeholder="Seu nome" value={sel.nome} onChange={e => set('nome', e.target.value)} />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Telefone / WhatsApp *</label>
                <input className="form-input" placeholder="(11) 99999-9999" value={sel.telefone} onChange={e => set('telefone', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className="form-input" type="email" placeholder="seu@email.com" value={sel.email} onChange={e => set('email', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Step 5 — Confirmação */}
        {step === 5 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle style={{ width: 32, height: 32, color: 'var(--success)' }} />
            </div>
            <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Agendamento Confirmado!</h2>
            <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 24 }}>Você receberá uma confirmação via WhatsApp em breve.</p>
            <div style={{ background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Serviço', val: sel.servico?.nome || '-' },
                { label: 'Profissional', val: sel.profissional || '-' },
                { label: 'Data', val: sel.dia ? `${sel.dia}/${calMonth + 1 < 10 ? '0' : ''}${calMonth + 1}/${calYear}` : '-' },
                { label: 'Horário', val: sel.hora || '-' },
                { label: 'Paciente', val: sel.nome || '-' },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setStep(1); setSel({ servico: null, profissional: '', dia: null, hora: '', nome: '', telefone: '', email: '' }); }}>
              Fazer Novo Agendamento
            </button>
          </div>
        )}

        {/* Navigation */}
        {step < 5 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
            <button className="btn btn-ghost" onClick={() => setStep(s => Math.max(1, s - 1))} style={{ visibility: step === 1 ? 'hidden' : 'visible' }}>
              <ChevronLeft />Voltar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setStep(s => Math.min(5, s + 1))}
              disabled={
                (step === 1 && !sel.servico) ||
                (step === 2 && !sel.profissional) ||
                (step === 3 && (!sel.dia || !sel.hora)) ||
                (step === 4 && !sel.nome)
              }
              style={{ opacity: ((step === 1 && !sel.servico) || (step === 2 && !sel.profissional) || (step === 3 && (!sel.dia || !sel.hora)) || (step === 4 && !sel.nome)) ? 0.5 : 1 }}
            >
              {step === 4 ? 'Confirmar Agendamento' : 'Próximo'}<ChevronRight />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
