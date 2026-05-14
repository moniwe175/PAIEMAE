import React, { useState } from 'react';
import { UserCheck, Plus, Search, Phone, XCircle, ChevronRight, Mail, Star } from 'lucide-react';

const clientes = [
  { id:1, nome:'Roberto Farias', telefone:'(11) 91234-5678', email:'roberto@email.com', origem:'Instagram', totalCompras:3, totalGasto:1200, status:'ativo', avatar:'R' },
  { id:2, nome:'Sandra Oliveira', telefone:'(11) 92345-6789', email:'sandra@email.com', origem:'Indicação', totalCompras:7, totalGasto:3800, status:'ativo', avatar:'S' },
  { id:3, nome:'Tatiana Pereira', telefone:'(11) 93456-7890', email:'tatiana@email.com', origem:'Google', totalCompras:2, totalGasto:650, status:'ativo', avatar:'T' },
  { id:4, nome:'Vanessa Cruz', telefone:'(11) 94567-8901', email:'vanessa@email.com', origem:'Instagram', totalCompras:5, totalGasto:2400, status:'inativo', avatar:'V' },
];

export default function Clients() {
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nome:'', telefone:'', email:'', origem:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca)
  );

  return (
    <div>
      {modal && (
        <div className="modal-overlay" onClick={()=>setModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Novo Cliente</span>
              <button className="modal-close" onClick={()=>setModal(false)}><XCircle /></button>
            </div>
            <div className="form-grid-2">
              <div className="form-group" style={{gridColumn:'span 2'}}>
                <label className="form-label">Nome completo</label>
                <input className="form-input" placeholder="Nome do cliente" value={form.nome} onChange={e=>set('nome',e.target.value)} />
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
                <label className="form-label">Origem / Canal</label>
                <select className="form-select" value={form.origem} onChange={e=>set('origem',e.target.value)}>
                  <option value="">Selecione...</option>
                  {['Instagram','Google','Indicação','Facebook','WhatsApp','Outro'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={()=>setModal(false)}><Star />Salvar</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><UserCheck />CLIENTES</div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{clientes.length} clientes cadastrados</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus />Novo Cliente</button>
      </div>

      <div className="grid-4 section-gap">
        {[
          {label:'Total',val:clientes.length,cor:'var(--color-primary)'},
          {label:'Ativos',val:clientes.filter(c=>c.status==='ativo').length,cor:'var(--success)'},
          {label:'Via Instagram',val:clientes.filter(c=>c.origem==='Instagram').length,cor:'var(--warning)'},
          {label:'Por Indicação',val:clientes.filter(c=>c.origem==='Indicação').length,cor:'var(--info)'},
        ].map(({label,val,cor})=>(
          <div key={label} className="stat-card" style={{textAlign:'center'}}>
            <div className="stat-value" style={{color:cor}}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border-color)'}}>
          <div className="search-box">
            <Search />
            <input className="search-input" placeholder="Buscar cliente..." value={busca} onChange={e=>setBusca(e.target.value)} />
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Cliente</th><th>Telefone</th><th>Origem</th><th>Compras</th><th>Total Gasto</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {filtrados.map(c=>(
                <tr key={c.id}>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div className="avatar">{c.avatar}</div>
                      <div>
                        <div style={{fontWeight:600,fontSize:13}}>{c.nome}</div>
                        <div style={{fontSize:11,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:4}}><Mail style={{width:10,height:10}}/>{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{fontSize:13,color:'var(--text-light)'}}><div style={{display:'flex',alignItems:'center',gap:4}}><Phone style={{width:12,height:12}}/>{c.telefone}</div></td>
                  <td><span className="badge badge-info">{c.origem}</span></td>
                  <td style={{textAlign:'center',fontWeight:600}}>{c.totalCompras}</td>
                  <td style={{fontWeight:600,color:'var(--success)'}}>R$ {c.totalGasto.toLocaleString('pt-BR')}</td>
                  <td><span className={`badge ${c.status==='ativo'?'badge-success':'badge-neutral'}`}>{c.status==='ativo'?'Ativo':'Inativo'}</span></td>
                  <td><ChevronRight style={{width:15,height:15,color:'var(--text-muted)'}} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
