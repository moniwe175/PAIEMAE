const HOUR_START = 7;
const HOUR_END = 20;
const SLOTS_PER_PROFESSIONAL_DAY = HOUR_END - HOUR_START;

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDuration(appointment) {
  const direct = Number(appointment?.duracao ?? appointment?.duration);
  if (direct > 0) return direct;

  try {
    const notes = typeof appointment?.notes === 'string' && appointment.notes.trim().startsWith('{')
      ? JSON.parse(appointment.notes)
      : appointment?.notes;
    const fromNotes = Number(notes?.duracao ?? notes?.duration);
    if (fromNotes > 0) return fromNotes;
  } catch {
    // Registros antigos podem ter observações em texto livre.
  }

  return 60;
}

function workingDaysInMonth(referenceDate) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  let total = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    if (new Date(year, month, day).getDay() !== 0) total += 1;
  }
  return total;
}

function periodDates(period, referenceDate) {
  if (period === 'dia') {
    return { dates: new Set([dateKey(referenceDate)]), monthPrefix: null, workingDays: 1, label: 'Hoje' };
  }

  if (period === 'semana') {
    const monday = new Date(referenceDate);
    const weekDay = monday.getDay();
    monday.setDate(monday.getDate() + (weekDay === 0 ? -6 : 1 - weekDay));
    const dates = new Set();
    for (let offset = 0; offset < 6; offset += 1) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + offset);
      dates.add(dateKey(date));
    }
    return { dates, monthPrefix: null, workingDays: 6, label: 'Esta semana' };
  }

  const monthPrefix = dateKey(referenceDate).slice(0, 7);
  return {
    dates: null,
    monthPrefix,
    workingDays: workingDaysInMonth(referenceDate),
    label: 'Este mês',
  };
}

function appointmentDate(appointment) {
  return appointment?.appointment_date || appointment?.data || '';
}

export function calculateAgendaPerformance(appointments = [], professionals = [], period = 'mes', referenceDate = new Date()) {
  const normalizedReference = referenceDate instanceof Date
    ? referenceDate
    : new Date(`${referenceDate}T12:00:00`);
  const range = periodDates(period, normalizedReference);
  const validAppointments = appointments.filter(appointment => {
    if (appointment?.status === 'bloqueado') return false;
    const value = appointmentDate(appointment);
    if (!value) return false;
    return range.dates ? range.dates.has(value) : value.startsWith(range.monthPrefix);
  });

  const activeProfessionals = professionals.filter(professional => professional?.ativo !== false).length;
  const appointmentProfessionals = new Set(
    validAppointments.map(appointment => appointment?.professional || appointment?.profissional).filter(Boolean),
  ).size;
  const professionalCount = Math.max(1, activeProfessionals || appointmentProfessionals);
  const totalSlots = SLOTS_PER_PROFESSIONAL_DAY * professionalCount * range.workingDays;
  const cancelledStatuses = new Set(['cancelado', 'desmarcado']);
  const absenceStatuses = new Set(['falta', 'cliente_faltou']);
  const occupied = validAppointments.filter(appointment => !cancelledStatuses.has(appointment.status)).length;
  const absences = validAppointments.filter(appointment => absenceStatuses.has(appointment.status)).length;
  const cancellations = validAppointments.filter(appointment => cancelledStatuses.has(appointment.status)).length;
  const durations = validAppointments
    .filter(appointment => !cancelledStatuses.has(appointment.status) && !absenceStatuses.has(appointment.status))
    .map(parseDuration);
  const averageMinutes = durations.length
    ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
    : 0;

  return {
    periodLabel: range.label,
    totalAppointments: validAppointments.length,
    totalSlots,
    occupied,
    occupancyRate: totalSlots ? Math.min(100, Math.round((occupied / totalSlots) * 100)) : 0,
    absences,
    noShowRate: validAppointments.length ? Math.round((absences / validAppointments.length) * 100) : 0,
    cancellations,
    cancellationRate: validAppointments.length ? Math.round((cancellations / validAppointments.length) * 100) : 0,
    averageMinutes,
    averageLabel: averageMinutes >= 60
      ? `${Math.floor(averageMinutes / 60)}h${averageMinutes % 60 ? ` ${averageMinutes % 60}min` : ''}`
      : averageMinutes > 0 ? `${averageMinutes} min` : '—',
  };
}
