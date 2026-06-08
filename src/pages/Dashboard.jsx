import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, Calendar, Users, AlertTriangle,
  TrendingUp, Package, ChevronRight, Clock, Star
} from 'lucide-react';
import { useSync } from '../contexts/SyncContext';
import SheetSyncStatus from '../components/integration/SheetSyncStatus';

// ─── Sub-components ───────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, iconColor, badge, badgeClass, value, label, sub }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div className="stat-card-icon" style={{ background: iconBg }}>
          <Icon style={{ color: iconColor }} />
        </div>
        {badge && (
          <span className={`stat-badge ${badgeClass}`}>
            <TrendingUp style={{ width: 10, height: 10 }} />
            {badge}
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: '8px 14px',
        boxShadow: 'var(--shadow-md)',
        fontSize: 12,
      }}>
        <p style={{ margin: 0, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-dark)' }}>
          R$ {payload[0].value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

// ─── Dashboard ────────────────────────────────────────────────
export default function Dashboard() {
  const { transactions, dailySheet } = useSync();

  const today = new Date();
  const diaSemana = today.toLocaleDateString('pt-BR', { weekday: 'long' });
  const dataBr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Compute real stats from transactions
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const monthTransactions = transactions.filter(t => {
    const parts = t.data.split('/');
    if (parts.length !== 3) return true;
    const txMonth = parseInt(parts[1], 10) - 1;
    const txYear = parseInt(parts[2], 10);
    return txMonth === currentMonth && txYear === currentYear;
  });

  const faturamentoMes = monthTransactions
    .filter(t => t.tipo === 'receita')
    .reduce((sum, t) => sum + t.valor, 0);

  const receitasHoje = transactions.filter(t => {
    const todayStr = today.toLocaleDateString('pt-BR');
    return t.tipo === 'receita' && t.data === todayStr;
  });
  // Use dailySheet faturamento when available, fallback to transactions
  const faturamentoHoje = dailySheet ? dailySheet.faturamentoBruto : receitasHoje.reduce((sum, t) => sum + t.valor, 0);

  // Unique active patients count
  const activePatients = new Set(
    transactions
      .filter(t => t.tipo === 'receita')
      .map(t => {
        const match = t.desc.match(/-\s*(.+)/);
        return match ? match[1].trim() : null;
      })
      .filter(Boolean)
  ).size;

  // Revenue data for last 7 days
  const revenueData = (() => {
    const days = [];
    const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-BR');
      const dayTotal = transactions
        .filter(t => t.tipo === 'receita' && t.data === dateStr)
        .reduce((sum, t) => sum + t.valor, 0);
      days.push({
        dia: dayLabels[d.getDay()],
        valor: dayTotal,
      });
    }
    return days;
  })();

  // Stock alerts (placeholder - from Inventory page)
  const stockAlerts = [
    { nome: 'Botox Allergan 100U', lote: 'Allergan', estoque: 5, minimo: 5 },
    { nome: 'Juvederm Ultra', lote: 'AbbVie', estoque: 2, minimo: 10 },
  ];

  // Today appointments (placeholder)
  const todayAppointments = [
    { hora: '09:00', paciente: 'Fernanda Lima', servico: 'Botox Facial', status: 'confirmado' },
    { hora: '10:30', paciente: 'Carla Mendes', servico: 'Preenchimento Labial', status: 'aguardando' },
    { hora: '14:00', paciente: 'Ana Beatriz', servico: 'Harmonização Facial', status: 'confirmado' },
  ];

  // Sync stats
  const syncedTxCount = transactions.filter(t => t.origem === 'planilha').length;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="page-header-label">
              <Star />
              DASHBOARD
            </div>
            <h1 className="page-title">
              Bom {diaSemana.split('-')[0].trim().includes('seg') || diaSemana.startsWith('ter') || diaSemana.startsWith('qua') || diaSemana.startsWith('qui') || diaSemana.startsWith('sex') ? 'dia' : 'dia'}, Evelyn
            </h1>
            <p className="page-subtitle">{dataBr}</p>
          </div>
          <SheetSyncStatus compact />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid-4 section-gap">
        <StatCard
          icon={DollarSign}
          iconBg="#EFF7F2"
          iconColor="var(--success)"
          badge={syncedTxCount > 0 ? `${syncedTxCount} sync` : null}
          badgeClass="up"
          value={`R$ ${faturamentoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          label="Faturamento do Mês"
          sub={syncedTxCount > 0 ? `${syncedTxCount} transações da planilha` : 'vs. mês anterior'}
        />
        <StatCard
          icon={Calendar}
          iconBg="var(--info-bg)"
          iconColor="var(--info)"
          badge="hoje"
          badgeClass="neutral"
          value={`R$ ${faturamentoHoje.toLocaleString('pt-BR')}`}
          label="Faturamento Hoje"
          sub={`${receitasHoje.length} receitas`}
        />
        <StatCard
          icon={Users}
          iconBg="var(--info-bg)"
          iconColor="var(--info)"
          value={String(activePatients)}
          label="Clientes Ativos"
          sub="com transações no período"
        />
        <StatCard
          icon={AlertTriangle}
          iconBg="var(--danger-bg)"
          iconColor="var(--danger)"
          value={String(stockAlerts.length)}
          label="Estoque Crítico"
          sub="produtos abaixo do mínimo"
        />
      </div>

      {/* Revenue Chart + Stock Alerts */}
      <div className="grid-2-1 section-gap">
        {/* Revenue Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <TrendingUp />
              Faturamento - Últimos 7 dias
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis
                dataKey="dia"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ fill: 'var(--color-primary)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stock Alerts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Package />
              Alertas de Estoque
            </span>
          </div>
          <div>
            {stockAlerts.map((item, i) => (
              <div key={i} className="alert-item">
                <div>
                  <div className="alert-item-label">{item.nome}</div>
                  <div className="alert-item-sub">{item.lote}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={`alert-item-qty ${item.estoque === 0 ? 'zero' : 'low'}`}>
                    {item.estoque}
                  </div>
                  <div className="alert-item-sub">min: {item.minimo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today Appointments */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Clock />
            Agendamentos de Hoje
          </span>
          <a href="/agenda" style={{ fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2, fontWeight: 600 }}>
            Ver todos <ChevronRight style={{ width: 13, height: 13 }} />
          </a>
        </div>

        {todayAppointments.length === 0 ? (
          <div className="empty-state">
            <Calendar />
            <p>Nenhum agendamento para hoje</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Paciente</th>
                  <th>Serviço</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {todayAppointments.map((apt, i) => (
                  <tr key={i}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{apt.hora}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar">
                          {apt.paciente.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 500 }}>{apt.paciente}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-light)' }}>{apt.servico}</td>
                    <td>
                      <span className={`badge ${apt.status === 'confirmado' ? 'badge-success' : 'badge-warning'}`}>
                        {apt.status === 'confirmado' ? 'Confirmado' : 'Aguardando'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
