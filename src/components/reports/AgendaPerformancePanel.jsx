/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react';
import { CalendarCheck, Clock, TrendingUp, UserX, XCircle } from 'lucide-react';
import { calculateAgendaPerformance } from '../../lib/agendaPerformance';

export default function AgendaPerformancePanel({ appointments = [], professionals = [], loading = false }) {
  const [period, setPeriod] = useState('mes');
  const stats = useMemo(
    () => calculateAgendaPerformance(appointments, professionals, period),
    [appointments, professionals, period],
  );

  return (
    <section className="card section-gap" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 800, color: 'var(--text-dark)' }}>
            <TrendingUp style={{ width: 16, height: 16, color: '#C73B6D' }} />
            Desempenho da Agenda
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            Indicadores calculados automaticamente a partir dos agendamentos · {stats.periodLabel}
          </div>
        </div>

        <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 8, padding: 2, gap: 2 }}>
          {[
            { key: 'dia', label: 'Dia' },
            { key: 'semana', label: 'Semana' },
            { key: 'mes', label: 'Mês' },
          ].map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPeriod(item.key)}
              style={{
                border: 'none',
                background: period === item.key ? '#fff' : 'transparent',
                color: period === item.key ? '#1F2937' : '#6B7280',
                fontWeight: period === item.key ? 700 : 500,
                fontSize: 11,
                padding: '4px 13px',
                borderRadius: 6,
                cursor: 'pointer',
                boxShadow: period === item.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          Carregando desempenho da agenda...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
          <MetricCard
            title="Taxa de Ocupação"
            icon={CalendarCheck}
            value={`${stats.occupancyRate}%`}
            detail={`${stats.occupied}/${stats.totalSlots} horários`}
            note="horários preenchidos no período"
            colors={{ bg: '#F0FDF4', border: '#DCFCE7', text: '#166534', value: '#15803D', icon: '#16A34A' }}
            progress={stats.occupancyRate}
          />
          <MetricCard
            title="No-show Rate (Faltas)"
            icon={UserX}
            value={`${stats.noShowRate}%`}
            detail={`${stats.absences} de ${stats.totalAppointments} agendados`}
            note={stats.absences ? `${stats.absences} cliente(s) não compareceram` : '✓ Nenhuma falta registrada'}
            colors={{ bg: '#FEF2F2', border: '#FEE2E2', text: '#991B1B', value: '#B91C1C', icon: '#DC2626' }}
          />
          <MetricCard
            title="Taxa de Cancelamento"
            icon={XCircle}
            value={`${stats.cancellationRate}%`}
            detail={`${stats.cancellations} cancelamento(s)`}
            note={stats.cancellations ? `${stats.cancellations} cancelamento(s) no período` : '✓ Sem cancelamentos no período'}
            colors={{ bg: '#FFFBEB', border: '#FEF3C7', text: '#92400E', value: '#B45309', icon: '#D97706' }}
          />
          <MetricCard
            title="Tempo Médio Atendimento"
            icon={Clock}
            value={stats.averageLabel}
            detail=""
            note="duração média dos procedimentos"
            colors={{ bg: '#EFF6FF', border: '#DBEAFE', text: '#1E40AF', value: '#1D4ED8', icon: '#2563EB' }}
          />
        </div>
      )}
    </section>
  );
}

function MetricCard({ title, icon: Icon, value, detail, note, colors, progress }) {
  return (
    <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '11px 14px', minHeight: 92 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: colors.text }}>{title}</span>
        <Icon style={{ width: 14, height: 14, color: colors.icon }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 21, fontWeight: 800, color: colors.value }}>{value}</span>
        {detail && <span style={{ fontSize: 10, color: colors.text }}>({detail})</span>}
      </div>
      {Number.isFinite(progress) && (
        <div style={{ width: '100%', height: 4, background: colors.border, borderRadius: 99, marginTop: 6, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: colors.icon, borderRadius: 99 }} />
        </div>
      )}
      <div style={{ fontSize: 10, color: colors.text, marginTop: 5, fontWeight: 500 }}>{note}</div>
    </div>
  );
}
