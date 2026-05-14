import React, { useState } from 'react';
import { Scissors, Plus, Search, XCircle, Clock, DollarSign } from 'lucide-react';

const servicos = [
  { id:1, nome:'Botox Facial', categoria:'Toxina', duracao:45, preco:650, comissao:30, ativo:true },
  { id:2, nome:'Botox Masseter', categoria:'Toxina', duracao:30, preco:450, comissao:30, ativo:true },
  { id:3, nome:'Preenchimento Labial', categoria:'Preenchedor', duracao:60, preco:900, comissao:35, ativo:true },
  { id:4, nome:'Preenchimento Malar', categoria:'Preenchedor', duracao:60, preco:1100, comissao:35, ativo:true },
  { id:5, nome:'Harmonização Facial', categoria:'Combo', duracao:120, preco:2800, comissao:40, ativo:true },
  { id:6, nome:'Bioestimulador (Sculptra)', categoria:'Bioestimulador', duracao:60, preco:1500, comissao:35, ativo:true },
  { id:7, nome:'Fio de PDO', categoria:'Fio', duracao:90, preco:1800, comissao:40, ativo:false },
  { id:8, nome:'Peeling Químico', categoria:'Peeling', duracao:60, preco:320, comissao:25, ativo:true },
  { id:9, nome:'Limpeza de Pele Profunda', categoria:'Skincare', duracao:90, preco:180, comissao:20, ativo:true },
];

const CATS = ['Toxina','Preenchedor','Combo','Bioestimulador','Fio','Peeling','Skincare'];
const CAT_COLORS = {
  Toxina:'badge-info', Preenchedor:'badge-warning', Combo:'badge-success',
  Bioestimulador:'badge-neutral', Fio:'badge-danger', Peeling:'badge-info', Skincare:'badge-neutral'
};

function ServicoModal({ onClose }) {
  const [form, setForm] = useState({ nome:'', categoria:'', duracao:'', preco:'', comissao:'', desc:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Novo Serviço</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-grid-2">
          <div className="form-group" style={{gridColumn:'span 2'}}>
            <label className="form-label">Nome do Serviço</label>
            <input className="form-input" placeholder="Ex: Botox Facial" value={form.nome} onChange={e=>set('nome',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-select" value={form.categoria} onChange={e=>set('categoria',e.target.value)}>
              <option value="">Selecione...</option>
              {CATS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Duração (min)</label>
            <input className="form-input" type="number" placeholder="60" value={form.duracao} onChange={e=>set('duracao',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Preço (R$)</label>
            <input className="form-input" type="number" placeholder="0,00" value={form.preco} onChange={e=>set('preco',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Comissão (%)</label>
            <input className="form-input" type="number" placeholder="30" value={form.comissao} onChange={e=>set('comissao',e.target.value)} />
          </div>
          <div className="form-group" style={{gridColumn:'span 2'}}>
            <label className="form-label">Descrição</label>
            <textarea className="form-textarea" placeholder="Descrição do serviço..." value={form.desc} onChange={e=>set('desc',e.target.value)} />
          </div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onClose}><Scissors />Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function Services() {
  const [modal, setModal] = useState(false);
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState('Todos');

  const filtrados = servicos.filter(s =>
    (catFiltro === 'Todos' || s.categoria === catFiltro) &&
    s.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div>
      {modal && <ServicoModal onClose={()=>setModal(false)} />}

      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Scissors />SERVIÇOS</div>
          <h1 className="page-title">Serviços</h1>
          <p className="page-subtitle">{servicos.length} serviços cadastrados</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus />Novo Serviço</button>
      </div>

      <div className="grid-4 section-gap">
        {[
          {label:'Total',val:servicos.length,cor:'var(--color-primary)'},
          {label:'Ativos',val:servicos.filter(s=>s.ativo).length,cor:'var(--success)'},
          {label:'Inativos',val:servicos.filter(s=>!s.ativo).length,cor:'var(--warning)'},
          {label:'Ticket Médio',val:`R$ ${Math.round(servicos.filter(s=>s.ativo).reduce((a,s)=>a+s.preco,0)/servicos.filter(s=>s.ativo).length).toLocaleString('pt-BR')}`,cor:'var(--info)'},
        ].map(({label,val,cor})=>(
          <div key={label} className="stat-card" style={{textAlign:'center'}}>
            <div className="stat-value" style={{color:cor}}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div className="tabs">
          {['Todos',...CATS].map(c=>(
            <button key={c} className={`tab-item${catFiltro===c?' active':''}`} onClick={()=>setCatFiltro(c)}>{c}</button>
          ))}
        </div>
        <div className="search-box">
          <Search />
          <input className="search-input" placeholder="Buscar serviço..." value={busca} onChange={e=>setBusca(e.target.value)} />
        </div>
      </div>

      <div className="grid-3">
        {filtrados.map(s=>(
          <div key={s.id} className="card" style={{opacity:s.ativo?1:0.6}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
              <span className={`badge ${CAT_COLORS[s.categoria]||'badge-neutral'}`}>{s.categoria}</span>
              <span className={`badge ${s.ativo?'badge-success':'badge-neutral'}`}>{s.ativo?'Ativo':'Inativo'}</span>
            </div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:10,color:'var(--text-dark)'}}>{s.nome}</div>
            <div className="divider" />
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                <span style={{display:'flex',alignItems:'center',gap:5,color:'var(--text-muted)'}}><Clock style={{width:13,height:13}}/>Duração</span>
                <span style={{fontWeight:600}}>{s.duracao} min</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                <span style={{display:'flex',alignItems:'center',gap:5,color:'var(--text-muted)'}}><DollarSign style={{width:13,height:13}}/>Preço</span>
                <span style={{fontWeight:700,color:'var(--success)'}}>R$ {s.preco.toLocaleString('pt-BR')}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                <span style={{color:'var(--text-muted)'}}>Comissão</span>
                <span style={{fontWeight:600}}>{s.comissao}%</span>
              </div>
            </div>
            <div style={{display:'flex',gap:6,marginTop:14}}>
              <button className="btn btn-ghost btn-sm" style={{flex:1}}>Editar</button>
              <button className="btn btn-secondary btn-sm" style={{flex:1}}>Detalhes</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
