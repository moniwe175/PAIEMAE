import { normalizeCrmPhone } from './crmJourney.js';

const TOOLS_BY_JOURNEY = Object.freeze({
  agendada: new Set([1, 2, 3, 7, 8, 10]),
  cliente: new Set([6, 9, 11, 16, 18]),
  recorrente: new Set([11, 16, 18]),
  faltou: new Set([4, 17]),
  em_risco: new Set([13, 14, 16, 20, 21]),
  inativa: new Set([13, 14, 16, 20, 21]),
});

const STATUS_PRESENTATION = Object.freeze({
  pending: {
    label: 'Aguardando revisão no Motor',
    color: '#D97706',
    background: '#FFFBEB',
    requiresAttention: true,
  },
  approved: {
    label: 'Programado pelo Motor',
    color: '#2563EB',
    background: '#EFF6FF',
    requiresAttention: false,
  },
  sent: {
    label: 'Enviado automaticamente',
    color: '#059669',
    background: '#ECFDF5',
    requiresAttention: false,
  },
  failed: {
    label: 'Falha no envio automático',
    color: '#DC2626',
    background: '#FEF2F2',
    requiresAttention: true,
  },
  expired: {
    label: 'Envio automático expirou',
    color: '#6B7280',
    background: '#F3F4F6',
    requiresAttention: true,
  },
  cancelled: {
    label: 'Automação cancelada',
    color: '#6B7280',
    background: '#F3F4F6',
    requiresAttention: true,
  },
});

export function getCrmAutomationPresentation(status) {
  return STATUS_PRESENTATION[status] || {
    label: 'Estado do Motor desconhecido',
    color: '#6B7280',
    background: '#F3F4F6',
    requiresAttention: true,
  };
}

function eventTimestamp(event) {
  return Date.parse(event?.sent_at || event?.updated_at || event?.created_at || event?.scheduled_at || '') || 0;
}

function eventMatchesLead(event, lead) {
  const clientIds = new Set([
    lead?.client_id,
    lead?._journey?.client?.id,
  ].filter(value => value !== null && value !== undefined).map(String));
  if (event?.client_id !== null && event?.client_id !== undefined && clientIds.has(String(event.client_id))) return true;

  const appointmentIds = new Set([
    lead?.appointment_id,
    ...(lead?._journey?.appointments || []).map(appointment => appointment?.id),
  ].filter(Boolean).map(String));
  if (event?.appointment_id && appointmentIds.has(String(event.appointment_id))) return true;

  const leadPhone = normalizeCrmPhone(lead?.telefone || lead?._journey?.client?.phone || lead?._journey?.client?.telefone);
  const eventPhone = normalizeCrmPhone(event?.client_phone);
  return leadPhone.length >= 10 && eventPhone.length >= 10 && leadPhone === eventPhone;
}

export function summarizeCrmAutomationForLead(lead, events = []) {
  const journeyKey = lead?._journey?.key;
  const relevantTools = TOOLS_BY_JOURNEY[journeyKey];
  if (!relevantTools) return null;

  const related = events
    .filter(event => relevantTools.has(Number(event?.tool_id)) && eventMatchesLead(event, lead))
    .sort((left, right) => eventTimestamp(right) - eventTimestamp(left));

  if (!related.length) return null;
  const latest = related[0];
  const presentation = getCrmAutomationPresentation(latest.status);

  return {
    latest,
    events: related,
    ...presentation,
    detail: latest.tool_name || `Ferramenta ${latest.tool_id}`,
  };
}

export function enrichCrmLeadsWithAutomation(leads = [], events = []) {
  const byClient = new Map();
  const byAppointment = new Map();
  const byPhone = new Map();
  const remember = (map, key, event) => {
    if (!key) return;
    const normalizedKey = String(key);
    const current = map.get(normalizedKey) || [];
    current.push(event);
    map.set(normalizedKey, current);
  };

  events.forEach(event => {
    remember(byClient, event?.client_id, event);
    remember(byAppointment, event?.appointment_id, event);
    const phone = normalizeCrmPhone(event?.client_phone);
    if (phone.length >= 10) remember(byPhone, phone, event);
  });

  return leads.map(lead => ({
    ...lead,
    _automation: (() => {
      const candidates = new Map();
      const include = rows => rows?.forEach(event => candidates.set(event.id, event));
      include(byClient.get(String(lead?.client_id ?? '')));
      include(byClient.get(String(lead?._journey?.client?.id ?? '')));
      include(byAppointment.get(String(lead?.appointment_id ?? '')));
      (lead?._journey?.appointments || []).forEach(appointment => include(byAppointment.get(String(appointment?.id ?? ''))));
      const phone = normalizeCrmPhone(lead?.telefone || lead?._journey?.client?.phone || lead?._journey?.client?.telefone);
      if (phone.length >= 10) include(byPhone.get(phone));
      return summarizeCrmAutomationForLead(lead, [...candidates.values()]);
    })(),
  }));
}
