import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, XCircle, DollarSign, Clock, Tag, Trash2, AlertOctagon, Edit3 } from 'lucide-react';
import { fetchPackages, insertPackage, updatePackage, deletePackage } from '../services/supabaseService';
import { getCurrentUser } from '../lib/supabase';

function genId() {
  return 'pkg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function PacoteModal({ onClose, onSave, pacote }) {
  const isEdit = !!pacote;
  const [form, setForm] = useState(() => isEdit ? {
    nome: pacote.nome, preco: String(pacote.preco), desconto: String(pacote.desconto),
    validade: pacote.validade, sessoes: String(pacote.sessoes), ativo: pacote.ativo,
  } : { nome:'', preco:'', desconto:'', validade:'', sessoes:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const canSave = form.nome && form.preco !== '';
  const handleSave = async () => {
    if (!canSave) return;
    if (isEdit) {
      await onSave({
        ...pacote,
        nome: form.nome,
        preco: Number(form.preco) || 0,
        desconto: Number(form.desconto) || 0,
        validade: form.validade || '6 meses',
        sessoes: Number(form.sessoes) || 1,
        ativo: form.ativo !== undefined ? form.ativo : pacote.ativo,
      });
    } else {
      await onSave({
        nome: form.nome,
        preco: Number(form.preco) || 0,
        desconto: Number(form.desconto) || 0,
        validade: form.validade || '6 meses',
        sessoes: Number(form.sessoes) || 1,
        servicos: [],
        vendidos: 0,
        ativo: true,
      });
    }
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Editar Pacote' : 'Novo Pacote'}</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-group">
          <label className="form-label">Nome do Pacote</label>
          <input className="form-input" placeholder="Ex: Pacote Prata" value={form.nome} onChange={e=>set('nome',e.target.value)} />
        </div>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">PreÃ§o (R$)</label>
            <input className="form-input" type="number" placeholder="0,00" value={form.preco} onChange={e=>set('preco',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Desconto (%)</label>
            <input className="form-input" type="number" placeholder="0" value={form.desconto} onChange={e=>set('desconto',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">NÂº de SessÃµes</label>
            <input className="form-input" type="number" placeholder="0" value={form.sessoes} onChange={e=>set('sessoes',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Validade</label>
            <input className="form-input" placeholder="Ex: 6 meses" value={form.validade} onChange={e=>set('validade',e.target.value)} />
          </div>
        </div>
        {isEdit && (
          <div className="form-group" style={{marginTop:4}}>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--text-dark)'}}>
              <input type="checkbox" checked={form.ativo !== false} onChange={e=>set('ativo',e.target.checked)} style={{width:16,height:16,accentColor:'var(--success)',cursor:'pointer'}} />
              Pacote Ativo
            </label>
          </div>
        )}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!canSave} onClick={handleSave} style={{opacity:canSave?1:0.5}}><ShoppingBag />{isEdit ? 'Salvar AlteraÃ§Ãµes' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ pacote, onClose, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:420, padding:'28px 28px 24px', boxShadow:'0 24px 64px rgba(0,0,0,0.2)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
          <div style={{ width:48, height:48, borderRadius:14, background:'var(--danger-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <AlertOctagon style={{ width:22, height:22, color:'var(--danger)' }} />
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text-dark)', marginBottom:2 }}>Excluir Pacote</div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>Esta aÃ§Ã£o nÃ£o pode ser desfeita.</div>
          </div>
        </div>
        <div style={{ background:'#F9FAFB', borderRadius:'var(--radius-md)', padding:'12px 16px', marginBottom:20, fontSize:13, color:'var(--text-light)' }}>
          Tem certeza que deseja excluir <strong style={{ color:'var(--text-dark)' }}>{pacote.nome}</strong>?
          {pacote.vendidos > 0 && (
            <div style={{ marginTop:6, color:'var(--warning)', fontWeight:600 }}>
              AtenÃ§Ã£o: {pacote.vendidos} unidade(s) jÃ¡ vendida(s).
            </div>
          )}
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

export default function Packages() {
  const [modal, setModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [pacotes, setPacotes] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await fetchPackages();
      if (error) {
        console.error('Erro ao carregar pacotes:', error);
        alert('Erro ao carregar pacotes: ' + (error.message || JSON.stringify(error)));
      }
      if (data) {
        setPacotes(data.map(p => ({
          ...p,
          servicos: p.servicos || [],
          preco: Number(p.preco) || 0,
          desconto: Number(p.desconto) || 0,
          sessoes: Number(p.sessoes) || 1,
          vendidos: Number(p.vendidos) || 0,
          ativo: p.ativo !== false,
        })));
      }
    }
    load();
  }, []);

  const handleAdd = async (formData) => {
    try {
      const user = await getCurrentUser();
      const newPkg = { id: genId(), ...formData, user_id: user?.id };
      console.log('Tentando salvar pacote:', newPkg);
      const { data, error } = await insertPackage(newPkg);
      
      if (error) {
        console.error('Erro detalhado:', error);
        alert('Erro ao salvar no banco: ' + (error.message || JSON.stringify(error)));
        return;
      }
      
      if (data) {
        setPacotes(prev => [...prev, { ...data, servicos: data.servicos || [], preco: Number(data.preco) || 0, desconto: Number(data.desconto) || 0, sessoes: Number(data.sessoes) || 1, vendidos: Number(data.vendidos) || 0, ativo: data.ativo !== false }]);
        setModal(false);
      }
    } catch (e) {
      console.error('Exceção capturada:', e);
      alert('Erro inesperado: ' + e.message);
    }
  };

  const handleUpdate = async (updated) => {
    const { data, error } = await updatePackage(updated.id, updated);
    if (error) {
      alert('Erro ao atualizar: ' + (error.message || JSON.stringify(error)));
      return;
    }
    if (data) {
      setPacotes(prev => prev.map(p => p.id === data.id ? { ...data, servicos: data.servicos || [], preco: Number(data.preco) || 0, desconto: Number(data.desconto) || 0, sessoes: Number(data.sessoes) || 1, vendidos: Number(data.vendidos) || 0, ativo: data.ativo !== false } : p));
      setEditTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await deletePackage(deleteTarget.id);
    if (error) {
      alert('Erro ao excluir: ' + (error.message || JSON.stringify(error)));
      return;
    }
    setPacotes(prev => prev.filter(p => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const totalVendidos = pacotes.reduce((a, p) => a + p.vendidos, 0);
  const receitaPacotes = pacotes.reduce((a, p) => a + p.vendidos * p.preco, 0);

  return (
    <div>
      {modal && <PacoteModal onClose={()=>setModal(false)} onSave={handleAdd} />}
      {editTarget && <PacoteModal pacote={editTarget} onClose={()=>setEditTarget(null)} onSave={handleUpdate} />}
      {deleteTarget && <DeleteConfirmModal pacote={deleteTarget} onClose={()=>setDeleteTarget(null)} onConfirm={handleDelete} />}

      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><ShoppingBag />PACOTES</div>
          <h1 className="page-title">Pacotes</h1>
          <p className="page-subtitle">{pacotes.length} pacote(s) cadastrado(s)</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus />Novo Pacote</button>
      </div>

      <div className="grid-4 section-gap">
        {[
          {label:'Total Pacotes',val:pacotes.length,cor:'var(--color-primary)'},
          {label:'Ativos',val:pacotes.filter(p=>p.ativo).length,cor:'var(--success)'},
          {label:'Total Vendidos',val:totalVendidos,cor:'var(--info)'},
          {label:'Receita em Pacotes',val:`R$ ${receitaPacotes.toLocaleString('pt-BR')}`,cor:'var(--warning)'},
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
                <span style={{display:'flex',alignItems:'center',gap:4,color:'var(--text-muted)'}}><Clock style={{width:12,height:12}}/>SessÃµes</span>
                <span style={{fontWeight:600}}>{p.sessoes} sessÃµes</span>
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
            {p.servicos && p.servicos.length > 0 && (
              <>
                <div style={{fontSize:12,color:'var(--text-muted)',fontWeight:500,marginBottom:8}}>Inclui:</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:14}}>
                  {p.servicos.map(s=>(
                    <span key={s} style={{background:'var(--color-accent-soft)',color:'var(--text-medium)',padding:'3px 8px',borderRadius:99,fontSize:11,fontWeight:500}}>{s}</span>
                  ))}
                </div>
              </>
            )}
            <div style={{display:'flex',gap:6}}>
              <button className="btn btn-ghost btn-sm" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:4}} onClick={()=>setEditTarget(p)}><Edit3 style={{width:12,height:12}}/>Editar</button>
              <button onClick={()=>setDeleteTarget(p)} title="Excluir pacote" style={{ padding:'6px 10px', borderRadius:'var(--radius-md)', border:'1.5px solid #FCA5A5', background:'#FFF5F5', fontSize:12, fontWeight:600, cursor:'pointer', color:'var(--danger)', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                <Trash2 style={{width:12,height:12}} />
              </button>
              <button className="btn btn-primary btn-sm" style={{flex:1}}><DollarSign style={{width:12,height:12}}/>Vender</button>
            </div>
          </div>
        ))}
      </div>

      {pacotes.length === 0 && (
        <div style={{textAlign:'center',padding:60,color:'var(--text-muted)'}}>
          <ShoppingBag style={{width:40,height:40,marginBottom:12,opacity:0.3}} />
          <p style={{fontSize:14}}>Nenhum pacote cadastrado</p>
          <button className="btn btn-primary" style={{marginTop:12}} onClick={()=>setModal(true)}>
            <Plus />Criar primeiro pacote
          </button>
        </div>
      )}
    </div>
  );
}
