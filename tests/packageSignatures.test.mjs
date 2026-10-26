import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildPackageSignatureDraft,
  signatureAppointmentCandidates,
} from '../src/lib/patientPackages.js';

const patientPackage = {
  id: 'pkg-1',
  client_id: 12,
  package_name: 'Drenagem 10 sessoes',
  total_sessions: 10,
  status: 'active',
};

test('libera assinatura somente para atendimento finalizado do mesmo pacote e cliente', () => {
  const appointments = [
    { id: 'finalizado', patient_package_id: 'pkg-1', client_id: 12, status: 'finalizado', procedure: 'Drenagem Linfatica', appointment_date: '2026-10-26', appointment_time: '08:30:00' },
    { id: 'aberto', patient_package_id: 'pkg-1', client_id: 12, status: 'confirmado', procedure: 'Drenagem Linfatica', appointment_date: '2026-10-27' },
    { id: 'outro-pacote', patient_package_id: 'pkg-2', client_id: 12, status: 'finalizado', procedure: 'Drenagem Linfatica', appointment_date: '2026-10-28' },
    { id: 'outro-cliente', patient_package_id: 'pkg-1', client_id: 99, status: 'finalizado', procedure: 'Drenagem Linfatica', appointment_date: '2026-10-29' },
  ];

  assert.deepEqual(
    signatureAppointmentCandidates(patientPackage, [], appointments, 'Drenagem Linfatica').map((item) => item.id),
    ['finalizado'],
  );
  assert.deepEqual(
    signatureAppointmentCandidates(patientPackage, [
      { patient_package_id: 'pkg-1', appointment_id: 'finalizado', status: 'signed' },
    ], appointments, 'Drenagem Linfatica'),
    [],
  );
});

test('monta assinatura na primeira sessao livre e vinculada ao agendamento', () => {
  const draft = buildPackageSignatureDraft(patientPackage, [
    { patient_package_id: 'pkg-1', session_number: 1, status: 'signed' },
  ], {
    id: 'apt-2',
    client_id: 12,
    patient_package_id: 'pkg-1',
    procedure: 'Drenagem Linfatica',
    professional: 'Bira',
    appointment_date: '2026-10-26',
    appointment_time: '08:30:00',
    status: 'finalizado',
  }, 'Drenagem Linfatica');

  assert.equal(draft.appointment_id, 'apt-2');
  assert.equal(draft.session_number, 2);
  assert.equal(draft.professional_name, 'Bira');
  assert.match(draft.performed_at, /^2026-10-26T08:30:00-03:00$/);
});

test('tela transforma sessao disponivel com atendimento finalizado em assinatura clicavel', async () => {
  const [page, panel, dialog] = await Promise.all([
    readFile(new URL('../src/pages/Assinaturas.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/patients/PackageSignaturesPanel.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/patients/PackageSignatureDialog.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /fetchAppointments\(\)/);
  assert.match(panel, /signatureAppointmentCandidates/);
  assert.match(panel, /Assinar sessao finalizada|Assinar sessão finalizada/);
  assert.match(dialog, /insertPatientPackageSession/);
  assert.match(dialog, /appointment_id: session\.appointment_id/);
});
