import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assessFranchiseDataQuality,
  calculateCustomerMetrics,
  calculateFranchisorResult,
  calculateFranchiseReadiness,
  calculateInitialInvestment,
  calculateOperationalMetrics,
  calculateUnitDre,
  projectFranchiseScenario,
} from '../src/lib/franchiseMetrics.js';
import { calculateMonthlyCareMetrics } from '../src/lib/dashboardMetrics.js';

const model = {
  configured: true,
  tax_rate: 6,
  card_fee_rate: 2,
  royalty_type: 'percentual',
  royalty_value: 5,
  marketing_fund_type: 'percentual',
  marketing_fund_value: 2,
  monthly_pro_labore: 1000,
  monthly_debt_service: 500,
};

test('DRE sai da receita real e chega ao caixa do franqueado sem esconder taxas', () => {
  const dre = calculateUnitDre({
    transactions: [
      { row_type: 'receita', gross: 6000, commission_value: 300 },
      { row_type: 'receita', gross: 4000, commission_value: 200 },
      { row_type: 'despesa', gross: 9999 },
      { row_type: 'receita', gross: 1000, is_metadata: true },
    ],
    monthlyInput: { discounts: 500, supplies_cost: 1000, payroll: 2000, rent: 1000 },
    model,
  });

  assert.equal(dre.grossRevenue, 10000);
  assert.equal(dre.netRevenue, 9500);
  assert.equal(dre.taxes, 570);
  assert.equal(dre.cardFees, 190);
  assert.equal(dre.commissions, 500);
  assert.equal(dre.royalties, 475);
  assert.equal(dre.marketingFund, 190);
  assert.equal(dre.ebitda, 3575);
  assert.equal(dre.availableCash, 2075);
  assert.ok(dre.breakEvenRevenue > 0);
});

test('custos detalhados do mês substituem o fallback, sem dupla contagem', () => {
  const dre = calculateUnitDre({
    transactions: [{ row_type: 'receita', gross: 1000 }],
    monthlyInput: { rent: 300, utilities: 100 },
    model: { ...model, monthly_fixed_costs: 9999 },
  });
  assert.equal(dre.fixedCosts, 400);
});

test('CAC usa novos pagantes e LTV é observado na receita histórica', () => {
  const allTransactions = [
    { row_type: 'receita', date_ref: '2026-09-01', client: 'Ana', gross: 1000 },
    { row_type: 'receita', date_ref: '2026-10-10', client: 'Ana', gross: 500 },
    { row_type: 'receita', date_ref: '2026-10-11', client: 'Bia', gross: 800 },
    { row_type: 'receita', date_ref: '2026-10-12', client: 'Clara', gross: 700 },
  ];
  const result = calculateCustomerMetrics({
    allTransactions,
    periodTransactions: allTransactions.filter((row) => row.date_ref.startsWith('2026-10')),
    marketingInvestments: [{ channel: 'Instagram Ads', amount: 600, leads: 20, new_paying_clients: 2 }],
    contributionMarginPct: 50,
  });
  assert.equal(result.uniquePayingClients, 3);
  assert.equal(result.newPayingClients, 2);
  assert.equal(result.returningClients, 1);
  assert.equal(result.cac, 300);
  assert.equal(result.averageLifetimeRevenue, 1000);
  assert.equal(result.observedLtv, 500);
  assert.equal(result.channels[0].cpl, 30);
});

test('ocupação fica pendente até existir capacidade real configurada', () => {
  const appointments = [
    { status: 'finalizado' }, { status: 'finalizado' }, { status: 'falta' }, { status: 'cancelado' },
  ];
  const pending = calculateOperationalMetrics({ appointments });
  assert.equal(pending.capacityConfigured, false);
  assert.equal(pending.monthlyCapacity, null);
  assert.equal(pending.occupancyPct, null);
  assert.equal(pending.noShowRatePct, 25);

  const configured = calculateOperationalMetrics({
    appointments,
    model: { rooms_count: 2, professionals_capacity: 3, operating_days_month: 20, hours_per_day: 8, average_session_minutes: 60 },
  });
  assert.equal(configured.monthlyCapacity, 320);
  assert.equal(configured.occupancyPct, 0.63);
});

test('fundo de marketing nunca é tratado como lucro da franqueadora', () => {
  const result = calculateFranchisorResult({
    unitDres: [{ royalties: 1000, marketingFund: 400 }],
    networkInput: { franchisor_payroll: 300, marketing_fund_spend: 250 },
  });
  assert.equal(result.operatingRevenue, 1000);
  assert.equal(result.ebitda, 700);
  assert.equal(result.marketingFundCollected, 400);
  assert.equal(result.marketingFundBalance, 150);
});

test('simulador calcula investimento, VPL e payback sem alterar o realizado', () => {
  const investmentModel = {
    franchise_fee: 10000,
    construction_investment: 20000,
    equipment_investment: 20000,
    working_capital: 10000,
    projection_months: 36,
    annual_discount_rate: 12,
  };
  assert.equal(calculateInitialInvestment(investmentModel), 60000);
  const projection = projectFranchiseScenario({
    model: investmentModel,
    baseDre: { netRevenue: 20000, variableCostRatio: 40, fixedCosts: 5000, proLabore: 1000, debtService: 0 },
  });
  assert.equal(projection.rows.length, 36);
  assert.equal(projection.rows[0].cashFlow, 6000);
  assert.equal(projection.paybackMonth, 10);
  assert.equal(projection.viableInHorizon, true);
  assert.ok(projection.npv > 0);
});

test('qualidade de dados revela pendências em vez de fabricar indicador', () => {
  const quality = assessFranchiseDataQuality({ model: { configured: false }, transactions: [] });
  assert.equal(quality.score, 0);
  assert.equal(quality.missing.length, 5);
});

test('painel troca contagens duplicadas por produção e recorrência reais', () => {
  const result = calculateMonthlyCareMetrics([
    { client_phone: '21999990001', appointment_date: '2026-09-10', status: 'finalizado' },
    { client_phone: '21999990001', appointment_date: '2026-10-05', status: 'finalizado' },
    { client_phone: '21999990002', appointment_date: '2026-10-06', status: 'completed' },
    { client_phone: '21999990003', appointment_date: '2026-10-07', status: 'cancelado' },
  ], '2026-10-01', '2026-10-31');
  assert.deepEqual(result, {
    completedAppointments: 2,
    uniquePatients: 2,
    recurringPatients: 1,
    returnRatePct: 50,
  });
});

test('prontidão só aprova unidade-piloto com histórico, resultado, operação e governança', () => {
  const snapshot = {
    quality: { score: 95 },
    dre: {
      ebitda: 10000, ebitdaMarginPct: 20, profitabilityPct: 12, contributionMarginPct: 50,
      safetyMarginPct: 30, cashReserveMonths: 6, debtService: 0, debtCoverageRatio: null,
    },
    scenario: { paybackMonth: 24 },
    customers: { ltvCacRatio: 3.5, returningSharePct: 40 },
    operations: { noShowRatePct: 3, cancellationRatePct: 5, capacityConfigured: true, occupancyPct: 75 },
  };
  const closes = Array.from({ length: 6 }, (_, index) => ({
    unit_id: 'unit-1', period_month: `2026-${String(index + 4).padStart(2, '0')}-01`,
    status: 'fechado', snapshot: { dre: { ebitda: 9000 } },
  }));
  const documents = [
    'cof', 'contrato', 'manual_operacional', 'manual_marca', 'treinamento', 'demonstracoes_financeiras',
  ].map((document_type) => ({ document_type, status: 'valido', unit_id: 'unit-1' }));
  const readiness = calculateFranchiseReadiness({
    snapshot, closes, documents, unitId: 'unit-1', referenceDate: '2026-10-31',
    audits: [{ status: 'concluida', overall_score: 90 }],
  });
  assert.equal(readiness.status, 'ready');
  assert.equal(readiness.score, 100);
  assert.equal(readiness.historyMonths, 6);
  assert.equal(readiness.criticalCount, 0);
  assert.equal(readiness.pendingCount, 0);
});

test('um mês bom não libera franquia sem evidência histórica', () => {
  const readiness = calculateFranchiseReadiness({
    snapshot: {
      quality: { score: 95 },
      dre: { ebitda: 10000, ebitdaMarginPct: 20, profitabilityPct: 12, contributionMarginPct: 50, safetyMarginPct: 30, cashReserveMonths: 6, debtService: 0 },
      scenario: { paybackMonth: 24 },
      customers: { ltvCacRatio: 4, returningSharePct: 40 },
      operations: { noShowRatePct: 2, cancellationRatePct: 4, capacityConfigured: true, occupancyPct: 75 },
    },
    closes: [], documents: [], audits: [], unitId: 'unit-1', referenceDate: '2026-10-31',
  });
  assert.equal(readiness.status, 'building_evidence');
  assert.equal(readiness.historyMonths, 0);
  assert.ok(readiness.blockers.some((metric) => metric.metricKey === 'history_months'));
  assert.ok(readiness.blockers.some((metric) => metric.metricKey === 'required_documents_pct'));
});

test('contrato da tela, navegação, permissões e banco está completo', () => {
  const page = fs.readFileSync(new URL('../src/pages/Franquia.jsx', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const sidebar = fs.readFileSync(new URL('../src/components/ui/sidebar.jsx', import.meta.url), 'utf8');
  const migration = fs.readFileSync(new URL('../franchise_management_migration.sql', import.meta.url), 'utf8');
  const healthMigration = fs.readFileSync(new URL('../franchise_health_targets_migration.sql', import.meta.url), 'utf8');
  const dashboard = fs.readFileSync(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8');

  assert.match(app, /path="\/franquia"/);
  assert.match(sidebar, /Franquia & Viabilidade/);
  assert.match(page, /DRE da unidade/);
  assert.match(page, /LTV observado/);
  assert.match(page, /Payback simples/);
  assert.match(page, /Fundo coletado/);
  assert.match(page, /qualidade dos dados/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.franchise_units/i);
  assert.match(migration, /franchise_network_monthly_inputs/i);
  assert.match(migration, /franchise_compliance_documents/i);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /WHEN require_write THEN/i);
  assert.match(healthMigration, /profitable_months_pct/i);
  assert.match(healthMigration, /ON CONFLICT \(unit_id, metric_key, valid_from\) DO NOTHING/i);
  assert.match(page, /O que impede franquear agora/);
  assert.match(page, /Atual x meta x distância/);
  assert.doesNotMatch(dashboard, /label="Clientes Ativos"/);
  assert.doesNotMatch(dashboard, /label="Estoque Crítico"/);
  assert.match(dashboard, /label="Atendimentos Concluídos"/);
  assert.match(dashboard, /label="Pacientes Recorrentes"/);
});
