import { getCrmAppointmentValue, getSaoPauloDate, normalizeCrmPhone } from './crmJourney.js';

const COMPLETED = new Set(['finalizado', 'concluido', 'concluído', 'atendido']);
const NO_SHOW = new Set(['falta', 'cliente_faltou', 'nao_compareceu', 'não_compareceu', 'no_show']);
const CANCELLED = new Set(['cancelado', 'cancelada', 'desmarcado', 'desmarcada']);
const BLOCKED = new Set(['bloqueado', 'bloqueada']);

function clean(value) {
  return String(value || '').trim().toLowerCase();
}

function isoDate(value) {
  const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function startDateForPeriod(today, days) {
  if (!days || days === 'all') return null;
  const parsed = new Date(`${today}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - (Number(days) - 1));
  return parsed.toISOString().slice(0, 10);
}

function inPeriod(value, start, end) {
  const date = isoDate(value);
  return Boolean(date && date <= end && (!start || date >= start));
}

function appointmentMoment(appointment) {
  const date = isoDate(appointment?.appointment_date);
  if (!date) return null;
  return `${date}T${String(appointment?.appointment_time || '12:00').slice(0, 5)}:00`;
}

function appointmentKey(appointment) {
  return String(appointment?.id || `${appointmentMoment(appointment)}-${appointment?.client_id || ''}-${appointment?.procedure || ''}`);
}

function clientKey(row) {
  if (row?.client_id !== null && row?.client_id !== undefined) return `client:${row.client_id}`;
  const phone = normalizeCrmPhone(row?.client_phone || row?.telefone || row?.phone);
  return phone.length >= 10 ? `phone:${phone}` : null;
}

function rate(part, total) {
  return total > 0 ? (part / total) * 100 : null;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function hoursBetween(from, to) {
  const start = Date.parse(from || '');
  const end = Date.parse(to || '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 3600000;
}

function isCompleted(appointment) {
  return COMPLETED.has(clean(appointment?.status));
}

function isFailure(appointment) {
  const status = clean(appointment?.status);
  return NO_SHOW.has(status) || CANCELLED.has(status);
}

function isValidFuture(appointment, today) {
  const date = isoDate(appointment?.appointment_date);
  const status = clean(appointment?.status);
  return Boolean(date && date >= today
    && !COMPLETED.has(status) && !NO_SHOW.has(status) && !CANCELLED.has(status) && !BLOCKED.has(status));
}

function afterLead(appointment, lead) {
  const appointmentDate = isoDate(appointment?.appointment_date);
  const leadDate = isoDate(lead?.created_at);
  return Boolean(appointmentDate && (!leadDate || appointmentDate >= leadDate));
}

function firstAppointmentTimestamp(appointment) {
  return appointment?.created_at || appointmentMoment(appointment);
}

function latestAppointment(appointments = []) {
  return [...appointments].sort((left, right) => (
    String(appointmentMoment(right) || '').localeCompare(String(appointmentMoment(left) || ''))
  ))[0] || null;
}

function automaticLossReason(lead) {
  const appointments = lead?._journey?.appointments || [];
  const last = latestAppointment(appointments);
  const status = clean(last?.status);
  const hasContact = Boolean(normalizeCrmPhone(lead?.telefone).length >= 10 || lead?.instagram || lead?.email);

  if (!hasContact) return 'Sem contato válido';
  if (NO_SHOW.has(status) && !lead?._journey?.nextAppointment) return 'Faltou e não reagendou';
  if (CANCELLED.has(status) && !lead?._journey?.nextAppointment) return 'Cancelou e não reagendou';
  if (!lead?._journey?.isPayingClient && lead?._journey?.key === 'inativa') return 'Não agendou em 30 dias';
  if (lead?.status === 'encerrado_perdido') return lead?.motivo_perda && lead.motivo_perda !== 'automatico'
    ? lead.motivo_perda
    : 'Perda automática sem detalhe';
  return null;
}

function summarizeGroup(rows) {
  const leads = rows.length;
  const booked = rows.filter(row => row.booked).length;
  const attended = rows.filter(row => row.attended).length;
  return {
    leads,
    booked,
    attended,
    bookingRate: rate(booked, leads),
    attendanceRate: rate(attended, booked),
    finalRate: rate(attended, leads),
  };
}

export function buildCrmFunnelAnalytics({
  leads = [],
  clients = [],
  appointments = [],
  automationEvents = [],
  periodDays = 90,
  referenceDate = new Date(),
} = {}) {
  const today = getSaoPauloDate(referenceDate);
  const startDate = startDateForPeriod(today, periodDays);
  const activeLeads = leads.filter(lead => !lead?.arquivado);
  const cohort = activeLeads.filter(lead => inPeriod(lead?.created_at, startDate, today));

  const leadRows = cohort.map(lead => {
    const related = (lead?._journey?.appointments || []).filter(appointment => afterLead(appointment, lead));
    const bookedAppointments = related.filter(appointment => !BLOCKED.has(clean(appointment?.status)));
    const completedAppointments = related.filter(isCompleted);
    const firstBooked = [...bookedAppointments].sort((left, right) => (
      String(firstAppointmentTimestamp(left) || '').localeCompare(String(firstAppointmentTimestamp(right) || ''))
    ))[0] || null;
    const firstCompleted = [...completedAppointments].sort((left, right) => (
      String(appointmentMoment(left) || '').localeCompare(String(appointmentMoment(right) || ''))
    ))[0] || null;

    return {
      lead,
      related,
      booked: bookedAppointments.length > 0,
      attended: completedAppointments.length > 0,
      returned: completedAppointments.length >= 2,
      leadToBookingHours: firstBooked ? hoursBetween(lead.created_at, firstAppointmentTimestamp(firstBooked)) : null,
      leadToAttendanceHours: firstCompleted ? hoursBetween(lead.created_at, appointmentMoment(firstCompleted)) : null,
    };
  });

  const stages = {
    leads: cohort.length,
    booked: leadRows.filter(row => row.booked).length,
    attended: leadRows.filter(row => row.attended).length,
    returned: leadRows.filter(row => row.returned).length,
  };

  const uniqueRelatedAppointments = new Map();
  activeLeads.forEach(lead => (lead?._journey?.appointments || []).forEach(appointment => {
    uniqueRelatedAppointments.set(appointmentKey(appointment), appointment);
  }));

  const uniqueAllAppointments = new Map();
  appointments.forEach(appointment => uniqueAllAppointments.set(appointmentKey(appointment), appointment));
  const allAppointments = [...uniqueAllAppointments.values()];

  const failures = allAppointments.filter(appointment => isFailure(appointment) && inPeriod(appointment?.appointment_date, startDate, today));
  const appointmentsByClient = new Map();
  allAppointments.forEach(appointment => {
    const key = clientKey(appointment);
    if (!key) return;
    const rows = appointmentsByClient.get(key) || [];
    rows.push(appointment);
    appointmentsByClient.set(key, rows);
  });
  const recoveredFailures = failures.filter(failure => {
    const key = clientKey(failure);
    const failureMoment = appointmentMoment(failure);
    return Boolean(key && (appointmentsByClient.get(key) || []).some(candidate => (
      appointmentMoment(candidate) > failureMoment
      && (isCompleted(candidate) || isValidFuture(candidate, today))
    )));
  });

  const futureAppointments = [...uniqueRelatedAppointments.values()].filter(appointment => isValidFuture(appointment, today));
  const periodCompleted = [...uniqueRelatedAppointments.values()].filter(appointment => (
    isCompleted(appointment) && inPeriod(appointment?.appointment_date, startDate, today)
  ));

  const lossMap = new Map();
  cohort.forEach(lead => {
    const reason = automaticLossReason(lead);
    if (reason) lossMap.set(reason, (lossMap.get(reason) || 0) + 1);
  });

  const groupRows = (selector) => {
    const groups = new Map();
    leadRows.forEach(row => {
      const key = selector(row.lead) || 'Não informado';
      const current = groups.get(key) || [];
      current.push(row);
      groups.set(key, current);
    });
    return [...groups.entries()]
      .map(([label, rows]) => ({ label, ...summarizeGroup(rows) }))
      .sort((left, right) => right.leads - left.leads || right.attended - left.attended);
  };

  const procedureMap = new Map();
  periodCompleted.forEach(appointment => {
    const name = appointment?.procedure || 'Não informado';
    const current = procedureMap.get(name) || { procedure: name, attendances: 0, revenue: 0 };
    current.attendances += 1;
    current.revenue += getCrmAppointmentValue(appointment);
    procedureMap.set(name, current);
  });

  const countDuplicatePhones = rows => {
    const counts = new Map();
    rows.forEach(row => {
      const phone = normalizeCrmPhone(row?.telefone || row?.phone);
      if (phone.length >= 10) counts.set(phone, (counts.get(phone) || 0) + 1);
    });
    return [...counts.values()].filter(count => count > 1).reduce((sum, count) => sum + count, 0);
  };

  const motorEvents = automationEvents.filter(event => inPeriod(event?.created_at, startDate, today));
  const motorCount = status => motorEvents.filter(event => event?.status === status).length;
  const completedWithoutValue = allAppointments.filter(appointment => (
    isCompleted(appointment) && getCrmAppointmentValue(appointment) <= 0
  )).length;
  const leadHasContact = lead => Boolean(
    normalizeCrmPhone(lead?.telefone || lead?._journey?.client?.phone || lead?._journey?.client?.telefone).length >= 10
    || lead?.instagram || lead?._journey?.client?.instagram
    || lead?.email || lead?._journey?.client?.email
  );

  const qualityItems = [
    { key: 'lead_no_contact', label: 'Interessados sem telefone, Instagram ou e-mail', count: activeLeads.filter(lead => !leadHasContact(lead)).length },
    { key: 'lead_no_origin', label: 'Interessados sem origem informada', count: activeLeads.filter(lead => !String(lead?.origem || '').trim()).length },
    { key: 'lead_unlinked', label: 'Interessados sem paciente ou agendamento localizado', count: activeLeads.filter(lead => !lead?._journey?.client && !(lead?._journey?.appointments || []).length).length },
    { key: 'duplicate_lead_phone', label: 'Cadastros de interessados com telefone repetido', count: countDuplicatePhones(activeLeads) },
    { key: 'duplicate_client_phone', label: 'Pacientes com telefone repetido', count: countDuplicatePhones(clients) },
    { key: 'completed_without_value', label: 'Atendimentos finalizados sem valor na Agenda', count: completedWithoutValue },
    { key: 'motor_failed', label: 'Mensagens do Motor com falha ou expiração no período', count: motorCount('failed') + motorCount('expired') },
  ];

  return {
    period: { days: periodDays, startDate, endDate: today },
    stages: {
      ...stages,
      leadToBookingRate: rate(stages.booked, stages.leads),
      bookingToAttendanceRate: rate(stages.attended, stages.booked),
      attendanceToReturnRate: rate(stages.returned, stages.attended),
      finalConversionRate: rate(stages.attended, stages.leads),
    },
    timing: {
      medianLeadToBookingHours: median(leadRows.map(row => row.leadToBookingHours)),
      medianLeadToAttendanceHours: median(leadRows.map(row => row.leadToAttendanceHours)),
    },
    recovery: {
      failures: failures.length,
      recovered: recoveredFailures.length,
      rate: rate(recoveredFailures.length, failures.length),
    },
    forecast: {
      appointments: futureAppointments.length,
      value: futureAppointments.reduce((sum, appointment) => sum + getCrmAppointmentValue(appointment), 0),
    },
    losses: [...lossMap.entries()].map(([reason, count]) => ({ reason, count })).sort((left, right) => right.count - left.count),
    byOrigin: groupRows(lead => lead?.origem || 'Não informada'),
    byResponsible: groupRows(lead => lead?.responsavel || 'Sem responsável'),
    procedures: [...procedureMap.values()].sort((left, right) => right.revenue - left.revenue || right.attendances - left.attendances),
    motor: {
      total: motorEvents.length,
      pending: motorCount('pending'),
      approved: motorCount('approved'),
      sent: motorCount('sent'),
      failed: motorCount('failed'),
      expired: motorCount('expired'),
      cancelled: motorCount('cancelled'),
    },
    quality: {
      items: qualityItems,
      pendingTotal: qualityItems.reduce((sum, item) => sum + item.count, 0),
      categoriesWithIssues: qualityItems.filter(item => item.count > 0).length,
    },
  };
}
