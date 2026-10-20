import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  appointmentPatientKey,
  derivePatientRelationship,
  isCompletedAppointment,
  resolvePatientSource,
  UNKNOWN_PATIENT_SOURCE,
} from '../src/lib/patientAnalytics.js';

test('não atribui Instagram quando o valor veio do padrão antigo', () => {
  assert.deepEqual(resolvePatientSource({ source: 'Instagram' }), {
    source: UNKNOWN_PATIENT_SOURCE,
    originalSource: 'Instagram',
    confirmed: false,
  });
});

test('mantém Instagram quando a origem foi confirmada', () => {
  const result = resolvePatientSource({
    source: 'Instagram',
    source_confirmed_at: '2026-10-19T12:00:00Z',
  });
  assert.equal(result.source, 'Instagram');
  assert.equal(result.confirmed, true);
});

test('preserva canais legados que só poderiam ter sido preenchidos explicitamente', () => {
  const result = resolvePatientSource({ source: 'Indicação' });
  assert.equal(result.source, 'Indicação');
  assert.equal(result.confirmed, true);
});

test('classifica relacionamento pelas consultas, sem confundir com pontos', () => {
  assert.equal(derivePatientRelationship(0), 'Sem histórico');
  assert.equal(derivePatientRelationship(1), 'Primeira visita');
  assert.equal(derivePatientRelationship(2), 'Recorrente');
  assert.equal(derivePatientRelationship(3), 'Fidelizado');
  assert.equal(derivePatientRelationship(5, true), 'Recorrente');
});

test('identifica atendimento concluído nos dois status usados pelo sistema', () => {
  assert.equal(isCompletedAppointment({ status: 'finalizado' }), true);
  assert.equal(isCompletedAppointment({ status: 'completed' }), true);
  assert.equal(isCompletedAppointment({ status: 'cancelado' }), false);
});

test('prioriza id e telefone para não juntar homônimos', () => {
  assert.equal(appointmentPatientKey({ client_id: 42, client_name: 'Maria' }), 'id:42');
  assert.equal(appointmentPatientKey({ client_phone: '+55 (21) 99999-0000' }), 'phone:21999990000');
  assert.equal(appointmentPatientKey({ client_name: ' Maria da Silva ' }), 'name:maria da silva');
});

test('contrato da tela e da migração impede origem fictícia', () => {
  const page = fs.readFileSync(new URL('../src/pages/Pacientes.jsx', import.meta.url), 'utf8');
  const sql = fs.readFileSync(new URL('../patient_source_truth.sql', import.meta.url), 'utf8');

  assert.doesNotMatch(page, /item\.source\s*\|\|\s*['"]Instagram['"]/);
  assert.match(page, /Não informado — configurar depois/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS source_confirmed_at timestamptz/i);
  assert.match(sql, /ALTER COLUMN source DROP DEFAULT/i);
});
