import React, { useState } from 'react';
import { DollarSign, Plus, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, XCircle, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const barData = [
  { mes:'Jan', receita:3200, despesa:1800 },
  { mes:'Fev', receita:4100, despesa:2100 },
  { mes:'Mar', receita:3800, despesa:1950 },
  { mes:'Abr', receita:5200, despesa:2400 },
  { mes:'Mai', receita:4800, despesa:2200 },
];

const transacoes = [
  { id:1, tipo:'receita', desc:'Botox Facial - Ana Beatriz', categoria:'Serviços', data:'14/05/2026', valor:650 },
  { id:2, tipo:'receita', desc:'Preenchimento - Carla Mendes', categoria:'Serviços', data:'14/05/2026', valor:900 },
  { id:3, tipo:'despesa', desc:'Botox Allergan 100U', categoria:'Estoque', data:'13/05/2026', valor:480 },
  { id:4, tipo:'receita', desc:'Pacote Harmonização - Fernanda', categoria:'Pacotes', data:'12/05/2026', valor:1800 },
  { id:5, tipo:'despesa', desc:'Aluguel da clínica', categoria:'Fixo', data:'10/05/2026', valor:3500 },
  { id:6, tipo:'receita', desc:'Bioestimulador - Patrícia', categoria:'Serviços', data:'09/05/2026', valor:1200 },
  { id:7, tipo:'despesa', desc:'Material de consumo', categoria:'Estoque', data:'08/05/2026', valor:320 },
];

export default function Financial() {
  const [modal, setModal] = useState(false);
  const [filtro, setFiltro] = useState('todos');
  const [form, setForm] = useState({ tipo:'receita', desc:'', valor:'', categoria:'', data:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const receita = transacoes.filter(t=>t.tipo==='receita').reduce((a,t)=>a+t.valor,0);
  const despesa = transacoes.filter(t=>t.tipo==='despesa').reduce((a,t)=>a+t.valor,0);
  const lucro = receita - despesa;

  const filtradas = transacoes.filter(t => filtro==='todos' || t.tipo===filtro);

  return (
    <div>
      {modal && (
        <div className="modal-overlay" onClick={()=>setModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Nova Transação</span>
              <button className="modal-close" onClick={()=>setModal(false)}><XCircle /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <div className="tabs">
                {['receita','despesa'].map(t=>(
                  <button key={t} className={`tab-item${form.tipo===t?' active':''}`} onClick={()=>set('tipo',t)}>
                    {t==='receita'?'Receita':'Despesa'}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input className="form-input" placeholder="Descrição da transação" value={form.desc} onChange={e=>set('desc',e.target.value)} />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" placeholder="0,00" value={form.valor} onChange={e=>set('valor',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Data</label>
                <input className="form-input" type="date" value={form.data} onChange={e=>set('data',e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-select" value={form.categoria} onChange={e=>set('categoria',e.target.value)}>
                <option value="">Selecione...</option>
                {['Serviços','Pacotes','Estoque','Fixo','Marketing','Outros'].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={()=>setModal(false)}><DollarSign />Salvar</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><DollarSign />FINANCEIRO</div>
          <h1 className="page-title">Financeiro</h1>
          <p className="page-subtitle">Controle de receitas e despesas</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus />Nova Transação</button>
      </div>

      <div className="grid-3 section-gap">
        <div className="stat-card">
          <div className="stat-card-icon" style={{background:'var(--success-bg)'}}>
            <TrendingUp style={{color:'var(--success)'}} />
          </div>
          <div className="stat-value" style={{color:'var(--success)'}}>R$ {receita.toLocaleString('pt-BR')}</div>
          <div className="stat-label">Receitas do Mês</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{background:'var(--danger-bg)'}}>
            <TrendingDown style={{color:'var(--danger)'}} />
          </div>
          <div className="stat-value" style={{color:'var(--danger)'}}>R$ {despesa.toLocaleString('pt-BR')}</div>
          <div className="stat-label">Despesas do Mês</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{background:lucro>=0?'var(--success-bg)':'var(--danger-bg)'}}>
            <DollarSign style={{color:lucro>=0?'var(--success)':'var(--danger)'}} />
          </div>
          <div className="stat-value" style={{color:lucro>=0?'var(--success)':'var(--danger)'}}>R$ {lucro.toLocaleString('pt-BR')}</div>
          <div className="stat-label">Lucro Líquido</div>
        </div>
      </div>

      <div className="grid-2-1 section-gap">
        <div className="card">
          <div className="card-header">
            <span className="card-title"><TrendingUp />Receitas vs Despesas</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{top:0,right:0,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'var(--text-muted)'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize:11,fill:'var(--text-muted)'}} />
              <Tooltip />
              <Bar dataKey="receita" fill="var(--success)" radius={[4,4,0,0]} name="Receita" />
              <Bar dataKey="despesa" fill="var(--danger)" radius={[4,4,0,0]} name="Despesa" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Por Categoria</span></div>
          {[
            {cat:'Serviços',val:2750,pct:60,cor:'var(--success)'},
            {cat:'Pacotes',val:1800,pct:39,cor:'var(--info)'},
            {cat:'Estoque',val:800,pct:17,cor:'var(--warning)'},
            {cat:'Fixo',val:3500,pct:76,cor:'var(--danger)'},
          ].map(({cat,val,pct,cor})=>(
            <div key={cat} style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                <span style={{color:'var(--text-medium)',fontWeight:500}}>{cat}</span>
                <span style={{fontWeight:600}}>R$ {val.toLocaleString('pt-BR')}</span>
              </div>
              <div style={{height:6,background:'var(--border-color)',borderRadius:99,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct}%`,background:cor,borderRadius:99,transition:'width 0.5s'}} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border-color)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:13,fontWeight:600,color:'var(--text-dark)',display:'flex',alignItems:'center',gap:6}}><Filter style={{width:14,height:14,color:'var(--color-primary)'}}/>Transações</span>
          <div className="tabs">
            {[{k:'todos',l:'Todos'},{k:'receita',l:'Receitas'},{k:'despesa',l:'Despesas'}].map(({k,l})=>(
              <button key={k} className={`tab-item${filtro===k?' active':''}`} onClick={()=>setFiltro(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Tipo</th><th style={{textAlign:'right'}}>Valor</th></tr></thead>
            <tbody>
              {filtradas.map(t=>(
                <tr key={t.id}>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:28,height:28,borderRadius:8,background:t.tipo==='receita'?'var(--success-bg)':'var(--danger-bg)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {t.tipo==='receita'
                          ? <ArrowUpRight style={{width:13,height:13,color:'var(--success)'}}/>
                          : <ArrowDownLeft style={{width:13,height:13,color:'var(--danger)'}}/>}
                      </div>
                      <span style={{fontWeight:500,fontSize:13}}>{t.desc}</span>
                    </div>
                  </td>
                  <td><span className="badge badge-neutral">{t.categoria}</span></td>
                  <td style={{fontSize:13,color:'var(--text-light)'}}>{t.data}</td>
                  <td><span className={`badge ${t.tipo==='receita'?'badge-success':'badge-danger'}`}>{t.tipo==='receita'?'Receita':'Despesa'}</span></td>
                  <td style={{textAlign:'right',fontWeight:700,color:t.tipo==='receita'?'var(--success)':'var(--danger)'}}>
                    {t.tipo==='receita'?'+':'-'} R$ {t.valor.toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
