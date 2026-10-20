import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { calculateAgendaPerformance } from '../src/lib/agendaPerformance.js';

const professionals = [
  { nome: 'Evelyn', ativo: true },
  { nome: 'Bárbara', ativo: true },
  { nome: 'Bira', ativo: true },
];

test('calcula ocupação, faltas, cancelamentos e duração sem contar bloqueios', () => {
  const stats = calculateAgendaPerformance([
    { appointment_date: '2026-10-19', professional: 'Evelyn', status: 'confirmado', notes: '{"duracao":90}' },
    { appointment_date: '2026-10-19', professional: 'Bárbara', status: 'falta', notes: '{"duracao":60}' },
    { appointment_date: '2026-10-19', professional: 'Bira', status: 'cancelado', notes: '{"duracao":30}' },
    { appointment_date: '2026-10-19', professional: 'Bira', status: 'desmarcado', notes: '{"duracao":30}' },
    { appointment_date: '2026-10-19', professional: 'Evelyn', status: 'bloqueado' },
  ], professionals, 'dia', '2026-10-19');

  assert.equal(stats.totalSlots, 39);
  assert.equal(stats.totalAppointments, 4);
  assert.equal(stats.occupied, 2);
  assert.equal(stats.occupancyRate, 5);
  assert.equal(stats.absences, 1);
  assert.equal(stats.noShowRate, 25);
  assert.equal(stats.cancellations, 2);
  assert.equal(stats.cancellationRate, 50);
  assert.equal(stats.averageMinutes, 90);
  assert.equal(stats.averageLabel, '1h 30min');
});

test('semana considera segunda a sábado e ignora domingo', () => {
  const stats = calculateAgendaPerformance([
    { appointment_date: '2026-10-19', status: 'finalizado', duracao: 45 }, // segunda
    { appointment_date: '2026-10-24', status: 'confirmado', duracao: 60 }, // sábado
    { appointment_date: '2026-10-25', status: 'confirmado', duracao: 60 }, // domingo
  ], professionals, 'semana', '2026-10-19');

  assert.equal(stats.totalAppointments, 2);
  assert.equal(stats.totalSlots, 13 * 3 * 6);
  assert.equal(stats.averageMinutes, 53);
});

test('indicadores saem da Agenda e passam para Relatórios', () => {
  const agenda = fs.readFileSync(path.resolve('src/pages/Agenda.jsx'), 'utf8');
  const reports = fs.readFileSync(path.resolve('src/pages/Reports.jsx'), 'utf8');
  const panel = fs.readFileSync(path.resolve('src/components/reports/AgendaPerformancePanel.jsx'), 'utf8');

  assert.doesNotMatch(agenda, /AgendaKpiPanel|Indicadores de Desempenho no Topo da Agenda/);
  assert.match(reports, /AgendaPerformancePanel/);
  assert.match(panel, /Desempenho da Agenda/);
  assert.match(panel, /Taxa de Ocupação/);
  assert.match(panel, /No-show Rate/);
  assert.match(panel, /Taxa de Cancelamento/);
  assert.match(panel, /Tempo Médio Atendimento/);
});
