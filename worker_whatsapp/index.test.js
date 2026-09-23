import test from 'node:test';
import assert from 'node:assert/strict';

import { extractQrCode, mapEvolutionState, normalizePhone } from './index.js';

test('normalizePhone adiciona o DDI brasileiro quando necessário', () => {
  assert.equal(normalizePhone('(21) 99999-8888'), '5521999998888');
  assert.equal(normalizePhone('5521999998888'), '5521999998888');
});

test('normalizePhone rejeita telefone vazio ou curto', () => {
  assert.equal(normalizePhone(''), null);
  assert.equal(normalizePhone('1234'), null);
});

test('extractQrCode aceita os formatos retornados pela Evolution', () => {
  assert.equal(extractQrCode({ qrcode: { base64: 'data:image/png;base64,abc' } }), 'data:image/png;base64,abc');
  assert.equal(extractQrCode({ base64: 'data:image/png;base64,xyz' }), 'data:image/png;base64,xyz');
  assert.equal(extractQrCode({}), null);
});

test('mapEvolutionState converte os estados para a tela do PAIEMAE', () => {
  assert.equal(mapEvolutionState('open'), 'connected');
  assert.equal(mapEvolutionState('connecting'), 'connecting');
  assert.equal(mapEvolutionState('close'), 'disconnected');
});
