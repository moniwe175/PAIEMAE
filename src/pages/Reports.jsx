import { useState, useMemo, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, Calendar, DollarSign,
  FileSpreadsheet, Wallet, Zap, Loader2
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useSync } from '../contexts/SyncContext';
import SheetSyncStatus from '../components/integration/SheetSyncStatus';

// ─── Helpers ──────────────────────────────────────────────────
/** Brazilian currency format: R$ 1.234,56 */
const formatBRL = (val) =>
  `R$ ${(Number(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Convert YYYY-MM-DD → DD/MM/YYYY */
const formatDateBR = (dateStr) => {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

/** Safely read a numeric field from a cashier record, trying multiple column names */
const numField = (rec, ...keys) => {
  for (const k of keys) {
    if (rec[k] !== undefined && rec[k] !== null && rec[k] !== '') {
      const n = Number(rec[k]);
      if (!isNaN(n)) return n;
    }
  }
  return 0;
};

export default function Reports() {
  const { transactions, comissoes, cashierHistory } = useSync();

  // ─── State ──────────────────────────────────────────────────
  const [periodo, setPeriodo] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // KPI state from sheet_transactions
  const [sheetKpis, setSheetKpis] = useState({
    faturamento: 0,
    totalSessoes: 0,
    ticketMedio: 0,
    totalPix: 0,
    totalCartao: 0,
    totalDinheiro: 0,
    novosPacientes: 0,
    loading: true,
  });
  const [sheetTxData, setSheetTxData] = useState([]);

  // ─── Date range computation ─────────────────────────────────
  const { startDateStr, endDateStr, daysCount } = useMemo(() => {
    const today = new Date();
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    let start = new Date(today);
    start.setHours(0, 0, 0, 0);

    if (periodo === '7d') start.setDate(today.getDate() - 7);
    else if (periodo === '30d') start.setDate(today.getDate() - 30);
    else if (periodo === '90d') start.setDate(today.getDate() - 90);
    else if (periodo === '6m') start.setMonth(today.getMonth() - 6);
    else if (periodo === 'ano') start.setFullYear(today.getFullYear() - 1);
    else if (periodo === 'custom') {
      if (customStart) start = new Date(customStart + 'T00:00:00');
      if (customEnd) end = new Date(customEnd + 'T23:59:59');
    }

    const diffMs = end - start;
    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    return {
      startDateStr: start.toISOString().split('T')[0],
      endDateStr: end.toISOString().split('T')[0],
      daysCount: days,
    };
  }, [periodo, customStart, customEnd]);

  // ─── Fetch KPIs from sheet_transactions ────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchSheetKpis() {
      setSheetKpis((prev) => ({ ...prev, loading: true }));
      try {
        const { data, error } = await supabase
          .from('sheet_transactions')
          .select(
            'gross, date_ref, pix, credito, debito, dinheiro, client, procedure, professional, payment_method, commission_value'
          )
          .eq('row_type', 'receita')
          .eq('is_metadata', false)
          .is('deleted_at', null)
          .gte('date_ref', startDateStr)
          .lte('date_ref', endDateStr)
          .order('date_ref', { ascending: false });

        if (error) throw error;
        if (cancelled) return;

        const rows = data || [];

        const faturamento = rows.reduce((sum, t) => sum + (parseFloat(t.gross) || 0), 0);
        const totalSessoes = rows.length;
        const ticketMedio = totalSessoes > 0 ? faturamento / totalSessoes : 0;
        const totalPix = rows.reduce((sum, t) => sum + (parseFloat(t.pix) || 0), 0);
        const totalCartao = rows.reduce(
          (sum, t) => sum + (parseFloat(t.credito) || 0) + (parseFloat(t.debito) || 0),
          0
        );
        const totalDinheiro = rows.reduce((sum, t) => sum + (parseFloat(t.dinheiro) || 0), 0);
        const novosPacientes = new Set(rows.map((t) => t.client).filter(Boolean)).size;

        setSheetKpis({
          faturamento,
          totalSessoes,
          ticketMedio,
          totalPix,
          totalCartao,
          totalDinheiro,
          novosPacientes,
          loading: false,
        });
        setSheetTxData(rows);
      } catch (e) {
        if (!cancelled) {
          console.warn('[Reports] Erro ao buscar KPIs da planilha:', e?.message || e);
          setSheetKpis((prev) => ({ ...prev, loading: false }));
        }
      }
    }

    fetchSheetKpis();
    return () => {
      cancelled = true;
    };
  }, [startDateStr, endDateStr]);

  // ─── Monthly revenue chart (from sheet_transactions) ────────
  const faturamentoMensal = useMemo(() => {
    const months = {};
    sheetTxData.forEach((t) => {
      const dr = t.date_ref || '';
      const parts = dr.split('-');
      if (parts.length !== 3) return;
      const key = `${parts[1]}/${parts[2]}`;
      if (!months[key]) months[key] = { mes: key, valor: 0 };
      months[key].valor += parseFloat(t.gross) || 0;
    });
    return Object.values(months).sort((a, b) => {
      const [am, ay] = a.mes.split('/').map(Number);
      const [bm, by] = b.mes.split('/').map(Number);
      return ay * 12 + am - (by * 12 + bm);
    });
  }, [sheetTxData]);

  // ─── Service popularity (from sheet_transactions) ──────────
  const servicosPopulares = useMemo(() => {
    const services = {};
    sheetTxData.forEach((t) => {
      const name = (t.procedure || 'Sem procedimento').trim();
      if (!services[name]) services[name] = { nome: name, qtd: 0, valor: 0 };
      services[name].qtd++;
      services[name].valor += parseFloat(t.gross) || 0;
    });
    return Object.values(services).sort((a, b) => b.valor - a.valor).slice(0, 5);
  }, [sheetTxData]);

  // ─── Payment method breakdown (pie chart) ──────────────────
  const pagamentoData = useMemo(() => {
    if (sheetKpis.totalPix === 0 && sheetKpis.totalCartao === 0 && sheetKpis.totalDinheiro === 0)
      return [];
    return [
      { name: 'Pix', value: sheetKpis.totalPix, color: 'var(--color-primary)' },
      { name: 'Cartão', value: sheetKpis.totalCartao, color: '#4285F4' },
      { name: 'Dinheiro', value: sheetKpis.totalDinheiro, color: '#6B9B7A' },
    ].filter((d) => d.value > 0);
  }, [sheetKpis]);

  // ─── Professional ranking (sheet_transactions + comissoes) ──
  const profRanking = useMemo(() => {
    const profs = {};
    sheetTxData.forEach((t) => {
      const name = (t.professional || 'Sem profissional').trim();
      if (!profs[name]) profs[name] = { nome: name, comissaoTotal: 0, sessoes: 0 };
      profs[name].comissaoTotal += parseFloat(t.commission_value) || 0;
      profs[name].sessoes++;
    });
    comissoes.forEach((c) => {
      const name = c.prof || c.profissional || '';
      if (!name) return;
      if (!profs[name]) profs[name] = { nome: name, comissaoTotal: 0, sessoes: 0 };
      profs[name].comissaoTotal += c.valorComissao || 0;
      profs[name].sessoes++;
    });
    return Object.values(profs)
      .sort((a, b) => b.comissaoTotal - a.comissaoTotal)
      .slice(0, 8);
  }, [sheetTxData, comissoes]);

  // ─── Filtered cashier history by date range ─────────────────
  const filteredCashierHistory = useMemo(() => {
    if (!cashierHistory || cashierHistory.length === 0) return [];
    return cashierHistory.filter((c) => {
      const d = c.date || '';
      return d >= startDateStr && d <= endDateStr;
    });
  }, [cashierHistory, startDateStr, endDateStr]);

  // Synced count from legacy transactions (for badge compat)
  const syncedCount = useMemo(
    () => transactions.filter((t) => t.origem === 'planilha').length,
    [transactions]
  );

  // ─── Period tabs ────────────────────────────────────────────
  const periodTabs = [
    { k: '7d', l: '7 dias' },
    { k: '30d', l: '30 dias' },
    { k: '90d', l: '90 dias' },
    { k: 'ano', l: 'Ano' },
    { k: 'custom', l: 'Personalizado' },
  ];

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div className="page-header-label">
            <BarChart3 />
            RELATÓRIOS
          </div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Análise completa do desempenho da clínica</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <SheetSyncStatus compact />
          <div className="tabs">
            {periodTabs.map(({ k, l }) => (
              <button
                key={k}
                className={`tab-item${periodo === k ? ' active' : ''}`}
                onClick={() => setPeriodo(k)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom date range inputs */}
      {periodo === 'custom' && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <label
            style={{
              fontSize: 13,
              color: 'var(--text-medium)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Calendar style={{ width: 14, height: 14 }} /> De:
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="search-input"
              style={{ width: 'auto', paddingLeft: 10 }}
            />
          </label>
          <label
            style={{
              fontSize: 13,
              color: 'var(--text-medium)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Até:
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="search-input"
              style={{ width: 'auto', paddingLeft: 10 }}
            />
          </label>
        </div>
      )}

      {/* KPI Cards from sheet_transactions */}
      <div className="grid-4 section-gap">
        {sheetKpis.loading ? (
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              color: 'var(--text-muted)',
            }}
          >
            <Loader2
              style={{
                width: 20,
                height: 20,
                marginRight: 8,
                animation: 'spin 1s linear infinite',
              }}
            />
            Carregando dados da planilha...
          </div>
        ) : (
          [
            {
              label: 'Faturamento Total',
              val: formatBRL(sheetKpis.faturamento),
              sub:
                syncedCount > 0
                  ? `${syncedCount} registros da planilha`
                  : `${sheetKpis.totalSessoes} sessões no período`,
              cor: 'var(--success)',
              icon: DollarSign,
              bgIcon: 'var(--success-bg)',
              showSyncBadge: syncedCount > 0,
            },
            {
              label: 'Total de Sessões',
              val: String(sheetKpis.totalSessoes),
              sub: `${sheetKpis.totalSessoes > 0 ? (sheetKpis.totalSessoes / daysCount).toFixed(1) : 0}/dia`,
              cor: 'var(--info)',
              icon: Calendar,
              bgIcon: 'var(--info-bg)',
            },
            {
              label: 'Pacientes Únicos',
              val: String(sheetKpis.novosPacientes),
              sub: `Dinheiro: ${formatBRL(sheetKpis.totalDinheiro)}`,
              cor: 'var(--color-primary)',
              icon: Users,
              bgIcon: 'var(--color-accent-soft)',
            },
            {
              label: 'Ticket Médio',
              val: formatBRL(sheetKpis.ticketMedio),
              sub: `Pix: ${formatBRL(sheetKpis.totalPix)} • Cartão: ${formatBRL(sheetKpis.totalCartao)}`,
              cor: 'var(--warning)',
              icon: TrendingUp,
              bgIcon: 'var(--warning-bg)',
            },
          ].map(({ label, val, sub, cor, icon: Icon, bgIcon, showSyncBadge }) => (
            <div key={label} className="stat-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div className="stat-card-icon" style={{ background: bgIcon, marginBottom: 8 }}>
                  <Icon style={{ color: cor }} />
                </div>
                {showSyncBadge && (
                  <span className="stat-badge up">
                    <FileSpreadsheet style={{ width: 10, height: 10 }} />
                    sync
                  </span>
                )}
              </div>
              <div className="stat-value" style={{ color: cor }}>
                {val}
              </div>
              <div className="stat-label">{label}</div>
              <div className="stat-sub">{sub}</div>
            </div>
          ))
        )}
      </div>

      {/* ─── Cashier History Table ──────────────────────────── */}
      <div className="card section-gap" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-dark)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Wallet style={{ width: 16, height: 16, color: 'var(--color-primary)' }} />
            Histórico de Caixas
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {filteredCashierHistory.length} registro(s) • {formatDateBR(startDateStr)} –{' '}
            {formatDateBR(endDateStr)}
          </span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th style={{ textAlign: 'right' }}>Abertura</th>
                <th style={{ textAlign: 'right' }}>Fechamento</th>
                <th style={{ textAlign: 'right' }}>Entradas (R$)</th>
                <th style={{ textAlign: 'right' }}>Saídas (R$)</th>
                <th style={{ textAlign: 'right' }}>Pix</th>
                <th style={{ textAlign: 'right' }}>Cartão</th>
                <th style={{ textAlign: 'center' }}>Auto</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCashierHistory.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}
                  >
                    Nenhum registro de caixa no período selecionado
                  </td>
                </tr>
              ) : (
                filteredCashierHistory.map((c, i) => {
                  const entradas = numField(c, 'total_cash_in', 'dinheiro_entradas');
                  const saidas = numField(c, 'total_cash_out', 'dinheiro_saidas');
                  const pix = numField(c, 'pix', 'total_pix');
                  const credito = numField(c, 'credito', 'total_credito');
                  const debito = numField(c, 'debito', 'total_debito');
                  const cartao =
                    numField(c, 'cartao', 'card', 'total_cartao') || credito + debito;
                  const hasClosing =
                    c.closing_balance !== null &&
                    c.closing_balance !== undefined &&
                    c.closing_balance !== '';
                  const isAberto = c.status === 'aberto';

                  return (
                    <tr key={c.id || i}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>
                        {formatDateBR(c.date)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {formatBRL(c.opening_balance)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: hasClosing ? 'var(--text-dark)' : 'var(--text-muted)',
                        }}
                      >
                        {hasClosing ? formatBRL(c.closing_balance) : '—'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: 'var(--success)',
                          fontWeight: 600,
                        }}
                      >
                        {formatBRL(entradas)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: 'var(--danger)',
                          fontWeight: 600,
                        }}
                      >
                        {formatBRL(saidas)}
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatBRL(pix)}</td>
                      <td style={{ textAlign: 'right' }}>{formatBRL(cartao)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {c.auto_closed ? (
                          <span className="badge badge-info">
                            <Zap style={{ width: 10, height: 10 }} />
                            Auto
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            —
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`badge ${isAberto ? 'badge-warning' : 'badge-success'}`}
                        >
                          {isAberto ? 'Aberto' : 'Fechado'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Charts row 1 ────────────────────────────────────── */}
      <div className="grid-2-1 section-gap">
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <TrendingUp />
              Faturamento Mensal
            </span>
          </div>
          {faturamentoMensal.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={faturamentoMensal}
                margin={{ top: 5, right: 5, left: -15, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-light)"
                  vertical={false}
                />
                <XAxis
                  dataKey="mes"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickFormatter={(v) => `R$${v / 1000}k`}
                />
                <Tooltip formatter={(v) => [formatBRL(v), 'Faturamento']} />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 220,
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              Sem dados no período
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <DollarSign />
              Métodos de Pagamento
            </span>
          </div>
          {pagamentoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pagamentoData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {pagamentoData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  iconSize={10}
                  iconType="circle"
                  formatter={(v) => (
                    <span style={{ fontSize: 11, color: 'var(--text-medium)' }}>{v}</span>
                  )}
                />
                <Tooltip formatter={(v) => [formatBRL(v), 'Total']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 220,
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              Sem dados no período
            </div>
          )}
        </div>
      </div>

      {/* ─── Professional ranking ───────────────────────────── */}
      {profRanking.length > 0 && (
        <div className="card section-gap">
          <div className="card-header">
            <span className="card-title">
              <Users />
              Ranking de Profissionais
            </span>
          </div>
          <ResponsiveContainer
            width="100%"
            height={Math.max(profRanking.length * 50, 120)}
          >
            <BarChart
              data={profRanking}
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              layout="vertical"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-light)"
                horizontal={false}
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={(v) =>
                  `R$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`
                }
              />
              <YAxis
                type="category"
                dataKey="nome"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-medium)' }}
                width={130}
              />
              <Tooltip formatter={(v) => [formatBRL(v), 'Comissão Total']} />
              <Bar
                dataKey="comissaoTotal"
                fill="var(--color-accent)"
                radius={[0, 4, 4, 0]}
                name="Comissão"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Services chart ─────────────────────────────────── */}
      {servicosPopulares.length > 0 && (
        <div className="card section-gap">
          <div className="card-header">
            <span className="card-title">
              <BarChart3 />
              Serviços Mais Realizados
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={servicosPopulares}
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              layout="vertical"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-light)"
                horizontal={false}
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              />
              <YAxis
                type="category"
                dataKey="nome"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-medium)' }}
                width={140}
              />
              <Tooltip
                formatter={(v, n) =>
                  n === 'qtd' ? [v, 'Sessões'] : [formatBRL(v), 'Faturamento']
                }
              />
              <Bar
                dataKey="qtd"
                fill="var(--color-primary)"
                radius={[0, 4, 4, 0]}
                name="Sessões"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Detail table ───────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>
            Detalhamento por Serviço
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {sheetTxData.length} transação(ões) • {formatDateBR(startDateStr)} –{' '}
            {formatDateBR(endDateStr)}
          </span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Serviço</th>
                <th style={{ textAlign: 'center' }}>Sessões</th>
                <th style={{ textAlign: 'right' }}>Faturamento</th>
                <th style={{ textAlign: 'right' }}>Ticket Médio</th>
                <th>Participação</th>
              </tr>
            </thead>
            <tbody>
              {servicosPopulares.map((s, i) => {
                const totalValor = servicosPopulares.reduce((a, x) => a + x.valor, 0);
                const pct = totalValor > 0 ? Math.round((s.valor / totalValor) * 100) : 0;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{s.nome}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.qtd}</td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: 'var(--success)',
                      }}
                    >
                      {formatBRL(s.valor)}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>
                      {formatBRL(s.valor / s.qtd)}
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: 'var(--border-color)',
                            borderRadius: 99,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: 'var(--color-primary)',
                              borderRadius: 99,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            width: 28,
                            textAlign: 'right',
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {servicosPopulares.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: 'center',
                      padding: 24,
                      color: 'var(--text-muted)',
                    }}
                  >
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
