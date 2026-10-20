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

export function isCompletedAppointment(appointment = {}) {
  return ['finalizado', 'completed'].includes(String(appointment.status || '').toLowerCase());
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
