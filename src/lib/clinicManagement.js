const COMPLETED = new Set(['finalizado', 'completed', 'concluido', 'concluído', 'atendido']);
const ABSENT = new Set(['falta', 'cliente_faltou', 'nao_compareceu', 'não_compareceu', 'no_show']);
const CANCELLED = new Set(['cancelado', 'cancelada', 'desmarcado', 'desmarcada']);
const BLOCKED = new Set(['bloqueado', 'bloqueada']);
const AWAITING_CONFIRMATION = new Set(['aguardando_confirmacao', 'aguardando confirmação', 'pending', 'agendado']);

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR');
}

function appointmentDate(appointment) {
  return String(appointment?.appointment_date || appointment?.data || '').slice(0, 10);
}

function patientKey(appointment) {
  const phone = String(appointment?.client_phone || appointment?.telefone || '').replace(/\D/g, '').slice(-11);
  if (phone.length >= 10) return `phone:${phone}`;
  if (appointment?.client_id != null && appointment.client_id !== '') return `id:${appointment.client_id}`;
  const name = normalize(appointment?.client_name || appointment?.paciente);
  return name ? `name:${name}` : '';
}

function countRanking(items, getKey) {
  const counts = new Map();
  items.forEach(item => {
    const key = String(getKey(item) || '').trim();
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))[0] || null;
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateClinicManagement(
  appointments = [],
  startDate,
  endDate,
  referenceDate = new Date(),
) {
  const today = referenceDate instanceof Date
    ? new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
    : new Date(`${referenceDate}T12:00:00`);
  const todayKey = isoDate(today);
  const nextSeven = new Date(today);
  nextSeven.setDate(nextSeven.getDate() + 6);
  const nextSevenKey = isoDate(nextSeven);

  const operational = appointments.filter(item => !BLOCKED.has(normalize(item?.status)) && appointmentDate(item));
  const periodAppointments = operational.filter(item => {
    const date = appointmentDate(item);
    return date >= startDate && date <= endDate;
  });
  const completed = periodAppointments.filter(item => COMPLETED.has(normalize(item.status)));
  const absences = periodAppointments.filter(item => ABSENT.has(normalize(item.status)));
  const cancellations = periodAppointments.filter(item => CANCELLED.has(normalize(item.status)));
  const active = periodAppointments.filter(item => {
    const status = normalize(item.status);
    return !COMPLETED.has(status) && !ABSENT.has(status) && !CANCELLED.has(status);
  });

  const completedBefore = new Set(
    operational
      .filter(item => appointmentDate(item) < startDate && COMPLETED.has(normalize(item.status)))
      .map(patientKey)
      .filter(Boolean),
  );
  const attendedKeys = new Set(completed.map(patientKey).filter(Boolean));
  const returningKeys = new Set([...attendedKeys].filter(key => completedBefore.has(key)));
  const firstVisitCount = Math.max(0, attendedKeys.size - returningKeys.size);
  const attendanceBase = completed.length + absences.length;

  const upcoming = operational.filter(item => {
    const date = appointmentDate(item);
    const status = normalize(item.status);
    return date >= todayKey && date <= nextSevenKey
      && !COMPLETED.has(status)
      && !ABSENT.has(status)
      && !CANCELLED.has(status);
  });
  const awaitingConfirmation = upcoming.filter(item => AWAITING_CONFIRMATION.has(normalize(item.status))).length;
  const pendingPast = operational.filter(item => {
    const date = appointmentDate(item);
    const status = normalize(item.status);
    return date < todayKey
      && !COMPLETED.has(status)
      && !ABSENT.has(status)
      && !CANCELLED.has(status);
  }).length;

  return {
    totalScheduled: periodAppointments.length,
    completed: completed.length,
    uniquePatients: attendedKeys.size,
    absences: absences.length,
    cancellations: cancellations.length,
    active: active.length,
    attendanceRate: attendanceBase ? Math.round((completed.length / attendanceBase) * 100) : 0,
    losses: absences.length + cancellations.length,
    lossRate: periodAppointments.length
      ? Math.round(((absences.length + cancellations.length) / periodAppointments.length) * 100)
      : 0,
    returningPatients: returningKeys.size,
    firstVisitPatients: firstVisitCount,
    returnRate: attendedKeys.size ? Math.round((returningKeys.size / attendedKeys.size) * 100) : 0,
    upcomingSevenDays: upcoming.length,
    awaitingConfirmation,
    pendingPast,
    topProcedure: countRanking(completed, item => item.procedure || item.servico),
    topProfessional: countRanking(completed, item => item.professional || item.profissional),
  };
}

export function calculateCommercialHighlights(transactions = [], previousRevenue = 0, daysCount = 1) {
  const services = new Map();
  const clients = new Set();
  let revenue = 0;

  transactions.forEach(transaction => {
    const value = Number(transaction?.gross) || 0;
    revenue += value;
    const client = normalize(transaction?.client);
    if (client) clients.add(client);
    const serviceName = String(transaction?.procedure || 'Sem procedimento').trim();
    const current = services.get(serviceName) || { name: serviceName, count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += value;
    services.set(serviceName, current);
  });

  const topService = [...services.values()]
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))[0] || null;
  const sessions = transactions.length;
  const previous = Number(previousRevenue) || 0;

  return {
    revenue,
    sessions,
    uniquePayingClients: clients.size,
    averageTicket: sessions ? revenue / sessions : 0,
    ticketPerClient: clients.size ? revenue / clients.size : 0,
    dailyAverage: revenue / Math.max(1, Number(daysCount) || 1),
    growthRate: previous > 0 ? ((revenue - previous) / previous) * 100 : null,
    topService,
  };
}
