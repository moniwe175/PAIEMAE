import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findUniqueExactClient,
  normalizeClientSearch,
  searchClients,
} from '../src/lib/clientSearch.js';

const clients = [
  { id: 1, nome: 'Iara Ferino Sinal Seguros', telefone: '(21) 98001-6724' },
  { id: 2, nome: 'Iury', telefone: '21976848545' },
  { id: 3, nome: 'Inês Palácio', telefone: '(21) 98742-3189' },
  { id: 4, nome: 'Maria Iury Silva', telefone: '(21) 99999-1111' },
];

test('ignora maiusculas e acentos ao pesquisar clientes', () => {
  assert.equal(normalizeClientSearch(' INÊS  PALÁCIO '), 'ines palacio');
  assert.equal(searchClients(clients, 'IURY')[0].id, 2);
});

test('coloca inicio do nome antes de palavra interna e de aproximacoes', () => {
  assert.deepEqual(searchClients(clients, 'Iur').map((client) => client.id), [2, 4]);
  assert.equal(searchClients(clients, 'Iuri')[0].id, 2);
});

test('encontra tambem por telefone e limita os resultados', () => {
  assert.equal(searchClients(clients, '8545')[0].id, 2);
  assert.equal(searchClients(clients, '', 2).length, 2);
});

test('seleciona automaticamente apenas quando o nome exato e unico', () => {
  assert.equal(findUniqueExactClient(clients, 'iury').id, 2);
  assert.equal(findUniqueExactClient([...clients, { id: 5, nome: 'IURY' }], 'iury'), null);
});
