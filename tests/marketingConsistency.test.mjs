import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMarketingActions, buildMarketingScoreboard, calculateContentConsistency, findInstagramChannel,
} from '../src/lib/marketingConsistency.js';

test('constância mede dias publicados sem confundir vários posts no mesmo dia', () => {
  const result = calculateContentConsistency([
    { timestamp: '2026-10-20T10:00:00Z' }, { timestamp: '2026-10-20T18:00:00Z' },
    { timestamp: '2026-10-19T10:00:00Z' }, { timestamp: '2026-10-17T10:00:00Z' },
  ], 7, new Date('2026-10-20T20:00:00Z'));
  assert.equal(result.posts, 4);
  assert.equal(result.activeDays, 3);
  assert.equal(result.currentStreak, 2);
  assert.equal(result.postedToday, true);
  assert.equal(result.longestGap, 1);
});

test('placar prioriza vendas e preserva ausência como pendente', () => {
  const pending = buildMarketingScoreboard({ followers: 1200, mediaSummary: { totals: {} } });
  assert.equal(pending.sales, null);
  assert.equal(pending.followers, 1200);
  const score = buildMarketingScoreboard({
    channel: { interessados_total: 10, interessados_com_agendamento: 4, clientes_atendidos_vinculados: 2, recebimentos_atribuidos: 900 },
    mediaSummary: { totals: { shares: 8, reach: 1000, engagements: 120 } }, followers: 1500,
  });
  assert.equal(score.leadToMqlPct, 40);
  assert.equal(score.mqlToSalePct, 50);
  assert.equal(score.engagementRatePct, 12);
});

test('origem Instagram é localizada sem depender de maiúsculas ou acentos', () => {
  assert.equal(findInstagramChannel([{ canal: 'Instagram Orgânico', interessados_total: 3 }]).interessados_total, 3);
  assert.equal(findInstagramChannel([{ canal: 'Indicação' }]).interessados_total, 0);
  assert.equal(findInstagramChannel([]), null);
});

test('ações apontam falta de publicação e gargalos do funil', () => {
  const actions = buildMarketingActions({ consistency: { postedToday: false, lastPostDate: '2026-10-18' }, scoreboard: { leads: 5, mql: 0, sales: 0, shares: 0 } });
  assert.ok(actions.some((action) => action.title === 'Publicar hoje'));
  assert.ok(actions.some((action) => action.title === 'Leads não estão avançando'));
  assert.ok(actions.some((action) => action.title === 'Conteúdo sem encaminhamento registrado'));
});
