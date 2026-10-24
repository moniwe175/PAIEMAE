import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildPatientDocumentContent,
  PATIENT_DOCUMENT_TYPES,
  patientDocumentStatus,
  validatePatientDocumentDraft,
} from '../src/lib/patientDocuments.js';

test('oferece exatamente os quatro documentos gerais solicitados', () => {
  assert.deepEqual(PATIENT_DOCUMENT_TYPES.map((item) => item.id), [
    'procedure_consent',
    'image_authorization',
    'responsibility_term',
    'service_agreement',
  ]);
});

test('gera consentimento identificado sem duplicar termo especifico do procedimento', () => {
  const content = buildPatientDocumentContent({
    type: 'procedure_consent',
    patientName: 'Maria Silva',
    procedureName: 'Toxina botulínica',
    professionalName: 'Dra. Evelyn',
  });
  assert.match(content, /Maria Silva/);
  assert.match(content, /Toxina botulínica/);
  assert.match(content, /termo específico correspondente/);
});

test('autorizacao de imagem preserva apenas finalidades escolhidas', () => {
  const content = buildPatientDocumentContent({
    type: 'image_authorization',
    patientName: 'Ana',
    imageScopes: ['marketing'],
  });
  assert.match(content, /site e redes sociais/);
  assert.doesNotMatch(content, /Conteúdo educativo/);
  assert.match(content, /interrupção de novos usos/);
});

test('exige procedimento e finalidade quando necessarios', () => {
  assert.match(validatePatientDocumentDraft({ clientId: '1', type: 'procedure_consent', content: 'x' }), /procedimento/);
  assert.match(validatePatientDocumentDraft({ clientId: '1', type: 'image_authorization', imageScopes: [], content: 'x' }), /finalidade/);
  assert.equal(validatePatientDocumentDraft({ clientId: '1', type: 'image_authorization', imageScopes: ['marketing'], content: 'x' }), '');
});

test('traduz os estados operacionais do documento', () => {
  assert.equal(patientDocumentStatus({ status: 'pending' }).label, 'Pendente');
  assert.equal(patientDocumentStatus({ status: 'signed' }).label, 'Assinado');
  assert.equal(patientDocumentStatus({ status: 'revoked' }).label, 'Revogado');
});

test('migracao mantem assinatura, versao, RLS e imutabilidade', async () => {
  const migration = await readFile(new URL('../patient_documents_migration.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.patient_documents/i);
  assert.match(migration, /client_id integer NOT NULL REFERENCES public\.clients\(id\)/i);
  assert.match(migration, /content_snapshot text NOT NULL/i);
  assert.match(migration, /signature_data_url text/i);
  assert.match(migration, /template_version integer NOT NULL/i);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /fn_protect_signed_patient_document/i);
  assert.match(migration, /status = 'pending'/i);
});

test('interface separa documentos das fichas clinicas', async () => {
  const [page, documents] = await Promise.all([
    readFile(new URL('../src/pages/Anamnese.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/anamnese/PatientDocuments.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(page, /Fichas clínicas/);
  assert.match(page, /Documentos e consentimentos/);
  assert.match(documents, /Novo documento/);
  assert.match(documents, /Confirmar assinatura/);
  assert.match(documents, /Revogar/);
});
