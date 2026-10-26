import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  activePackageSessions,
  addMonthsToDate,
  buildPackageSessionGrid,
  eligiblePatientPackages,
  isPackageRepasseTransaction,
  packageAcceptsService,
  packageProgress,
  patientsWithPackages,
  resolvePackageChoice,
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

test('prioriza o identificador estável do serviço e preserva pacotes antigos por nome', () => {
  const renamedService = { id: 'svc-botox', nome: 'Toxina Botulínica Facial' };
  assert.equal(packageAcceptsService({ services: [{ id: 'svc-botox', nome: 'Botox' }] }, renamedService), true);
  assert.equal(packageAcceptsService({ services: [{ id: 'svc-drenagem', nome: 'Botox' }] }, renamedService), false);
  assert.equal(packageAcceptsService({ services: [{ nome: 'Botox Facial' }] }, 'Botox'), true);
  assert.equal(packageAcceptsService({ services: [{ id: 'svc-drenagem', nome: 'Drenagem' }, { nome: 'Toxina Botulínica Facial' }] }, renamedService), true);
});

test('seleciona pacote único automaticamente e só pede escolha quando há conflito', () => {
  assert.deepEqual(resolvePackageChoice([], null), { mode: 'none', packageId: null });
  assert.deepEqual(resolvePackageChoice([{ id: 'unico' }], null), { mode: 'automatic', packageId: 'unico' });
  assert.deepEqual(resolvePackageChoice([{ id: 'a' }, { id: 'b' }], null), { mode: 'choose', packageId: null });
  assert.deepEqual(resolvePackageChoice([{ id: 'a' }, { id: 'b' }], 'b'), { mode: 'selected', packageId: 'b' });
});

test('calcula validade do catálogo a partir da data de compra', () => {
  assert.equal(addMonthsToDate('2026-10-26', '6 meses'), '2027-04-26');
  assert.equal(addMonthsToDate('2026-10-26', '1 ano'), '2027-10-26');
});

test('somente repasse real identifica uma sessão realizada do pacote', () => {
  assert.equal(isPackageRepasseTransaction({ repasse: 80, is_metadata: false, deleted_at: null }), true);
  assert.equal(isPackageRepasseTransaction({ repasse: 0, is_metadata: false, deleted_at: null }), false);
  assert.equal(isPackageRepasseTransaction({ repasse: 80, is_metadata: true, deleted_at: null }), false);
  assert.equal(isPackageRepasseTransaction({ repasse: 80, is_metadata: false, deleted_at: '2026-10-26T12:00:00Z' }), false);
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

test('monta uma grade de um serviço até o total de sessões do pacote', () => {
  const grid = buildPackageSessionGrid(pkg, [
    { id: 's1', patient_package_id: 'pkg-1', service_name: 'Drenagem Linfática', session_number: 1, status: 'signed' },
    { id: 's2', patient_package_id: 'pkg-1', service_name: 'Drenagem Linfática', session_number: 2, status: 'pending_signature' },
  ]);
  assert.equal(grid.columns.length, 1);
  assert.equal(grid.columns[0].name, 'Drenagem Linfática');
  assert.equal(grid.rowCount, 10);
  assert.equal(grid.rows[0].cells[0].session.id, 's1');
  assert.equal(grid.rows[1].cells[0].session.id, 's2');
  assert.equal(grid.rows[2].cells[0].available, true);
});

test('usa cada serviço como coluna e respeita o limite individual de sessões', () => {
  const grid = buildPackageSessionGrid({
    id: 'multi',
    package_name: 'Pacote combinado',
    total_sessions: 8,
    services: [{ nome: 'Botox', qtd: 3 }, { nome: 'Drenagem', qtd: 5 }],
  }, [
    { id: 'botox-1', patient_package_id: 'multi', service_name: 'Botox', session_number: 1, status: 'signed' },
    { id: 'drenagem-1', patient_package_id: 'multi', service_name: 'Drenagem', session_number: 2, status: 'pending_signature' },
  ]);
  assert.equal(grid.rowCount, 5);
  assert.deepEqual(grid.columns.map((column) => column.name), ['Botox', 'Drenagem']);
  assert.equal(grid.rows[0].cells[0].session.id, 'botox-1');
  assert.equal(grid.rows[0].cells[1].session.id, 'drenagem-1');
  assert.equal(grid.rows[3].cells[0].disabled, true);
  assert.equal(grid.rows[3].cells[1].available, true);
});

test('migração e interfaces preservam vínculo, assinatura e estorno', async () => {
  const [migration, repasseMigration, sheetSync, patients, agenda, signatures, signaturesPage, app, sidebar, packageCatalog] = await Promise.all([
    readFile(new URL('../patient_packages_migration.sql', import.meta.url), 'utf8'),
    readFile(new URL('../package_sessions_repasse_sync.sql', import.meta.url), 'utf8'),
    readFile(new URL('../google-apps-script/web-app-endpoint.gs', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Pacientes.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Agenda.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/patients/PackageSignaturesPanel.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Assinaturas.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ui/sidebar.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/services/PacotesSection.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.patient_packages/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.patient_package_sessions/i);
  assert.match(migration, /client_id integer NOT NULL REFERENCES public\.clients\(id\)/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS patient_package_id/i);
  assert.match(migration, /status = 'reversed'/i);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(repasseMigration, /DROP TRIGGER IF EXISTS trg_sync_package_session_from_appointment/i);
  assert.match(repasseMigration, /CREATE TRIGGER trg_normalize_sheet_package_repasse/i);
  assert.match(repasseMigration, /NEW\.repasse := NEW\.gross/i);
  assert.match(repasseMigration, /sheet_transaction_id uuid/i);
  assert.match(repasseMigration, /COALESCE\(NEW\.repasse, 0\) <= 0/i);
  assert.match(repasseMigration, /CREATE TRIGGER trg_sync_package_session_from_repasse_upsert/i);
  assert.match(repasseMigration, /CREATE TRIGGER trg_sync_package_session_from_repasse_delete/i);
  assert.match(sheetSync, /repasse: repasse \|\| 0/i);
  assert.match(sheetSync, /var gross = credito \+ debito \+ dinheiro \+ pix/i);
  assert.match(sheetSync, /rowTypeAtendimento = gross <= 0 && repasse <= 0 \? 'rascunho'/i);
  assert.match(patients, /<PatientPackagesPanel/);
  assert.doesNotMatch(patients, /PackageSignaturesPanel/);
  assert.match(agenda, /Pacote identificado automaticamente/);
  assert.match(agenda, /Selecione o serviço primeiro/);
  assert.match(agenda, /eligiblePackages\.length > 1/);
  assert.match(agenda, /só será descontada quando o repasse aparecer na planilha/i);
  assert.match(agenda, /service_id: item\.service_id/);
  assert.match(packageCatalog, /id: service\.id/);
  assert.match(signatures, /Abrir assinaturas/);
  assert.match(signatures, /Voltar para pacientes/);
  assert.match(signatures, /buildPackageSessionGrid/);
  assert.match(signatures, /Somente quem possui pacote aparece aqui/);
  assert.match(signatures, /<PackageSignatureDialog/);
  assert.match(signaturesPage, /<PackageSignaturesPanel/);
  assert.match(signaturesPage, /somente clientes que possuem pacote/i);
  assert.match(app, /path="\/assinaturas"/);
  assert.match(sidebar, /name: 'Assinaturas', path: '\/assinaturas'/);
});
