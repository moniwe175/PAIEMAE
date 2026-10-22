import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCrmFunnelAnalytics } from '../src/lib/crmFunnelAnalytics.js';

const referenceDate = new Date('2026-10-22T12:00:00-03:00');

function appointment(id, clientId, date, status, overrides = {}) {
  return {
    id,
    client_id: clientId,
    client_phone: `2199999000${clientId}`,
    appointment_date: date,
    appointment_time: '10:00',
    status,
    procedure: 'Botox',
    valor: 300,
    created_at: `${date}T09:00:00-03:00`,
    ...overrides,
  };
}

function lead(id, clientId, createdAt, appointments, overrides = {}) {
  return {
    id,
    client_id: clientId,
    nome: `Lead ${id}`,
    telefone: `2199999000${clientId}`,
    origem: 'Instagram',
    responsavel: 'Recepção',
    created_at: createdAt,
    arquivado: false,
    status: 'aguardando_resposta',
    _journey: {
      key: appointments.some(row => row.status === 'finalizado') ? 'cliente' : 'interessada',
      client: { id: clientId, phone: `2199999000${clientId}` },
      appointments,
      isPayingClient: appointments.some(row => row.status === 'finalizado'),
      nextAppointment: appointments.find(row => row.appointment_date >= '2026-10-22' && row.status === 'confirmado') || null,
    },
    ...overrides,
  };
}

test('mede as microconversões do interessado até o retorno', () => {
  const a1 = appointment('a1', 1, '2026-10-05', 'finalizado', { created_at: '2026-10-02T10:00:00-03:00' });
  const a2 = appointment('a2', 1, '2026-10-20', 'finalizado');
  const canceled = appointment('a3', 2, '2026-10-06', 'cancelado', { created_at: '2026-10-02T12:00:00-03:00' });
  const rescheduled = appointment('a4', 2, '2026-10-25', 'confirmado', { valor: 500 });
  const leads = [
    lead('l1', 1, '2026-10-01T10:00:00-03:00', [a1, a2]),
    lead('l2', 2, '2026-10-02T10:00:00-03:00', [canceled, rescheduled]),
    lead('l3', 3, '2026-10-03T10:00:00-03:00', []),
  ];

  const result = buildCrmFunnelAnalytics({
    leads,
    appointments: [a1, a2, canceled, rescheduled],
    periodDays: 30,
    referenceDate,
  });

  assert.deepEqual(
    { leads: result.stages.leads, booked: result.stages.booked, attended: result.stages.attended, returned: result.stages.returned },
    { leads: 3, booked: 2, attended: 1, returned: 1 },
  );
  assert.ok(Math.abs(result.stages.leadToBookingRate - 66.6667) < 0.01);
  assert.equal(result.stages.bookingToAttendanceRate, 50);
  assert.equal(result.stages.attendanceToReturnRate, 100);
  assert.equal(result.recovery.failures, 1);
  assert.equal(result.recovery.recovered, 1);
  assert.equal(result.recovery.rate, 100);
  assert.equal(result.forecast.appointments, 1);
  assert.equal(result.forecast.value, 500);
});

test('não atribui ao lead um atendimento ocorrido antes de sua entrada', () => {
  const oldAppointment = appointment('old', 1, '2026-09-10', 'finalizado');
  const result = buildCrmFunnelAnalytics({
    leads: [lead('l1', 1, '2026-10-01T10:00:00-03:00', [oldAppointment])],
    appointments: [oldAppointment],
    periodDays: 30,
    referenceDate,
  });

  assert.equal(result.stages.leads, 1);
  assert.equal(result.stages.booked, 0);
  assert.equal(result.stages.attended, 0);
});

test('separa origem e procedimento usando apenas fatos do período', () => {
  const instagramAppointment = appointment('a1', 1, '2026-10-10', 'finalizado', { procedure: 'Botox', valor: 400 });
  const googleAppointment = appointment('a2', 2, '2026-10-11', 'finalizado', { procedure: 'Limpeza', valor: 200 });
  const leads = [
    lead('l1', 1, '2026-10-01T10:00:00-03:00', [instagramAppointment]),
    lead('l2', 2, '2026-10-02T10:00:00-03:00', [googleAppointment], { origem: 'Google' }),
  ];
  const result = buildCrmFunnelAnalytics({ leads, appointments: [instagramAppointment, googleAppointment], periodDays: 30, referenceDate });

  assert.equal(result.byOrigin.find(row => row.label === 'Instagram').finalRate, 100);
  assert.equal(result.byOrigin.find(row => row.label === 'Google').attended, 1);
  assert.deepEqual(result.procedures.map(row => [row.procedure, row.revenue]), [['Botox', 400], ['Limpeza', 200]]);
});

test('expõe pendências de dados e estados do Motor sem alterar suas regras', () => {
  const completedWithoutValue = appointment('a1', 1, '2026-10-10', 'finalizado', { valor: null, notes: null });
  const leads = [
    lead('l1', 1, '2026-10-01T10:00:00-03:00', [completedWithoutValue], { telefone: '', origem: '' }),
    lead('l2', 2, '2026-10-02T10:00:00-03:00', [], { telefone: '', instagram: '', email: '' }),
  ];
  const events = [
    { id: 'm1', status: 'sent', created_at: '2026-10-10T10:00:00Z' },
    { id: 'm2', status: 'failed', created_at: '2026-10-11T10:00:00Z' },
    { id: 'm3', status: 'expired', created_at: '2026-10-12T10:00:00Z' },
  ];
  const result = buildCrmFunnelAnalytics({ leads, appointments: [completedWithoutValue], automationEvents: events, periodDays: 30, referenceDate });

  assert.equal(result.motor.sent, 1);
  assert.equal(result.motor.failed, 1);
  assert.equal(result.motor.expired, 1);
  assert.equal(result.quality.items.find(item => item.key === 'completed_without_value').count, 1);
  assert.equal(result.quality.items.find(item => item.key === 'motor_failed').count, 2);
  assert.ok(result.quality.categoriesWithIssues > 0);
});

