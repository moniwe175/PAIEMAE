import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, AlertTriangle, XCircle, TrendingDown, Trash2, AlertOctagon } from 'lucide-react';
import { fetchInventory, insertInventoryItem, deleteInventoryItem } from '../services/supabaseService';
import { getCurrentUser } from '../lib/supabase';

function genId() {
  return 'inv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function calcStatus(estoque, minimo) {
  const e = Number(estoque), m = Number(minimo);
  if (e <= m * 0.5) return 'critico';
  if (e <= m) return 'baixo';
  return 'ok';
}

function ProdutoModal({ onClose, onSave }) {
  const [form, setForm] = useState({ nome:'', categoria:'', estoque:'', minimo:'', preco:'', fornecedor:'', vencimento:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const canSave = form.nome && form.categoria && form.estoque !== '';
  const handleSave = async () => {
    if (!canSave) return;
    const e = Number(form.estoque), m = Number(form.minimo) || 0, pr = Number(form.preco) || 0;
    await onSave({ nome: form.nome, categoria: form.categoria, estoque: e, minimo: m, preco: pr, fornecedor: form.fornecedor, vencimento: form.vencimento, status: calcStatus(e, m) });
    onClose();
  };
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
              {['Toxina BotulÃ­nica','Preenchedor','Bioestimulador','Peeling','Fio','Skincare','Outros'].map(c=><option key={c}>{c}</option>)}
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
            <label className="form-label">Estoque MÃ­nimo</label>
            <input className="form-input" type="number" placeholder="0" value={form.minimo} onChange={e=>set('minimo',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">PreÃ§o de Custo (R$)</label>
            <input className="form-input" type="number" placeholder="0,00" value={form.preco} onChange={e=>set('preco',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Validade</label>
            <input className="form-input" placeholder="MM/AAAA" value={form.vencimento} onChange={e=>set('vencimento',e.target.value)} />
          </div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!canSave} onClick={handleSave} style={{opacity:canSave?1:0.5}}><Package />Salvar</button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ produto, onClose, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:420, padding:'28px 28px 24px', boxShadow:'0 24px 64px rgba(0,0,0,0.2)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
          <div style={{ width:48, height:48, borderRadius:14, background:'var(--danger-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <AlertOctagon style={{ width:22, height:22, color:'var(--danger)' }} />
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text-dark)', marginBottom:2 }}>Excluir Produto</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>Esta aÃ§Ã£o nÃ£o pode ser desfeita.</div>
          </div>
        </div>
        <div style={{ background:'#F9FAFB', borderRadius:'var(--radius-md)', padding:'12px 16px', marginBottom:20, fontSize:13, color:'var(--text-light)' }}>
          Tem certeza que deseja excluir <strong style={{ color:'var(--text-dark)' }}>{produto.nome}</strong>?
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button onClick={onConfirm} style={{ padding:'9px 18px', borderRadius:'var(--radius-md)', border:'none', background:'var(--danger)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <Trash2 style={{width:14,height:14}} />Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_MAP = {
  ok: { label:'Normal', cls:'badge-success' },
  baixo: { label:'Baixo', cls:'badge-warning' },
  critico: { label:'CrÃ­tico', cls:'badge-danger' },
};

export default function Inventory() {
  const [modal, setModal] = useState(false);
  const [busca, setBusca] = useState('');
  const [produtos, setProdutos] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await fetchInventory();
      if (data) {
        setProdutos(data.map(p => ({
          ...p,
          estoque: Number(p.estoque) || 0,
          minimo: Number(p.minimo) || 0,
          preco: Number(p.preco) || 0,
        })));
      }
    }
    load();
  }, []);

  const filtrados = produtos.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.categoria || '').toLowerCase().includes(busca.toLowerCase())
  );

  const criticos = produtos.filter(p => p.status === 'critico').length;
  const baixos = produtos.filter(p => p.status === 'baixo').length;
  const valorEstoque = produtos.reduce((s, p) => s + p.estoque * p.preco, 0);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await deleteInventoryItem(deleteTarget.id);
    if (!error) {
      setProdutos(prev => prev.filter(p => p.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const handleAdd = async (produto) => {
    const user = await getCurrentUser();
    const item = { id: genId(), ...produto, user_id: user?.id };
    const { data, error } = await insertInventoryItem(item);
    if (!error && data) {
      setProdutos(prev => [...prev, { ...data, estoque: Number(data.estoque) || 0, minimo: Number(data.minimo) || 0, preco: Number(data.preco) || 0 }]);
    }
  };

  return (
    <div>
      {modal && <ProdutoModal onClose={()=>setModal(false)} onSave={handleAdd} />}
      {deleteTarget && <DeleteConfirmModal produto={deleteTarget} onClose={()=>setDeleteTarget(null)} onConfirm={handleDelete} />}

      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Package />ESTOQUE</div>
          <h1 className="page-title">Estoque</h1>
          <p className="page-subtitle">{produtos.length} produto(s) cadastrado(s)</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus />Novo Produto</button>
      </div>

      <div className="grid-4 section-gap">
        {[
          {label:'Total Produtos',val:produtos.length,cor:'var(--color-primary)',icon:Package},
          {label:'Estoque CrÃ­tico',val:criticos,cor:'var(--danger)',icon:AlertTriangle},
          {label:'Estoque Baixo',val:baixos,cor:'var(--warning)',icon:TrendingDown},
          {label:'Valor em Estoque',val:`R$ ${valorEstoque.toLocaleString('pt-BR',{minimumFractionDigits:2})}`,cor:'var(--success)',icon:Package},
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
            {criticos} produto(s) com estoque crÃ­tico! Realize a reposiÃ§Ã£o imediatamente.
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
              <th>Produto</th><th>Categoria</th><th>Fornecedor</th><th>Estoque</th><th>MÃ­nimo</th><th>Custo</th><th>Validade</th><th>Status</th><th style={{width:50}}></th>
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
                  <td><span className={`badge ${STATUS_MAP[p.status]?.cls || 'badge-neutral'}`}>{STATUS_MAP[p.status]?.label || p.status}</span></td>
                  <td>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      title="Excluir produto"
                      style={{ background:'none', border:'none', cursor:'pointer', padding:4, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FEE2E2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Trash2 style={{width:14,height:14,color:'var(--danger)'}} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={9} style={{textAlign:'center',padding:'32px 0',color:'var(--text-muted)',fontSize:13}}>Nenhum produto encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
