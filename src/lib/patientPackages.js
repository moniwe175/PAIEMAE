const ACTIVE_SESSION_STATUSES = new Set(['pending_signature', 'signed', 'legacy']);

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
