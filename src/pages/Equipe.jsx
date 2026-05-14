import React, { useState } from 'react';
import { Zap, Plus, XCircle, Phone, Mail, Award, Calendar } from 'lucide-react';

const equipe = [
  { id:1, nome:'Evelyn Costa', cargo:'Médica Esteta - CRM 123456', especialidade:'Botox, Preenchimento, Harmonização', telefone:'(11) 99111-1111', email:'evelyn@clinica.com', admissao:'01/01/2023', comissao:40, sessoesMes:28, faturamentoMes:18200, status:'ativo', avatar:'E', cor:'var(--color-primary)' },
  { id:2, nome:'Juliana Ramos', cargo:'Enfermeira - COREN 654321', especialidade:'Bioestimulador, Fios, Skincare', telefone:'(11) 99222-2222', email:'juliana@clinica.com', admissao:'15/03/2023', comissao:35, sessoesMes:19, faturamentoMes:9800, status:'ativo', avatar:'J', cor:'var(--info)' },
  { id:3, nome:'Carla Souza', cargo:'Esteticista', especialidade:'Peeling, Limpeza de Pele', telefone:'(11) 99333-3333', email:'carla@clinica.com', admissao:'10/06/2023', comissao:25, sessoesMes:22, faturamentoMes:5200, status:'ativo', avatar:'C', cor:'var(--success)' },
];

function ProfModal({ onClose }) {
  const [form, setForm] = useState({ nome:'', cargo:'', especialidade:'', telefone:'', email:'', comissao:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Novo Profissional</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-grid-2">
          <div className="form-group" style={{gridColumn:'span 2'}}>
            <label className="form-label">Nome completo</label>
            <input className="form-input" placeholder="Nome do profissional" value={form.nome} onChange={e=>set('nome',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Cargo / Registro</label>
            <input className="form-input" placeholder="Ex: Médica - CRM 000" value={form.cargo} onChange={e=>set('cargo',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Comissão (%)</label>
            <input className="form-input" type="number" placeholder="30" value={form.comissao} onChange={e=>set('comissao',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-input" placeholder="(11) 99999-9999" value={form.telefone} onChange={e=>set('telefone',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e=>set('email',e.target.value)} />
          </div>
          <div className="form-group" style={{gridColumn:'span 2'}}>
            <label className="form-label">Especialidades</label>
            <input className="form-input" placeholder="Ex: Botox, Preenchimento..." value={form.especialidade} onChange={e=>set('especialidade',e.target.value)} />
          </div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onClose}><Zap />Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function Equipe() {
  const [modal, setModal] = useState(false);

  return (
    <div>
      {modal && <ProfModal onClose={()=>setModal(false)} />}

      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Zap />EQUIPE</div>
          <h1 className="page-title">Equipe</h1>
          <p className="page-subtitle">{equipe.length} profissionais cadastrados</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus />Novo Profissional</button>
      </div>

      <div className="grid-3 section-gap">
        {equipe.map(prof=>(
          <div key={prof.id} className="card">
            <div style={{textAlign:'center',marginBottom:16}}>
              <div className="avatar avatar-lg" style={{margin:'0 auto 10px',background:`linear-gradient(135deg, ${prof.cor}, ${prof.cor}66)`,width:56,height:56,fontSize:20}}>
                {prof.avatar}
              </div>
              <div style={{fontWeight:700,fontSize:15}}>{prof.nome}</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{prof.cargo}</div>
              <span className="badge badge-success" style={{marginTop:6}}>Ativo</span>
            </div>
            <div className="divider" />
            <div style={{fontSize:12,color:'var(--text-muted)',fontWeight:500,marginBottom:6}}>Especialidades</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:14}}>
              {prof.especialidade.split(', ').map(e=>(
                <span key={e} style={{background:'var(--color-accent-soft)',color:'var(--text-medium)',padding:'2px 8px',borderRadius:99,fontSize:11,fontWeight:500}}>{e}</span>
              ))}
            </div>
            <div className="divider" />
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14,textAlign:'center'}}>
              <div style={{background:'var(--bg-main)',borderRadius:8,padding:'8px 4px'}}>
                <div style={{fontSize:16,fontWeight:700,color:'var(--color-primary)'}}>{prof.sessoesMes}</div>
                <div style={{fontSize:10,color:'var(--text-muted)'}}>Sessões</div>
              </div>
              <div style={{background:'var(--bg-main)',borderRadius:8,padding:'8px 4px'}}>
                <div style={{fontSize:12,fontWeight:700,color:'var(--success)'}}>R${(prof.faturamentoMes/1000).toFixed(1)}k</div>
                <div style={{fontSize:10,color:'var(--text-muted)'}}>Faturado</div>
              </div>
              <div style={{background:'var(--bg-main)',borderRadius:8,padding:'8px 4px'}}>
                <div style={{fontSize:16,fontWeight:700,color:'var(--info)'}}>{prof.comissao}%</div>
                <div style={{fontSize:10,color:'var(--text-muted)'}}>Comissão</div>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:7,fontSize:12}}>
              <div style={{display:'flex',gap:7,alignItems:'center',color:'var(--text-light)'}}><Phone style={{width:12,height:12}}/>{prof.telefone}</div>
              <div style={{display:'flex',gap:7,alignItems:'center',color:'var(--text-light)'}}><Mail style={{width:12,height:12}}/>{prof.email}</div>
              <div style={{display:'flex',gap:7,alignItems:'center',color:'var(--text-light)'}}><Calendar style={{width:12,height:12}}/>Desde {prof.admissao}</div>
            </div>
            <div style={{display:'flex',gap:6,marginTop:14}}>
              <button className="btn btn-ghost btn-sm" style={{flex:1}}>Editar</button>
              <button className="btn btn-secondary btn-sm" style={{flex:1}}><Award style={{width:12,height:12}}/>Comissões</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
