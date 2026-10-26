const ACTIVE_SESSION_STATUSES = new Set(['pending_signature', 'signed', 'legacy']);

export function isPackageRepasseTransaction(transaction) {
  return Number(transaction?.repasse) > 0
    && transaction?.is_metadata !== true
    && !transaction?.deleted_at;
}

export function patientsWithPackages(patients = [], packages = []) {
  const clientIds = new Set(
    packages
      .map((patientPackage) => patientPackage?.client_id)
      .filter((clientId) => clientId !== null && clientId !== undefined)
      .map(String),
  );

  return patients.filter((patient) => clientIds.has(String(patient?.id)));
}

export function activePackageSessions(sessions = [], packageId = null) {
  return sessions.filter((session) => (
    (!packageId || String(session.patient_package_id) === String(packageId))
    && ACTIVE_SESSION_STATUSES.has(String(session.status || 'pending_signature'))
  ));
}

export function packageProgress(patientPackage, sessions = [], today = new Date()) {
  const total = Math.max(1, Number(patientPackage?.total_sessions) || 1);
  const used = activePackageSessions(sessions, patientPackage?.id).length;
  const remaining = Math.max(0, total - used);
  const expiry = patientPackage?.expires_at ? new Date(`${patientPackage.expires_at}T12:00:00`) : null;
  const expired = Boolean(expiry && expiry < new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const storedStatus = String(patientPackage?.status || 'active');
  const status = storedStatus === 'cancelled' || storedStatus === 'paused'
    ? storedStatus
    : remaining === 0
      ? 'completed'
      : expired
        ? 'expired'
        : 'active';

  return {
    total,
    used,
    remaining,
    percent: Math.min(100, Math.round((used / total) * 100)),
    status,
  };
}

export function packageServiceNames(patientPackage) {
  const services = Array.isArray(patientPackage?.services) ? patientPackage.services : [];
  return services
    .map((service) => typeof service === 'string' ? service : service?.nome || service?.name)
    .filter(Boolean);
}

function positiveInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function sessionSort(a, b) {
  const byNumber = positiveInteger(a?.session_number) - positiveInteger(b?.session_number);
  if (byNumber) return byNumber;
  return new Date(a?.performed_at || 0) - new Date(b?.performed_at || 0);
}

function isLegacySession(session) {
  return String(session?.status || '') === 'legacy'
    || normalizePackageText(session?.service_name).includes('anterior ao controle digital');
}

export function buildPackageSessionGrid(patientPackage, sessions = []) {
  const total = positiveInteger(patientPackage?.total_sessions, 1);
  const definitions = (Array.isArray(patientPackage?.services) ? patientPackage.services : [])
    .map((service, index) => {
      const name = typeof service === 'string' ? service : service?.nome || service?.name;
      if (!name) return null;
      return {
        key: String(typeof service === 'object' && (service?.id || service?.service_id) || `service-${index}`),
        name,
        quota: positiveInteger(typeof service === 'object' ? service?.qtd || service?.quantity : null, 1),
        sessions: [],
      };
    })
    .filter(Boolean);

  const columns = definitions.length > 0
    ? definitions
    : [{ key: 'package-service', name: patientPackage?.package_name || 'Serviço do pacote', quota: total, sessions: [] }];

  if (columns.length === 1) columns[0].quota = Math.max(columns[0].quota, total);

  const packageSessions = activePackageSessions(sessions, patientPackage?.id).sort(sessionSort);
  const unmatched = [];

  packageSessions.forEach((session) => {
    const normalizedService = normalizePackageText(session?.service_name);
    let column = columns.find((item) => normalizePackageText(item.name) === normalizedService);
    if (!column && normalizedService) {
      column = columns.find((item) => {
        const normalizedColumn = normalizePackageText(item.name);
        return normalizedColumn.includes(normalizedService) || normalizedService.includes(normalizedColumn);
      });
    }
    if (!column && (columns.length === 1 || isLegacySession(session))) {
      if (columns.length === 1) column = columns[0];
    }
    if (column) column.sessions.push(session);
    else unmatched.push(session);
  });

  const unmatchedGroups = new Map();
  unmatched.forEach((session) => {
    const legacy = isLegacySession(session);
    const name = legacy ? 'Sessões anteriores' : session?.service_name || 'Serviço não identificado';
    const key = normalizePackageText(name) || 'unmatched';
    if (!unmatchedGroups.has(key)) unmatchedGroups.set(key, { key: `extra-${key}`, name, quota: 0, sessions: [] });
    unmatchedGroups.get(key).sessions.push(session);
  });
  unmatchedGroups.forEach((column) => {
    column.quota = column.sessions.length;
    columns.push(column);
  });

  columns.forEach((column) => {
    column.sessions.sort(sessionSort);
    column.quota = Math.max(column.quota, column.sessions.length);
  });

  const rowCount = Math.max(1, ...columns.map((column) => column.quota));
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => ({
    number: rowIndex + 1,
    cells: columns.map((column) => ({
      session: column.sessions[rowIndex] || null,
      available: rowIndex < column.quota && !column.sessions[rowIndex],
      disabled: rowIndex >= column.quota,
    })),
  }));

  return { columns, rows, rowCount };
}

const COMPLETED_APPOINTMENT_STATUSES = new Set(['finalizado', 'concluido', 'completed']);

function completedAppointment(appointment) {
  return COMPLETED_APPOINTMENT_STATUSES.has(normalizePackageText(appointment?.status));
}

export function signatureAppointmentCandidates(patientPackage, sessions = [], appointments = [], serviceName = '') {
  const linkedAppointmentIds = new Set(
    activePackageSessions(sessions, patientPackage?.id)
      .map((session) => session?.appointment_id)
      .filter(Boolean)
      .map(String),
  );
  const targetService = normalizePackageText(serviceName);

  return appointments
    .filter((appointment) => {
      if (!completedAppointment(appointment)) return false;
      if (String(appointment?.patient_package_id || '') !== String(patientPackage?.id || '')) return false;
      if (String(appointment?.client_id || '') !== String(patientPackage?.client_id || '')) return false;
      if (linkedAppointmentIds.has(String(appointment?.id || ''))) return false;
      if (!targetService) return true;
      const appointmentService = normalizePackageText(appointment?.procedure);
      return appointmentService === targetService
        || appointmentService.includes(targetService)
        || targetService.includes(appointmentService);
    })
    .sort((left, right) => {
      const leftDate = `${left?.appointment_date || ''}T${left?.appointment_time || '00:00:00'}`;
      const rightDate = `${right?.appointment_date || ''}T${right?.appointment_time || '00:00:00'}`;
      return leftDate.localeCompare(rightDate) || String(left?.id || '').localeCompare(String(right?.id || ''));
    });
}

export function buildPackageSignatureDraft(patientPackage, sessions = [], appointment, serviceName = '') {
  if (!patientPackage?.id || !appointment?.id) return null;
  const occupiedNumbers = new Set(
    activePackageSessions(sessions, patientPackage.id)
      .map((session) => positiveInteger(session?.session_number))
      .filter(Boolean),
  );
  const total = positiveInteger(patientPackage.total_sessions, 1);
  const sessionNumber = Array.from({ length: total }, (_, index) => index + 1)
    .find((number) => !occupiedNumbers.has(number));
  if (!sessionNumber) return null;

  const date = String(appointment.appointment_date || '').slice(0, 10);
  const time = String(appointment.appointment_time || '12:00:00').slice(0, 8);
  return {
    patient_package_id: patientPackage.id,
    client_id: patientPackage.client_id,
    appointment_id: appointment.id,
    session_number: sessionNumber,
    service_name: appointment.procedure || serviceName || patientPackage.package_name,
    professional_name: appointment.professional || null,
    performed_at: date ? `${date}T${time || '12:00:00'}-03:00` : new Date().toISOString(),
    status: 'pending_signature',
    acknowledgment_text: `Confirmo a realizacao da sessao ${sessionNumber} de ${total} do pacote ${patientPackage.package_name || ''}.`,
  };
}

function packageServiceEntries(patientPackage) {
  const services = Array.isArray(patientPackage?.services) ? patientPackage.services : [];
  return services.map((service) => ({
    id: typeof service === 'object' ? service?.id || service?.service_id || null : null,
    name: typeof service === 'string' ? service : service?.nome || service?.name || '',
  })).filter((service) => service.id || service.name);
}

export function normalizePackageText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

export function packageAcceptsService(patientPackage, service) {
  const targetId = typeof service === 'object' ? service?.id || service?.service_id : null;
  const targetName = typeof service === 'object' ? service?.nome || service?.name : service;
  const entries = packageServiceEntries(patientPackage);
  if (!entries.length) return true;
  let entriesForName = entries;

  if (targetId) {
    const entriesWithId = entries.filter((entry) => entry.id);
    if (entriesWithId.some((entry) => String(entry.id) === String(targetId))) return true;
    entriesForName = entries.filter((entry) => !entry.id);
    if (entriesWithId.length > 0 && entriesForName.length === 0) return false;
  }

  const target = normalizePackageText(targetName);
  if (!target) return false;
  return entriesForName
    .map((entry) => normalizePackageText(entry.name))
    .some((entry) => entry === target || entry.includes(target) || target.includes(entry));
}

export function eligiblePatientPackages(packages = [], sessions = [], clientId, service, today = new Date()) {
  return packages.filter((patientPackage) => {
    if (String(patientPackage.client_id) !== String(clientId || '')) return false;
    const progress = packageProgress(patientPackage, sessions, today);
    return progress.status === 'active' && progress.remaining > 0 && packageAcceptsService(patientPackage, service);
  });
}

export function resolvePackageChoice(eligiblePackages = [], selectedPackageId = null) {
  if (eligiblePackages.length === 0) return { mode: 'none', packageId: null };
  if (eligiblePackages.length === 1) return { mode: 'automatic', packageId: eligiblePackages[0].id };
  const selected = eligiblePackages.find((item) => String(item.id) === String(selectedPackageId || ''));
  return selected
    ? { mode: 'selected', packageId: selected.id }
    : { mode: 'choose', packageId: null };
}

export function addMonthsToDate(dateValue, validityText) {
  const base = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
  const match = String(validityText || '').match(/(\d+)/);
  const amount = Math.max(1, Number(match?.[1]) || 6);
  if (/ano/i.test(String(validityText || ''))) base.setFullYear(base.getFullYear() + amount);
  else base.setMonth(base.getMonth() + amount);
  return [base.getFullYear(), String(base.getMonth() + 1).padStart(2, '0'), String(base.getDate()).padStart(2, '0')].join('-');
}
