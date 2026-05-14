import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, Calendar, Users, AlertTriangle,
  TrendingUp, Package, ChevronRight, Clock, Star
} from 'lucide-react';

// ─── Mock Data ───────────────────────────────────────────────
const revenueData = [
  { dia: 'Seg', valor: 280 },
  { dia: 'Ter', valor: 420 },
  { dia: 'Qua', valor: 380 },
  { dia: 'Qui', valor: 510 },
  { dia: 'Sex', valor: 760 },
  { dia: 'Sáb', valor: 920 },
  { dia: 'Dom', valor: 1176 },
];

const stockAlerts = [
  { nome: '5', lote: '5', estoque: 0, minimo: 55 },
  { nome: 'Botox Allergan 100U', lote: 'Allergan', estoque: 5, minimo: 5 },
  { nome: 'Juvederm Ultra', lote: 'AbbVie', estoque: 2, minimo: 10 },
];

const todayAppointments = [
  { hora: '09:00', paciente: 'Fernanda Lima', servico: 'Botox Facial', status: 'confirmado' },
  { hora: '10:30', paciente: 'Carla Mendes', servico: 'Preenchimento Labial', status: 'aguardando' },
  { hora: '14:00', paciente: 'Ana Beatriz', servico: 'Harmonização Facial', status: 'confirmado' },
];

const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const today = new Date();
const dayOfMonth = today.getDate();

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
  const diaSemana = today.toLocaleDateString('pt-BR', { weekday: 'long' });
  const dataBr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-label">
          <Star />
          DASHBOARD
        </div>
        <h1 className="page-title">
          Bom {diaSemana.split('-')[0].trim().includes('seg') || diaSemana.startsWith('ter') || diaSemana.startsWith('qua') || diaSemana.startsWith('qui') || diaSemana.startsWith('sex') ? 'dia' : 'dia'}, Evelyn
        </h1>
        <p className="page-subtitle">{dataBr}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid-4 section-gap">
        <StatCard
          icon={DollarSign}
          iconBg="#EFF7F2"
          iconColor="var(--success)"
          badge="12%"
          badgeClass="up"
          value="R$ 1.176,00"
          label="Faturamento do Mês"
          sub="vs. mês anterior"
        />
        <StatCard
          icon={Calendar}
          iconBg="var(--info-bg)"
          iconColor="var(--info)"
          badge="5%"
          badgeClass="up"
          value="0"
          label="Agendamentos Hoje"
          sub="0 finalizados"
        />
        <StatCard
          icon={Users}
          iconBg="var(--info-bg)"
          iconColor="var(--info)"
          badge="8%"
          badgeClass="up"
          value="6"
          label="Clientes Ativos"
          sub="novos este mês"
        />
        <StatCard
          icon={AlertTriangle}
          iconBg="var(--danger-bg)"
          iconColor="var(--danger)"
          value="2"
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
