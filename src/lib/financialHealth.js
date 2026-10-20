import { calculateCustomerMetrics, calculateUnitDre, isRevenueTransaction, roundMetric, safeDivide, toNumber } from './franchiseMetrics.js';

export const FINANCIAL_TARGETS = {
  dataQualityPct: 95,
  contributionMarginPct: 40,
  ebitdaMarginPct: 15,
  netMarginPct: 10,
  safetyMarginPct: 20,
  cashReserveMonths: 3,
  debtCoverageRatio: 1.2,
};

const validEntry = (entry) => entry && entry.status !== 'cancelled' && entry.status !== 'cancelado';
const remaining = (entry) => Math.max(0, toNumber(entry.amount) - toNumber(entry.paid_amount));
const dateOnly = (value) => String(value || '').slice(0, 10);

const MONTHLY_CATEGORY_FIELDS = {
  folha: 'payroll', salarios: 'payroll', encargos: 'payroll_charges', beneficios: 'payroll_charges',
  aluguel: 'rent', condominio: 'rent', utilidades: 'utilities', agua_luz_telefone: 'utilities',
  sistemas: 'systems', contabilidade: 'accounting_legal', juridico: 'accounting_legal',
  manutencao: 'maintenance', seguros: 'insurance', marketing: 'marketing_expense', trafego_pago: 'marketing_expense',
  insumos: 'supplies_cost', materiais: 'supplies_cost', impostos: 'taxes_override', taxas_cartao: 'card_fees_override',
  descontos: 'discounts', estornos: 'refunds', devolucoes: 'refunds', pro_labore: 'pro_labore_override',
  dividas: 'debt_service_override', emprestimos: 'debt_service_override', investimentos: 'capex', capex: 'capex',
  outros_fixos: 'other_fixed_costs',
};

export function deriveMonthlyCosts(entries = [], periodMonth = '') {
  const prefix = String(periodMonth).slice(0, 7);
  const result = {};
  entries.filter(validEntry).filter((entry) => entry.entry_type === 'payable')
    .filter((entry) => dateOnly(entry.competence_date).startsWith(prefix))
    .forEach((entry) => {
      const category = String(entry.category || '').trim().toLowerCase();
      const field = MONTHLY_CATEGORY_FIELDS[category]
        || (entry.cost_behavior === 'fixed' ? 'other_fixed_costs' : null);
      if (field) result[field] = toNumber(result[field]) + toNumber(entry.amount);
    });
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, roundMetric(value)]));
}

export function summarizeAccounts(entries = [], today = new Date().toISOString().slice(0, 10)) {
  const summary = {
    receivableOpen: 0,
    payableOpen: 0,
    receivableOverdue: 0,
    payableOverdue: 0,
    overdueCount: 0,
    uncategorizedCount: 0,
  };

  entries.filter(validEntry).forEach((entry) => {
    const open = remaining(entry);
    if (open <= 0) return;
    const receivable = entry.entry_type === 'receivable';
    if (receivable) summary.receivableOpen += open;
    else summary.payableOpen += open;
    if (dateOnly(entry.due_date) && dateOnly(entry.due_date) < today) {
      summary.overdueCount += 1;
      if (receivable) summary.receivableOverdue += open;
      else summary.payableOverdue += open;
    }
    if (!entry.category) summary.uncategorizedCount += 1;
  });

  return Object.fromEntries(Object.entries(summary).map(([key, value]) => [
    key,
    key.endsWith('Count') ? value : roundMetric(value),
  ]));
}

export function buildCashForecast({ entries = [], currentCash, startDate, weeks = 13 } = {}) {
  const start = new Date(`${startDate || new Date().toISOString().slice(0, 10)}T12:00:00Z`);
  const cashKnown = currentCash !== null && currentCash !== undefined && currentCash !== '';
  let balance = cashKnown ? toNumber(currentCash) : null;

  return Array.from({ length: weeks }, (_, index) => {
    const from = new Date(start);
    from.setUTCDate(from.getUTCDate() + index * 7);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 6);
    const fromKey = from.toISOString().slice(0, 10);
    const toKey = to.toISOString().slice(0, 10);
    let inflows = 0;
    let outflows = 0;
    entries.filter(validEntry).forEach((entry) => {
      const due = dateOnly(entry.due_date);
      if (!due || due > toKey || (index > 0 && due < fromKey)) return;
      if (entry.entry_type === 'receivable') inflows += remaining(entry);
      else outflows += remaining(entry);
    });
    if (balance !== null) balance += inflows - outflows;
    return {
      week: index + 1,
      from: fromKey,
      to: toKey,
      inflows: roundMetric(inflows),
      outflows: roundMetric(outflows),
      balance: roundMetric(balance),
      negative: balance !== null && balance < 0,
    };
  });
}

export function assessFinancialData({ model = {}, monthlyInput = {}, entries = [], transactions = [] } = {}) {
  const checks = [
    { key: 'sales', label: 'Vendas importadas', ok: transactions.some(isRevenueTransaction), action: 'Sincronize a planilha de vendas.' },
    { key: 'model', label: 'Impostos e taxas conferidos', ok: Boolean(model.configured) && monthlyInput.rates_confirmed === true, action: 'Configure e confirme impostos e taxas de cartão.' },
    { key: 'costs', label: 'Custos do mês conferidos', ok: Boolean(monthlyInput.id) && monthlyInput.costs_confirmed === true, action: 'Preencha todos os custos e confirme a revisão do mês.' },
    { key: 'cash', label: 'Saldo bancário conciliado', ok: monthlyInput.closing_cash !== null && monthlyInput.closing_cash !== undefined && monthlyInput.cash_reconciled === true, action: 'Informe e confirme o saldo real das contas bancárias.' },
    { key: 'accounts', label: 'Contas a pagar e receber cadastradas', ok: entries.length > 0, action: 'Importe a planilha de contas a pagar e receber.' },
    { key: 'categories', label: 'Contas categorizadas', ok: entries.length > 0 && entries.every((entry) => Boolean(entry.category)), action: 'Categorize os lançamentos sem categoria.' },
  ];
  const score = Math.round(checks.filter((check) => check.ok).length / checks.length * 100);
  return { score, checks, missing: checks.filter((check) => !check.ok) };
}

export function calculateServiceProfitability({ transactions = [], serviceCosts = [], model = {}, ratesConfirmed = false } = {}) {
  const costs = new Map(serviceCosts.map((row) => [String(row.service_name || '').trim().toLowerCase(), row]));
  const services = new Map();
  transactions.filter(isRevenueTransaction).forEach((row) => {
    const name = String(row.procedure || 'Sem procedimento').trim();
    const key = name.toLowerCase();
    const current = services.get(key) || { name, sessions: 0, revenue: 0, commissions: 0 };
    current.sessions += 1;
    current.revenue += toNumber(row.gross);
    current.commissions += toNumber(row.commission_value);
    services.set(key, current);
  });

  return [...services.entries()].map(([key, service]) => {
    const configured = costs.get(key);
    if (!configured || !ratesConfirmed) return { ...service, configured: false, contribution: null, contributionPerHour: null };
    const materials = toNumber(configured.material_cost) * service.sessions;
    const taxes = service.revenue * (toNumber(model.tax_rate) / 100);
    const cardFees = service.revenue * (toNumber(model.card_fee_rate) / 100);
    const contribution = service.revenue - service.commissions - materials - taxes - cardFees;
    const totalHours = service.sessions * toNumber(configured.duration_minutes) / 60;
    return {
      ...service,
      configured: true,
      materials: roundMetric(materials),
      contribution: roundMetric(contribution),
      contributionMarginPct: roundMetric(safeDivide(contribution, service.revenue, 0) * 100),
      contributionPerHour: totalHours > 0 ? roundMetric(contribution / totalHours) : null,
    };
  }).sort((a, b) => toNumber(b.contribution, -Infinity) - toNumber(a.contribution, -Infinity));
}

export function buildFinancialHealth({
  transactions = [], allTransactions = [], marketingInvestments = [], model = {}, monthlyInput = {}, entries = [], budgets = [], serviceCosts = [], startDate,
} = {}) {
  const baseDre = calculateUnitDre({ transactions, monthlyInput, model });
  const capex = toNumber(monthlyInput.capex);
  const netCashAfterInvestments = baseDre.availableCash - capex;
  const dre = {
    ...baseDre,
    capex: roundMetric(capex),
    netCashAfterInvestments: roundMetric(netCashAfterInvestments),
    netCashMarginPct: roundMetric(safeDivide(netCashAfterInvestments, baseDre.netRevenue, 0) * 100),
  };
  const effectiveMarketing = marketingInvestments.length
    ? marketingInvestments
    : toNumber(monthlyInput.marketing_expense) > 0 ? [{ amount: monthlyInput.marketing_expense, channel: 'Marketing total' }] : [];
  const customers = calculateCustomerMetrics({
    allTransactions: allTransactions.length ? allTransactions : transactions,
    periodTransactions: transactions,
    marketingInvestments: effectiveMarketing,
    contributionMarginPct: monthlyInput.costs_confirmed === true && monthlyInput.rates_confirmed === true ? dre.contributionMarginPct : 0,
  });
  const accounts = summarizeAccounts(entries, startDate);
  const quality = assessFinancialData({ model, monthlyInput, entries, transactions });
  const currentCash = monthlyInput.cash_reconciled === true ? monthlyInput.closing_cash : null;
  const forecast = buildCashForecast({ entries, currentCash, startDate, weeks: 13 });
  const services = calculateServiceProfitability({ transactions, serviceCosts, model, ratesConfirmed: monthlyInput.rates_confirmed === true });
  const alerts = [];

  if (quality.score < FINANCIAL_TARGETS.dataQualityPct) alerts.push({ level: 'warning', title: 'Fechamento incompleto', detail: `${quality.missing.length} fonte(s) de dados ainda precisam ser preenchidas.`, action: quality.missing[0]?.action });
  if (accounts.payableOverdue > 0) alerts.push({ level: 'critical', title: 'Contas vencidas', detail: `${accounts.payableOverdue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em pagamentos vencidos.`, action: 'Regularize ou renegocie os vencimentos.' });
  if (accounts.receivableOverdue > 0) alerts.push({ level: 'warning', title: 'Recebimentos atrasados', detail: `${accounts.receivableOverdue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} a receber já venceram.`, action: 'Faça a cobrança e atualize o pagamento.' });
  const firstNegative = forecast.find((week) => week.negative);
  if (firstNegative) alerts.push({ level: 'critical', title: 'Caixa ficará negativo', detail: `A projeção fica negativa na semana ${firstNegative.week}.`, action: 'Antecipe recebimentos, adie gastos não essenciais ou negocie prazos.' });
  const dreConfirmed = quality.checks.find((check) => check.key === 'costs')?.ok
    && quality.checks.find((check) => check.key === 'model')?.ok;
  if (dreConfirmed && dre.ebitda < 0) alerts.push({ level: 'critical', title: 'Operação no prejuízo', detail: 'Os custos operacionais estão acima da receita líquida.', action: 'Revise preço, margem dos serviços e custos fixos.' });
  else if (dreConfirmed && dre.netCashAfterInvestments < 0) alerts.push({ level: 'warning', title: 'Caixa gerado no mês ficou negativo', detail: 'A operação e os investimentos consumiram mais caixa do que geraram.', action: 'Separe gastos recorrentes de investimentos e confira a fonte de financiamento.' });
  if (dreConfirmed && dre.breakEvenRevenue !== null && dre.netRevenue < dre.breakEvenRevenue) alerts.push({ level: 'warning', title: 'Abaixo do ponto de equilíbrio', detail: `Faltam ${(dre.breakEvenRevenue - dre.netRevenue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para cobrir as obrigações.`, action: 'Planeje vendas com margem, não apenas volume.' });
  services.filter((service) => service.configured && service.contribution < 0).forEach((service) => alerts.push({ level: 'critical', title: `${service.name} tem margem negativa`, detail: 'Cada venda deste serviço reduz o resultado.', action: 'Corrija preço, consumo de materiais ou comissão.' }));

  const actualByCategory = {
    folha: toNumber(monthlyInput.payroll) + toNumber(monthlyInput.payroll_charges),
    aluguel: toNumber(monthlyInput.rent),
    insumos: toNumber(monthlyInput.supplies_cost),
    marketing: toNumber(monthlyInput.marketing_expense),
    outros: toNumber(monthlyInput.utilities) + toNumber(monthlyInput.systems) + toNumber(monthlyInput.accounting_legal) + toNumber(monthlyInput.maintenance) + toNumber(monthlyInput.insurance) + toNumber(monthlyInput.other_fixed_costs),
  };
  const budgetRows = budgets.map((budget) => ({
    ...budget,
    actual: roundMetric(actualByCategory[budget.category] || 0),
    variance: roundMetric(toNumber(budget.budget_amount) - (actualByCategory[budget.category] || 0)),
  }));

  return { dre, customers, accounts, quality, forecast, services, alerts, budgetRows };
}
