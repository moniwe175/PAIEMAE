import React, { useState } from 'react';
import { Megaphone, Plus, XCircle, Users, TrendingUp, Send, MessageSquare, Instagram, Star } from 'lucide-react';

const campanhas = [
  { id:1, nome:'Promoção Dia das Mães', canal:'WhatsApp', enviados:48, abertos:35, cliques:12, conversoes:5, status:'ativo', data:'10/05/2026' },
  { id:2, nome:'Oferta Botox Inverno', canal:'Instagram', enviados:0, abertos:1240, cliques:89, conversoes:18, status:'ativo', data:'08/05/2026' },
  { id:3, nome:'Lembrete de Retorno', canal:'WhatsApp', enviados:22, abertos:20, cliques:8, conversoes:3, status:'concluido', data:'01/05/2026' },
  { id:4, nome:'Captação de Novos Clientes', canal:'Email', enviados:150, abertos:62, cliques:28, conversoes:7, status:'concluido', data:'22/04/2026' },
];

const CANAL_ICON = {
  WhatsApp: MessageSquare,
  Instagram: Instagram,
  Email: Send,
};

const CANAL_COLOR = {
  WhatsApp: '#25D366',
  Instagram: '#E1306C',
  Email: 'var(--info)',
};

function CampanhaModal({ onClose }) {
  const [form, setForm] = useState({ nome:'', canal:'WhatsApp', mensagem:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Nova Campanha</span>
          <button className="modal-close" onClick={onClose}><XCircle /></button>
        </div>
        <div className="form-group">
          <label className="form-label">Nome da Campanha</label>
          <input className="form-input" placeholder="Ex: Promoção de Verão" value={form.nome} onChange={e=>set('nome',e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Canal</label>
          <select className="form-select" value={form.canal} onChange={e=>set('canal',e.target.value)}>
            {['WhatsApp','Instagram','Email','SMS'].map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Mensagem / Conteúdo</label>
          <textarea className="form-textarea" style={{minHeight:100}} placeholder="Digite o conteúdo da campanha..." value={form.mensagem} onChange={e=>set('mensagem',e.target.value)} />
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onClose}><Send />Criar Campanha</button>
        </div>
      </div>
    </div>
  );
}

export default function Marketing() {
  const [modal, setModal] = useState(false);

  const totalEnviados = campanhas.reduce((a,c)=>a+c.enviados,0);
  const totalConversoes = campanhas.reduce((a,c)=>a+c.conversoes,0);

  return (
    <div>
      {modal && <CampanhaModal onClose={()=>setModal(false)} />}

      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Megaphone />MARKETING</div>
          <h1 className="page-title">Marketing</h1>
          <p className="page-subtitle">Gestão de campanhas e comunicação</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus />Nova Campanha</button>
      </div>

      <div className="grid-4 section-gap">
        {[
          {label:'Campanhas Ativas',val:campanhas.filter(c=>c.status==='ativo').length,cor:'var(--color-primary)',icon:Megaphone},
          {label:'Mensagens Enviadas',val:totalEnviados,cor:'var(--info)',icon:Send},
          {label:'Conversões',val:totalConversoes,cor:'var(--success)',icon:Users},
          {label:'Taxa de Conversão',val:`${Math.round((totalConversoes/Math.max(totalEnviados,1))*100)}%`,cor:'var(--warning)',icon:TrendingUp},
        ].map(({label,val,cor,icon:Icon})=>(
          <div key={label} className="stat-card">
            <div className="stat-card-icon" style={{background:`${cor}18`}}><Icon style={{color:cor}} /></div>
            <div className="stat-value" style={{color:cor}}>{val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Canal cards */}
      <div className="grid-3 section-gap">
        {[
          {canal:'WhatsApp',desc:'Envio direto para pacientes via WhatsApp Business',leads:25,cor:'#25D366'},
          {canal:'Instagram',desc:'Publicações e stories patrocinados no Instagram',leads:57,cor:'#E1306C'},
          {canal:'Email',desc:'Campanhas de e-mail marketing para base de clientes',leads:18,cor:'var(--info)'},
        ].map(({canal,desc,leads,cor})=>{
          const Icon = CANAL_ICON[canal] || Send;
          return (
            <div key={canal} className="card" style={{borderTop:`3px solid ${cor}`}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <div style={{width:38,height:38,borderRadius:10,background:`${cor}18`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Icon style={{width:18,height:18,color:cor}} />
                </div>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{canal}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Canal de comunicação</div>
                </div>
              </div>
              <p style={{fontSize:12,color:'var(--text-light)',margin:'0 0 12px',lineHeight:1.5}}>{desc}</p>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:'var(--text-muted)'}}>Leads gerados</span>
                <span style={{fontWeight:700,color:cor,fontSize:18}}>{leads}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border-color)'}}>
          <span style={{fontSize:13,fontWeight:600,color:'var(--text-dark)',display:'flex',alignItems:'center',gap:6}}>
            <Star style={{width:14,height:14,color:'var(--color-primary)'}}/>Campanhas Recentes
          </span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Campanha</th><th>Canal</th><th>Data</th><th style={{textAlign:'center'}}>Enviados</th>
              <th style={{textAlign:'center'}}>Abertos</th><th style={{textAlign:'center'}}>Cliques</th>
              <th style={{textAlign:'center'}}>Conversões</th><th>Status</th>
            </tr></thead>
            <tbody>
              {campanhas.map(c=>{
                const Icon = CANAL_ICON[c.canal] || Send;
                const cor = CANAL_COLOR[c.canal] || 'var(--info)';
                return (
                  <tr key={c.id}>
                    <td style={{fontWeight:600,fontSize:13}}>{c.nome}</td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <Icon style={{width:13,height:13,color:cor}}/><span style={{fontSize:12}}>{c.canal}</span>
                      </div>
                    </td>
                    <td style={{fontSize:12,color:'var(--text-light)'}}>{c.data}</td>
                    <td style={{textAlign:'center',fontWeight:600}}>{c.enviados||c.abertos}</td>
                    <td style={{textAlign:'center',fontWeight:600,color:'var(--info)'}}>{c.abertos}</td>
                    <td style={{textAlign:'center',fontWeight:600,color:'var(--warning)'}}>{c.cliques}</td>
                    <td style={{textAlign:'center',fontWeight:700,color:'var(--success)'}}>{c.conversoes}</td>
                    <td><span className={`badge ${c.status==='ativo'?'badge-success':'badge-neutral'}`}>{c.status==='ativo'?'Ativo':'Concluído'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
