import React, { useState } from 'react';
import { Package, Plus, Search, AlertTriangle, XCircle, TrendingDown } from 'lucide-react';

const produtos = [
  { id:1, nome:'Botox Allergan 100U', categoria:'Toxina Botulínica', estoque:5, minimo:5, preco:480, fornecedor:'Allergan', vencimento:'12/2026', status:'critico' },
  { id:2, nome:'Juvederm Ultra 1ml', categoria:'Preenchedor', estoque:2, minimo:10, preco:650, fornecedor:'AbbVie', vencimento:'08/2026', status:'critico' },
  { id:3, nome:'Sculptra 150mg', categoria:'Bioestimulador', estoque:8, minimo:5, preco:1200, fornecedor:'Galderma', vencimento:'03/2027', status:'ok' },
  { id:4, nome:'Radiesse 1.5ml', categoria:'Preenchedor', estoque:12, minimo:8, preco:890, fornecedor:'Merz', vencimento:'09/2027', status:'ok' },
  { id:5, nome:'Peeling TCA 30%', categoria:'Peeling', estoque:3, minimo:4, preco:85, fornecedor:'Genérico', vencimento:'06/2026', status:'baixo' },
  { id:6, nome:'Fio PDO 29G', categoria:'Fio', estoque:50, minimo:20, preco:12, fornecedor:'Koru', vencimento:'01/2028', status:'ok' },
];

function ProdutoModal({ onClose }) {
  const [form, setForm] = useState({ nome:'', categoria:'', estoque:'', minimo:'', preco:'', fornecedor:'', vencimento:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Novo Produto</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-grid-2">
          <div className="form-group" style={{gridColumn:'span 2'}}>
            <label className="form-label">Nome do Produto</label>
            <input className="form-input" placeholder="Nome do produto" value={form.nome} onChange={e=>set('nome',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-select" value={form.categoria} onChange={e=>set('categoria',e.target.value)}>
              <option value="">Selecione...</option>
              {['Toxina Botulínica','Preenchedor','Bioestimulador','Peeling','Fio','Skincare','Outros'].map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Fornecedor</label>
            <input className="form-input" placeholder="Nome do fornecedor" value={form.fornecedor} onChange={e=>set('fornecedor',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Estoque Atual</label>
            <input className="form-input" type="number" placeholder="0" value={form.estoque} onChange={e=>set('estoque',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Estoque Mínimo</label>
            <input className="form-input" type="number" placeholder="0" value={form.minimo} onChange={e=>set('minimo',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Preço de Custo (R$)</label>
            <input className="form-input" type="number" placeholder="0,00" value={form.preco} onChange={e=>set('preco',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Validade</label>
            <input className="form-input" placeholder="MM/AAAA" value={form.vencimento} onChange={e=>set('vencimento',e.target.value)} />
          </div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onClose}><Package />Salvar</button>
        </div>
      </div>
    </div>
  );
}

const STATUS_MAP = {
  ok: { label:'Normal', cls:'badge-success' },
  baixo: { label:'Baixo', cls:'badge-warning' },
  critico: { label:'Crítico', cls:'badge-danger' },
};

export default function Inventory() {
  const [modal, setModal] = useState(false);
  const [busca, setBusca] = useState('');

  const filtrados = produtos.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busca.toLowerCase())
  );

  const criticos = produtos.filter(p => p.status === 'critico').length;
  const baixos = produtos.filter(p => p.status === 'baixo').length;

  return (
    <div>
      {modal && <ProdutoModal onClose={()=>setModal(false)} />}

      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Package />ESTOQUE</div>
          <h1 className="page-title">Estoque</h1>
          <p className="page-subtitle">{produtos.length} produtos cadastrados</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus />Novo Produto</button>
      </div>

      <div className="grid-4 section-gap">
        {[
          {label:'Total Produtos',val:produtos.length,cor:'var(--color-primary)',icon:Package},
          {label:'Estoque Crítico',val:criticos,cor:'var(--danger)',icon:AlertTriangle},
          {label:'Estoque Baixo',val:baixos,cor:'var(--warning)',icon:TrendingDown},
          {label:'Valor em Estoque',val:'R$ 18.420',cor:'var(--success)',icon:Package},
        ].map(({label,val,cor,icon:Icon})=>(
          <div key={label} className="stat-card">
            <div className="stat-card-icon" style={{background:`${cor}18`}}>
              <Icon style={{color:cor}} />
            </div>
            <div className="stat-value" style={{color:cor}}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {criticos > 0 && (
        <div style={{background:'var(--danger-bg)',border:'1px solid #f8c4c8',borderRadius:'var(--radius-md)',padding:'12px 16px',marginBottom:20,display:'flex',alignItems:'center',gap:8}}>
          <AlertTriangle style={{width:16,height:16,color:'var(--danger)',flexShrink:0}} />
          <span style={{fontSize:13,color:'var(--danger)',fontWeight:600}}>
            {criticos} produto(s) com estoque crítico! Realize a reposição imediatamente.
          </span>
        </div>
      )}

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border-color)'}}>
          <div className="search-box">
            <Search />
            <input className="search-input" placeholder="Buscar produto..." value={busca} onChange={e=>setBusca(e.target.value)} />
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Produto</th><th>Categoria</th><th>Fornecedor</th><th>Estoque</th><th>Mínimo</th><th>Custo</th><th>Validade</th><th>Status</th>
            </tr></thead>
            <tbody>
              {filtrados.map(p=>(
                <tr key={p.id}>
                  <td style={{fontWeight:600,fontSize:13}}>{p.nome}</td>
                  <td><span className="badge badge-neutral">{p.categoria}</span></td>
                  <td style={{fontSize:13,color:'var(--text-light)'}}>{p.fornecedor}</td>
                  <td>
                    <span style={{fontWeight:700,fontSize:15,color:p.status==='critico'?'var(--danger)':p.status==='baixo'?'var(--warning)':'var(--text-dark)'}}>
                      {p.estoque}
                    </span>
                  </td>
                  <td style={{fontSize:13,color:'var(--text-muted)'}}>{p.minimo}</td>
                  <td style={{fontWeight:600}}>R$ {p.preco.toLocaleString('pt-BR')}</td>
                  <td style={{fontSize:13,color:'var(--text-light)'}}>{p.vencimento}</td>
                  <td><span className={`badge ${STATUS_MAP[p.status].cls}`}>{STATUS_MAP[p.status].label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
