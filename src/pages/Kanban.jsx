import React, { useState } from 'react';
import { Star, Plus, XCircle, GripVertical } from 'lucide-react';

const COLUNAS = [
  { id:'novo', label:'Novo Lead', cor:'var(--info)', corBg:'var(--info-bg)' },
  { id:'contato', label:'Em Contato', cor:'var(--warning)', corBg:'var(--warning-bg)' },
  { id:'agendado', label:'Agendado', cor:'var(--color-primary)', corBg:'var(--color-accent-soft)' },
  { id:'concluido', label:'Concluído', cor:'var(--success)', corBg:'var(--success-bg)' },
];

const initCards = [
  { id:1, nome:'Letícia Martins', servico:'Botox Facial', valor:650, col:'novo', avatar:'L' },
  { id:2, nome:'Bruna Castro', servico:'Harmonização', valor:2800, col:'novo', avatar:'B' },
  { id:3, nome:'Raquel Nunes', servico:'Preenchimento Labial', valor:900, col:'contato', avatar:'R' },
  { id:4, nome:'Simone Teixeira', servico:'Bioestimulador', valor:1500, col:'contato', avatar:'S' },
  { id:5, nome:'Débora Freitas', servico:'Peeling Químico', valor:320, col:'agendado', avatar:'D' },
  { id:6, nome:'Priscila Lima', servico:'Botox Facial', valor:650, col:'agendado', avatar:'P' },
  { id:7, nome:'Monique Alves', servico:'Harmonização', valor:2800, col:'concluido', avatar:'M' },
];

export default function Kanban() {
  const [cards, setCards] = useState(initCards);
  const [dragging, setDragging] = useState(null);

  const moveCard = (cardId, novaCol) => {
    setCards(cs => cs.map(c => c.id === cardId ? {...c, col: novaCol} : c));
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
      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Star />KANBAN</div>
          <h1 className="page-title">Kanban de Leads</h1>
          <p className="page-subtitle">Gestão de funil de atendimento</p>
        </div>
        <button className="btn btn-primary"><Plus />Novo Lead</button>
      </div>

      <div style={{display:'flex',gap:14,overflowX:'auto',paddingBottom:8}}>
        {COLUNAS.map(col=>{
          const colCards = cards.filter(c=>c.col===col.id);
          const totalValor = colCards.reduce((a,c)=>a+c.valor,0);
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
                      <div className="avatar" style={{width:30,height:30,fontSize:12,flexShrink:0}}>{card.avatar}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{card.nome}</div>
                        <div style={{fontSize:11,color:'var(--text-muted)'}}>{card.servico}</div>
                      </div>
                      <GripVertical style={{width:14,height:14,color:'var(--text-muted)',flexShrink:0}} />
                    </div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <span style={{fontSize:13,fontWeight:700,color:'var(--success)'}}>R$ {card.valor.toLocaleString('pt-BR')}</span>
                      <div style={{display:'flex',gap:4}}>
                        {COLUNAS.filter(c=>c.id!==col.id).slice(0,1).map(nextCol=>(
                          <button key={nextCol.id} className="btn btn-secondary btn-sm" onClick={()=>moveCard(card.id,nextCol.id)} style={{padding:'2px 8px',fontSize:10}}>
                            →
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
