export const CRM_JOURNEY_RULES = Object.freeze({
  riskAfterDays: 45,
  recurringWindowDays: 90,
  inactiveClientAfterDays: 120,
  inactiveLeadAfterDays: 30,
});

export const CRM_JOURNEY_STATUS = Object.freeze({
  interessada: {
    label: 'Interessada',
    shortLabel: 'Sem agendamento',
    color: '#D97706',
    background: '#FFFBEB',
  },
  agendada: {
    label: 'Agendada',
    shortLabel: 'Agendada',
    color: '#2563EB',
    background: '#EFF6FF',
  },
  cliente: {
    label: 'Cliente',
    shortLabel: 'Cliente',
    color: '#059669',
    background: '#ECFDF5',
  },
  recorrente: {
    label: 'Recorrente',
    shortLabel: 'Recorrente',
    color: '#047857',
    background: '#D1FAE5',
  },
  faltou: {
    label: 'Faltou',
    shortLabel: 'Reagendar',
    color: '#DC2626',
    background: '#FEF2F2',
  },
  em_risco: {
    label: 'Em risco',
    shortLabel: 'Em risco',
    color: '#C2410C',
    background: '#FFF7ED',
  },
  inativa: {
    label: 'Inativa',
    shortLabel: 'Reativar',
    color: '#6B7280',
    background: '#F3F4F6',
  },
});

const COMPLETED_STATUSES = new Set(['finalizado', 'concluido', 'concluído', 'atendido']);
const NO_SHOW_STATUSES = new Set(['falta', 'cliente_faltou', 'nao_compareceu', 'não_compareceu', 'no_show']);
const CANCELLED_STATUSES = new Set(['cancelado', 'cancelada', 'desmarcado', 'desmarcada']);
const BLOCKED_STATUSES = new Set(['bloqueado', 'bloqueada']);

function clean(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeCrmPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  return digits;
}

export function normalizeCrmInstagram(value) {
  return clean(value).replace(/^@/, '');
}

function phonesMatch(left, right) {
  const a = normalizeCrmPhone(left);
  const b = normalizeCrmPhone(right);
  return a.length >= 10 && b.length >= 10 && a === b;
}

function isoDate(value) {
  if (!value) return null;
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

export function getSaoPauloDate(referenceDate = new Date()) {
  if (typeof referenceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    return referenceDate;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(referenceDate);
}

function daysBetween(earlier, later) {
  if (!earlier || !later) return null;
  const start = Date.parse(`${earlier}T12:00:00Z`);
  const end = Date.parse(`${later}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function addDays(date, amount) {
  if (!date) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

function formatDate(date) {
  if (!date) return null;
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
}

function appointmentStatus(appointment) {
  return clean(appointment?.status);
}

function appointmentTimestamp(appointment) {
  const date = isoDate(appointment?.appointment_date) || '0000-00-00';
  const time = String(appointment?.appointment_time || '00:00').slice(0, 5);
  return `${date}T${time}`;
}

export function getCrmAppointmentValue(appointment) {
  if (appointment?.valor !== null && appointment?.valor !== undefined && appointment?.valor !== ''
    && Number.isFinite(Number(appointment.valor))) return Number(appointment.valor);
  if (!appointment?.notes || typeof appointment.notes !== 'string') return 0;
  try {
    const parsed = JSON.parse(appointment.notes);
    return Number(parsed?.valor) || 0;
  } catch {
    return 0;
  }
}

export function findCrmClient(lead, clients = []) {
  if (!lead) return { client: null, matchType: null };

  if (lead.client_id != null) {
    const explicit = clients.find(client => String(client.id) === String(lead.client_id));
    if (explicit) return { client: explicit, matchType: 'vinculo' };
  }

  if (lead.telefone) {
    const byPhone = clients.find(client => phonesMatch(lead.telefone, client.phone || client.telefone));
    if (byPhone) return { client: byPhone, matchType: 'telefone' };
  }

  const email = clean(lead.email);
  if (email) {
    const byEmail = clients.find(client => clean(client.email) === email);
    if (byEmail) return { client: byEmail, matchType: 'email' };
  }

  const instagram = normalizeCrmInstagram(lead.instagram);
  if (instagram) {
    const byInstagram = clients.find(client => normalizeCrmInstagram(client.instagram) === instagram);
    if (byInstagram) return { client: byInstagram, matchType: 'instagram' };
  }

  return { client: null, matchType: null };
}

export function findLeadAppointments(lead, client, appointments = []) {
  const seen = new Set();
  const leadPhone = lead?.telefone || client?.phone || client?.telefone;
  return appointments
    .filter(appointment => {
      const explicitAppointment = lead?.appointment_id && String(appointment.id) === String(lead.appointment_id);
      const linkedClient = client?.id != null && appointment.client_id != null
        && String(appointment.client_id) === String(client.id);
      const linkedLeadClient = lead?.client_id != null && appointment.client_id != null
        && String(appointment.client_id) === String(lead.client_id);
      const linkedPhone = leadPhone && phonesMatch(leadPhone, appointment.client_phone);
      if (!explicitAppointment && !linkedClient && !linkedLeadClient && !linkedPhone) return false;
      const key = appointment.id || `${appointmentTimestamp(appointment)}-${appointment.procedure || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => appointmentTimestamp(a).localeCompare(appointmentTimestamp(b)));
}

function recommendationFor(key, nextAppointment, lastCompleted, context = {}) {
  const nextDate = isoDate(nextAppointment?.appointment_date);
  const lastDate = isoDate(lastCompleted?.appointment_date);
  const daysUntilNext = daysBetween(context.today, nextDate);
  const isPayingClient = Boolean(lastCompleted);
  const recommendations = {
    interessada: {
      label: context.daysSinceLeadCreation === 0 ? 'Responder novo interesse hoje' : 'Responder e tentar agendar',
      priority: context.daysSinceLeadCreation === 0 ? 4 : 3,
      requiresAction: true,
      dueDate: context.today,
      reason: 'Ainda não existe agendamento vinculado.',
    },
    agendada: {
      label: daysUntilNext === 0
        ? 'Confirmar presença hoje'
        : daysUntilNext === 1
          ? 'Confirmar presença para amanhã'
          : nextDate ? `Acompanhar agendamento de ${formatDate(nextDate)}` : 'Confirmar presença',
      priority: daysUntilNext != null && daysUntilNext <= 1 ? 4 : 2,
      requiresAction: daysUntilNext != null && daysUntilNext <= 1,
      dueDate: nextDate ? addDays(nextDate, -1) : null,
      reason: 'Existe um próximo horário ativo na Agenda.',
    },
    cliente: {
      label: context.daysSinceLastVisit != null && context.daysSinceLastVisit <= 7
        ? 'Fazer pós-atendimento e combinar retorno'
        : 'Planejar o próximo retorno',
      priority: context.daysSinceLastVisit != null && context.daysSinceLastVisit <= 7 ? 3 : 1,
      requiresAction: true,
      dueDate: lastDate ? addDays(lastDate, 2) : context.today,
      reason: 'O atendimento foi finalizado e é considerado pago nesta fase.',
    },
    recorrente: {
      label: 'Relacionamento em dia',
      priority: 0,
      requiresAction: false,
      dueDate: null,
      reason: 'Há pelo menos dois atendimentos finalizados nos últimos 90 dias.',
    },
    faltou: {
      label: 'Chamar para reagendar hoje',
      priority: 4,
      requiresAction: true,
      dueDate: context.today,
      reason: 'A última movimentação foi uma falta sem novo horário.',
    },
    em_risco: {
      label: lastDate ? `Convidar para retornar · última visita ${formatDate(lastDate)}` : 'Convidar para retornar',
      priority: 3,
      requiresAction: true,
      dueDate: context.today,
      reason: 'Passaram pelo menos 45 dias desde o último atendimento finalizado.',
    },
    inativa: {
      label: isPayingClient ? 'Fazer campanha de reativação' : 'Revisar interesse antigo',
      priority: 2,
      requiresAction: true,
      dueDate: context.today,
      reason: isPayingClient
        ? 'Passaram pelo menos 120 dias desde o último atendimento finalizado.'
        : 'O interesse está sem agendamento há pelo menos 30 dias.',
    },
  };
  return recommendations[key];
}

// Espelho testável das quatro etapas persistidas pela migração SQL. A Agenda
// continua sendo a fonte de verdade; esta função evita regras divergentes na UI.
export function deriveCrmPipelineStatus(lead, relatedAppointments = [], referenceDate = new Date()) {
  const today = getSaoPauloDate(referenceDate);
  const sorted = [...relatedAppointments].sort((a, b) => appointmentTimestamp(a).localeCompare(appointmentTimestamp(b)));
  const finalized = sorted.filter(appointment => {
    const date = isoDate(appointment.appointment_date);
    return date && date <= today && COMPLETED_STATUSES.has(appointmentStatus(appointment));
  }).at(-1) || null;

  if (finalized) {
    return { status: 'encerrado_ganho', appointment: finalized, motivoPerda: null };
  }

  const active = sorted.find(appointment => {
    const date = isoDate(appointment.appointment_date);
    const status = appointmentStatus(appointment);
    return date && date >= today
      && !COMPLETED_STATUSES.has(status)
      && !NO_SHOW_STATUSES.has(status)
      && !CANCELLED_STATUSES.has(status)
      && !BLOCKED_STATUSES.has(status);
  }) || null;

  if (active) {
    return { status: 'agendado', appointment: active, motivoPerda: null };
  }

  const hasFailureWithoutReschedule = sorted.some(appointment => {
    const status = appointmentStatus(appointment);
    return NO_SHOW_STATUSES.has(status) || CANCELLED_STATUSES.has(status);
  });
  const leadAge = daysBetween(isoDate(lead?.created_at), today);
  if (hasFailureWithoutReschedule || (leadAge != null && leadAge > 30)) {
    return { status: 'encerrado_perdido', appointment: null, motivoPerda: 'automatico' };
  }

  return { status: 'aguardando_resposta', appointment: null, motivoPerda: null };
}

export function deriveCrmJourney(
  lead,
  clients = [],
  appointments = [],
  referenceDate = new Date(),
  rules = CRM_JOURNEY_RULES,
) {
  const today = getSaoPauloDate(referenceDate);
  const { client, matchType } = findCrmClient(lead, clients);
  const relatedAppointments = findLeadAppointments(lead, client, appointments);
  const pipeline = deriveCrmPipelineStatus(lead, relatedAppointments, referenceDate);

  const completed = relatedAppointments.filter(appointment => {
    const date = isoDate(appointment.appointment_date);
    return date && date <= today && COMPLETED_STATUSES.has(appointmentStatus(appointment));
  });
  const lastCompleted = completed.at(-1) || null;
  const lastCompletedDate = isoDate(lastCompleted?.appointment_date);
  const daysSinceLastVisit = daysBetween(lastCompletedDate, today);

  const futureAppointments = relatedAppointments.filter(appointment => {
    const status = appointmentStatus(appointment);
    const date = isoDate(appointment.appointment_date);
    return date && date >= today
      && !COMPLETED_STATUSES.has(status)
      && !NO_SHOW_STATUSES.has(status)
      && !CANCELLED_STATUSES.has(status)
      && !BLOCKED_STATUSES.has(status);
  });
  const nextAppointment = futureAppointments[0] || null;

  const pastOperational = relatedAppointments.filter(appointment => {
    const date = isoDate(appointment.appointment_date);
    const status = appointmentStatus(appointment);
    return date && date <= today && !CANCELLED_STATUSES.has(status) && !BLOCKED_STATUSES.has(status);
  });
  const lastOperational = pastOperational.at(-1) || null;
  const latestWasNoShow = Boolean(lastOperational && NO_SHOW_STATUSES.has(appointmentStatus(lastOperational)));

  const completedInRecurringWindow = completed.filter(appointment => {
    const distance = daysBetween(isoDate(appointment.appointment_date), today);
    return distance != null && distance <= rules.recurringWindowDays;
  });

  const createdDate = isoDate(lead?.created_at);
  const daysSinceLeadCreation = daysBetween(createdDate, today);

  let key = 'interessada';
  if (nextAppointment) key = 'agendada';
  else if (latestWasNoShow) key = 'faltou';
  else if (lastCompleted && daysSinceLastVisit >= rules.inactiveClientAfterDays) key = 'inativa';
  else if (lastCompleted && daysSinceLastVisit >= rules.riskAfterDays) key = 'em_risco';
  else if (completedInRecurringWindow.length >= 2) key = 'recorrente';
  else if (lastCompleted) key = 'cliente';
  else if (daysSinceLeadCreation != null && daysSinceLeadCreation >= rules.inactiveLeadAfterDays) key = 'inativa';

  const revenueFromAgenda = completed.reduce((sum, appointment) => sum + getCrmAppointmentValue(appointment), 0);
  const totalSpent = revenueFromAgenda || Number(client?.total_spent || client?.totalGasto) || 0;
  const isPayingClient = completed.length > 0;

  return {
    key,
    ...CRM_JOURNEY_STATUS[key],
    client,
    matchType,
    appointments: relatedAppointments,
    completedCount: completed.length,
    completedInRecurringWindow: completedInRecurringWindow.length,
    lastAppointment: lastOperational,
    lastCompleted,
    nextAppointment,
    lastVisitDate: lastCompletedDate,
    nextAppointmentDate: isoDate(nextAppointment?.appointment_date),
    daysSinceLastVisit,
    totalSpent,
    revenueFromAgenda,
    revenueSource: 'agenda_finalizada',
    isPayingClient,
    recommendation: recommendationFor(key, nextAppointment, lastCompleted, {
      today,
      daysSinceLastVisit,
      daysSinceLeadCreation,
    }),
    pipelineStatus: pipeline.status,
    pipelineAppointment: pipeline.appointment,
    isAutomaticallyMatched: Boolean(matchType && matchType !== 'vinculo'),
  };
}

/**
 * Resumo do CRM enquanto o Financeiro ainda não é a fonte de verdade.
 * Cada appointment é contado uma única vez, mesmo quando houver leads duplicados.
 * Regra provisória acordada: status finalizado representa atendimento pago.
 */
export function summarizeCrmRevenueFromAgenda(enrichedLeads = [], referenceDate = new Date()) {
  const today = getSaoPauloDate(referenceDate);
  const month = today.slice(0, 7);
  const activeLeads = enrichedLeads.filter(lead => !lead.arquivado);
  const uniqueAppointments = new Map();

  activeLeads.forEach(lead => {
    (lead?._journey?.appointments || []).forEach(appointment => {
      const key = appointment.id || `${appointmentTimestamp(appointment)}-${appointment.procedure || ''}-${appointment.client_id || ''}`;
      if (!uniqueAppointments.has(key)) uniqueAppointments.set(key, appointment);
    });
  });

  const completedThisMonth = [...uniqueAppointments.values()].filter(appointment => {
    const date = isoDate(appointment.appointment_date);
    return date?.startsWith(month) && date <= today && COMPLETED_STATUSES.has(appointmentStatus(appointment));
  });

  const payingClientKeys = new Set(
    activeLeads
      .filter(lead => lead?._journey?.isPayingClient)
      .map(lead => {
        if (lead?._journey?.client?.id != null) return `client:${lead._journey.client.id}`;
        const phone = normalizeCrmPhone(lead.telefone);
        return phone ? `phone:${phone}` : `lead:${lead.id}`;
      }),
  );

  return {
    source: 'agenda_finalizada',
    sourceLabel: 'Agenda · atendimentos finalizados considerados pagos',
    leads: activeLeads.length,
    waitingResponse: activeLeads.filter(lead => lead?._journey?.key === 'interessada').length,
    scheduled: activeLeads.filter(lead => lead?._journey?.key === 'agendada').length,
    payingClients: payingClientKeys.size,
    recurringClients: activeLeads.filter(lead => lead?._journey?.key === 'recorrente').length,
    atRiskClients: activeLeads.filter(lead => (
      lead?._journey?.isPayingClient && ['em_risco', 'inativa'].includes(lead?._journey?.key)
    )).length,
    postSaleClients: activeLeads.filter(lead => (
      lead?._journey?.key === 'cliente'
      && lead?._journey?.daysSinceLastVisit != null
      && lead._journey.daysSinceLastVisit <= 7
      && !lead._journey.nextAppointment
    )).length,
    salesThisMonth: completedThisMonth.length,
    revenueThisMonth: completedThisMonth.reduce((sum, appointment) => sum + getCrmAppointmentValue(appointment), 0),
    conversionRate: activeLeads.length ? (payingClientKeys.size / activeLeads.length) * 100 : null,
  };
}

export function enrichCrmLeads(leads = [], clients = [], appointments = [], referenceDate = new Date()) {
  const clientsById = new Map();
  const clientsByPhone = new Map();
  const clientsByEmail = new Map();
  const clientsByInstagram = new Map();
  const appointmentsById = new Map();
  const appointmentsByClient = new Map();
  const appointmentsByPhone = new Map();

  const rememberFirst = (map, key, value) => {
    if (key && !map.has(key)) map.set(key, value);
  };
  const append = (map, key, value) => {
    if (!key) return;
    const list = map.get(key) || [];
    list.push(value);
    map.set(key, list);
  };

  clients.forEach(client => {
    if (client?.id != null) clientsById.set(String(client.id), client);
    rememberFirst(clientsByPhone, normalizeCrmPhone(client?.phone || client?.telefone), client);
    rememberFirst(clientsByEmail, clean(client?.email), client);
    rememberFirst(clientsByInstagram, normalizeCrmInstagram(client?.instagram), client);
  });

  appointments.forEach(appointment => {
    if (appointment?.id != null) appointmentsById.set(String(appointment.id), appointment);
    if (appointment?.client_id != null) append(appointmentsByClient, String(appointment.client_id), appointment);
    append(appointmentsByPhone, normalizeCrmPhone(appointment?.client_phone), appointment);
  });

  return leads.map(lead => {
    const phone = normalizeCrmPhone(lead.telefone);
    const client = (lead.client_id != null && clientsById.get(String(lead.client_id)))
      || (phone && clientsByPhone.get(phone))
      || clientsByEmail.get(clean(lead.email))
      || clientsByInstagram.get(normalizeCrmInstagram(lead.instagram))
      || null;

    const related = new Map();
    const include = appointment => {
      if (!appointment) return;
      const key = appointment.id || `${appointmentTimestamp(appointment)}-${appointment.procedure || ''}`;
      related.set(String(key), appointment);
    };
    include(lead.appointment_id ? appointmentsById.get(String(lead.appointment_id)) : null);
    (lead.client_id != null ? appointmentsByClient.get(String(lead.client_id)) || [] : []).forEach(include);
    (client?.id != null ? appointmentsByClient.get(String(client.id)) || [] : []).forEach(include);
    (phone ? appointmentsByPhone.get(phone) || [] : []).forEach(include);

    return {
      ...lead,
      _journey: deriveCrmJourney(
        lead,
        client ? [client] : [],
        [...related.values()],
        referenceDate,
      ),
    };
  });
}

export function matchesCrmJourneyFilter(lead, filter) {
  const key = lead?._journey?.key;
  if (!filter) return true;
  if (filter === 'sem_agendamento') return key === 'interessada';
  if (filter === 'faltaram') return key === 'faltou';
  if (filter === 'em_risco') {
    return Boolean(lead?._journey?.isPayingClient) && (key === 'em_risco' || key === 'inativa');
  }
  if (filter === 'pos_venda') {
    return key === 'cliente'
      && lead?._journey?.daysSinceLastVisit != null
      && lead._journey.daysSinceLastVisit <= 7
      && !lead._journey.nextAppointment;
  }
  if (filter === 'agendadas') return key === 'agendada';
  if (filter === 'clientes') return ['cliente', 'recorrente'].includes(key);
  return true;
}
