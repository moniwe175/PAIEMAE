import React, { useState } from 'react';
import { BarChart3, TrendingUp, Users, Calendar, DollarSign, Download } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const faturamentoMensal = [
  { mes:'Jan', valor:3200 }, { mes:'Fev', valor:4100 }, { mes:'Mar', valor:3800 },
  { mes:'Abr', valor:5200 }, { mes:'Mai', valor:4800 }, { mes:'Jun', valor:6100 },
  { mes:'Jul', valor:5400 }, { mes:'Ago', valor:7200 }, { mes:'Set', valor:6800 },
  { mes:'Out', valor:8100 }, { mes:'Nov', valor:9200 }, { mes:'Dez', valor:10400 },
];

const servicosPopulares = [
  { nome:'Botox Facial', qtd:32, valor:20800 },
  { nome:'Preenchimento Labial', qtd:24, valor:21600 },
  { nome:'Harmonização', qtd:12, valor:33600 },
  { nome:'Bioestimulador', qtd:18, valor:27000 },
  { nome:'Peeling Químico', qtd:28, valor:8960 },
];

const origemClientes = [
  { name:'Instagram', value:38, color:'#E1306C' },
  { name:'Indicação', value:31, color:'var(--color-primary)' },
  { name:'Google', value:18, color:'#4285F4' },
  { name:'WhatsApp', value:13, color:'#25D366' },
];

export default function Reports() {
  const [periodo, setPeriodo] = useState('ano');

  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div>
          <div className="page-header-label"><BarChart3 />RELATÓRIOS</div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Análise completa do desempenho da clínica</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <div className="tabs">
            {[{k:'mes',l:'Mês'},{k:'trimestre',l:'Trimestre'},{k:'ano',l:'Ano'}].map(({k,l})=>(
              <button key={k} className={`tab-item${periodo===k?' active':''}`} onClick={()=>setPeriodo(k)}>{l}</button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm"><Download />Exportar</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-4 section-gap">
        {[
          {label:'Faturamento Total',val:'R$ 74.300',sub:'+22% vs ano anterior',cor:'var(--success)',icon:DollarSign,bgIcon:'var(--success-bg)'},
          {label:'Total de Sessões',val:'148',sub:'12,3 sessões/mês',cor:'var(--info)',icon:Calendar,bgIcon:'var(--info-bg)'},
          {label:'Novos Pacientes',val:'43',sub:'+8 vs período anterior',cor:'var(--color-primary)',icon:Users,bgIcon:'var(--color-accent-soft)'},
          {label:'Ticket Médio',val:'R$ 501',sub:'+5% vs ano anterior',cor:'var(--warning)',icon:TrendingUp,bgIcon:'var(--warning-bg)'},
        ].map(({label,val,sub,cor,icon:Icon,bgIcon})=>(
          <div key={label} className="stat-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div className="stat-card-icon" style={{background:bgIcon,marginBottom:8}}>
                <Icon style={{color:cor}} />
              </div>
              <span className="stat-badge up"><TrendingUp style={{width:10,height:10}} />+</span>
            </div>
            <div className="stat-value" style={{color:cor}}>{val}</div>
            <div className="stat-label">{label}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid-2-1 section-gap">
        <div className="card">
          <div className="card-header">
            <span className="card-title"><TrendingUp />Faturamento Mensal</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={faturamentoMensal} margin={{top:5,right:5,left:-15,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'var(--text-muted)'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:'var(--text-muted)'}} tickFormatter={v=>`R$${v/1000}k`} />
              <Tooltip formatter={(v)=>[`R$ ${v.toLocaleString('pt-BR')}`, 'Faturamento']} />
              <Line type="monotone" dataKey="valor" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title"><Users />Origem dos Clientes</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={origemClientes} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                {origemClientes.map((entry,i)=>(
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Legend iconSize={10} iconType="circle" formatter={(v)=><span style={{fontSize:11,color:'var(--text-medium)'}}>{v}</span>} />
              <Tooltip formatter={(v)=>[`${v}%`,'Participação']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Serviços mais realizados */}
      <div className="card section-gap">
        <div className="card-header">
          <span className="card-title"><BarChart3 />Serviços Mais Realizados</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={servicosPopulares} margin={{top:0,right:0,left:-20,bottom:0}} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'var(--text-muted)'}} />
            <YAxis type="category" dataKey="nome" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'var(--text-medium)'}} width={140} />
            <Tooltip formatter={(v,n)=>n==='qtd'?[v,'Sessões']:[`R$ ${v.toLocaleString('pt-BR')}`, 'Faturamento']} />
            <Bar dataKey="qtd" fill="var(--color-primary)" radius={[0,4,4,0]} name="Sessões" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela detalhada */}
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border-color)'}}>
          <span style={{fontSize:13,fontWeight:600,color:'var(--text-dark)'}}>Detalhamento por Serviço</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Serviço</th><th style={{textAlign:'center'}}>Sessões</th><th style={{textAlign:'right'}}>Faturamento</th><th style={{textAlign:'right'}}>Ticket Médio</th><th>Participação</th>
            </tr></thead>
            <tbody>
              {servicosPopulares.map((s,i)=>{
                const totalValor = servicosPopulares.reduce((a,x)=>a+x.valor,0);
                const pct = Math.round((s.valor/totalValor)*100);
                return (
                  <tr key={i}>
                    <td style={{fontWeight:600,fontSize:13}}>{s.nome}</td>
                    <td style={{textAlign:'center',fontWeight:600}}>{s.qtd}</td>
                    <td style={{textAlign:'right',fontWeight:700,color:'var(--success)'}}>R$ {s.valor.toLocaleString('pt-BR')}</td>
                    <td style={{textAlign:'right',fontSize:13}}>R$ {Math.round(s.valor/s.qtd).toLocaleString('pt-BR')}</td>
                    <td style={{minWidth:140}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{flex:1,height:6,background:'var(--border-color)',borderRadius:99,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${pct}%`,background:'var(--color-primary)',borderRadius:99}} />
                        </div>
                        <span style={{fontSize:11,fontWeight:600,width:28,textAlign:'right'}}>{pct}%</span>
                      </div>
                    </td>
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
