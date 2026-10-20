import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessFinancialData, buildCashForecast, buildFinancialHealth,
  calculateServiceProfitability, deriveMonthlyCosts, summarizeAccounts,
} from '../src/lib/financialHealth.js';
import { parseFinancialCsv } from '../src/lib/financialCsv.js';

const model = { configured: true, tax_rate: 6, card_fee_rate: 2 };
const transactions = [
  { row_type: 'receita', date_ref: '2026-10-10', gross: 1000, commission_value: 100, procedure: 'Botox', client: 'A' },
  { row_type: 'receita', date_ref: '2026-10-11', gross: 500, commission_value: 50, procedure: 'Limpeza', client: 'B' },
];

test('contas abertas e vencidas usam apenas o saldo restante', () => {
  const result = summarizeAccounts([
    { entry_type: 'payable', amount: 1000, paid_amount: 250, due_date: '2026-10-01', status: 'partial', category: 'aluguel' },
    { entry_type: 'receivable', amount: 600, paid_amount: 100, due_date: '2026-11-01', status: 'partial', category: 'pacote' },
    { entry_type: 'payable', amount: 300, paid_amount: 300, due_date: '2026-09-01', status: 'paid' },
  ], '2026-10-20');
  assert.equal(result.payableOpen, 750);
  assert.equal(result.payableOverdue, 750);
  assert.equal(result.receivableOpen, 500);
  assert.equal(result.overdueCount, 1);
});

test('fluxo de 13 semanas acumula entradas e saídas sem inventar saldo', () => {
  const entries = [
    { entry_type: 'receivable', amount: 1000, paid_amount: 0, due_date: '2026-10-22', status: 'open' },
    { entry_type: 'payable', amount: 1400, paid_amount: 0, due_date: '2026-10-25', status: 'open' },
  ];
  const known = buildCashForecast({ entries, currentCash: 500, startDate: '2026-10-20' });
  assert.equal(known.length, 13);
  assert.equal(known[0].balance, 100);
  const unknown = buildCashForecast({ entries, currentCash: null, startDate: '2026-10-20' });
  assert.equal(unknown[0].balance, null);
});

test('conta vencida entra imediatamente na primeira semana da projeção', () => {
  const rows = buildCashForecast({
    currentCash: 1000,
    startDate: '2026-10-20',
    entries: [{ entry_type: 'payable', amount: 400, paid_amount: 0, due_date: '2026-10-10', status: 'open' }],
  });
  assert.equal(rows[0].outflows, 400);
  assert.equal(rows[0].balance, 600);
});

test('rentabilidade do serviço permanece pendente até o custo ser configurado', () => {
  const pending = calculateServiceProfitability({ transactions, model, serviceCosts: [] });
  assert.equal(pending.find((row) => row.name === 'Botox').configured, false);
  assert.equal(pending.find((row) => row.name === 'Botox').contribution, null);
  const configured = calculateServiceProfitability({ transactions, model, ratesConfirmed: true, serviceCosts: [{ service_name: 'Botox', material_cost: 200, duration_minutes: 60 }] });
  assert.equal(configured.find((row) => row.name === 'Botox').contribution, 620);
  assert.equal(configured.find((row) => row.name === 'Botox').contributionPerHour, 620);
});

test('qualidade não considera saldo apenas digitado como conciliado', () => {
  const result = assessFinancialData({ model, transactions, entries: [], monthlyInput: { id: '1', rent: 2000, closing_cash: 5000, cash_reconciled: false } });
  assert.equal(result.checks.find((check) => check.key === 'cash').ok, false);
  assert.ok(result.score < 95);
});

test('saúde financeira alerta prejuízo e caixa negativo somente com base preenchida', () => {
  const result = buildFinancialHealth({
    transactions, model, startDate: '2026-10-20', serviceCosts: [], budgets: [],
    monthlyInput: { id: '1', rent: 3000, closing_cash: 100, cash_reconciled: true, costs_confirmed: true, rates_confirmed: true },
    entries: [{ entry_type: 'payable', description: 'Imposto', category: 'impostos', amount: 1000, paid_amount: 0, due_date: '2026-10-22', status: 'open' }],
  });
  assert.ok(result.alerts.some((alert) => alert.title === 'Operação no prejuízo'));
  assert.ok(result.alerts.some((alert) => alert.title === 'Caixa ficará negativo'));
  assert.equal(result.dre.netCashAfterInvestments, result.dre.availableCash);
});

test('importação CSV aceita moeda e datas brasileiras', () => {
  const rows = parseFinancialCsv('tipo;descricao;categoria;competencia;vencimento;valor;valor_pago;status\nPagar;Aluguel;aluguel;01/10/2026;10/10/2026;3.500,00;1.000,00;parcial');
  assert.equal(rows[0].entry_type, 'payable');
  assert.equal(rows[0].amount, 3500);
  assert.equal(rows[0].paid_amount, 1000);
  assert.equal(rows[0].due_date, '2026-10-10');
  assert.equal(rows[0].status, 'partial');
});

test('contas importadas preenchem os custos mensais sem contar recebíveis', () => {
  const costs = deriveMonthlyCosts([
    { entry_type: 'payable', category: 'aluguel', amount: 3000, competence_date: '2026-10-01', status: 'open' },
    { entry_type: 'payable', category: 'marketing', amount: 800, competence_date: '2026-10-05', status: 'paid' },
    { entry_type: 'receivable', category: 'aluguel', amount: 9000, competence_date: '2026-10-10', status: 'open' },
  ], '2026-10-01');
  assert.deepEqual(costs, { rent: 3000, marketing_expense: 800 });
});
