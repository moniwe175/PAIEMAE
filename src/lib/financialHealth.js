import { clinicDateKey } from './clinicDate';
import { calculateCustomerMetrics, calculateUnitDre, isRevenueTransaction, roundMetric, safeDivide, toNumber } from './franchiseMetrics.js';

export const FINANCIAL_TARGETS = {
  dataQualityPct: 95,
  contributionMarginPct: 40,
  ebitdaMarginPct: 15,
  netMarginPct: 10,
  safetyMarginPct: 20,
  cashReserveMonths: 3,
  debtCoverageRatio: 1.2,
  healthyMonths: 3,
  sustainableMonths: 6,
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

export function summarizeAccounts(entries = [], today = clinicDateKey()) {
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
  const start = new Date(`${startDate || clinicDateKey()}T12:00:00Z`);
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

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));

const previousMonth = (month) => {
  const [year, monthNumber] = String(month).slice(0, 7).split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return date.toISOString().slice(0, 7);
};

/**
 * Calcula a receita necessaria para cobrir todas as obrigacoes e ainda manter
 * as margens gerenciais definidas. Nao retorna meta quando a margem de
 * contribuicao e insuficiente ou os custos do mes ainda nao foram conferidos.
 */
export function calculateRevenueGuidance({
  dre = {}, ready = false, monthlyHistory = [], allTransactions = [], model = {}, asOfDate,
} = {}) {
  const contributionRatio = toNumber(dre.contributionMarginPct) / 100;
  const fixedObligations = toNumber(dre.fixedCosts) + toNumber(dre.proLabore) + toNumber(dre.debtService);
  const breakEvenRevenue = dre.breakEvenRevenue === null || dre.breakEvenRevenue === undefined
    ? null
    : toNumber(dre.breakEvenRevenue);
  const ebitdaTargetRatio = FINANCIAL_TARGETS.ebitdaMarginPct / 100;
  const cashTargetRatio = FINANCIAL_TARGETS.netMarginPct / 100;
  const safetyTargetRatio = FINANCIAL_TARGETS.safetyMarginPct / 100;

  const targetForDre = (candidateDre) => {
    const ratio = toNumber(candidateDre.contributionMarginPct) / 100;
    const obligations = toNumber(candidateDre.fixedCosts) + toNumber(candidateDre.proLabore) + toNumber(candidateDre.debtService);
    if (ratio <= Math.max(ebitdaTargetRatio, cashTargetRatio) || candidateDre.breakEvenRevenue === null) return null;
    const ebitdaTarget = toNumber(candidateDre.fixedCosts) / (ratio - ebitdaTargetRatio);
    const cashTarget = obligations / (ratio - cashTargetRatio);
    const safetyTarget = toNumber(candidateDre.breakEvenRevenue) / (1 - safetyTargetRatio);
    return roundMetric(Math.max(ebitdaTarget, cashTarget, safetyTarget));
  };

  const healthyRevenue = ready ? targetForDre(dre) : null;
  const marginInsufficient = ready && healthyRevenue === null;
  const gapToHealthyRevenue = healthyRevenue === null
    ? null
    : roundMetric(Math.max(0, healthyRevenue - toNumber(dre.netRevenue)));

  const asOfMonth = String(asOfDate || new Date().toISOString()).slice(0, 7);
  const closedMonths = monthlyHistory
    .filter((row) => String(row.period_month || '').slice(0, 7) < asOfMonth)
    .sort((a, b) => String(b.period_month).localeCompare(String(a.period_month)));
  let expectedMonth = previousMonth(asOfMonth);
  let consecutiveHealthyMonths = 0;
  for (const input of closedMonths) {
    const inputMonth = String(input.period_month || '').slice(0, 7);
    if (inputMonth !== expectedMonth || input.costs_confirmed !== true || input.rates_confirmed !== true || !model.configured) break;
    const monthTransactions = allTransactions.filter((row) => String(row.date_ref || '').startsWith(inputMonth));
    const monthDre = calculateUnitDre({ transactions: monthTransactions, monthlyInput: input, model });
    const monthTarget = targetForDre(monthDre);
    if (monthTarget === null || monthDre.netRevenue < monthTarget || monthDre.availableCash <= 0) break;
    consecutiveHealthyMonths += 1;
    expectedMonth = previousMonth(expectedMonth);
  }

  return {
    ready,
    breakEvenRevenue: ready ? breakEvenRevenue : null,
    healthyRevenue,
    gapToHealthyRevenue,
    marginInsufficient,
    contributionRatio: roundMetric(contributionRatio * 100),
    fixedObligations: ready ? roundMetric(fixedObligations) : null,
    consecutiveHealthyMonths,
    healthyMonthsRequired: FINANCIAL_TARGETS.healthyMonths,
    sustainableMonthsRequired: FINANCIAL_TARGETS.sustainableMonths,
    isHealthyHistory: consecutiveHealthyMonths >= FINANCIAL_TARGETS.healthyMonths,
    isSustainableHistory: consecutiveHealthyMonths >= FINANCIAL_TARGETS.sustainableMonths,
  };
}

/**
 * Nota conservadora: somente existe quando o fechamento esta completo. A nota
 * mede rentabilidade, distancia do ponto de equilibrio, caixa e obrigacoes.
 */
export function calculateBusinessHealth({ dre = {}, quality = {}, forecast = [], accounts = {}, guidance = {} } = {}) {
  const ready = quality.score >= FINANCIAL_TARGETS.dataQualityPct && guidance.ready && guidance.healthyRevenue !== null;
  if (!ready) {
    return {
      ready: false,
      score: null,
      label: 'Aguardando dados',
      detail: `${quality.score || 0}% do fechamento preenchido`,
      components: [],
    };
  }

  const component = (key, label, value, target, weight) => ({
    key, label, value: roundMetric(value), target, weight,
    points: roundMetric(clamp(safeDivide(value, target, 0)) * weight, 1),
  });
  const components = [
    component('contribution', 'Margem de contribuicao', dre.contributionMarginPct, FINANCIAL_TARGETS.contributionMarginPct, 10),
    component('ebitda', 'Margem EBITDA', dre.ebitdaMarginPct, FINANCIAL_TARGETS.ebitdaMarginPct, 15),
    component('cash_margin', 'Margem de caixa', dre.netCashMarginPct, FINANCIAL_TARGETS.netMarginPct, 10),
    component('safety', 'Margem de seguranca', dre.safetyMarginPct, FINANCIAL_TARGETS.safetyMarginPct, 20),
    component('reserve', 'Reserva de caixa', dre.cashReserveMonths, FINANCIAL_TARGETS.cashReserveMonths, 15),
    {
      key: 'forecast', label: 'Caixa em 13 semanas', weight: 20,
      points: forecast.some((week) => week.negative) ? 0 : 20,
      ok: !forecast.some((week) => week.negative),
    },
    {
      key: 'overdue', label: 'Contas vencidas', weight: 10,
      points: toNumber(accounts.payableOverdue) > 0 ? 0 : 10,
      ok: toNumber(accounts.payableOverdue) <= 0,
    },
  ];
  const score = Math.round(components.reduce((sum, item) => sum + item.points, 0));
  let label = score >= 85 ? 'Saudavel' : score >= 70 ? 'Estavel, com atencao' : score >= 50 ? 'Em risco' : 'Critico';
  if (score >= 85 && !guidance.isHealthyHistory) label = 'Bom mes, em validacao';
  return {
    ready: true,
    score,
    label,
    detail: guidance.isHealthyHistory
      ? `${guidance.consecutiveHealthyMonths} meses saudaveis consecutivos`
      : `${guidance.consecutiveHealthyMonths} de ${guidance.healthyMonthsRequired} meses saudaveis`,
    components,
  };
}

export function buildFinancialHealth({
  transactions = [], allTransactions = [], marketingInvestments = [], model = {}, monthlyInput = {}, monthlyHistory = [], entries = [], budgets = [], serviceCosts = [], startDate,
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
  const guidance = calculateRevenueGuidance({
    dre,
    ready: Boolean(dreConfirmed),
    monthlyHistory,
    allTransactions: allTransactions.length ? allTransactions : transactions,
    model,
    asOfDate: startDate,
  });
  const businessHealth = calculateBusinessHealth({ dre, quality, forecast, accounts, guidance });
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

  return { dre, customers, accounts, quality, forecast, services, alerts, budgetRows, guidance, businessHealth };
}
