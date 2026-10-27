import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  allocatePaymentsAcrossItems,
  buildInitialComandaItem,
  calculateComandaTotals,
  normalizeSinglePayment,
  validateDigitalComanda,
} from '../src/lib/digitalComanda.js';

test('calcula itens avulsos e não transforma repasse em receita', () => {
  const result = calculateComandaTotals([
    { service_name: 'Botox', quantity: 1, unit_price: 600, discount: 50 },
    { service_name: 'Axila', quantity: 1, unit_price: 120, is_package: true },
  ]);
  assert.deepEqual(result, { total: 550, services: 2, packageItems: 1 });
});

test('rateia pagamento sem alterar o total da comanda', () => {
  const rows = allocatePaymentsAcrossItems([
    { service_name: 'Botox', quantity: 1, unit_price: 600 },
    { service_name: 'Axila', quantity: 1, unit_price: 100 },
    { service_name: 'Virilha', quantity: 1, unit_price: 0, is_package: true },
  ], { pix: 350, credito: 350 });
  assert.equal(rows.reduce((sum, item) => sum + item.payment.pix, 0), 350);
  assert.equal(rows.reduce((sum, item) => sum + item.payment.credito, 0), 350);
  assert.equal(rows[2].repasse, 1);
  assert.equal(rows[2].line_total, 0);
});

test('exige que pagamento feche com o valor dos serviços', () => {
  const items = [{ service_name: 'Botox', professional_name: 'Evelyn', quantity: 1, unit_price: 600 }];
  assert.equal(validateDigitalComanda({ items, payment: normalizeSinglePayment(600, 'pix') }), '');
  assert.match(validateDigitalComanda({ items, payment: normalizeSinglePayment(500, 'pix') }), /somam R\$ 500\.00/);
});

test('pré-preenche a comanda com o serviço e pacote do agendamento', () => {
  const item = buildInitialComandaItem({
    servico: 'Bioestimulador', profissional: 'Bira', valor: 900, patient_package_id: 'pkg-1',
  }, [{ id: 'svc-1', nome: 'Bioestimulador', preco: 850 }]);
  assert.equal(item.service_id, 'svc-1');
  assert.equal(item.is_package, true);
  assert.equal(item.unit_price, 0);
});

test('migração usa a mesma chave datada do sincronizador da planilha', () => {
  const sql = fs.readFileSync(new URL('../digital_comandas_migration.sql', import.meta.url), 'utf8');
  const appsScript = fs.readFileSync(new URL('../google-apps-script/web-app-endpoint.gs', import.meta.url), 'utf8');
  assert.match(sql, /service_date::text\s*\|\|\s*'_'\s*\|\|\s*v_comanda\.command_number/i);
  assert.match(appsScript, /var comandaStr = dateRef \+ '_' \+/);
  assert.match(sql, /digital_comanda_item_id/i);
});
