import React, { useState, useEffect, useRef } from 'react';
import { Package, Plus, Search, AlertTriangle, XCircle, TrendingDown, Trash2, AlertOctagon, MoreVertical, Edit2 } from 'lucide-react';
import { fetchInventory, insertInventoryItem, deleteInventoryItem } from '../services/supabaseService';
import { getCurrentUser } from '../lib/supabase';

function genId() {
  return 'inv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function calcStatus(estoque, minimo) {
  const e = Number(estoque), m = Number(minimo);
  if (m === 0) return e === 0 ? 'critico' : 'ok';
  if (e === 0 || e <= m * 0.5) return 'critico';
  if (e <= m) return 'baixo';
  return 'ok';
}

const CATEGORIAS = [
  'Toxina Botulínica','Preenchedor','Bioestimulador','Peeling',
  'Fio','Skincare','Anestésico','Descartável','Cosmético',
  'Ácido Hialurônico','Outros'
];

const UNIDADES = ['unidade','frasco','ampola','caixa','kit','tubo','seringa'];

const CAT_COLORS = {
  'Toxina Botulínica': { bg: '#FDE8E8', color: '#B91C1C' },
  'Preenchedor':        { bg: '#E0F2FE', color: '#0369A1' },
  'Bioestimulador':     { bg: '#F3E8FF', color: '#7C3AED' },
  'Peeling':            { bg: '#FEF9C3', color: '#92400E' },
  'Fio':                { bg: '#D1FAE5', color: '#065F46' },
  'Skincare':           { bg: '#FCE7F3', color: '#9D174D' },
  'Anestésico':         { bg: '#E0F2FE', color: '#0284C7' },
  'Descartável':        { bg: '#F1F5F9', color: '#475569' },
  'Cosmético':          { bg: '#FEF3C7', color: '#B45309' },
  'Ácido Hialurônico':  { bg: '#E0F2FE', color: '#0369A1' },
  'Outros':             { bg: '#F3F4F6', color: '#6B7280' },
};

function ProdutoModal({ onClose, onSave }) {
  const [form, setForm] = useState({ nome:'', categoria:'', lote:'', fornecedor:'', estoque:'', minimo:'', unidade:'unidade', preco:'', vencimento:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const canSave = form.nome && form.categoria && form.estoque !== '';
  const handleSave = async () => {
    if (!canSave) return;
    const e = Number(form.estoque), m = Number(form.minimo) || 0, pr = Number(form.preco) || 0;
    await onSave({
      nome: form.nome, categoria: form.categoria, lote: form.lote,
      fornecedor: form.fornecedor, estoque: e, minimo: m,
      unidade: form.unidade || 'unidade',
      preco: pr, vencimento: form.vencimento,
      status: calcStatus(e, m)
    });
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
            <label className="form-label">Nome do Produto *</label>
            <input className="form-input" placeholder="Ex: Botox Allergan 100U" value={form.nome} onChange={e=>set('nome',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Categoria *</label>
            <select className="form-select" value={form.categoria} onChange={e=>set('categoria',e.target.value)}>
              <option value="">Selecione...</option>
              {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Unidade</label>
            <select className="form-select" value={form.unidade} onChange={e=>set('unidade',e.target.value)}>
              {UNIDADES.map(u=><option key={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Fornecedor</label>
            <input className="form-input" placeholder="Nome do fornecedor" value={form.fornecedor} onChange={e=>set('fornecedor',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Lote</label>
            <input className="form-input" placeholder="Ex: BOT2026A" value={form.lote} onChange={e=>set('lote',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Estoque Atual *</label>
            <input className="form-input" type="number" placeholder="0" value={form.estoque} onChange={e=>set('estoque',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Estoque Mínimo</label>
            <input className="form-input" type="number" placeholder="0" value={form.minimo} onChange={e=>set('minimo',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Custo (R$)</label>
            <input className="form-input" type="number" placeholder="0,00" value={form.preco} onChange={e=>set('preco',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Validade</label>
            <input className="form-input" type="date" value={form.vencimento} onChange={e=>set('vencimento',e.target.value)} />
          </div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!canSave} onClick={handleSave} style={{opacity:canSave?1:0.5}}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function RowMenu({ produto, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} style={{position:'relative'}}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{background:'none',border:'none',cursor:'pointer',padding:'4px 6px',borderRadius:6,display:'flex',alignItems:'center',color:'#9CA3AF'}}
      >
        <MoreVertical style={{width:16,height:16}} />
      </button>
      {open && (
        <div style={{position:'absolute',right:0,top:'calc(100% + 4px)',background:'#fff',border:'1px solid #E5E7EB',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:100,minWidth:140,overflow:'hidden'}}>
          <button
            onClick={() => { onDelete(produto); setOpen(false); }}
            style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 14px',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#EF4444',fontWeight:500}}
            onMouseEnter={e=>e.currentTarget.style.background='#FEE2E2'}
            onMouseLeave={e=>e.currentTarget.style.background='none'}
          >
            <Trash2 style={{width:14,height:14}} /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}

function DeleteConfirmModal({ produto, onClose, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ background:'#fff', borderRadius: 22, width:'100%', maxWidth:400, boxShadow:'0 32px 80px rgba(0,0,0,0.25)', padding:'24px' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <AlertTriangle style={{ width: 28, height: 28, color: '#DC2626' }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Excluir Produto</div>
          <div style={{ fontSize: 14, color: '#4B5563', marginBottom: 24 }}>
            Deseja realmente excluir <strong>"{produto.nome}"</strong>?
          </div>
          <div style={{ display: 'flex', gap: 12, width: '100%' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
              Voltar
            </button>
            <button onClick={onConfirm} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#DC2626', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    (p.categoria || '').toLowerCase().includes(busca.toLowerCase()) ||
    (p.fornecedor || '').toLowerCase().includes(busca.toLowerCase())
  );

  const criticos = produtos.filter(p => calcStatus(p.estoque, p.minimo) === 'critico').length;
  const baixos = produtos.filter(p => calcStatus(p.estoque, p.minimo) === 'baixo').length;
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

  const formatDate = (v) => {
    if (!v) return '-';
    if (v.includes('-') && v.length === 10) {
      const [y, m, d] = v.split('-');
      return `${d}/${m}/${y}`;
    }
    return v;
  };

  return (
    <div>
      {modal && <ProdutoModal onClose={() => setModal(false)} onSave={handleAdd} />}
      {deleteTarget && <DeleteConfirmModal produto={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />}

      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Package />ESTOQUE</div>
          <h1 className="page-title">Estoque</h1>
          <p className="page-subtitle">{produtos.length} produto(s) cadastrado(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus />Novo Produto</button>
      </div>

      <div className="grid-4 section-gap">
        {[
          {label:'Total Produtos',val:produtos.length,cor:'var(--color-primary)',icon:Package},
          {label:'Estoque Crítico',val:criticos,cor:'var(--danger)',icon:AlertTriangle},
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
        <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:12,padding:'12px 16px',marginBottom:20,display:'flex',alignItems:'center',gap:8}}>
          <AlertTriangle style={{width:16,height:16,color:'#DC2626',flexShrink:0}} />
          <span style={{fontSize:13,color:'#DC2626',fontWeight:600}}>
            {criticos} produto(s) com estoque crítico! Realize a reposição imediatamente.
          </span>
        </div>
      )}

      <div className="card" style={{padding:0,overflow:'hidden',borderRadius:16}}>
        {/* Search bar */}
        <div style={{padding:'16px 20px',borderBottom:'1px solid #F3F4F6'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,background:'#F9FAFB',border:'1.5px solid #E5E7EB',borderRadius:50,padding:'9px 16px',maxWidth:360}}>
            <Search style={{width:15,height:15,color:'#9CA3AF',flexShrink:0}} />
            <input
              style={{border:'none',outline:'none',background:'transparent',fontSize:14,color:'#374151',width:'100%'}}
              placeholder="Buscar produto..."
              value={busca}
              onChange={e=>setBusca(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{borderBottom:'1px solid #F3F4F6'}}>
                {['Produto','Categoria','Estoque','Custo','Validade','Status',''].map(h=>(
                  <th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'#6B7280',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => {
                const st = calcStatus(p.estoque, p.minimo);
                const isCritico = st === 'critico';
                const isBaixo = st === 'baixo';
                const catStyle = CAT_COLORS[p.categoria] || { bg: '#F3F4F6', color: '#6B7280' };
                const maxBar = Math.max(p.minimo * 2, p.estoque, 1);
                const barPct = Math.min((p.estoque / maxBar) * 100, 100);
                const barColor = isCritico ? '#EF4444' : isBaixo ? '#F59E0B' : '#C4B5A0';
                const subLabel = [p.fornecedor, p.lote ? `Lote: ${p.lote}` : null].filter(Boolean).join(' • ');

                return (
                  <tr key={p.id} style={{borderBottom: i < filtrados.length -1 ? '1px solid #F9FAFB' : 'none'}}>
                    {/* Produto */}
                    <td style={{padding:'14px 16px'}}>
                      <div style={{fontWeight:600,color:'#111827',fontSize:13}}>{p.nome}</div>
                      {subLabel && <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{subLabel}</div>}
                    </td>

                    {/* Categoria */}
                    <td style={{padding:'14px 16px',whiteSpace:'nowrap'}}>
                      <span style={{
                        background: catStyle.bg, color: catStyle.color,
                        padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600,
                        whiteSpace:'nowrap'
                      }}>
                        {p.categoria}
                      </span>
                    </td>

                    {/* Estoque */}
                    <td style={{padding:'14px 16px',minWidth:120}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                        <span style={{fontWeight:700,fontSize:13,color: isCritico ? '#EF4444' : '#111827'}}>
                          {p.estoque} {p.unidade || ''}
                        </span>
                        {isCritico && <AlertTriangle style={{width:13,height:13,color:'#F97316',flexShrink:0}} />}
                      </div>
                      {/* progress bar */}
                      <div style={{height:3,background:'#F3F4F6',borderRadius:4,overflow:'hidden',width:'100%'}}>
                        <div style={{height:'100%',width:`${barPct}%`,background:barColor,borderRadius:4,transition:'width 0.3s'}} />
                      </div>
                    </td>

                    {/* Custo */}
                    <td style={{padding:'14px 16px',whiteSpace:'nowrap',fontWeight:500,color:'#374151'}}>
                      R$ {p.preco.toLocaleString('pt-BR',{minimumFractionDigits:2})}
                    </td>

                    {/* Validade */}
                    <td style={{padding:'14px 16px',whiteSpace:'nowrap',color:'#6B7280',fontSize:13}}>
                      {formatDate(p.vencimento)}
                    </td>

                    {/* Status */}
                    <td style={{padding:'14px 16px'}}>
                      {isCritico ? (
                        <span style={{border:'1.5px solid #EF4444',color:'#EF4444',background:'transparent',padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600}}>
                          Crítico
                        </span>
                      ) : (
                        <span style={{border:'1.5px solid #D1D5DB',color:'#374151',background:'transparent',padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600}}>
                          OK
                        </span>
                      )}
                    </td>

                    {/* Menu */}
                    <td style={{padding:'14px 8px',textAlign:'right'}}>
                      <RowMenu produto={p} onDelete={setDeleteTarget} />
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={7} style={{textAlign:'center',padding:'40px 0',color:'#9CA3AF',fontSize:14}}>Nenhum produto encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
