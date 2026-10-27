import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  appointmentMatchesPatient,
  appointmentPatientKey,
  buildPatientCommercialHistory,
  calculateLoyalPatientStats,
  calculateScheduledReturnStats,
  derivePatientRelationship,
  getIndexedAppointmentsForPatient,
  getAppointmentRecordedValue,
  getCommercialStatus,
  indexAppointmentsByPatient,
  isCompletedAppointment,
  resolvePatientSource,
  UNKNOWN_PATIENT_SOURCE,
} from '../src/lib/patientAnalytics.js';

test('resume fidelização somente sobre clientes com histórico real', () => {
  const stats = calculateLoyalPatientStats([
    { totalSessoes: 4, isEmRisco: false },
    { totalSessoes: 3, isEmRisco: true },
    { totalSessoes: 1, isEmRisco: false },
    { totalSessoes: 0, isEmRisco: false },
  ]);
  assert.deepEqual(stats, { loyal: 1, withHistory: 3, percentage: 33 });
});

test('mede retorno futuro apenas entre clientes atendidos no período', () => {
  const stats = calculateScheduledReturnStats([
    { totalSessoes: 2, ultimaVisitaIso: '2026-10-20', commercialHistory: { futureCount: 1 } },
    { totalSessoes: 1, ultimaVisitaIso: '2026-10-19', commercialHistory: { futureCount: 0 } },
    { totalSessoes: 4, ultimaVisitaIso: '2026-07-01', commercialHistory: { futureCount: 1 } },
    { totalSessoes: 0, ultimaVisitaIso: null, commercialHistory: { futureCount: 0 } },
  ], '2026-09-01');
  assert.deepEqual(stats, { scheduled: 1, withoutReturn: 1, recentlyAttended: 2, percentage: 50 });
});

test('não atribui Instagram quando o valor veio do padrão antigo', () => {
  assert.deepEqual(resolvePatientSource({ source: 'Instagram' }), {
    source: UNKNOWN_PATIENT_SOURCE,
    originalSource: 'Instagram',
    confirmed: false,
  });
});

test('mantém Instagram quando a origem foi confirmada', () => {
  const result = resolvePatientSource({
    source: 'Instagram',
    source_confirmed_at: '2026-10-19T12:00:00Z',
  });
  assert.equal(result.source, 'Instagram');
  assert.equal(result.confirmed, true);
});

test('preserva canais legados que só poderiam ter sido preenchidos explicitamente', () => {
  const result = resolvePatientSource({ source: 'Indicação' });
  assert.equal(result.source, 'Indicação');
  assert.equal(result.confirmed, true);
});

test('classifica relacionamento pelas consultas, sem confundir com pontos', () => {
  assert.equal(derivePatientRelationship(0), 'Sem histórico');
  assert.equal(derivePatientRelationship(1), 'Primeira visita');
  assert.equal(derivePatientRelationship(2), 'Recorrente');
  assert.equal(derivePatientRelationship(3), 'Fidelizado');
  assert.equal(derivePatientRelationship(5, true), 'Recorrente');
});

test('identifica atendimento concluído nos dois status usados pelo sistema', () => {
  assert.equal(isCompletedAppointment({ status: 'finalizado' }), true);
  assert.equal(isCompletedAppointment({ status: 'completed' }), true);
  assert.equal(isCompletedAppointment({ status: 'cancelado' }), false);
});

test('prioriza id e telefone para não juntar homônimos', () => {
  assert.equal(appointmentPatientKey({ client_id: 42, client_name: 'Maria' }), 'id:42');
  assert.equal(appointmentPatientKey({ client_phone: '+55 (21) 99999-0000' }), 'phone:21999990000');
  assert.equal(appointmentPatientKey({ client_name: ' Maria da Silva ' }), 'name:maria da silva');
});

test('vincula o histórico por id e usa telefone apenas quando o agendamento não tem id', () => {
  const patient = { id: 42, nome: 'Maria', telefone: '(21) 99999-0000' };
  assert.equal(appointmentMatchesPatient({ client_id: 42, client_name: 'Outra pessoa' }, patient), true);
  assert.equal(appointmentMatchesPatient({ client_id: 99, client_phone: '(21) 99999-0000' }, patient), false);
  assert.equal(appointmentMatchesPatient({ client_phone: '(21) 99999-0000' }, patient), true);
});

test('indexa agendamentos sem comparar toda a agenda para cada paciente', () => {
  const appointments = [
    { id: 'por-id', client_id: 42, client_name: 'Maria' },
    { id: 'por-telefone', client_phone: '(21) 99999-0000', client_name: 'Maria' },
    { id: 'por-nome', client_name: 'Maria' },
    { id: 'outro', client_id: 99, client_name: 'Outra pessoa' },
  ];
  const index = indexAppointmentsByPatient(appointments);
  const matches = getIndexedAppointmentsForPatient(index, {
    id: 42,
    nome: 'Maria',
    telefone: '(21) 99999-0000',
  });

  assert.deepEqual(matches.map((item) => item.id), ['por-id', 'por-telefone', 'por-nome']);
});

test('lê o valor informado na Agenda sem tratar texto comum como dinheiro', () => {
  assert.equal(getAppointmentRecordedValue({ notes: JSON.stringify({ valor: 650 }) }), 650);
  assert.equal(getAppointmentRecordedValue({ valor: 320 }), 320);
  assert.equal(getAppointmentRecordedValue({ notes: 'Observação clínica livre' }), 0);
});

test('classifica os estados comerciais sem contar cancelamento ou falta como atendimento', () => {
  assert.equal(getCommercialStatus({ status: 'finalizado' }), 'completed');
  assert.equal(getCommercialStatus({ status: 'cancelado' }), 'cancelled');
  assert.equal(getCommercialStatus({ status: 'cliente_faltou' }), 'no_show');
  assert.equal(getCommercialStatus({ status: 'confirmado' }), 'scheduled');
});

test('monta histórico comercial somente com valores de atendimentos finalizados', () => {
  const patient = { id: 'pac-1', nome: 'Ana' };
  const history = buildPatientCommercialHistory(patient, [
    { id: 'a1', client_id: 'pac-1', appointment_date: '2026-08-01', appointment_time: '10:00', procedure: 'Botox', professional: 'Evelyn', status: 'finalizado', notes: JSON.stringify({ valor: 500 }) },
    { id: 'a2', client_id: 'pac-1', appointment_date: '2026-09-01', appointment_time: '10:00', procedure: 'Botox', professional: 'Evelyn', status: 'finalizado', notes: JSON.stringify({ valor: 700 }) },
    { id: 'a3', client_id: 'pac-1', appointment_date: '2026-10-10', appointment_time: '10:00', procedure: 'Limpeza', professional: 'Bárbara', status: 'cancelado', notes: JSON.stringify({ valor: 300 }) },
    { id: 'a4', client_id: 'pac-1', appointment_date: '2026-11-01', appointment_time: '09:00', procedure: 'Retorno', professional: 'Evelyn', status: 'confirmado', notes: JSON.stringify({ valor: 100 }) },
    { id: 'outro', client_id: 'pac-2', appointment_date: '2026-09-01', status: 'finalizado', notes: JSON.stringify({ valor: 9999 }) },
  ], new Date('2026-10-23T12:00:00'));

  assert.equal(history.completedCount, 2);
  assert.equal(history.cancelledCount, 1);
  assert.equal(history.futureCount, 1);
  assert.equal(history.totalRecordedValue, 1200);
  assert.equal(history.averageTicket, 600);
  assert.equal(history.averageIntervalDays, 31);
  assert.equal(history.firstVisit, '2026-08-01');
  assert.equal(history.lastVisit, '2026-09-01');
  assert.equal(history.nextAppointment.id, 'a4');
  assert.deepEqual(history.topServices[0], { service: 'Botox', sessions: 2, recordedValue: 1200 });
  assert.equal(history.timeline.length, 4);
});

test('ticket observado ignora atendimentos sem valor informado em vez de presumir valor zero', () => {
  const history = buildPatientCommercialHistory({ id: 1 }, [
    { id: 'com-valor', client_id: 1, appointment_date: '2026-10-01', status: 'finalizado', notes: JSON.stringify({ valor: 500 }) },
    { id: 'sem-valor', client_id: 1, appointment_date: '2026-10-02', status: 'finalizado', notes: '{}' },
  ]);
  assert.equal(history.completedCount, 2);
  assert.equal(history.appointmentsWithValue, 1);
  assert.equal(history.averageTicket, 500);
});

test('contrato da tela e da migração impede origem fictícia', () => {
  const page = fs.readFileSync(new URL('../src/pages/Pacientes.jsx', import.meta.url), 'utf8');
  const sql = fs.readFileSync(new URL('../patient_source_truth.sql', import.meta.url), 'utf8');

  assert.doesNotMatch(page, /item\.source\s*\|\|\s*['"]Instagram['"]/);
  assert.match(page, /Não informado — configurar depois/);
  assert.match(page, /Histórico Comercial/);
  assert.match(page, /Clientes Fidelizados/);
  assert.match(page, /Retorno Já Agendado/);
  assert.doesNotMatch(page, /ResponsiveContainer|PieChart|retornoAgendadoChart/);
  assert.match(page, /conic-gradient/);
  assert.match(page, /paginados\.map/);
  assert.match(page, /indexAppointmentsByPatient/);
  assert.doesNotMatch(page, /Taxa de Indicação/);
  assert.match(page, /Atendimento finalizado não comprova pagamento/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS source_confirmed_at timestamptz/i);
  assert.match(sql, /ALTER COLUMN source DROP DEFAULT/i);
});
