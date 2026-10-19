import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveCrmJourney,
  deriveCrmPipelineStatus,
  enrichCrmLeads,
  findCrmClient,
  matchesCrmJourneyFilter,
  normalizeCrmPhone,
} from '../src/lib/crmJourney.js';

const TODAY = '2026-10-19';

function lead(overrides = {}) {
  return {
    id: 'lead-1',
    nome: 'Maria',
    telefone: '(11) 99999-0000',
    created_at: '2026-10-10T12:00:00Z',
    ...overrides,
  };
}

function appointment(id, date, status, overrides = {}) {
  return {
    id,
    client_id: 10,
    client_phone: '11999990000',
    appointment_date: date,
    appointment_time: '10:00:00',
    status,
    ...overrides,
  };
}

const clients = [{ id: 10, name: 'Maria da Silva', phone: '+55 (11) 99999-0000', total_spent: 900 }];

test('normaliza telefone brasileiro e localiza paciente sem vínculo manual', () => {
  assert.equal(normalizeCrmPhone('+55 (11) 99999-0000'), '11999990000');
  const result = findCrmClient(lead(), clients);
  assert.equal(result.client.id, 10);
  assert.equal(result.matchType, 'telefone');
});

test('mantém como interessada quando ainda não existe agendamento', () => {
  const journey = deriveCrmJourney(lead(), clients, [], TODAY);
  assert.equal(journey.key, 'interessada');
  assert.equal(journey.isAutomaticallyMatched, true);
  assert.equal(journey.recommendation.label, 'Conversar e agendar');
});

test('agendamento futuro válido transforma a pessoa em agendada', () => {
  const journey = deriveCrmJourney(lead(), clients, [
    appointment('a1', '2026-10-25', 'confirmado'),
  ], TODAY);
  assert.equal(journey.key, 'agendada');
  assert.equal(journey.nextAppointmentDate, '2026-10-25');
});

test('agendamento cancelado não qualifica como agendada', () => {
  const journey = deriveCrmJourney(lead(), clients, [
    appointment('a1', '2026-10-25', 'cancelado'),
  ], TODAY);
  assert.equal(journey.key, 'interessada');
  assert.equal(journey.nextAppointment, null);
});

test('primeiro atendimento finalizado transforma a pessoa em cliente', () => {
  const journey = deriveCrmJourney(lead(), clients, [
    appointment('a1', '2026-10-10', 'finalizado', { notes: JSON.stringify({ valor: 350 }) }),
  ], TODAY);
  assert.equal(journey.key, 'cliente');
  assert.equal(journey.completedCount, 1);
  assert.equal(journey.totalSpent, 350);
});

test('dois atendimentos finalizados em 90 dias qualificam como recorrente', () => {
  const journey = deriveCrmJourney(lead(), clients, [
    appointment('a1', '2026-09-01', 'finalizado'),
    appointment('a2', '2026-10-10', 'finalizado'),
  ], TODAY);
  assert.equal(journey.key, 'recorrente');
  assert.equal(journey.completedInRecurringWindow, 2);
});

test('falta mais recente sem novo horário entra na fila de reagendamento', () => {
  const journey = deriveCrmJourney(lead(), clients, [
    appointment('a1', '2026-09-01', 'finalizado'),
    appointment('a2', '2026-10-15', 'cliente_faltou'),
  ], TODAY);
  assert.equal(journey.key, 'faltou');
  assert.equal(journey.recommendation.label, 'Chamar para reagendar');
});

test('cliente vira em risco após 45 dias e inativa após 120 dias', () => {
  const risk = deriveCrmJourney(lead(), clients, [
    appointment('a1', '2026-08-20', 'finalizado'),
  ], TODAY);
  assert.equal(risk.key, 'em_risco');

  const inactive = deriveCrmJourney(lead(), clients, [
    appointment('a1', '2026-05-01', 'finalizado'),
  ], TODAY);
  assert.equal(inactive.key, 'inativa');
});

test('lead sem agendar há 30 dias vira inativa e os filtros usam a jornada derivada', () => {
  const enriched = enrichCrmLeads([
    lead({ created_at: '2026-08-01T12:00:00Z' }),
    lead({ id: 'lead-2', telefone: '11911110000' }),
  ], clients, [], TODAY);

  assert.equal(enriched[0]._journey.key, 'inativa');
  assert.equal(matchesCrmJourneyFilter(enriched[0], 'em_risco'), true);
  assert.equal(matchesCrmJourneyFilter(enriched[1], 'sem_agendamento'), true);
});

test('um novo horário prevalece sobre uma falta anterior', () => {
  const journey = deriveCrmJourney(lead(), clients, [
    appointment('a1', '2026-10-10', 'falta'),
    appointment('a2', '2026-10-22', 'aguardando_confirmacao'),
  ], TODAY);
  assert.equal(journey.key, 'agendada');
  assert.equal(journey.nextAppointment.id, 'a2');
});

test('pipeline persistido segue as quatro regras automáticas e a precedência da Agenda', () => {
  const freshLead = lead();
  assert.equal(deriveCrmPipelineStatus(freshLead, [], TODAY).status, 'aguardando_resposta');

  const scheduled = deriveCrmPipelineStatus(freshLead, [
    appointment('future', '2026-10-25', 'confirmado'),
  ], TODAY);
  assert.equal(scheduled.status, 'agendado');
  assert.equal(scheduled.appointment.id, 'future');

  const won = deriveCrmPipelineStatus(freshLead, [
    appointment('done', '2026-10-10', 'finalizado'),
    appointment('future', '2026-10-25', 'confirmado'),
  ], TODAY);
  assert.equal(won.status, 'encerrado_ganho', 'Atendimento finalizado tem precedência');
  assert.equal(won.appointment.id, 'done');

  const missed = deriveCrmPipelineStatus(freshLead, [
    appointment('missed', '2026-10-15', 'falta'),
  ], TODAY);
  assert.equal(missed.status, 'encerrado_perdido');
  assert.equal(missed.motivoPerda, 'automatico');

  const oldLead = lead({ created_at: '2026-09-01T12:00:00Z' });
  assert.equal(deriveCrmPipelineStatus(oldLead, [], TODAY).status, 'encerrado_perdido');
});
