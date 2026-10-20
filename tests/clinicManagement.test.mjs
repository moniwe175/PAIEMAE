import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateClinicManagement,
  calculateCommercialHighlights,
} from '../src/lib/clinicManagement.js';

const appointments = [
  { appointment_date: '2026-09-10', client_id: 1, client_phone: '21999990001', client_name: 'Ana', status: 'finalizado', procedure: 'Botox', professional: 'Evelyn' },
  { appointment_date: '2026-10-02', client_id: 1, client_phone: '21999990001', client_name: 'Ana', status: 'finalizado', procedure: 'Botox', professional: 'Evelyn' },
  { appointment_date: '2026-10-03', client_id: 2, client_phone: '21999990002', client_name: 'Bia', status: 'finalizado', procedure: 'Limpeza', professional: 'Bárbara' },
  { appointment_date: '2026-10-04', client_id: 3, client_name: 'Clara', status: 'falta', procedure: 'Botox', professional: 'Evelyn' },
  { appointment_date: '2026-10-05', client_id: 4, client_name: 'Dani', status: 'cancelado', procedure: 'Botox', professional: 'Evelyn' },
  { appointment_date: '2026-10-06', client_id: 5, client_name: 'Eva', status: 'confirmado', procedure: 'Botox', professional: 'Evelyn' },
  { appointment_date: '2026-10-19', client_id: 6, client_name: 'Fabi', status: 'aguardando_confirmacao', procedure: 'Peeling', professional: 'Bárbara' },
  { appointment_date: '2026-10-21', client_id: 7, client_name: 'Gabi', status: 'confirmado', procedure: 'Peeling', professional: 'Bárbara' },
  { appointment_date: '2026-10-03', status: 'bloqueado', professional: 'Bárbara' },
];

test('resume operação real sem inventar quantidade de horários disponíveis', () => {
  const stats = calculateClinicManagement(appointments, '2026-10-01', '2026-10-19', '2026-10-19');

  assert.equal(stats.totalScheduled, 6);
  assert.equal(stats.completed, 2);
  assert.equal(stats.uniquePatients, 2);
  assert.equal(stats.attendanceRate, 67);
  assert.equal(stats.absences, 1);
  assert.equal(stats.cancellations, 1);
  assert.equal(stats.losses, 2);
  assert.equal(stats.returningPatients, 1);
  assert.equal(stats.firstVisitPatients, 1);
  assert.equal(stats.returnRate, 50);
  assert.equal(stats.pendingPast, 1);
  assert.equal(stats.topProcedure.name, 'Botox');
  assert.equal(stats.topProfessional.name, 'Bárbara');
  assert.equal(stats.upcomingSevenDays, 2);
  assert.equal(stats.awaitingConfirmation, 1);
  assert.equal('totalSlots' in stats, false);
  assert.equal('averageMinutes' in stats, false);
});

test('calcula vendas, clientes únicos, ticket, crescimento e campeão de faturamento', () => {
  const stats = calculateCommercialHighlights([
    { client: 'Ana', procedure: 'Botox', gross: 800 },
    { client: 'Ana', procedure: 'Retorno', gross: 200 },
    { client: 'Bia', procedure: 'Limpeza', gross: 400 },
  ], 1000, 10);

  assert.equal(stats.revenue, 1400);
  assert.equal(stats.sessions, 3);
  assert.equal(stats.uniquePayingClients, 2);
  assert.equal(stats.averageTicket, 1400 / 3);
  assert.equal(stats.ticketPerClient, 700);
  assert.equal(stats.dailyAverage, 140);
  assert.equal(stats.growthRate, 40);
  assert.equal(stats.topService.name, 'Botox');
  assert.equal(stats.topService.revenue, 800);
});

test('Relatórios usa resumo gerencial e remove os indicadores estimados da Agenda', () => {
  const agenda = fs.readFileSync(path.resolve('src/pages/Agenda.jsx'), 'utf8');
  const reports = fs.readFileSync(path.resolve('src/pages/Reports.jsx'), 'utf8');
  const panel = fs.readFileSync(path.resolve('src/components/reports/ClinicManagementPanel.jsx'), 'utf8');

  assert.doesNotMatch(agenda, /AgendaKpiPanel|Indicadores de Desempenho no Topo da Agenda/);
  assert.match(reports, /ClinicManagementPanel/);
  assert.match(panel, /Resumo gerencial da clínica/);
  assert.match(panel, /Clientes atendidos/);
  assert.match(panel, /O que mais vendeu/);
  assert.match(panel, /Precisam de reagendamento/);
  assert.match(panel, /Conferência dos dados/);
  assert.doesNotMatch(panel, /Taxa de Ocupação|Tempo Médio Atendimento|totalSlots/);
});
