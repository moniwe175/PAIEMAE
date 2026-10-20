import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Agenda fica operacional e Relatórios mantém sua estrutura financeira original', () => {
  const agenda = fs.readFileSync(path.resolve('src/pages/Agenda.jsx'), 'utf8');
  const reports = fs.readFileSync(path.resolve('src/pages/Reports.jsx'), 'utf8');

  assert.doesNotMatch(agenda, /AgendaKpiPanel|Indicadores de Desempenho no Topo da Agenda/);
  assert.doesNotMatch(reports, /AgendaPerformancePanel|ClinicManagementPanel|Desempenho da Agenda|Resumo gerencial da clínica/);
  assert.match(reports, /Faturamento Total/);
  assert.match(reports, /Total de Sessões/);
  assert.match(reports, /Ticket Médio por Sessão/);
  assert.match(reports, /Histórico de Caixas/);
  assert.match(reports, /Ranking: Serviços Mais Vendidos/);
});
