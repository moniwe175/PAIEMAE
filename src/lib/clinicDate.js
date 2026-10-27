export const CLINIC_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Chave YYYY-MM-DD do dia civil da clínica.
 *
 * Não use Date#toISOString para filtrar a Agenda: depois das 21h em Brasília,
 * o UTC já está no dia seguinte e a tela aparenta perder os agendamentos.
 */
export function clinicDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}
