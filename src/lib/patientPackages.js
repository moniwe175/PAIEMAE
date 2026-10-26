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

export function normalizePackageText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

export function packageAcceptsService(patientPackage, serviceName) {
  const target = normalizePackageText(serviceName);
  if (!target) return true;
  const services = packageServiceNames(patientPackage).map(normalizePackageText);
  if (!services.length) return true;
  return services.some((service) => service === target || service.includes(target) || target.includes(service));
}

export function eligiblePatientPackages(packages = [], sessions = [], clientId, serviceName, today = new Date()) {
  return packages.filter((patientPackage) => {
    if (String(patientPackage.client_id) !== String(clientId || '')) return false;
    const progress = packageProgress(patientPackage, sessions, today);
    return progress.status === 'active' && progress.remaining > 0 && packageAcceptsService(patientPackage, serviceName);
  });
}

export function addMonthsToDate(dateValue, validityText) {
  const base = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
  const match = String(validityText || '').match(/(\d+)/);
  const amount = Math.max(1, Number(match?.[1]) || 6);
  if (/ano/i.test(String(validityText || ''))) base.setFullYear(base.getFullYear() + amount);
  else base.setMonth(base.getMonth() + amount);
  return [base.getFullYear(), String(base.getMonth() + 1).padStart(2, '0'), String(base.getDate()).padStart(2, '0')].join('-');
}
