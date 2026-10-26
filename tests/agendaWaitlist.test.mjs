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

test('combina vaga por dia, horario, servico e profissional', () => {
  const entry = {
    status: 'aguardando',
    service: 'Drenagem Linfatica',
    preferred_professional: 'Barbara',
    preferred_period: 'tarde',
    preferred_time: '15:00:00',
    waitlist_date: '2026-10-24',
  };

  assert.equal(waitlistMatchesSlot(entry, {
    date: '2026-10-24', service: 'Drenagem Linfática', professional: 'Barbara', time: '15:00',
  }), true);
  assert.equal(waitlistMatchesSlot(entry, {
    date: '2026-10-24', service: 'Drenagem Linfática', professional: 'Evelyn', time: '15:00',
  }), false);
  assert.equal(waitlistMatchesSlot(entry, {
    date: '2026-10-24', service: 'Drenagem Linfática', professional: 'Barbara', time: '15:30',
  }), false);
  assert.equal(waitlistMatchesSlot(entry, {
    date: '2026-10-25', service: 'Drenagem Linfática', professional: 'Barbara', time: '15:00',
  }), false);
});

test('mantem aguardando antes de contatada e respeita a ordem de chegada', () => {
  const entries = [
    { id: '3', status: 'contatada', created_at: '2026-10-20T09:00:00Z' },
    { id: '2', status: 'aguardando', created_at: '2026-10-22T09:00:00Z' },
    { id: '1', status: 'aguardando', created_at: '2026-10-21T09:00:00Z' },
  ];
  assert.deepEqual(sortWaitlistEntries(entries).map((entry) => entry.id), ['1', '2', '3']);
  assert.equal(isActiveWaitlistEntry({ status: 'agendada', waitlist_date: '2026-10-24' }, '2026-10-24'), false);
  assert.equal(isActiveWaitlistEntry({ status: 'aguardando', waitlist_date: '2026-10-25' }, '2026-10-24'), false);
});

test('retorna somente candidatos compativeis com a vaga liberada', () => {
  const slot = { date: '2026-10-24', service: 'Botox', professional: 'Evelyn', time: '10:00' };
  const candidates = compatibleWaitlistEntries([
    { id: 'ok', status: 'aguardando', service: 'Botox', preferred_time: '10:00:00', waitlist_date: '2026-10-24' },
    { id: 'outro-dia', status: 'aguardando', service: 'Botox', preferred_time: '10:00:00', waitlist_date: '2026-10-25' },
    { id: 'horario', status: 'aguardando', service: 'Botox', preferred_time: '10:30:00', waitlist_date: '2026-10-24' },
    { id: 'servico', status: 'aguardando', service: 'Massagem', preferred_time: '10:00:00', waitlist_date: '2026-10-24' },
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
  assert.match(agenda, /\[waitlistOpen, setWaitlistOpen\]\s*=\s*useState\(false\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.appointment_waitlist/i);
  assert.match(migration, /client_id integer NOT NULL REFERENCES public\.clients\(id\)/i);
  assert.match(migration, /waitlist_date date NOT NULL DEFAULT CURRENT_DATE/i);
  assert.match(migration, /preferred_time time without time zone/i);
  assert.match(migration, /client_id, lower\(service\), waitlist_date/i);
  assert.match(migration, /scheduled_appointment_id uuid REFERENCES public\.appointments\(id\)/i);
  assert.match(migration, /waitlist_date\s*=\s*NEW\.appointment_date::date/i);
  assert.doesNotMatch(migration, /waitlist_date::text\s*=\s*NEW\.appointment_date/i);
});

test('patch de producao compara as datas da espera e da agenda com tipos compativeis', async () => {
  const patch = await readFile(
    new URL('../fix_waitlist_appointment_date_type.sql', import.meta.url),
    'utf8',
  );

  assert.match(patch, /CREATE OR REPLACE FUNCTION public\.fn_close_waitlist_from_appointment/i);
  assert.match(patch, /waitlist_date\s*=\s*NEW\.appointment_date::date/i);
  assert.doesNotMatch(patch, /waitlist_date::text\s*=\s*NEW\.appointment_date/i);
});
