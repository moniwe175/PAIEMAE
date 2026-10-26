import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  activePackageSessions,
  addMonthsToDate,
  eligiblePatientPackages,
  packageAcceptsService,
  packageProgress,
  patientsWithPackages,
} from '../src/lib/patientPackages.js';

const pkg = {
  id: 'pkg-1', client_id: 12, package_name: 'Drenagem 10 sessões',
  total_sessions: 10, status: 'active', expires_at: '2027-04-01',
  services: [{ nome: 'Drenagem Linfática', qtd: 10 }],
};

test('conta apenas sessões efetivamente consumidas e ignora estornos', () => {
  const sessions = [
    { patient_package_id: 'pkg-1', status: 'signed' },
    { patient_package_id: 'pkg-1', status: 'pending_signature' },
    { patient_package_id: 'pkg-1', status: 'legacy' },
    { patient_package_id: 'pkg-1', status: 'reversed' },
  ];
  assert.equal(activePackageSessions(sessions, 'pkg-1').length, 3);
  assert.deepEqual(packageProgress(pkg, sessions, new Date('2026-10-26T12:00:00')), {
    total: 10, used: 3, remaining: 7, percent: 30, status: 'active',
  });
});

test('identifica pacote concluído ou vencido sem inventar saldo', () => {
  const tenSessions = Array.from({ length: 10 }, () => ({ patient_package_id: 'pkg-1', status: 'signed' }));
  assert.equal(packageProgress(pkg, tenSessions, new Date('2026-10-26T12:00:00')).status, 'completed');
  assert.equal(packageProgress({ ...pkg, expires_at: '2026-01-01' }, [], new Date('2026-10-26T12:00:00')).status, 'expired');
});

test('oferece somente pacote do paciente, ativo, com saldo e serviço compatível', () => {
  assert.equal(packageAcceptsService(pkg, 'Drenagem Linfatica'), true);
  assert.equal(packageAcceptsService(pkg, 'Botox'), false);
  const list = eligiblePatientPackages([
    pkg,
    { ...pkg, id: 'outro', client_id: 99 },
    { ...pkg, id: 'botox', services: [{ nome: 'Botox' }] },
  ], [], 12, 'Drenagem Linfática', new Date('2026-10-26T12:00:00'));
  assert.deepEqual(list.map((item) => item.id), ['pkg-1']);
});

test('calcula validade do catálogo a partir da data de compra', () => {
  assert.equal(addMonthsToDate('2026-10-26', '6 meses'), '2027-04-26');
  assert.equal(addMonthsToDate('2026-10-26', '1 ano'), '2027-10-26');
});

test('a área de assinaturas lista somente pacientes que possuem pacote', () => {
  const patients = [
    { id: 12, nome: 'Ana' },
    { id: 99, nome: 'Beatriz' },
    { id: 34, nome: 'Carla' },
  ];
  const patientPackages = [
    { id: 'pacote-1', client_id: 12 },
    { id: 'pacote-2', client_id: 34 },
  ];
  assert.deepEqual(patientsWithPackages(patients, patientPackages).map((patient) => patient.nome), ['Ana', 'Carla']);
});

test('migração e interfaces preservam vínculo, assinatura e estorno', async () => {
  const [migration, patients, agenda, signatures, signaturesPage, app, sidebar] = await Promise.all([
    readFile(new URL('../patient_packages_migration.sql', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Pacientes.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Agenda.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/patients/PackageSignaturesPanel.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Assinaturas.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ui/sidebar.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.patient_packages/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.patient_package_sessions/i);
  assert.match(migration, /client_id integer NOT NULL REFERENCES public\.clients\(id\)/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS patient_package_id/i);
  assert.match(migration, /status = 'reversed'/i);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(patients, /<PatientPackagesPanel/);
  assert.doesNotMatch(patients, /PackageSignaturesPanel/);
  assert.match(agenda, /Utilizar pacote da paciente/);
  assert.match(agenda, /não duplicar a receita/);
  assert.match(signatures, /Aguardando assinatura/);
  assert.match(signatures, /Somente quem possui pacote aparece aqui/);
  assert.match(signatures, /<PackageSignatureDialog/);
  assert.match(signaturesPage, /<PackageSignaturesPanel/);
  assert.match(signaturesPage, /somente clientes que possuem pacote/i);
  assert.match(app, /path="\/assinaturas"/);
  assert.match(sidebar, /name: 'Assinaturas', path: '\/assinaturas'/);
});
