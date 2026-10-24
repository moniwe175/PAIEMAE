import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  compatibleWaitlistEntries,
  isActiveWaitlistEntry,
  sortWaitlistEntries,
  waitlistMatchesSlot,
  waitlistPeriodForTime,
} from '../src/lib/agendaWaitlist.js';

test('classifica o periodo do horario', () => {
  assert.equal(waitlistPeriodForTime('09:00'), 'manha');
  assert.equal(waitlistPeriodForTime('14:30'), 'tarde');
  assert.equal(waitlistPeriodForTime('18:00'), 'noite');
});

test('combina vaga por servico, profissional, periodo e validade', () => {
  const entry = {
    status: 'aguardando',
    service: 'Drenagem Linfatica',
    preferred_professional: 'Barbara',
    preferred_period: 'tarde',
    available_from: '2026-10-20',
    available_until: '2026-10-31',
  };

  assert.equal(waitlistMatchesSlot(entry, {
    date: '2026-10-24', service: 'Drenagem Linfática', professional: 'Barbara', time: '15:00',
  }), true);
  assert.equal(waitlistMatchesSlot(entry, {
    date: '2026-10-24', service: 'Drenagem Linfática', professional: 'Evelyn', time: '15:00',
  }), false);
  assert.equal(waitlistMatchesSlot(entry, {
    date: '2026-11-01', service: 'Drenagem Linfática', professional: 'Barbara', time: '15:00',
  }), false);
});

test('mantem aguardando antes de contatada e respeita a ordem de chegada', () => {
  const entries = [
    { id: '3', status: 'contatada', created_at: '2026-10-20T09:00:00Z' },
    { id: '2', status: 'aguardando', created_at: '2026-10-22T09:00:00Z' },
    { id: '1', status: 'aguardando', created_at: '2026-10-21T09:00:00Z' },
  ];
  assert.deepEqual(sortWaitlistEntries(entries).map((entry) => entry.id), ['1', '2', '3']);
  assert.equal(isActiveWaitlistEntry({ status: 'agendada' }, '2026-10-24'), false);
});

test('retorna somente candidatos compativeis com a vaga liberada', () => {
  const slot = { date: '2026-10-24', service: 'Botox', professional: 'Evelyn', time: '10:00' };
  const candidates = compatibleWaitlistEntries([
    { id: 'ok', status: 'aguardando', service: 'Botox', preferred_period: 'manha' },
    { id: 'periodo', status: 'aguardando', service: 'Botox', preferred_period: 'tarde' },
    { id: 'servico', status: 'aguardando', service: 'Massagem', preferred_period: 'manha' },
  ], slot);
  assert.deepEqual(candidates.map((entry) => entry.id), ['ok']);
});

test('contrato da lista usa Pacientes e permanece separada dos agendamentos', async () => {
  const [panel, agenda, migration] = await Promise.all([
    readFile(new URL('../src/components/agenda/WaitlistPanel.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Agenda.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../agenda_waitlist_migration.sql', import.meta.url), 'utf8'),
  ]);

  assert.match(panel, /fetchClients\(\)/);
  assert.doesNotMatch(panel, /crm_leads/);
  assert.match(agenda, /<WaitlistPanel/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.appointment_waitlist/i);
  assert.match(migration, /client_id integer NOT NULL REFERENCES public\.clients\(id\)/i);
  assert.match(migration, /scheduled_appointment_id uuid REFERENCES public\.appointments\(id\)/i);
});
