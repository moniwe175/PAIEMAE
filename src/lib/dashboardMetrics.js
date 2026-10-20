import { appointmentPatientKey, isCompletedAppointment } from './patientAnalytics.js';

export function calculateMonthlyCareMetrics(appointments = [], monthStart, monthEnd) {
  const completed = appointments.filter(isCompletedAppointment);
  const completedInMonth = completed.filter((appointment) => {
    const date = String(appointment.appointment_date || '').slice(0, 10);
    return date && date >= monthStart && date <= monthEnd;
  });

  const visitsByPatient = new Map();
  completed.forEach((appointment) => {
    const key = appointmentPatientKey(appointment);
    if (!key) return;
    if (!visitsByPatient.has(key)) visitsByPatient.set(key, []);
    visitsByPatient.get(key).push(String(appointment.appointment_date || '').slice(0, 10));
  });

  const patientsInMonth = new Set(completedInMonth.map(appointmentPatientKey).filter(Boolean));
  const recurringPatients = [...patientsInMonth].filter((key) => {
    const visits = (visitsByPatient.get(key) || []).filter(Boolean);
    return visits.length >= 2;
  });

  return {
    completedAppointments: completedInMonth.length,
    uniquePatients: patientsInMonth.size,
    recurringPatients: recurringPatients.length,
    returnRatePct: patientsInMonth.size > 0
      ? Math.round((recurringPatients.length / patientsInMonth.size) * 100)
      : null,
  };
}

