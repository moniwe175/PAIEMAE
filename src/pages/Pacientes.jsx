import React, { useState } from 'react';
import { Users, Plus, Search, Phone, Calendar, FileText, Star, XCircle, ChevronRight, Mail, MapPin } from 'lucide-react';

const pacientes = [
  { id:1, nome:'Ana Beatriz Souza', telefone:'(11) 98765-4321', email:'ana@email.com', cidade:'São Paulo', nascimento:'15/03/1990', ultimaVisita:'10/05/2026', totalSessoes:8, totalGasto:2850, status:'ativo', avatar:'A' },
  { id:2, nome:'Carla Mendes Silva', telefone:'(11) 97654-3210', email:'carla@email.com', cidade:'São Paulo', nascimento:'22/07/1985', ultimaVisita:'08/05/2026', totalSessoes:12, totalGasto:4200, status:'ativo', avatar:'C' },
  { id:3, nome:'Fernanda Lima', telefone:'(11) 96543-2109', email:'fernanda@email.com', cidade:'Guarulhos', nascimento:'30/11/1992', ultimaVisita:'05/05/2026', totalSessoes:5, totalGasto:1750, status:'ativo', avatar:'F' },
  { id:4, nome:'Juliana Costa', telefone:'(11) 95432-1098', email:'juliana@email.com', cidade:'São Paulo', nascimento:'14/04/1988', ultimaVisita:'01/04/2026', totalSessoes:3, totalGasto:980, status:'inativo', avatar:'J' },
  { id:5, nome:'Mariana Alves', telefone:'(11) 94321-0987', email:'mariana@email.com', cidade:'São Bernardo', nascimento:'08/09/1995', ultimaVisita:'28/04/2026', totalSessoes:6, totalGasto:2100, status:'ativo', avatar:'M' },
  { id:6, nome:'Patrícia Rocha', telefone:'(11) 93210-9876', email:'patricia@email.com', cidade:'São Paulo', nascimento:'19/01/1982', ultimaVisita:'12/05/2026', totalSessoes:15, totalGasto:5800, status:'ativo', avatar:'P' },
];

const historico = [
  { data:'10/05/2026', servico:'Botox Facial', valor:650 },
  { data:'15/03/2026', servico:'Preenchimento Labial', valor:900 },
  { data:'10/01/2026', servico:'Peeling Químico', valor:320 },
];

function PacienteModal({ onClose }) {
  const [form, setForm] = useState({ nome:'', telefone:'', email:'', nascimento:'', cidade:'', obs:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Novo Paciente</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-grid-2">
          <div className="form-group" style={{gridColumn:'span 2'}}>
            <label className="form-label">Nome completo</label>
            <input className="form-input" placeholder="Nome do paciente" value={form.nome} onChange={e=>set('nome',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-input" placeholder="(11) 99999-9999" value={form.telefone} onChange={e=>set('telefone',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e=>set('email',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nascimento</label>
            <input className="form-input" type="date" value={form.nascimento} onChange={e=>set('nascimento',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Cidade</label>
            <input className="form-input" placeholder="São Paulo" value={form.cidade} onChange={e=>set('cidade',e.target.value)} />
          </div>
          <div className="form-group" style={{gridColumn:'span 2'}}>
            <label className="form-label">Anamnese / Observações</label>
            <textarea className="form-textarea" placeholder="Alergias, histórico relevante..." value={form.obs} onChange={e=>set('obs',e.target.value)} />
          </div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onClose}><Star />Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function Pacientes() {
  const [modal, setModal] = useState(false);
  const [busca, setBusca] = useState('');
  const [selected, setSelected] = useState(null);

  const filtrados = pacientes.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) || p.telefone.includes(busca)
  );

  return (
    <div>
      {modal && <PacienteModal onClose={()=>setModal(false)} />}
      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Users />PACIENTES</div>
          <h1 className="page-title">Pacientes</h1>
          <p className="page-subtitle">{pacientes.length} pacientes cadastrados</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus />Novo Paciente</button>
      </div>

      <div className="grid-4 section-gap">
        {[
          {label:'Total',val:pacientes.length,cor:'var(--color-primary)'},
          {label:'Ativos',val:pacientes.filter(p=>p.status==='ativo').length,cor:'var(--success)'},
          {label:'Inativos',val:pacientes.filter(p=>p.status==='inativo').length,cor:'var(--warning)'},
          {label:'Novos este mês',val:2,cor:'var(--info)'},
        ].map(({label,val,cor})=>(
          <div key={label} className="stat-card" style={{textAlign:'center'}}>
            <div className="stat-value" style={{color:cor}}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:16}}>
        <div style={{flex:1}}>
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border-color)'}}>
              <div className="search-box">
                <Search />
                <input className="search-input" placeholder="Buscar paciente..." value={busca} onChange={e=>setBusca(e.target.value)} />
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr>
                  <th>Paciente</th><th>Telefone</th><th>Última Visita</th><th>Sessões</th><th>Total Gasto</th><th>Status</th><th></th>
                </tr></thead>
                <tbody>
                  {filtrados.map(p=>(
                    <tr key={p.id} style={{cursor:'pointer',background:selected?.id===p.id?'var(--bg-card-hover)':''}} onClick={()=>setSelected(selected?.id===p.id?null:p)}>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div className="avatar">{p.avatar}</div>
                          <div>
                            <div style={{fontWeight:600,fontSize:13}}>{p.nome}</div>
                            <div style={{fontSize:11,color:'var(--text-muted)'}}>{p.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{fontSize:13,color:'var(--text-light)'}}>{p.telefone}</td>
                      <td style={{fontSize:13,color:'var(--text-light)'}}>{p.ultimaVisita}</td>
                      <td style={{fontWeight:600,textAlign:'center'}}>{p.totalSessoes}</td>
                      <td style={{fontWeight:600,color:'var(--success)'}}>R$ {p.totalGasto.toLocaleString('pt-BR')}</td>
                      <td><span className={`badge ${p.status==='ativo'?'badge-success':'badge-neutral'}`}>{p.status==='ativo'?'Ativo':'Inativo'}</span></td>
                      <td><ChevronRight style={{width:15,height:15,color:'var(--text-muted)'}} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {selected && (
          <div style={{width:280}}>
            <div className="card">
              <div className="card-header">
                <span className="card-title"><FileText />Perfil</span>
                <button className="modal-close" onClick={()=>setSelected(null)}><XCircle /></button>
              </div>
              <div style={{textAlign:'center',marginBottom:16}}>
                <div className="avatar avatar-lg" style={{margin:'0 auto 8px'}}>{selected.avatar}</div>
                <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{selected.nome}</div>
                <span className={`badge ${selected.status==='ativo'?'badge-success':'badge-neutral'}`}>{selected.status==='ativo'?'Ativo':'Inativo'}</span>
              </div>
              <div className="divider"/>
              <div style={{display:'flex',flexDirection:'column',gap:9,fontSize:13}}>
                <div style={{display:'flex',gap:8,alignItems:'center',color:'var(--text-light)'}}><Phone style={{width:13,height:13}}/>{selected.telefone}</div>
                <div style={{display:'flex',gap:8,alignItems:'center',color:'var(--text-light)'}}><Mail style={{width:13,height:13}}/>{selected.email}</div>
                <div style={{display:'flex',gap:8,alignItems:'center',color:'var(--text-light)'}}><MapPin style={{width:13,height:13}}/>{selected.cidade}</div>
              </div>
              <div className="divider"/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                <div style={{textAlign:'center',background:'var(--bg-main)',borderRadius:8,padding:'10px 6px'}}>
                  <div style={{fontSize:20,fontWeight:700,color:'var(--color-primary)'}}>{selected.totalSessoes}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Sessões</div>
                </div>
                <div style={{textAlign:'center',background:'var(--bg-main)',borderRadius:8,padding:'10px 6px'}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--success)'}}>R${selected.totalGasto.toLocaleString('pt-BR')}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Gasto Total</div>
                </div>
              </div>
              <div style={{fontSize:12,fontWeight:600,color:'var(--text-medium)',marginBottom:8}}>Histórico de Sessões</div>
              {historico.map((h,i)=>(
                <div key={i} className="alert-item">
                  <div>
                    <div className="alert-item-label">{h.servico}</div>
                    <div className="alert-item-sub">{h.data}</div>
                  </div>
                  <div style={{fontWeight:700,color:'var(--success)',fontSize:13}}>R$ {h.valor}</div>
                </div>
              ))}
              <div style={{display:'flex',gap:6,marginTop:14}}>
                <button className="btn btn-secondary btn-sm" style={{flex:1}}>Editar</button>
                <button className="btn btn-primary btn-sm" style={{flex:1}}><Calendar style={{width:13,height:13}}/>Agendar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
