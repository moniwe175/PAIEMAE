export const ACTIVE_WAITLIST_STATUSES = new Set(['aguardando', 'contatada']);

export const WAITLIST_PERIODS = [
  { value: 'qualquer', label: 'Qualquer horario' },
  { value: 'manha', label: 'Manha' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function waitlistPeriodForTime(time) {
  const hour = Number(String(time || '00:00').split(':')[0]);
  if (hour < 12) return 'manha';
  if (hour < 18) return 'tarde';
  return 'noite';
}

export function isActiveWaitlistEntry(entry, referenceDate = '') {
  if (!ACTIVE_WAITLIST_STATUSES.has(entry?.status)) return false;
  if (referenceDate && entry?.available_until && entry.available_until < referenceDate) return false;
  return true;
}

export function waitlistMatchesSlot(entry, slot) {
  const slotDate = String(slot?.date || '');
  if (!isActiveWaitlistEntry(entry, slotDate)) return false;
  if (normalize(entry.service) !== normalize(slot?.service)) return false;

  const preferredProfessional = normalize(entry.preferred_professional);
  if (preferredProfessional && preferredProfessional !== 'qualquer'
      && preferredProfessional !== normalize(slot?.professional)) return false;

  if (entry.available_from && slotDate && entry.available_from > slotDate) return false;

  const preferredPeriod = entry.preferred_period || 'qualquer';
  if (preferredPeriod !== 'qualquer' && preferredPeriod !== waitlistPeriodForTime(slot?.time)) return false;

  return true;
}

export function sortWaitlistEntries(entries = []) {
  return [...entries].sort((a, b) => {
    const statusA = a.status === 'aguardando' ? 0 : 1;
    const statusB = b.status === 'aguardando' ? 0 : 1;
    if (statusA !== statusB) return statusA - statusB;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });
}

export function compatibleWaitlistEntries(entries = [], slot) {
  return sortWaitlistEntries(entries.filter((entry) => waitlistMatchesSlot(entry, slot)));
}

