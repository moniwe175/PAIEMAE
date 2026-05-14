import React, { useState } from 'react';
import { ShoppingBag, Plus, XCircle, DollarSign, Clock, Tag } from 'lucide-react';

const pacotes = [
  { id:1, nome:'Pacote Bronze', servicos:['Botox Facial','Peeling Químico'], sessoes:3, preco:1650, desconto:10, validade:'6 meses', vendidos:8, ativo:true },
  { id:2, nome:'Pacote Prata', servicos:['Botox Facial','Preenchimento Labial','Peeling Químico'], sessoes:5, preco:2900, desconto:15, validade:'8 meses', vendidos:12, ativo:true },
  { id:3, nome:'Pacote Ouro', servicos:['Harmonização Facial','Bioestimulador','Botox Facial','Peeling Químico'], sessoes:8, preco:5200, desconto:20, validade:'12 meses', vendidos:5, ativo:true },
  { id:4, nome:'Pacote Skincare', servicos:['Limpeza de Pele Profunda','Peeling Químico'], sessoes:4, preco:680, desconto:10, validade:'4 meses', vendidos:15, ativo:true },
  { id:5, nome:'Pacote Rejuvenescimento', servicos:['Fio de PDO','Bioestimulador','Botox Facial'], sessoes:3, preco:4200, desconto:12, validade:'8 meses', vendidos:3, ativo:false },
];

function PacoteModal({ onClose }) {
  const [form, setForm] = useState({ nome:'', preco:'', desconto:'', validade:'', sessoes:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Novo Pacote</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-group">
          <label className="form-label">Nome do Pacote</label>
          <input className="form-input" placeholder="Ex: Pacote Prata" value={form.nome} onChange={e=>set('nome',e.target.value)} />
        </div>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Preço (R$)</label>
            <input className="form-input" type="number" placeholder="0,00" value={form.preco} onChange={e=>set('preco',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Desconto (%)</label>
            <input className="form-input" type="number" placeholder="0" value={form.desconto} onChange={e=>set('desconto',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nº de Sessões</label>
            <input className="form-input" type="number" placeholder="0" value={form.sessoes} onChange={e=>set('sessoes',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Validade</label>
            <input className="form-input" placeholder="Ex: 6 meses" value={form.validade} onChange={e=>set('validade',e.target.value)} />
          </div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onClose}><ShoppingBag />Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function Packages() {
  const [modal, setModal] = useState(false);

  return (
    <div>
      {modal && <PacoteModal onClose={()=>setModal(false)} />}

      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><ShoppingBag />PACOTES</div>
          <h1 className="page-title">Pacotes</h1>
          <p className="page-subtitle">{pacotes.length} pacotes cadastrados</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus />Novo Pacote</button>
      </div>

      <div className="grid-4 section-gap">
        {[
          {label:'Total Pacotes',val:pacotes.length,cor:'var(--color-primary)'},
          {label:'Ativos',val:pacotes.filter(p=>p.ativo).length,cor:'var(--success)'},
          {label:'Total Vendidos',val:pacotes.reduce((a,p)=>a+p.vendidos,0),cor:'var(--info)'},
          {label:'Receita em Pacotes',val:'R$ 98.500',cor:'var(--warning)'},
        ].map(({label,val,cor})=>(
          <div key={label} className="stat-card" style={{textAlign:'center'}}>
            <div className="stat-value" style={{color:cor}}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid-3">
        {pacotes.map(p=>(
          <div key={p.id} className="card" style={{opacity:p.ativo?1:0.6}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <span className={`badge ${p.ativo?'badge-success':'badge-neutral'}`}>{p.ativo?'Ativo':'Inativo'}</span>
              <span className="badge badge-warning" style={{display:'flex',alignItems:'center',gap:3}}>
                <Tag style={{width:10,height:10}}/>{p.desconto}% off
              </span>
            </div>
            <div style={{fontWeight:700,fontSize:16,marginBottom:4,color:'var(--text-dark)'}}>{p.nome}</div>
            <div style={{fontSize:24,fontWeight:800,color:'var(--color-primary)',marginBottom:10}}>
              R$ {p.preco.toLocaleString('pt-BR')}
            </div>
            <div className="divider" />
            <div style={{display:'flex',flexDirection:'column',gap:7,marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                <span style={{display:'flex',alignItems:'center',gap:4,color:'var(--text-muted)'}}><Clock style={{width:12,height:12}}/>Sessões</span>
                <span style={{fontWeight:600}}>{p.sessoes} sessões</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                <span style={{color:'var(--text-muted)'}}>Validade</span>
                <span style={{fontWeight:600}}>{p.validade}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                <span style={{color:'var(--text-muted)'}}>Vendidos</span>
                <span style={{fontWeight:600,color:'var(--success)'}}>{p.vendidos}</span>
              </div>
            </div>
            <div style={{fontSize:12,color:'var(--text-muted)',fontWeight:500,marginBottom:8}}>Inclui:</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:14}}>
              {p.servicos.map(s=>(
                <span key={s} style={{background:'var(--color-accent-soft)',color:'var(--text-medium)',padding:'3px 8px',borderRadius:99,fontSize:11,fontWeight:500}}>{s}</span>
              ))}
            </div>
            <div style={{display:'flex',gap:6}}>
              <button className="btn btn-ghost btn-sm" style={{flex:1}}>Editar</button>
              <button className="btn btn-primary btn-sm" style={{flex:1}}><DollarSign style={{width:12,height:12}}/>Vender</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
