import { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Users, Calendar, DollarSign, FileSpreadsheet } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { useSync } from '../contexts/SyncContext';
import SheetSyncStatus from '../components/integration/SheetSyncStatus';

const COLORS = ['#E1306C', 'var(--color-primary)', '#4285F4', '#25D366', '#0F9D58'];

export default function Reports() {
  const { transactions, comissoes } = useSync();
  const [periodo, setPeriodo] = useState('ano');

  // Compute data based on selected period
  const filteredData = useMemo(() => {
    const today = new Date();
    let startDate = new Date();

    if (periodo === '7d') startDate.setDate(today.getDate() - 7);
    else if (periodo === '30d') startDate.setDate(today.getDate() - 30);
    else if (periodo === '6m') startDate.setMonth(today.getMonth() - 6);
    else startDate.setFullYear(today.getFullYear() - 1);

    return transactions.filter(t => {
      const parts = t.data.split('/');
      if (parts.length !== 3) return true;
      const txDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      return txDate >= startDate && txDate <= today;
    });
  }, [transactions, periodo]);

  // KPIs
  const faturamentoTotal = filteredData.filter(t => t.tipo === 'receita').reduce((a, t) => a + t.valor, 0);
  const despesaTotal = filteredData.filter(t => t.tipo === 'despesa').reduce((a, t) => a + t.valor, 0);
  const lucroLiquido = faturamentoTotal - despesaTotal;
  const totalSessoes = filteredData.filter(t => t.tipo === 'receita').length;
  const ticketMedio = totalSessoes > 0 ? Math.round(faturamentoTotal / totalSessoes) : 0;
  const novosPacientes = new Set(
    filteredData.filter(t => t.tipo === 'receita').map(t => {
      const match = t.desc.match(/-\s*(.+)/);
      return match ? match[1].trim() : null;
    }).filter(Boolean)
  ).size;

  // Synced count
  const syncedCount = filteredData.filter(t => t.origem === 'planilha').length;

  // Monthly revenue for chart
  const faturamentoMensal = useMemo(() => {
    const months = {};
    filteredData.filter(t => t.tipo === 'receita').forEach(t => {
      const parts = t.data.split('/');
      const key = parts.length === 3 ? `${parts[1]}/${parts[2]}` : t.data;
      if (!months[key]) months[key] = { mes: key, valor: 0 };
      months[key].valor += t.valor;
    });
    return Object.values(months);
  }, [filteredData]);

  // Service popularity
  const servicosPopulares = useMemo(() => {
    const services = {};
    filteredData.filter(t => t.tipo === 'receita').forEach(t => {
      const name = t.desc.replace(/\s*-\s*.+$/, '').trim();
      if (!services[name]) services[name] = { nome: name, qtd: 0, valor: 0 };
      services[name].qtd++;
      services[name].valor += t.valor;
    });
    return Object.values(services).sort((a, b) => b.valor - a.valor).slice(0, 5);
  }, [filteredData]);

  // Client origin (from origem field)
  const origemData = useMemo(() => {
    const manual = filteredData.filter(t => t.origem === 'manual').length;
    const planilha = filteredData.filter(t => t.origem === 'planilha').length;
    const total = manual + planilha;
    if (total === 0) return [];
    return [
      { name: 'Manual (ERP)', value: Math.round((manual / total) * 100), color: 'var(--color-primary)' },
      { name: 'Planilha Integrada', value: Math.round((planilha / total) * 100), color: '#0F9D58' },
    ].filter(d => d.value > 0);
  }, [filteredData]);

  // Professional ranking from commissions
  const profRanking = useMemo(() => {
    const profs = {};
    comissoes.forEach(c => {
      if (!profs[c.prof]) profs[c.prof] = { nome: c.prof, comissaoTotal: 0, sessoes: 0 };
      profs[c.prof].comissaoTotal += c.valorComissao;
      profs[c.prof].sessoes++;
    });
    return Object.values(profs).sort((a, b) => b.comissaoTotal - a.comissaoTotal);
  }, [comissoes]);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-header-label"><BarChart3 />RELATÓRIOS</div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Análise completa do desempenho da clínica</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SheetSyncStatus compact />
          <div className="tabs">
            {[{ k: '7d', l: '7 dias' }, { k: '30d', l: '30 dias' }, { k: '6m', l: '6 meses' }, { k: 'ano', l: 'Ano' }].map(({ k, l }) => (
              <button key={k} className={`tab-item${periodo === k ? ' active' : ''}`} onClick={() => setPeriodo(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-4 section-gap">
        {[
          { label: 'Faturamento Total', val: `R$ ${faturamentoTotal.toLocaleString('pt-BR')}`, sub: syncedCount > 0 ? `${syncedCount} da planilha` : 'Período selecionado', cor: 'var(--success)', icon: DollarSign, bgIcon: 'var(--success-bg)' },
          { label: 'Total de Sessões', val: String(totalSessoes), sub: `${totalSessoes > 0 ? (totalSessoes / (periodo === '7d' ? 7 : periodo === '30d' ? 30 : 180)).toFixed(1) : 0}/dia`, cor: 'var(--info)', icon: Calendar, bgIcon: 'var(--info-bg)' },
          { label: 'Novos Pacientes', val: String(novosPacientes), sub: 'no período', cor: 'var(--color-primary)', icon: Users, bgIcon: 'var(--color-accent-soft)' },
          { label: 'Ticket Médio', val: `R$ ${ticketMedio.toLocaleString('pt-BR')}`, sub: `Lucro: R$ ${lucroLiquido.toLocaleString('pt-BR')}`, cor: 'var(--warning)', icon: TrendingUp, bgIcon: 'var(--warning-bg)' },
        ].map(({ label, val, sub, cor, icon: Icon, bgIcon }) => (
          <div key={label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-card-icon" style={{ background: bgIcon, marginBottom: 8 }}>
                <Icon style={{ color: cor }} />
              </div>
              {syncedCount > 0 && label === 'Faturamento Total' && (
                <span className="stat-badge up"><FileSpreadsheet style={{ width: 10, height: 10 }} />sync</span>
              )}
            </div>
            <div className="stat-value" style={{ color: cor }}>{val}</div>
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
            <LineChart data={faturamentoMensal} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `R$${v / 1000}k`} />
              <Tooltip formatter={(v) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Faturamento']} />
              <Line type="monotone" dataKey="valor" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title"><Users />Origem dos Dados</span>
          </div>
          {origemData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={origemData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                  {origemData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend iconSize={10} iconType="circle" formatter={(v) => <span style={{ fontSize: 11, color: 'var(--text-medium)' }}>{v}</span>} />
                <Tooltip formatter={(v) => [`${v}%`, 'Participação']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, color: 'var(--text-muted)', fontSize: 13 }}>
              Sem dados no período
            </div>
          )}
        </div>
      </div>

      {/* Professional ranking */}
      {profRanking.length > 0 && (
        <div className="card section-gap">
          <div className="card-header">
            <span className="card-title"><Users />Ranking de Profissionais</span>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(profRanking.length * 50, 120)}>
            <BarChart data={profRanking} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
              <YAxis type="category" dataKey="nome" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-medium)' }} width={130} />
              <Tooltip formatter={(v) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Comissão Total']} />
              <Bar dataKey="comissaoTotal" fill="var(--color-accent)" radius={[0, 4, 4, 0]} name="Comissão" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Services chart */}
      {servicosPopulares.length > 0 && (
        <div className="card section-gap">
          <div className="card-header">
            <span className="card-title"><BarChart3 />Serviços Mais Realizados</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={servicosPopulares} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis type="category" dataKey="nome" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-medium)' }} width={140} />
              <Tooltip formatter={(v, n) => n === 'qtd' ? [v, 'Sessões'] : [`R$ ${v.toLocaleString('pt-BR')}`, 'Faturamento']} />
              <Bar dataKey="qtd" fill="var(--color-primary)" radius={[0, 4, 4, 0]} name="Sessões" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detail table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>Detalhamento por Serviço</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Serviço</th><th style={{ textAlign: 'center' }}>Sessões</th><th style={{ textAlign: 'right' }}>Faturamento</th><th style={{ textAlign: 'right' }}>Ticket Médio</th><th>Participação</th>
            </tr></thead>
            <tbody>
              {servicosPopulares.map((s, i) => {
                const totalValor = servicosPopulares.reduce((a, x) => a + x.valor, 0);
                const pct = totalValor > 0 ? Math.round((s.valor / totalValor) * 100) : 0;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{s.nome}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.qtd}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>R$ {s.valor.toLocaleString('pt-BR')}</td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>R$ {Math.round(s.valor / s.qtd).toLocaleString('pt-BR')}</td>
                    <td style={{ minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--border-color)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, width: 28, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {servicosPopulares.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    Nenhum dado no período selecionado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
