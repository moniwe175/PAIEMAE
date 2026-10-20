/* eslint-disable react/prop-types */
import { useMemo } from 'react';
import {
  AlertTriangle,
  Award,
  CalendarCheck,
  CircleDollarSign,
  ClipboardCheck,
  RefreshCw,
  Stethoscope,
  Users,
} from 'lucide-react';
import { calculateClinicManagement, calculateCommercialHighlights } from '../../lib/clinicManagement';

const formatBRL = value => `R$ ${(Number(value) || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

function formatDate(date) {
  if (!date) return '—';
  const [year, month, day] = String(date).split('-');
  return `${day}/${month}/${year}`;
}

export default function ClinicManagementPanel({
  appointments = [],
  transactions = [],
  previousRevenue = 0,
  startDate,
  endDate,
  daysCount = 1,
  loading = false,
}) {
  const agenda = useMemo(
    () => calculateClinicManagement(appointments, startDate, endDate),
    [appointments, startDate, endDate],
  );
  const commercial = useMemo(
    () => calculateCommercialHighlights(transactions, previousRevenue, daysCount),
    [transactions, previousRevenue, daysCount],
  );

  const growth = commercial.growthRate;
  const growthText = growth == null
    ? 'sem base anterior para comparação'
    : `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% vs. período anterior`;

  return (
    <section className="card section-gap" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--text-dark)' }}>
            <ClipboardCheck style={{ width: 17, height: 17, color: 'var(--color-primary)' }} />
            Resumo gerencial da clínica
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Vendas e atendimentos reais no período selecionado · {formatDate(startDate)} a {formatDate(endDate)}
          </div>
        </div>
        <span style={{ alignSelf: 'flex-start', padding: '5px 9px', borderRadius: 8, background: '#F3F4F6', color: '#4B5563', fontSize: 10, fontWeight: 700 }}>
          Sem estimar horários ou duração
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          Carregando resumo gerencial...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 10 }}>
            <ManagerCard
              icon={CircleDollarSign}
              label="Faturamento"
              value={formatBRL(commercial.revenue)}
              detail={`${growthText} · média ${formatBRL(commercial.dailyAverage)}/dia`}
              tone="#15803D"
              background="#F0FDF4"
            />
            <ManagerCard
              icon={Users}
              label="Clientes atendidos"
              value={agenda.uniquePatients}
              detail={`${agenda.completed} atendimento(s) concluído(s)`}
              tone="#0369A1"
              background="#F0F9FF"
            />
            <ManagerCard
              icon={Stethoscope}
              label="Ticket médio por venda"
              value={formatBRL(commercial.averageTicket)}
              detail={`${commercial.sessions} venda(s) · ${commercial.uniquePayingClients} cliente(s) · ${formatBRL(commercial.ticketPerClient)} por cliente`}
              tone="#7C3AED"
              background="#F5F3FF"
            />
            <ManagerCard
              icon={CalendarCheck}
              label="Comparecimento"
              value={`${agenda.attendanceRate}%`}
              detail={`${agenda.completed} concluído(s) · ${agenda.absences} falta(s)`}
              tone="#0F766E"
              background="#F0FDFA"
            />
            <ManagerCard
              icon={RefreshCw}
              label="Clientes que retornaram"
              value={`${agenda.returnRate}%`}
              detail={`${agenda.returningPatients} recorrente(s) · ${agenda.firstVisitPatients} primeira visita`}
              tone="#B45309"
              background="#FFFBEB"
            />
            <ManagerCard
              icon={AlertTriangle}
              label="Precisam de reagendamento"
              value={agenda.losses}
              detail={`${agenda.absences} falta(s) · ${agenda.cancellations} cancelamento(s) · ${agenda.lossRate}% da agenda`}
              tone="#B91C1C"
              background="#FEF2F2"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))', gap: 10, marginTop: 10 }}>
            <InsightCard icon={Award} title="O que mais vendeu">
              {commercial.topService ? (
                <>
                  <strong>{commercial.topService.name}</strong>
                  <span>{formatBRL(commercial.topService.revenue)} · {commercial.topService.count} venda(s)</span>
                </>
              ) : <span>Sem vendas registradas no período.</span>}
              {agenda.topProcedure && (
                <span>Mais realizado na Agenda: <strong>{agenda.topProcedure.name}</strong> ({agenda.topProcedure.count})</span>
              )}
            </InsightCard>

            <InsightCard icon={Stethoscope} title="Equipe e próximos 7 dias">
              {agenda.topProfessional ? (
                <span>Mais atendimentos: <strong>{agenda.topProfessional.name}</strong> ({agenda.topProfessional.count})</span>
              ) : <span>Sem atendimentos finalizados por profissional.</span>}
              <span><strong>{agenda.upcomingSevenDays}</strong> agendamento(s) nos próximos 7 dias</span>
              <span><strong>{agenda.awaitingConfirmation}</strong> aguardando confirmação</span>
            </InsightCard>

            <InsightCard icon={ClipboardCheck} title="Conferência dos dados" warning={agenda.pendingPast > 0 || commercial.sessions !== agenda.completed}>
              <span>Vendas registradas: <strong>{commercial.sessions}</strong> · Agenda finalizada: <strong>{agenda.completed}</strong></span>
              {commercial.sessions !== agenda.completed && (
                <span>Os totais são diferentes; confira vendas e status da Agenda.</span>
              )}
              <span><strong>{agenda.pendingPast}</strong> agendamento(s) passado(s) ainda sem desfecho</span>
            </InsightCard>
          </div>
        </>
      )}
    </section>
  );
}

function ManagerCard({ icon: Icon, label, value, detail, tone, background }) {
  return (
    <div style={{ padding: '13px 14px', borderRadius: 12, border: `1px solid ${tone}20`, background }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: tone, fontSize: 11, fontWeight: 700 }}>
        <Icon style={{ width: 14, height: 14 }} /> {label}
      </div>
      <div style={{ color: tone, fontSize: 22, lineHeight: 1.15, fontWeight: 800, marginTop: 7 }}>{value}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 5, lineHeight: 1.35 }}>{detail}</div>
    </div>
  );
}

function InsightCard({ icon: Icon, title, children, warning = false }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${warning ? '#FDE68A' : 'var(--border-light)'}`, background: warning ? '#FFFBEB' : '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 800, color: warning ? '#92400E' : 'var(--text-dark)', marginBottom: 8 }}>
        <Icon style={{ width: 14, height: 14 }} /> {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, color: 'var(--text-medium)', fontSize: 11, lineHeight: 1.35 }}>
        {children}
      </div>
    </div>
  );
}
