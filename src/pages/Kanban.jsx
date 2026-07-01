import React, { useState, useEffect } from 'react';
import { Star, Plus, XCircle, GripVertical, Trash2 } from 'lucide-react';
import { fetchKanbanLeads, insertKanbanLead, updateKanbanLead, deleteKanbanLead } from '../services/supabaseService';
import { getCurrentUser } from '../lib/supabase';

const COLUNAS = [
  { id:'novo', label:'Novo Lead', cor:'var(--info)', corBg:'var(--info-bg)' },
  { id:'contato', label:'Em Contato', cor:'var(--warning)', corBg:'var(--warning-bg)' },
  { id:'agendado', label:'Agendado', cor:'var(--color-primary)', corBg:'var(--color-accent-soft)' },
  { id:'concluido', label:'ConcluÃ­do', cor:'var(--success)', corBg:'var(--success-bg)' },
];

function genId() {
  return 'lead_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function LeadModal({ onClose, onSave }) {
  const [form, setForm] = useState({ nome:'', servico:'', valor:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const canSave = form.nome;
  const handleSave = async () => {
    if (!canSave) return;
    await onSave({
      nome: form.nome,
      servico: form.servico,
      valor: Number(form.valor) || 0,
      col: 'novo',
      avatar: form.nome.charAt(0).toUpperCase(),
      ordem: Date.now(),
    });
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Novo Lead</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-group">
          <label className="form-label">Nome</label>
          <input className="form-input" placeholder="Nome do lead" value={form.nome} onChange={e=>set('nome',e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">ServiÃ§o de Interesse</label>
          <input className="form-input" placeholder="Ex: Botox Facial" value={form.servico} onChange={e=>set('servico',e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Valor Estimado (R$)</label>
          <input className="form-input" type="number" placeholder="0" value={form.valor} onChange={e=>set('valor',e.target.value)} />
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!canSave} onClick={handleSave} style={{opacity:canSave?1:0.5}}><Plus />Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function Kanban() {
  const [cards, setCards] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await fetchKanbanLeads();
      if (data) {
        setCards(data.map(c => ({
          ...c,
          valor: Number(c.valor) || 0,
        })));
      }
    }
    load();
  }, []);

  const moveCard = async (cardId, novaCol) => {
    setCards(cs => cs.map(c => c.id === cardId ? {...c, col: novaCol} : c));
    await updateKanbanLead(cardId, { col: novaCol });
  };

  const handleAddLead = async (leadData) => {
    const user = await getCurrentUser();
    const lead = { id: genId(), ...leadData, user_id: user?.id };
    const { data, error } = await insertKanbanLead(lead);
    if (!error && data) {
      setCards(prev => [...prev, { ...data, valor: Number(data.valor) || 0 }]);
    }
  };

  const handleDeleteLead = async (cardId) => {
    const { error } = await deleteKanbanLead(cardId);
    if (!error) {
      setCards(prev => prev.filter(c => c.id !== cardId));
    }
  };

  const onDragStart = (e, card) => {
    setDragging(card);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (e, colId) => {
    e.preventDefault();
    if (dragging) moveCard(dragging.id, colId);
    setDragging(null);
  };

  const onDragOver = (e) => e.preventDefault();

  return (
    <div>
      {modal && <LeadModal onClose={()=>setModal(false)} onSave={handleAddLead} />}

      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Star />KANBAN</div>
          <h1 className="page-title">Kanban de Leads</h1>
          <p className="page-subtitle">GestÃ£o de funil de atendimento</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus />Novo Lead</button>
      </div>

      <div style={{display:'flex',gap:14,overflowX:'auto',paddingBottom:8}}>
        {COLUNAS.map(col=>{
          const colCards = cards.filter(c=>c.col===col.id);
          const totalValor = colCards.reduce((a,c)=>a+(c.valor||0),0);
          return (
            <div
              key={col.id}
              style={{minWidth:240,flex:1}}
              onDrop={e=>onDrop(e,col.id)}
              onDragOver={onDragOver}
            >
              {/* Column header */}
              <div style={{
                background:col.corBg,
                borderRadius:'var(--radius-md)',
                padding:'10px 14px',
                marginBottom:10,
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between'
              }}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:col.cor}} />
                  <span style={{fontSize:12,fontWeight:700,color:'var(--text-dark)'}}>{col.label}</span>
                  <span style={{
                    background:col.cor,color:'#fff',borderRadius:99,
                    width:20,height:20,display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:11,fontWeight:700
                  }}>{colCards.length}</span>
                </div>
                <span style={{fontSize:11,fontWeight:600,color:col.cor}}>
                  R$ {totalValor.toLocaleString('pt-BR')}
                </span>
              </div>

              {/* Cards */}
              <div style={{display:'flex',flexDirection:'column',gap:8,minHeight:200}}>
                {colCards.map(card=>(
                  <div
                    key={card.id}
                    draggable
                    onDragStart={e=>onDragStart(e,card)}
                    className="card"
                    style={{
                      cursor:'grab',padding:'12px 14px',
                      opacity:dragging?.id===card.id?0.5:1,
                      transition:'opacity 0.15s',
                    }}
                  >
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                      <div className="avatar" style={{width:30,height:30,fontSize:12,flexShrink:0}}>{card.avatar || card.nome?.charAt(0) || '?'}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{card.nome}</div>
                        <div style={{fontSize:11,color:'var(--text-muted)'}}>{card.servico}</div>
                      </div>
                      <div style={{display:'flex',gap:2}}>
                        <button
                          onClick={() => handleDeleteLead(card.id)}
                          title="Excluir lead"
                          style={{ background:'none', border:'none', cursor:'pointer', padding:4, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#FEE2E2'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <Trash2 style={{width:12,height:12,color:'var(--danger)'}} />
                        </button>
                        <GripVertical style={{width:14,height:14,color:'var(--text-muted)',flexShrink:0}} />
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <span style={{fontSize:13,fontWeight:700,color:'var(--success)'}}>R$ {(card.valor||0).toLocaleString('pt-BR')}</span>
                      <div style={{display:'flex',gap:4}}>
                        {COLUNAS.filter(c=>c.id!==col.id).slice(0,1).map(nextCol=>(
                          <button key={nextCol.id} className="btn btn-secondary btn-sm" onClick={()=>moveCard(card.id,nextCol.id)} style={{padding:'2px 8px',fontSize:10}}>
                            â†’
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {colCards.length===0 && (
                  <div style={{
                    border:'2px dashed var(--border-color)',borderRadius:'var(--radius-md)',
                    padding:'24px',textAlign:'center',color:'var(--text-muted)',fontSize:12
                  }}>
                    Arraste cards aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
