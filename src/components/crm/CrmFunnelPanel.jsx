/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CalendarDays, CheckCircle2,
  Clock3, RotateCcw, Send, ShieldCheck, TrendingUp,
} from 'lucide-react';
import { buildCrmFunnelAnalytics } from '../../lib/crmFunnelAnalytics';

const PERIODS = [
  { key: 30, label: '30 dias' },
  { key: 90, label: '90 dias' },
  { key: 'all', label: 'Todo período' },
];

function fmtPct(value) {
  return value === null || value === undefined ? '—' : `${value.toFixed(1)}%`;
}

function fmtMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

function fmtDuration(hours) {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}min`;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  return `${(hours / 24).toFixed(1)} dias`;
}

function FunnelStep({ label, value, rate, color, detail, last }) {
  return (
    <div style={{ display: 'contents' }}>
      <div style={{
        padding: '13px 14px', border: `1px solid ${color}32`, borderRadius: 11,
        background: `${color}0D`, minWidth: 0,
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 25, fontWeight: 850, color: 'var(--text-dark)', marginTop: 4 }}>{value}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{detail}</div>
        {rate !== null && rate !== undefined && (
          <div style={{ fontSize: 11, color, fontWeight: 800, marginTop: 7 }}>{fmtPct(rate)} da etapa anterior</div>
        )}
      </div>
      {!last && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowRight style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, color }) {
  return (
    <div style={{ padding: '12px 14px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color }}>
        <Icon style={{ width: 14, height: 14 }} />
        <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.35 }}>{label}</span>
      </div>
      <div style={{ fontSize: 19, fontWeight: 850, color: 'var(--text-dark)', marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{detail}</div>
    </div>
  );
}

function ConversionTable({ rows, firstColumn }) {
  if (!rows.length) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ainda não há dados suficientes.</div>;
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>{firstColumn}</th>
            <th>Interessados</th>
            <th>Agendaram</th>
            <th>Atendidos</th>
            <th>Conversão final</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map(row => (
            <tr key={row.label}>
              <td style={{ fontSize: 12, fontWeight: 700 }}>{row.label}</td>
              <td>{row.leads}</td>
              <td>{row.booked}</td>
              <td>{row.attended}</td>
              <td style={{ fontWeight: 800, color: row.finalRate >= 30 ? '#059669' : 'var(--text-dark)' }}>{fmtPct(row.finalRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CrmFunnelPanel({ leads, clients, appointments, automationEvents }) {
  const [periodDays, setPeriodDays] = useState(90);
  const analytics = useMemo(() => buildCrmFunnelAnalytics({
    leads,
    clients,
    appointments,
    automationEvents,
    periodDays,
  }), [leads, clients, appointments, automationEvents, periodDays]);

  const { stages, timing, recovery, forecast, quality, motor } = analytics;

  return (
    <section className="card section-gap" style={{ padding: 0, overflow: 'hidden' }} aria-label="Diagnóstico do funil comercial">
      <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 850, color: 'var(--text-dark)' }}>
            <Activity style={{ width: 16, height: 16, color: '#7C3AED' }} /> Diagnóstico do funil
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
            Conversões calculadas pela data de entrada do interessado e pelos acontecimentos reais da Agenda.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--bg-main)', borderRadius: 8 }}>
          {PERIODS.map(period => (
            <button
              type="button"
              key={period.key}
              onClick={() => setPeriodDays(period.key)}
              style={{
                border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 10, fontWeight: 750,
                background: periodDays === period.key ? '#fff' : 'transparent',
                color: periodDays === period.key ? 'var(--text-dark)' : 'var(--text-muted)',
                boxShadow: periodDays === period.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 28px minmax(0, 1fr) 28px minmax(0, 1fr) 28px minmax(0, 1fr)', gap: 5, alignItems: 'stretch' }}>
          <FunnelStep label="Interessados" value={stages.leads} color="#7C3AED" detail="entraram no período" />
          <FunnelStep label="Agendaram" value={stages.booked} rate={stages.leadToBookingRate} color="#2563EB" detail="tiveram horário registrado" />
          <FunnelStep label="Atendidos" value={stages.attended} rate={stages.bookingToAttendanceRate} color="#059669" detail="atendimento finalizado" />
          <FunnelStep label="Retornaram" value={stages.returned} rate={stages.attendanceToReturnRate} color="#047857" detail="2 ou mais atendimentos" last />
        </div>

        {stages.leads === 0 && (
          <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 8, background: '#FFFBEB', color: '#92400E', fontSize: 11 }}>
            Não entraram interessados neste período. Escolha um intervalo maior para analisar o histórico.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 9, marginTop: 14 }}>
          <MetricCard icon={Clock3} label="Velocidade para agendar" value={fmtDuration(timing.medianLeadToBookingHours)} detail="tempo mediano entre entrada e criação do primeiro agendamento" color="#2563EB" />
          <MetricCard icon={TrendingUp} label="Conversão final" value={fmtPct(stages.finalConversionRate)} detail="interessados do período que chegaram a atendimento finalizado" color="#059669" />
          <MetricCard icon={RotateCcw} label="Recuperação" value={fmtPct(recovery.rate)} detail={`${recovery.recovered} de ${recovery.failures} faltas ou cancelamentos tiveram novo horário`} color="#D97706" />
          <MetricCard icon={CalendarDays} label="Agenda futura do CRM" value={fmtMoney(forecast.value)} detail={`${forecast.appointments} horário(s) futuro(s) com valor informado`} color="#7C3AED" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12, marginTop: 14 }}>
          <div style={{ border: '1px solid var(--border-light)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-dark)', marginBottom: 9 }}>Onde as oportunidades estão sendo perdidas</div>
            {analytics.losses.length === 0 ? (
              <div style={{ fontSize: 11, color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 style={{ width: 14, height: 14 }} /> Nenhuma perda automática identificada no período.
              </div>
            ) : analytics.losses.slice(0, 5).map(item => (
              <div key={item.reason} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: 11 }}>
                <span style={{ color: 'var(--text-medium)' }}>{item.reason}</span>
                <strong style={{ color: '#C2410C' }}>{item.count}</strong>
              </div>
            ))}
          </div>

          <div style={{ border: '1px solid var(--border-light)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-dark)', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Send style={{ width: 13, height: 13, color: '#2563EB' }} /> Motor no período
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
              {[
                ['Enviadas', motor.sent, '#059669'],
                ['Programadas', motor.approved, '#2563EB'],
                ['Para revisar', motor.pending, '#D97706'],
                ['Falharam', motor.failed, '#DC2626'],
                ['Expiraram', motor.expired, '#6B7280'],
                ['Canceladas', motor.cancelled, '#6B7280'],
              ].map(([label, value, color]) => (
                <div key={label} style={{ padding: '7px 8px', borderRadius: 7, background: `${color}0D` }}>
                  <div style={{ fontSize: 16, fontWeight: 850, color }}>{value}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 8 }}>Somente leitura: nenhuma regra do Motor é alterada por este painel.</div>
          </div>
        </div>

        <details style={{ marginTop: 14, borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 800, color: 'var(--text-dark)' }}>Conversão por origem e responsável</summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginTop: 12 }}>
            <div><div style={{ fontSize: 11, fontWeight: 750, marginBottom: 7 }}>Origem</div><ConversionTable rows={analytics.byOrigin} firstColumn="Origem" /></div>
            <div><div style={{ fontSize: 11, fontWeight: 750, marginBottom: 7 }}>Responsável</div><ConversionTable rows={analytics.byResponsible} firstColumn="Responsável" /></div>
          </div>
        </details>

        <details style={{ marginTop: 10, borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 800, color: 'var(--text-dark)' }}>Procedimentos que realmente geraram atendimento</summary>
          <div className="table-wrapper" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>Procedimento</th><th>Atendimentos finalizados</th><th>Valor pela Agenda</th></tr></thead>
              <tbody>
                {analytics.procedures.slice(0, 10).map(item => (
                  <tr key={item.procedure}><td style={{ fontWeight: 700 }}>{item.procedure}</td><td>{item.attendances}</td><td>{fmtMoney(item.revenue)}</td></tr>
                ))}
                {!analytics.procedures.length && <tr><td colSpan="3" style={{ color: 'var(--text-muted)' }}>Nenhum atendimento finalizado no período.</td></tr>}
              </tbody>
            </table>
          </div>
        </details>

        <details style={{ marginTop: 10, borderTop: '1px solid var(--border-light)', paddingTop: 10 }} open={quality.categoriesWithIssues > 0}>
          <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 800, color: quality.categoriesWithIssues ? '#C2410C' : '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
            {quality.categoriesWithIssues ? <AlertTriangle style={{ width: 14, height: 14 }} /> : <ShieldCheck style={{ width: 14, height: 14 }} />}
            Qualidade dos dados · {quality.categoriesWithIssues ? `${quality.categoriesWithIssues} tipo(s) de pendência` : 'sem pendências'}
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, marginTop: 10 }}>
            {quality.items.map(item => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 8, background: item.count ? '#FFF7ED' : '#ECFDF5', fontSize: 11 }}>
                <span style={{ color: 'var(--text-medium)' }}>{item.label}</span>
                <strong style={{ color: item.count ? '#C2410C' : '#059669' }}>{item.count}</strong>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}

