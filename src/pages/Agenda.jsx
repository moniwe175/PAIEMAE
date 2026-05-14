import React, { useState } from 'react';
import {
  Calendar, Plus, ChevronLeft, ChevronRight,
  Clock, User, Scissors, CheckCircle, XCircle, AlertCircle, Phone
} from 'lucide-react';

const HORAS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];

const SERVICOS = ['Botox Facial','Preenchimento Labial','Harmonização Facial','Fio de PDO','Bioestimulador','Peeling Químico','Limpeza de Pele'];
const PACIENTES = ['Fernanda Lima','Carla Mendes','Ana Beatriz','Juliana Costa','Patrícia Rocha','Mariana Alves','Isabela Santos'];

const mockAgendamentos = [
  { id:1, hora:'09:00', duracao:60, paciente:'Fernanda Lima', servico:'Botox Facial', status:'confirmado', telefone:'(11) 99999-0001' },
  { id:2, hora:'10:30', duracao:45, paciente:'Carla Mendes', servico:'Preenchimento Labial', status:'aguardando', telefone:'(11) 99999-0002' },
  { id:3, hora:'14:00', duracao:90, paciente:'Ana Beatriz', servico:'Harmonização Facial', status:'confirmado', telefone:'(11) 99999-0003' },
  { id:4, hora:'16:00', duracao:30, paciente:'Juliana Costa', servico:'Peeling Químico', status:'concluido', telefone:'(11) 99999-0004' },
];

const STATUS_MAP = {
  confirmado: { label: 'Confirmado', cls: 'badge-success', icon: CheckCircle },
  aguardando: { label: 'Aguardando', cls: 'badge-warning', icon: AlertCircle },
  concluido:  { label: 'Concluído',  cls: 'badge-info',    icon: CheckCircle },
  cancelado:  { label: 'Cancelado',  cls: 'badge-danger',  icon: XCircle },
};

function AgendamentoModal({ onClose }) {
  const [form, setForm] = useState({ data:'', hora:'09:00', paciente:'', servico:'', observacoes:'' });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Novo Agendamento</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-group">
          <label className="form-label">Paciente</label>
          <select className="form-select" value={form.paciente} onChange={e=>set('paciente',e.target.value)}>
            <option value="">Selecione...</option>
            {PACIENTES.map(p=><option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Data</label>
            <input type="date" className="form-input" value={form.data} onChange={e=>set('data',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Horário</label>
            <select className="form-select" value={form.hora} onChange={e=>set('hora',e.target.value)}>
              {HORAS.map(h=><option key={h}>{h}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Serviço</label>
          <select className="form-select" value={form.servico} onChange={e=>set('servico',e.target.value)}>
            <option value="">Selecione...</option>
            {SERVICOS.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Observações</label>
          <textarea className="form-textarea" placeholder="Observações sobre o agendamento..." value={form.observacoes} onChange={e=>set('observacoes',e.target.value)} />
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onClose}><CheckCircle />Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function Agenda() {
  const [modal, setModal] = useState(false);
  const [view, setView] = useState('dia');
  const [selected, setSelected] = useState(null);

  const today = new Date();
  const label = today.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  return (
    <div>
      {modal && <AgendamentoModal onClose={()=>setModal(false)} />}

      {/* Header */}
      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Calendar />AGENDA</div>
          <h1 className="page-title">Agenda</h1>
          <p className="page-subtitle">{label}</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}>
          <Plus />Novo Agendamento
        </button>
      </div>

      {/* View Tabs + Nav */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div className="tabs">
          {['dia','semana'].map(v=>(
            <button key={v} className={`tab-item${view===v?' active':''}`} onClick={()=>setView(v)}>
              {v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button className="btn btn-ghost btn-sm"><ChevronLeft /></button>
          <span style={{fontSize:13,fontWeight:600,color:'var(--text-dark)'}}>
            {today.toLocaleDateString('pt-BR',{day:'numeric',month:'short',year:'numeric'})}
          </span>
          <button className="btn btn-ghost btn-sm"><ChevronRight /></button>
        </div>
      </div>

      <div style={{display:'flex',gap:16}}>
        {/* Timeline */}
        <div className="card" style={{flex:1,padding:0,overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border-color)',display:'flex',alignItems:'center',gap:8}}>
            <Clock style={{width:15,height:15,color:'var(--color-primary)'}}/>
            <span style={{fontSize:13,fontWeight:600,color:'var(--text-dark)'}}>Horários</span>
            <span className="badge badge-info" style={{marginLeft:'auto'}}>{mockAgendamentos.length} agendamentos</span>
          </div>
          <div style={{padding:'8px 0'}}>
            {HORAS.map(hora=>{
              const apt = mockAgendamentos.find(a=>a.hora===hora);
              return (
                <div key={hora} className="time-slot" style={{padding:'4px 20px',minHeight:52,borderBottom:'1px solid var(--border-light)'}}>
                  <span className="time-label">{hora}</span>
                  {apt ? (
                    <div
                      className="appointment-card"
                      style={{cursor:'pointer'}}
                      onClick={()=>setSelected(selected?.id===apt.id?null:apt)}
                    >
                      <div className="appointment-name">{apt.paciente}</div>
                      <div className="appointment-service">{apt.servico} · {apt.duracao}min</div>
                      <span className={`badge ${STATUS_MAP[apt.status].cls}`} style={{marginTop:4,fontSize:10}}>
                        {STATUS_MAP[apt.status].label}
                      </span>
                    </div>
                  ) : (
                    <div style={{flex:1,borderRadius:8,cursor:'pointer',transition:'background 0.12s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                      onClick={()=>setModal(true)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <div style={{width:260,display:'flex',flexDirection:'column',gap:12}}>
          {/* Selected appointment detail */}
          {selected && (
            <div className="card">
              <div className="card-header">
                <span className="card-title"><User />Detalhes</span>
                <button className="modal-close" onClick={()=>setSelected(null)}><XCircle /></button>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <div className="avatar avatar-lg">{selected.paciente.charAt(0)}</div>
                <div>
                  <div style={{fontWeight:600,fontSize:14}}>{selected.paciente}</div>
                  <div style={{fontSize:12,color:'var(--text-light)',display:'flex',alignItems:'center',gap:4,marginTop:2}}>
                    <Phone style={{width:11,height:11}}/>{selected.telefone}
                  </div>
                </div>
              </div>
              <div className="divider" />
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                  <span style={{color:'var(--text-muted)'}}>Horário</span>
                  <span style={{fontWeight:600}}>{selected.hora}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                  <span style={{color:'var(--text-muted)'}}>Serviço</span>
                  <span style={{fontWeight:600,textAlign:'right',maxWidth:130}}>{selected.servico}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                  <span style={{color:'var(--text-muted)'}}>Duração</span>
                  <span style={{fontWeight:600}}>{selected.duracao} min</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,alignItems:'center'}}>
                  <span style={{color:'var(--text-muted)'}}>Status</span>
                  <span className={`badge ${STATUS_MAP[selected.status].cls}`}>{STATUS_MAP[selected.status].label}</span>
                </div>
              </div>
              <div style={{display:'flex',gap:6,marginTop:14}}>
                <button className="btn btn-secondary btn-sm" style={{flex:1}}>Editar</button>
                <button className="btn btn-danger btn-sm" style={{flex:1}}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Resumo do dia */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Scissors />Resumo do Dia</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                {label:'Total agendamentos',val:mockAgendamentos.length,color:'var(--text-dark)'},
                {label:'Confirmados',val:mockAgendamentos.filter(a=>a.status==='confirmado').length,color:'var(--success)'},
                {label:'Aguardando',val:mockAgendamentos.filter(a=>a.status==='aguardando').length,color:'var(--warning)'},
                {label:'Concluídos',val:mockAgendamentos.filter(a=>a.status==='concluido').length,color:'var(--info)'},
              ].map(({label,val,color})=>(
                <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13}}>
                  <span style={{color:'var(--text-light)'}}>{label}</span>
                  <span style={{fontWeight:700,color}}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
