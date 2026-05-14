import React, { useState } from 'react';
import { Award, Plus, XCircle, DollarSign, Percent, Calendar } from 'lucide-react';

const profissionais = [
  { id:1, nome:'Evelyn Costa', cargo:'Médica Esteta', avatar:'E', cor:'var(--color-primary)' },
  { id:2, nome:'Juliana Ramos', cargo:'Enfermeira', avatar:'J', cor:'var(--info)' },
  { id:3, nome:'Carla Souza', cargo:'Esteticista', avatar:'C', cor:'var(--success)' },
];

const comissoes = [
  { id:1, prof:'Evelyn Costa', servico:'Botox Facial', paciente:'Ana Beatriz', data:'10/05/2026', valorServ:650, pct:40, valorComissao:260, status:'pago' },
  { id:2, prof:'Juliana Ramos', servico:'Preenchimento Labial', paciente:'Carla Mendes', data:'08/05/2026', valorServ:900, pct:35, valorComissao:315, status:'pendente' },
  { id:3, prof:'Evelyn Costa', servico:'Harmonização Facial', paciente:'Fernanda Lima', data:'05/05/2026', valorServ:2800, pct:40, valorComissao:1120, status:'pago' },
  { id:4, prof:'Carla Souza', servico:'Peeling Químico', paciente:'Juliana Costa', data:'01/05/2026', valorServ:320, pct:25, valorComissao:80, status:'pendente' },
  { id:5, prof:'Juliana Ramos', servico:'Bioestimulador', paciente:'Patrícia Rocha', data:'28/04/2026', valorServ:1500, pct:35, valorComissao:525, status:'pago' },
];

export default function Comissoes() {
  const [filtro, setFiltro] = useState('todos');
  const [profFiltro, setProfFiltro] = useState('Todos');

  const filtradas = comissoes.filter(c =>
    (filtro === 'todos' || c.status === filtro) &&
    (profFiltro === 'Todos' || c.prof === profFiltro)
  );

  const totalPago = comissoes.filter(c=>c.status==='pago').reduce((a,c)=>a+c.valorComissao,0);
  const totalPendente = comissoes.filter(c=>c.status==='pendente').reduce((a,c)=>a+c.valorComissao,0);

  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><Award />COMISSÕES</div>
          <h1 className="page-title">Comissões</h1>
          <p className="page-subtitle">Controle de comissões por profissional</p>
        </div>
        <button className="btn btn-primary"><Plus />Lançar Comissão</button>
      </div>

      <div className="grid-3 section-gap">
        <div className="stat-card">
          <div className="stat-card-icon" style={{background:'var(--success-bg)'}}>
            <DollarSign style={{color:'var(--success)'}} />
          </div>
          <div className="stat-value" style={{color:'var(--success)'}}>R$ {totalPago.toLocaleString('pt-BR')}</div>
          <div className="stat-label">Total Pago</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{background:'var(--warning-bg)'}}>
            <DollarSign style={{color:'var(--warning)'}} />
          </div>
          <div className="stat-value" style={{color:'var(--warning)'}}>R$ {totalPendente.toLocaleString('pt-BR')}</div>
          <div className="stat-label">A Pagar</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{background:'var(--info-bg)'}}>
            <Award style={{color:'var(--info)'}} />
          </div>
          <div className="stat-value" style={{color:'var(--info)'}}>{comissoes.length}</div>
          <div className="stat-label">Lançamentos no Mês</div>
        </div>
      </div>

      {/* Por profissional */}
      <div className="grid-3 section-gap">
        {profissionais.map(prof=>{
          const total = comissoes.filter(c=>c.prof===prof.nome).reduce((a,c)=>a+c.valorComissao,0);
          const pendente = comissoes.filter(c=>c.prof===prof.nome && c.status==='pendente').reduce((a,c)=>a+c.valorComissao,0);
          return (
            <div key={prof.id} className="card">
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
                <div className="avatar avatar-lg" style={{background:`linear-gradient(135deg, ${prof.cor}, ${prof.cor}88)`}}>{prof.avatar}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{prof.nome}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)'}}>{prof.cargo}</div>
                </div>
              </div>
              <div className="divider" />
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                <span style={{color:'var(--text-muted)'}}>Total do mês</span>
                <span style={{fontWeight:700,color:'var(--success)'}}>R$ {total.toLocaleString('pt-BR')}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginTop:8}}>
                <span style={{color:'var(--text-muted)'}}>A receber</span>
                <span style={{fontWeight:700,color:'var(--warning)'}}>R$ {pendente.toLocaleString('pt-BR')}</span>
              </div>
              {pendente > 0 && (
                <button className="btn btn-primary btn-sm" style={{width:'100%',marginTop:12,justifyContent:'center'}}>
                  <DollarSign style={{width:12,height:12}}/>Pagar Comissão
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border-color)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
          <span style={{fontSize:13,fontWeight:600,color:'var(--text-dark)'}}>Histórico de Comissões</span>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <select className="form-select" style={{width:'auto',padding:'6px 10px',fontSize:12}} value={profFiltro} onChange={e=>setProfFiltro(e.target.value)}>
              <option>Todos</option>
              {profissionais.map(p=><option key={p.id}>{p.nome}</option>)}
            </select>
            <div className="tabs">
              {[{k:'todos',l:'Todos'},{k:'pago',l:'Pagos'},{k:'pendente',l:'Pendentes'}].map(({k,l})=>(
                <button key={k} className={`tab-item${filtro===k?' active':''}`} onClick={()=>setFiltro(k)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Profissional</th><th>Serviço</th><th>Paciente</th><th>Data</th>
              <th style={{textAlign:'right'}}>Valor Serv.</th>
              <th style={{textAlign:'center'}}>%</th>
              <th style={{textAlign:'right'}}>Comissão</th>
              <th>Status</th>
            </tr></thead>
            <tbody>
              {filtradas.map(c=>(
                <tr key={c.id}>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div className="avatar" style={{width:28,height:28,fontSize:11}}>{c.prof.charAt(0)}</div>
                      <span style={{fontSize:12,fontWeight:500}}>{c.prof}</span>
                    </div>
                  </td>
                  <td style={{fontSize:12}}>{c.servico}</td>
                  <td style={{fontSize:12,color:'var(--text-light)'}}>{c.paciente}</td>
                  <td style={{fontSize:12,color:'var(--text-light)'}}><div style={{display:'flex',alignItems:'center',gap:4}}><Calendar style={{width:11,height:11}}/>{c.data}</div></td>
                  <td style={{textAlign:'right',fontSize:12}}>R$ {c.valorServ.toLocaleString('pt-BR')}</td>
                  <td style={{textAlign:'center'}}><div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2,fontSize:12}}><Percent style={{width:11,height:11,color:'var(--text-muted)'}}/>{c.pct}</div></td>
                  <td style={{textAlign:'right',fontWeight:700,color:'var(--success)'}}>R$ {c.valorComissao.toLocaleString('pt-BR')}</td>
                  <td><span className={`badge ${c.status==='pago'?'badge-success':'badge-warning'}`}>{c.status==='pago'?'Pago':'Pendente'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
