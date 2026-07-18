import React, { useState, useEffect, useRef } from 'react';
import { Package, Plus, Search, AlertTriangle, XCircle, TrendingDown, Trash2, AlertOctagon, MoreVertical, Edit2, ExternalLink, ArrowUp, ArrowDown } from 'lucide-react';
import { fetchInventory, insertInventoryItem, deleteInventoryItem, updateInventoryItem } from '../services/supabaseService';
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

function ProdutoModal({ produto, onClose, onSave }) {
  const [form, setForm] = useState({
    nome: produto?.nome || '',
    marca: produto?.marca || '',
    categoria: produto?.categoria || '',
    unidade: produto?.unidade || 'unidade',
    sku: produto?.sku || '',
    estoque: produto?.estoque?.toString() || '0',
    minimo: produto?.minimo?.toString() || '5',
    preco: produto?.preco?.toString() || '0',
    preco_venda: produto?.preco_venda?.toString() || '0',
    vencimento: produto?.vencimento || '',
    lote: produto?.lote || '',
    fornecedor: produto?.fornecedor || '',
    fornecedor_telefone: produto?.fornecedor_telefone || '',
    fornecedor_email: produto?.fornecedor_email || '',
    link: produto?.link || ''
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const canSave = form.nome && form.categoria && form.estoque !== '';
  
  const handleSave = async () => {
    if (!canSave) return;
    const e = Number(form.estoque), m = Number(form.minimo) || 0, pr = Number(form.preco) || 0, pv = Number(form.preco_venda) || 0;
    const itemData = {
      nome: form.nome,
      marca: form.marca,
      categoria: form.categoria,
      unidade: form.unidade,
      sku: form.sku,
      estoque: e,
      minimo: m,
      preco: pr,
      preco_venda: pv,
      vencimento: form.vencimento,
      lote: form.lote,
      fornecedor: form.fornecedor,
      fornecedor_telefone: form.fornecedor_telefone,
      fornecedor_email: form.fornecedor_email,
      link: form.link,
      status: calcStatus(e, m)
    };
    if (produto?.id) itemData.id = produto.id;
    await onSave(itemData);
    onClose();
  };

  const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: 'inherit' };
  const inputStyle = { width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 12, outline: 'none', background: '#FAFAFA', fontSize: 13, color: '#374151', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth: 480, padding: 0, borderRadius: 24, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column'}}>
        <div style={{padding: '20px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA', flexShrink: 0}}>
          <h2 style={{fontSize: 18, fontWeight: 700, color: '#111827', margin: 0, fontFamily: 'inherit'}}>{produto ? 'Editar Produto' : 'Novo Produto'}</h2>
          <button onClick={onClose} style={{background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4}}><XCircle style={{width: 20, height: 20}} /></button>
        </div>

        <div style={{padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, flexGrow: 1}}>
          <div>
            <label style={labelStyle}>Nome *</label>
            <input style={inputStyle} value={form.nome} onChange={e=>set('nome',e.target.value)} />
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
            <div>
              <label style={labelStyle}>Marca</label>
              <input style={inputStyle} value={form.marca} onChange={e=>set('marca',e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Categoria *</label>
              <select style={inputStyle} value={form.categoria} onChange={e=>set('categoria',e.target.value)}>
                <option value="">Selecione...</option>
                {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
            <div>
              <label style={labelStyle}>Unidade</label>
              <select style={inputStyle} value={form.unidade} onChange={e=>set('unidade',e.target.value)}>
                {UNIDADES.map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>SKU</label>
              <input style={inputStyle} value={form.sku} onChange={e=>set('sku',e.target.value)} />
            </div>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
            <div>
              <label style={labelStyle}>Estoque Atual</label>
              <input style={inputStyle} type="number" value={form.estoque} onChange={e=>set('estoque',e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Estoque Mínimo</label>
              <input style={inputStyle} type="number" value={form.minimo} onChange={e=>set('minimo',e.target.value)} />
            </div>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
            <div>
              <label style={labelStyle}>Preço Custo (R$)</label>
              <input style={inputStyle} type="number" value={form.preco} onChange={e=>set('preco',e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Preço Venda (R$)</label>
              <input style={inputStyle} type="number" value={form.preco_venda} onChange={e=>set('preco_venda',e.target.value)} />
            </div>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
            <div>
              <label style={labelStyle}>Validade</label>
              <input style={inputStyle} type="date" value={form.vencimento} onChange={e=>set('vencimento',e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Lote</label>
              <input style={inputStyle} value={form.lote} onChange={e=>set('lote',e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Fornecedor — Nome</label>
            <input style={inputStyle} placeholder="Nome do fornecedor" value={form.fornecedor} onChange={e=>set('fornecedor',e.target.value)} />
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
            <div>
              <label style={labelStyle}>Fornecedor — Telefone</label>
              <input style={inputStyle} placeholder="(11) 99999-9999" value={form.fornecedor_telefone} onChange={e=>set('fornecedor_telefone',e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Fornecedor — Email</label>
              <input style={inputStyle} type="email" placeholder="contato@fornecedor.com" value={form.fornecedor_email} onChange={e=>set('fornecedor_email',e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Link do Produto</label>
            <input style={inputStyle} placeholder="https://..." value={form.link} onChange={e=>set('link',e.target.value)} />
          </div>
        </div>

        <div style={{padding: '16px 24px', display: 'flex', gap: 12, justifyContent: 'flex-end', background: '#FAFAFA', borderTop: '1px solid #F3F4F6', flexShrink: 0}}>
          <button className="btn btn-ghost" onClick={onClose} style={{padding: '10px 20px', borderRadius: 12, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'}}>Cancelar</button>
          <button className="btn btn-primary" disabled={!canSave} onClick={handleSave} style={{padding: '10px 20px', borderRadius: 12, border: 'none', background: canSave ? 'var(--color-primary)' : '#E5E7EB', color: '#fff', fontSize: 14, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit'}}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function EntradaModal({ produto, onClose, onSave }) {
  const [qtd, setQtd] = useState('');
  const canSave = Number(qtd) > 0;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth: 400, padding: 24, borderRadius: 24}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
          <h2 style={{fontSize: 18, fontWeight: 700, margin: 0}}>Entrada de Estoque</h2>
          <button onClick={onClose} style={{background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF'}}><XCircle style={{width: 20, height: 20}} /></button>
        </div>
        <p style={{fontSize: 14, color: '#4B5563', marginBottom: 20}}>
          Adicionar quantidade ao produto <strong>{produto.nome}</strong>. (Estoque atual: {produto.estoque})
        </p>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Quantidade a adicionar *</label>
          <input type="number" style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 12, outline: 'none', background: '#FAFAFA', fontSize: 13, boxSizing: 'border-box' }} value={qtd} onChange={e=>setQtd(e.target.value)} />
        </div>
        <div style={{display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end'}}>
          <button className="btn btn-ghost" onClick={onClose} style={{padding: '10px 20px', borderRadius: 12, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer'}}>Cancelar</button>
          <button className="btn btn-primary" disabled={!canSave} onClick={() => onSave(produto, Number(qtd))} style={{padding: '10px 20px', borderRadius: 12, border: 'none', background: canSave ? 'var(--color-primary)' : '#E5E7EB', color: '#fff', fontSize: 14, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed'}}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function RowMenu({ produto, onEdit, onEntrada, onDelete }) {
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
            onClick={() => { onEdit(produto); setOpen(false); }}
            style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 14px',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#374151',fontWeight:500}}
            onMouseEnter={e=>e.currentTarget.style.background='#F3F4F6'}
            onMouseLeave={e=>e.currentTarget.style.background='none'}
          >
            <Edit2 style={{width:14,height:14}} /> Editar
          </button>
          <button
            onClick={() => { onEntrada(produto); setOpen(false); }}
            style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 14px',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#374151',fontWeight:500}}
            onMouseEnter={e=>e.currentTarget.style.background='#F3F4F6'}
            onMouseLeave={e=>e.currentTarget.style.background='none'}
          >
            <ArrowUp style={{width:14,height:14}} /> Entrada
          </button>
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
  const [editTarget, setEditTarget] = useState(null);
  const [entradaTarget, setEntradaTarget] = useState(null);
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

  const handleSave = async (produto) => {
    if (produto.id) {
      const { data, error } = await updateInventoryItem(produto.id, produto);
      if (error) {
        alert('Erro ao atualizar produto: ' + (error.message || JSON.stringify(error)));
        return;
      }
      if (data) {
        setProdutos(prev => prev.map(p => p.id === data.id ? { ...data, estoque: Number(data.estoque) || 0, minimo: Number(data.minimo) || 0, preco: Number(data.preco) || 0 } : p));
      }
    } else {
      const { data, error } = await insertInventoryItem(produto);
      if (error) {
        alert('Erro ao salvar produto: ' + (error.message || JSON.stringify(error)));
        return;
      }
      if (data) {
        setProdutos(prev => [...prev, { ...data, estoque: Number(data.estoque) || 0, minimo: Number(data.minimo) || 0, preco: Number(data.preco) || 0 }]);
      }
    }
  };

  const handleEntrada = async (produto, qtd) => {
    const novoEstoque = produto.estoque + qtd;
    const { data, error } = await updateInventoryItem(produto.id, { estoque: novoEstoque, status: calcStatus(novoEstoque, produto.minimo) });
    if (error) {
      alert('Erro ao dar entrada: ' + (error.message || JSON.stringify(error)));
      return;
    }
    if (data) {
      setProdutos(prev => prev.map(p => p.id === data.id ? { ...data, estoque: Number(data.estoque) || 0, minimo: Number(data.minimo) || 0, preco: Number(data.preco) || 0 } : p));
    }
    setEntradaTarget(null);
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
      {(modal || editTarget) && <ProdutoModal produto={editTarget} onClose={() => { setModal(false); setEditTarget(null); }} onSave={handleSave} />}
      {entradaTarget && <EntradaModal produto={entradaTarget} onClose={() => setEntradaTarget(null)} onSave={handleEntrada} />}
      {deleteTarget && <DeleteConfirmModal produto={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />}

      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Package />ESTOQUE</div>
          <h1 className="page-title">Estoque</h1>
          <p className="page-subtitle">{produtos.length} produto(s) cadastrado(s)</p>
        </div>
        <div style={{display:'flex', gap: 12}}>
          <button className="btn btn-ghost" style={{padding: '10px 16px', borderRadius: 12, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8}} onClick={() => alert('Em breve: Relatório de Movimentações')}>
            <ArrowDown style={{width: 16, height: 16}} /> Movimentação
          </button>
          <button className="btn btn-primary" onClick={() => setModal(true)}><Plus />Novo Produto</button>
        </div>
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

      <div className="card" style={{padding:0,overflow:'visible',borderRadius:12,border:'1px solid #EAE3DD'}}>
        {/* Search bar */}
        <div style={{padding:'20px 24px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,background:'#FAF7F5',border:'1px solid #E5D5C5',borderRadius:8,padding:'10px 16px',maxWidth:360}}>
            <Search style={{width:16,height:16,color:'#A89F96',flexShrink:0}} />
            <input
              style={{border:'none',outline:'none',background:'transparent',fontSize:14,color:'#444',width:'100%',fontFamily:'inherit'}}
              placeholder="Buscar produto..."
              value={busca}
              onChange={e=>setBusca(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{borderBottom:'1px solid #F3F4F6'}}>
                {['Produto','Categoria','Estoque','Custo','Validade','Status',''].map(h=>(
                  <th key={h} style={{padding:'14px 24px',textAlign:'left',fontSize:13,fontWeight:600,color:'#78716C',whiteSpace:'nowrap',fontFamily:'inherit'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => {
                const st = calcStatus(p.estoque, p.minimo);
                const isCritico = st === 'critico';
                const isBaixo = st === 'baixo';
                const catStyle = CAT_COLORS[p.categoria] || { bg: '#FDF2F2', color: '#995B5B' }; // fallback pinkish
                const maxBar = Math.max(p.minimo * 2, p.estoque, 1);
                const barPct = Math.min((p.estoque / maxBar) * 100, 100);
                const barColor = isCritico ? '#DC2626' : isBaixo ? '#F59E0B' : '#B89B84'; // brown for ok
                
                // Build sublabel parts
                const subParts = [];
                if (p.marca) subParts.push(p.marca);
                if (p.lote) subParts.push(`Lote: ${p.lote}`);
                if (p.fornecedor) subParts.push(p.fornecedor);
                const subLabel = subParts.join(' • ');

                return (
                  <tr key={p.id} style={{borderBottom: i < filtrados.length -1 ? '1px solid #F4F4F5' : 'none'}}>
                    {/* Produto */}
                    <td style={{padding:'16px 24px'}}>
                      <div style={{fontWeight:600,color:'#3F3F46',fontSize:14,display:'flex',alignItems:'center',gap:6}}>
                        {p.nome}
                        {p.link && (
                          <a href={p.link} target="_blank" rel="noreferrer" style={{color:'#D4A373',display:'flex',alignItems:'center'}}>
                            <ExternalLink style={{width:14,height:14}} />
                          </a>
                        )}
                      </div>
                      {subLabel && <div style={{fontSize:12,color:'#A1A1AA',marginTop:4}}>{subLabel}</div>}
                    </td>

                    {/* Categoria */}
                    <td style={{padding:'16px 24px',whiteSpace:'nowrap'}}>
                      <span style={{
                        background: catStyle.bg, color: catStyle.color,
                        padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
                        whiteSpace:'nowrap'
                      }}>
                        {p.categoria}
                      </span>
                    </td>

                    {/* Estoque */}
                    <td style={{padding:'16px 24px',minWidth:140}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                        <span style={{fontWeight:600,fontSize:13,color: isCritico ? '#DC2626' : '#52525B'}}>
                          {p.estoque} {p.unidade || ''}
                        </span>
                        {isCritico && <AlertTriangle style={{width:14,height:14,color:'#DC2626',flexShrink:0}} />}
                      </div>
                      {/* progress bar */}
                      <div style={{height:4,background:'#F4F4F5',borderRadius:4,overflow:'hidden',width:'80px'}}>
                        <div style={{height:'100%',width:`${barPct}%`,background:barColor,borderRadius:4,transition:'width 0.3s'}} />
                      </div>
                    </td>

                    {/* Custo */}
                    <td style={{padding:'16px 24px',whiteSpace:'nowrap',fontWeight:500,color:'#52525B'}}>
                      R$ {p.preco.toLocaleString('pt-BR',{minimumFractionDigits:2})}
                    </td>

                    {/* Validade */}
                    <td style={{padding:'16px 24px',whiteSpace:'nowrap',color:'#52525B',fontSize:13}}>
                      {formatDate(p.vencimento)}
                    </td>

                    {/* Status */}
                    <td style={{padding:'16px 24px'}}>
                      {isCritico ? (
                        <span style={{border:'1px solid #FECACA',color:'#DC2626',background:'transparent',padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:600}}>
                          Crítico
                        </span>
                      ) : (
                        <span style={{border:'1px solid #E4E4E7',color:'#71717A',background:'transparent',padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:600}}>
                          OK
                        </span>
                      )}
                    </td>

                    {/* Menu */}
                    <td style={{padding:'16px 16px',textAlign:'right'}}>
                      <RowMenu produto={p} onEdit={setEditTarget} onEntrada={setEntradaTarget} onDelete={setDeleteTarget} />
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
