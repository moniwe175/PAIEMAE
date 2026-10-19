import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTOMATIC_AUDIENCE_RULES,
  buildAutomaticAudienceInsights,
} from '../src/lib/automaticAudiences.js';

const rfm = [
  { client_id: 1, client_name: 'Ana', client_source: 'Instagram', dias_sem_atendimento: 10, atendimentos_total: 1, atendimentos_periodo: 1, valor_total: 200, valor_periodo: 200, ultimo_atendimento: '2026-10-09' },
  { client_id: 2, client_name: 'Bia', client_source: 'Instagram', dias_sem_atendimento: 20, atendimentos_total: 4, atendimentos_periodo: 2, valor_total: 2000, valor_periodo: 900, ultimo_atendimento: '2026-09-29' },
  { client_id: 3, client_name: 'Carla', client_source: 'Indicação', dias_sem_atendimento: 60, atendimentos_total: 2, atendimentos_periodo: 0, valor_total: 800, valor_periodo: 0, ultimo_atendimento: '2026-08-20' },
  { client_id: 4, client_name: 'Dora', client_source: 'Google', dias_sem_atendimento: 100, atendimentos_total: 3, atendimentos_periodo: 0, valor_total: 1200, valor_periodo: 0, ultimo_atendimento: '2026-07-11' },
  { client_id: 5, client_name: 'Eva', client_source: 'Instagram', dias_sem_atendimento: 150, atendimentos_total: 2, atendimentos_periodo: 0, valor_total: 500, valor_periodo: 0, ultimo_atendimento: '2026-05-22' },
];

const appointments = [
  { client_id: 1, status: 'finalizado', procedure: 'Limpeza de pele' },
  { client_id: 2, status: 'finalizado', procedure: 'Botox' },
  { client_id: 2, status: 'finalizado', procedure: 'Botox' },
  { client_id: 3, status: 'finalizado', procedure: 'Botox' },
  { client_id: 4, status: 'finalizado', procedure: 'Bioestimulador' },
  { client_id: 5, status: 'cancelado', procedure: 'Botox' },
];

test('cria públicos de ciclo de vida sem configuração manual', () => {
  const result = buildAutomaticAudienceInsights(rfm, appointments);
  const byId = Object.fromEntries(result.audiences.map(audience => [audience.id, audience]));

  assert.equal(byId.novos.count, 1);
  assert.equal(byId.recorrentes.count, 1);
  assert.equal(byId.retorno.count, 1);
  assert.equal(byId.risco.count, 1);
  assert.equal(byId.reativar.count, 1);
  assert.equal(AUTOMATIC_AUDIENCE_RULES.activeDays, 45);
  assert.equal(AUTOMATIC_AUDIENCE_RULES.returnDays, 90);
  assert.equal(AUTOMATIC_AUDIENCE_RULES.riskDays, 120);
});

test('calcula maior valor por percentil e ignora procedimentos não finalizados', () => {
  const result = buildAutomaticAudienceInsights(rfm, appointments);
  const highValue = result.audiences.find(audience => audience.id === 'alto_valor');
  const inactive = result.audiences.find(audience => audience.id === 'reativar');

  assert.equal(result.highValueThreshold, 1200);
  assert.deepEqual(highValue.members.map(member => member.name), ['Bia', 'Dora']);
  assert.equal(inactive.topService, null, 'agendamento cancelado não deve virar evidência de serviço');
});

test('perfil automático usa clientes reais que retornam e suas evidências', () => {
  const result = buildAutomaticAudienceInsights(rfm, appointments);

  assert.equal(result.profile.sampleCount, 2);
  assert.equal(result.profile.topSource, 'Indicação');
  assert.equal(result.profile.topService, 'Botox');
  assert.match(result.profile.summary, /Botox/);
  assert.ok(result.profile.averageVisits >= 2);
});

test('sem histórico exibe perfil inicial e públicos vazios, sem exigir formulário', () => {
  const result = buildAutomaticAudienceInsights([], []);

  assert.equal(result.totalClients, 0);
  assert.equal(result.profile.sampleCount, 0);
  assert.match(result.profile.summary, /automaticamente/);
  assert.ok(result.audiences.every(audience => audience.count === 0));
});

