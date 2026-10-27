export const UNKNOWN_PATIENT_SOURCE = 'Não informado';

export function resolvePatientSource(client = {}) {
  const source = String(client.source || '').trim();
  // O schema antigo preenchia Instagram automaticamente. Outros canais
  // legados só poderiam ter sido informados explicitamente.
  const confirmed = Boolean(client.source_confirmed_at) || Boolean(source && source !== 'Instagram');
  return {
    source: confirmed ? source : UNKNOWN_PATIENT_SOURCE,
    originalSource: source,
    confirmed: Boolean(confirmed && source),
  };
}

export function derivePatientRelationship(totalSessions = 0, isAtRisk = false) {
  const sessions = Math.max(0, Number(totalSessions) || 0);
  if (sessions >= 3 && !isAtRisk) return 'Fidelizado';
  if (sessions >= 2) return 'Recorrente';
  if (sessions === 1) return 'Primeira visita';
  return 'Sem histórico';
}

export function calculateLoyalPatientStats(patients = []) {
  const withHistory = patients.filter((patient) => Number(patient.totalSessoes) > 0);
  const loyal = withHistory.filter((patient) => Number(patient.totalSessoes) >= 3 && !patient.isEmRisco);
  return {
    loyal: loyal.length,
    withHistory: withHistory.length,
    percentage: withHistory.length > 0 ? Math.round((loyal.length / withHistory.length) * 100) : 0,
  };
}

export function calculateScheduledReturnStats(patients = [], cutoffDate = '') {
  const recentlyAttended = patients.filter((patient) => (
    Number(patient.totalSessoes) > 0
    && String(patient.ultimaVisitaIso || '') >= String(cutoffDate || '')
  ));
  const scheduled = recentlyAttended.filter((patient) => (
    Number(patient.commercialHistory?.futureCount) > 0
    || Boolean(patient.commercialHistory?.nextAppointment)
  ));
  return {
    scheduled: scheduled.length,
    withoutReturn: recentlyAttended.length - scheduled.length,
    recentlyAttended: recentlyAttended.length,
    percentage: recentlyAttended.length > 0
      ? Math.round((scheduled.length / recentlyAttended.length) * 100)
      : 0,
  };
}

export function isCompletedAppointment(appointment = {}) {
  return ['finalizado', 'completed', 'concluido', 'concluído'].includes(String(appointment.status || '').toLowerCase());
}

const CANCELLED_STATUSES = new Set(['cancelado', 'cancelled', 'desmarcado']);
const NO_SHOW_STATUSES = new Set(['falta', 'cliente_faltou', 'no_show', 'no-show']);
const BLOCKED_STATUSES = new Set(['bloqueado', 'blocked']);

function normalizeStatus(value) {
  return String(value || 'aguardando_confirmacao').trim().toLowerCase();
}

function digits(value) {
  return String(value || '').replace(/\D/g, '').slice(-11);
}

function normalizedName(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR');
}

function parseDateOnly(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function appointmentTimestamp(appointment = {}) {
  const date = parseDateOnly(appointment.appointment_date || appointment.data);
  if (!date) return 0;
  const time = String(appointment.appointment_time || appointment.hora || '00:00');
  const parts = time.match(/^(\d{1,2}):(\d{2})/);
  if (parts) date.setHours(Number(parts[1]), Number(parts[2]), 0, 0);
  return date.getTime();
}

export function getAppointmentRecordedValue(appointment = {}) {
  const direct = Number(appointment.valor ?? appointment.value);
  if (Number.isFinite(direct) && direct > 0) return direct;

  try {
    const notes = appointment.notes;
    const parsed = typeof notes === 'string' && notes.trim().startsWith('{')
      ? JSON.parse(notes)
      : (notes && typeof notes === 'object' ? notes : null);
    const value = Number(parsed?.valor ?? parsed?.value ?? parsed?.preco);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function appointmentMatchesPatient(appointment = {}, patient = {}) {
  if (appointment.client_id != null && appointment.client_id !== '' && patient.id != null && patient.id !== '') {
    return String(appointment.client_id) === String(patient.id);
  }

  const appointmentPhone = digits(appointment.client_phone || appointment.telefone);
  const patientPhone = digits(patient.phone || patient.telefone);
  if (appointmentPhone.length >= 10 && patientPhone.length >= 10) {
    return appointmentPhone === patientPhone;
  }

  const appointmentName = normalizedName(appointment.client_name || appointment.paciente);
  const patientName = normalizedName(patient.name || patient.nome);
  return Boolean(appointmentName && patientName && appointmentName === patientName);
}

export function getCommercialStatus(appointment = {}) {
  const status = normalizeStatus(appointment.status);
  if (isCompletedAppointment({ status })) return 'completed';
  if (CANCELLED_STATUSES.has(status)) return 'cancelled';
  if (NO_SHOW_STATUSES.has(status)) return 'no_show';
  if (BLOCKED_STATUSES.has(status)) return 'blocked';
  return 'scheduled';
}

export function buildPatientCommercialHistory(patient = {}, appointments = [], referenceDate = new Date()) {
  const reference = new Date(referenceDate);
  reference.setSeconds(0, 0);

  const related = appointments
    .filter((appointment) => appointmentMatchesPatient(appointment, patient))
    .filter((appointment) => getCommercialStatus(appointment) !== 'blocked')
    .map((appointment) => {
      const statusGroup = getCommercialStatus(appointment);
      const value = getAppointmentRecordedValue(appointment);
      const date = appointment.appointment_date || appointment.data || '';
      const time = String(appointment.appointment_time || appointment.hora || '').slice(0, 5);
      return {
        id: appointment.id,
        date,
        time,
        timestamp: appointmentTimestamp(appointment),
        service: appointment.procedure || appointment.servico || 'Atendimento',
        professional: appointment.professional || appointment.profissional || 'Não informado',
        originalStatus: normalizeStatus(appointment.status),
        statusGroup,
        value,
        countedInTotal: statusGroup === 'completed',
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  const completed = related.filter((item) => item.statusGroup === 'completed');
  const completedAsc = [...completed].sort((a, b) => a.timestamp - b.timestamp);
  const totalRecordedValue = completed.reduce((sum, item) => sum + item.value, 0);
  const appointmentsWithValue = completed.filter((item) => item.value > 0).length;

  let averageIntervalDays = null;
  if (completedAsc.length >= 2) {
    const differences = [];
    for (let index = 1; index < completedAsc.length; index += 1) {
      const difference = Math.round((completedAsc[index].timestamp - completedAsc[index - 1].timestamp) / 86400000);
      if (difference >= 0) differences.push(difference);
    }
    if (differences.length) {
      averageIntervalDays = Math.round(differences.reduce((sum, value) => sum + value, 0) / differences.length);
    }
  }

  const future = related
    .filter((item) => item.statusGroup === 'scheduled' && item.timestamp >= reference.getTime())
    .sort((a, b) => a.timestamp - b.timestamp);

  const serviceMap = new Map();
  completed.forEach((item) => {
    const current = serviceMap.get(item.service) || { service: item.service, sessions: 0, recordedValue: 0 };
    current.sessions += 1;
    current.recordedValue += item.value;
    serviceMap.set(item.service, current);
  });

  const monthlyMap = new Map();
  completedAsc.forEach((item) => {
    const key = String(item.date).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) return;
    const current = monthlyMap.get(key) || { month: key, sessions: 0, recordedValue: 0 };
    current.sessions += 1;
    current.recordedValue += item.value;
    monthlyMap.set(key, current);
  });

  return {
    timeline: related,
    completedCount: completed.length,
    scheduledCount: related.filter((item) => item.statusGroup === 'scheduled').length,
    futureCount: future.length,
    cancelledCount: related.filter((item) => item.statusGroup === 'cancelled').length,
    noShowCount: related.filter((item) => item.statusGroup === 'no_show').length,
    totalRecordedValue,
    appointmentsWithValue,
    averageTicket: appointmentsWithValue > 0 ? totalRecordedValue / appointmentsWithValue : 0,
    averageIntervalDays,
    firstVisit: completedAsc.at(0)?.date || null,
    lastVisit: completedAsc.at(-1)?.date || null,
    nextAppointment: future[0] || null,
    topServices: [...serviceMap.values()].sort((a, b) => b.sessions - a.sessions || b.recordedValue - a.recordedValue),
    monthlyEvolution: [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
  };
}

export function appointmentPatientKey(appointment = {}) {
  if (appointment.client_id != null && appointment.client_id !== '') {
    return `id:${appointment.client_id}`;
  }

  const phone = String(appointment.client_phone || '').replace(/\D/g, '').slice(-11);
  if (phone.length >= 10) return `phone:${phone}`;

  const name = String(appointment.client_name || '').trim().toLocaleLowerCase('pt-BR');
  return name ? `name:${name}` : '';
}
