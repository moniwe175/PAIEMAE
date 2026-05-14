import React, { useState } from 'react';
import { Settings, MessageSquare, Instagram, Link2, CheckCircle, XCircle, RefreshCw, Zap } from 'lucide-react';

const integracoes = [
  {
    id: 1,
    nome: 'WhatsApp Business',
    desc: 'Envio automático de lembretes de consulta, confirmações e mensagens de marketing para seus pacientes via WhatsApp.',
    icon: MessageSquare,
    cor: '#25D366',
    status: 'conectado',
    ultimoSync: '14/05/2026 09:30',
    mensagensEnviadas: 248,
  },
  {
    id: 2,
    nome: 'Instagram',
    desc: 'Integração com Instagram para publicação de antes/depois, stories de promoções e gestão de DMs de novos leads.',
    icon: Instagram,
    cor: '#E1306C',
    status: 'desconectado',
    ultimoSync: '-',
    mensagensEnviadas: 0,
  },
  {
    id: 3,
    nome: 'Google Agenda',
    desc: 'Sincronize seus agendamentos com o Google Agenda para visualização em qualquer dispositivo e compartilhamento com a equipe.',
    icon: Link2,
    cor: '#4285F4',
    status: 'conectado',
    ultimoSync: '14/05/2026 08:00',
    mensagensEnviadas: 92,
  },
  {
    id: 4,
    nome: 'Mercado Pago',
    desc: 'Receba pagamentos online via link, PIX e cartão. Integração completa com controle financeiro do sistema.',
    icon: Zap,
    cor: '#00AEEF',
    status: 'desconectado',
    ultimoSync: '-',
    mensagensEnviadas: 0,
  },
];

export default function Integration() {
  const [items, setItems] = useState(integracoes);

  const toggle = (id) => {
    setItems(prev => prev.map(i =>
      i.id === id
        ? {...i, status: i.status === 'conectado' ? 'desconectado' : 'conectado',
            ultimoSync: i.status === 'desconectado' ? `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : '-'}
        : i
    ));
  };

  const conectados = items.filter(i=>i.status==='conectado').length;

  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Settings />INTEGRAÇÕES</div>
          <h1 className="page-title">Integrações</h1>
          <p className="page-subtitle">Conecte suas ferramentas favoritas</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span className="badge badge-success">{conectados} conectadas</span>
          <span className="badge badge-neutral">{items.length - conectados} desconectadas</span>
        </div>
      </div>

      <div className="grid-2 section-gap">
        {items.map(item=>{
          const Icon = item.icon;
          const isConectado = item.status === 'conectado';
          return (
            <div key={item.id} className="card" style={{borderLeft:`3px solid ${item.cor}`}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{
                    width:44,height:44,borderRadius:12,
                    background:`${item.cor}18`,
                    display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0
                  }}>
                    <Icon style={{width:22,height:22,color:item.cor}} />
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:15}}>{item.nome}</div>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginTop:3}}>
                      {isConectado
                        ? <><CheckCircle style={{width:12,height:12,color:'var(--success)'}}/><span style={{fontSize:11,color:'var(--success)',fontWeight:600}}>Conectado</span></>
                        : <><XCircle style={{width:12,height:12,color:'var(--text-muted)'}}/><span style={{fontSize:11,color:'var(--text-muted)',fontWeight:500}}>Desconectado</span></>}
                    </div>
                  </div>
                </div>
                <label style={{display:'flex',alignItems:'center',cursor:'pointer',gap:6}}>
                  <div
                    onClick={()=>toggle(item.id)}
                    style={{
                      width:42,height:24,borderRadius:99,cursor:'pointer',
                      background:isConectado?item.cor:'var(--border-color)',
                      position:'relative',transition:'background 0.2s',flexShrink:0
                    }}
                  >
                    <div style={{
                      width:18,height:18,borderRadius:'50%',background:'#fff',
                      position:'absolute',top:3,left:isConectado?21:3,
                      transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </label>
              </div>

              <p style={{fontSize:12,color:'var(--text-light)',lineHeight:1.6,margin:'0 0 14px'}}>{item.desc}</p>

              <div className="divider" />

              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12}}>
                <div style={{color:'var(--text-muted)',display:'flex',alignItems:'center',gap:4}}>
                  <RefreshCw style={{width:11,height:11}}/> Último sync: {item.ultimoSync}
                </div>
                {isConectado && (
                  <span style={{fontWeight:600,color:item.cor}}>{item.mensagensEnviadas} envios</span>
                )}
              </div>

              {!isConectado && (
                <button className="btn btn-primary btn-sm" style={{marginTop:14,width:'100%',justifyContent:'center'}} onClick={()=>toggle(item.id)}>
                  <Link2 style={{width:12,height:12}}/>Conectar Agora
                </button>
              )}
              {isConectado && (
                <div style={{display:'flex',gap:6,marginTop:14}}>
                  <button className="btn btn-ghost btn-sm" style={{flex:1}}>Configurar</button>
                  <button className="btn btn-secondary btn-sm" style={{flex:1}}><RefreshCw style={{width:12,height:12}}/>Sincronizar</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
