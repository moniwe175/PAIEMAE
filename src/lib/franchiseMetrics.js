const RECEITA_TYPES = new Set(['receita', 'revenue', 'venda']);
const COMPLETED_STATUSES = new Set(['finalizado', 'concluido', 'concluído', 'atendido']);
const NO_SHOW_STATUSES = new Set(['falta', 'cliente_faltou', 'nao_compareceu', 'não_compareceu']);
const CANCELED_STATUSES = new Set(['cancelado', 'cancelada', 'desmarcado', 'desmarcada']);

export const DEFAULT_FRANCHISE_HEALTH_TARGETS = [
  { metricKey: 'data_quality_score', label: 'Qualidade dos dados', category: 'Base confiável', targetValue: 90, warningValue: 75, criticalValue: 50, direction: 'higher_better', unit: '%', action: 'Completar custos, investimentos e vínculos que ainda estão pendentes.' },
  { metricKey: 'history_months', label: 'Histórico fechado', category: 'Base confiável', targetValue: 6, warningValue: 3, criticalValue: 1, direction: 'higher_better', unit: ' meses', action: 'Fechar competências consecutivas para provar repetibilidade do modelo.' },
  { metricKey: 'profitable_months_pct', label: 'Meses com EBITDA positivo', category: 'Base confiável', targetValue: 80, warningValue: 60, criticalValue: 40, direction: 'higher_better', unit: '%', action: 'Identificar os meses negativos e corrigir preço, mix, ocupação ou estrutura de custos.' },
  { metricKey: 'ebitda_margin_pct', label: 'Margem EBITDA da unidade', category: 'Financeiro', targetValue: 15, warningValue: 10, criticalValue: 0, direction: 'higher_better', unit: '%', action: 'Aumentar margem de contribuição e revisar custos fixos antes de expandir.' },
  { metricKey: 'net_cash_margin_pct', label: 'Lucratividade líquida', category: 'Financeiro', targetValue: 10, warningValue: 5, criticalValue: 0, direction: 'higher_better', unit: '%', action: 'Garantir que sobre caixa após custos, pró-labore e serviço da dívida.' },
  { metricKey: 'contribution_margin_pct', label: 'Margem de contribuição', category: 'Financeiro', targetValue: 40, warningValue: 30, criticalValue: 20, direction: 'higher_better', unit: '%', action: 'Revisar preços, insumos, comissões, impostos e taxas de recebimento.' },
  { metricKey: 'safety_margin_pct', label: 'Margem acima do equilíbrio', category: 'Financeiro', targetValue: 20, warningValue: 10, criticalValue: 0, direction: 'higher_better', unit: '%', action: 'Elevar receita recorrente ou reduzir o ponto de equilíbrio da operação.' },
  { metricKey: 'cash_reserve_months', label: 'Reserva de caixa', category: 'Financeiro', targetValue: 6, warningValue: 3, criticalValue: 1, direction: 'higher_better', unit: ' meses', action: 'Formar capital de giro suficiente para absorver sazonalidade e imprevistos.' },
  { metricKey: 'debt_coverage_ratio', label: 'Cobertura da dívida (DSCR)', category: 'Financeiro', targetValue: 1.5, warningValue: 1.2, criticalValue: 1, direction: 'higher_better', unit: 'x', action: 'Renegociar dívida ou elevar geração de caixa antes de assumir expansão.' },
  { metricKey: 'payback_months', label: 'Payback do franqueado', category: 'Investimento', targetValue: 36, warningValue: 48, criticalValue: 60, direction: 'lower_better', unit: ' meses', action: 'Reduzir investimento inicial ou melhorar o caixa mensal projetado.' },
  { metricKey: 'ltv_cac_ratio', label: 'Relação LTV/CAC', category: 'Clientes', targetValue: 3, warningValue: 2, criticalValue: 1, direction: 'higher_better', unit: 'x', action: 'Reduzir CAC e aumentar retenção, frequência e margem dos clientes.' },
  { metricKey: 'returning_share_pct', label: 'Clientes recorrentes no mês', category: 'Clientes', targetValue: 30, warningValue: 20, criticalValue: 10, direction: 'higher_better', unit: '%', action: 'Criar jornada de retorno baseada no procedimento e no ciclo real do paciente.' },
  { metricKey: 'no_show_rate_pct', label: 'Taxa de faltas', category: 'Operação', targetValue: 5, warningValue: 8, criticalValue: 12, direction: 'lower_better', unit: '%', action: 'Reforçar confirmação, lembrete e política de reagendamento.' },
  { metricKey: 'cancellation_rate_pct', label: 'Taxa de cancelamento', category: 'Operação', targetValue: 10, warningValue: 15, criticalValue: 20, direction: 'lower_better', unit: '%', action: 'Analisar motivos e ajustar confirmação, oferta e disponibilidade.' },
  { metricKey: 'occupancy_pct', label: 'Ocupação da capacidade real', category: 'Operação', targetValue: 70, warningValue: 55, criticalValue: 40, direction: 'higher_better', unit: '%', action: 'Configurar a capacidade real e equilibrar demanda, salas e profissionais.' },
  { metricKey: 'audit_score', label: 'Auditoria de padrão', category: 'Governança', targetValue: 85, warningValue: 70, criticalValue: 50, direction: 'higher_better', unit: '%', action: 'Realizar auditoria e concluir o plano de ação da unidade-piloto.' },
  { metricKey: 'required_documents_pct', label: 'Documentação essencial', category: 'Governança', targetValue: 100, warningValue: 75, criticalValue: 50, direction: 'higher_better', unit: '%', action: 'Validar COF, contrato, manuais, treinamento e demonstrações financeiras.' },
];

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const safeDivide = (numerator, denominator, fallback = null) => {
  const divisor = toNumber(denominator);
  return divisor === 0 ? fallback : toNumber(numerator) / divisor;
};

export const roundMetric = (value, decimals = 2) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};

const normalizeText = (value) => String(value || '').trim().toLocaleLowerCase('pt-BR');
const clientKey = (row) => normalizeText(row.client_id || row.client || row.client_name || row.client_phone);
const transactionDate = (row) => String(row.date_ref || row.created_at || '').slice(0, 10);
const appointmentDate = (row) => String(row.appointment_date || row.date_ref || row.created_at || '').slice(0, 10);

export const isRevenueTransaction = (row) => {
  if (!row || row.deleted_at || row.is_metadata === true) return false;
  const type = normalizeText(row.row_type || row.tipo || 'receita');
  return RECEITA_TYPES.has(type);
};

export const filterPeriod = (rows = [], startDate, endDate, getDate = transactionDate) =>
  rows.filter((row) => {
    const date = getDate(row);
    return date && (!startDate || date >= startDate) && (!endDate || date <= endDate);
  });

const resolveFee = (override, type, value, base) => {
  if (override !== null && override !== undefined && override !== '') return toNumber(override);
  if (type === 'fixo') return toNumber(value);
  if (type === 'isento') return 0;
  return base * (toNumber(value) / 100);
};

const configuredFixedCosts = (monthlyInput = {}, model = {}) => {
  const detailed = [
    'payroll', 'payroll_charges', 'rent', 'utilities', 'systems',
    'accounting_legal', 'maintenance', 'insurance', 'marketing_expense', 'other_fixed_costs',
  ].reduce((sum, key) => sum + toNumber(monthlyInput[key]), 0);
  return detailed > 0 ? detailed : toNumber(model.monthly_fixed_costs);
};

/** DRE gerencial da unidade. Fundo de marketing e royalties ficam separados. */
export function calculateUnitDre({ transactions = [], monthlyInput = {}, model = {} } = {}) {
  const revenueRows = transactions.filter(isRevenueTransaction);
  const grossRevenue = revenueRows.reduce((sum, row) => sum + toNumber(row.gross ?? row.amount), 0);
  const discounts = toNumber(monthlyInput.discounts);
  const refunds = toNumber(monthlyInput.refunds);
  const netRevenue = Math.max(0, grossRevenue - discounts - refunds);
  const commissions = revenueRows.reduce((sum, row) => sum + toNumber(row.commission_value), 0);
  const supplies = toNumber(monthlyInput.supplies_cost);
  const taxes = monthlyInput.taxes_override !== null && monthlyInput.taxes_override !== undefined
    ? toNumber(monthlyInput.taxes_override)
    : netRevenue * (toNumber(model.tax_rate) / 100);
  const cardFees = monthlyInput.card_fees_override !== null && monthlyInput.card_fees_override !== undefined
    ? toNumber(monthlyInput.card_fees_override)
    : netRevenue * (toNumber(model.card_fee_rate) / 100);
  const royalties = resolveFee(
    monthlyInput.royalty_override,
    model.royalty_type,
    model.royalty_value,
    netRevenue,
  );
  const marketingFund = resolveFee(
    monthlyInput.marketing_fund_override,
    model.marketing_fund_type,
    model.marketing_fund_value,
    netRevenue,
  );
  const fixedCosts = configuredFixedCosts(monthlyInput, model);
  const proLabore = monthlyInput.pro_labore_override ?? model.monthly_pro_labore;
  const debtService = monthlyInput.debt_service_override ?? model.monthly_debt_service;
  const contributionMargin = netRevenue - taxes - cardFees - commissions - supplies;
  const contributionAfterFranchiseFees = contributionMargin - royalties - marketingFund;
  const operatingProfitBeforeFranchiseFees = contributionMargin - fixedCosts;
  const ebitda = contributionAfterFranchiseFees - fixedCosts;
  const cashBeforeDebt = ebitda - toNumber(proLabore);
  const availableCash = cashBeforeDebt - toNumber(debtService);
  const contributionMarginPct = safeDivide(contributionAfterFranchiseFees, netRevenue, 0) * 100;
  const variableCosts = taxes + cardFees + commissions + supplies + royalties + marketingFund;
  const variableCostRatio = safeDivide(variableCosts, netRevenue, 0);
  const fixedObligations = fixedCosts + toNumber(proLabore) + toNumber(debtService);
  const breakEvenRevenue = variableCostRatio < 1 ? fixedObligations / (1 - variableCostRatio) : null;

  return {
    grossRevenue: roundMetric(grossRevenue),
    discounts: roundMetric(discounts),
    refunds: roundMetric(refunds),
    netRevenue: roundMetric(netRevenue),
    taxes: roundMetric(taxes),
    cardFees: roundMetric(cardFees),
    commissions: roundMetric(commissions),
    supplies: roundMetric(supplies),
    contributionMargin: roundMetric(contributionMargin),
    contributionAfterFranchiseFees: roundMetric(contributionAfterFranchiseFees),
    contributionMarginPct: roundMetric(contributionMarginPct),
    fixedCosts: roundMetric(fixedCosts),
    operatingProfitBeforeFranchiseFees: roundMetric(operatingProfitBeforeFranchiseFees),
    royalties: roundMetric(royalties),
    marketingFund: roundMetric(marketingFund),
    ebitda: roundMetric(ebitda),
    ebitdaMarginPct: roundMetric(safeDivide(ebitda, netRevenue, 0) * 100),
    proLabore: roundMetric(proLabore),
    debtService: roundMetric(debtService),
    debtCoverageRatio: toNumber(debtService) > 0 ? roundMetric(cashBeforeDebt / toNumber(debtService)) : null,
    availableCash: roundMetric(availableCash),
    cashRunwayMonths: ebitda < 0 && toNumber(monthlyInput.closing_cash) > 0
      ? roundMetric(toNumber(monthlyInput.closing_cash) / Math.abs(ebitda), 1)
      : null,
    cashReserveMonths: fixedObligations > 0
      ? roundMetric(toNumber(monthlyInput.closing_cash) / fixedObligations, 1)
      : null,
    profitabilityPct: roundMetric(safeDivide(availableCash, netRevenue, 0) * 100),
    breakEvenRevenue: roundMetric(breakEvenRevenue),
    safetyMarginPct: breakEvenRevenue === null
      ? null
      : roundMetric(safeDivide(netRevenue - breakEvenRevenue, netRevenue, 0) * 100),
    sessionCount: revenueRows.length,
    averageTicket: roundMetric(safeDivide(netRevenue, revenueRows.length, 0)),
    variableCostRatio: roundMetric(variableCostRatio * 100),
  };
}

export function calculateCustomerMetrics({
  allTransactions = [], periodTransactions = [], marketingInvestments = [], contributionMarginPct = 0,
} = {}) {
  const allRevenue = allTransactions.filter(isRevenueTransaction).filter((row) => clientKey(row));
  const periodRevenue = periodTransactions.filter(isRevenueTransaction).filter((row) => clientKey(row));
  const firstPurchase = new Map();
  const lifetimeRevenue = new Map();

  allRevenue.forEach((row) => {
    const key = clientKey(row);
    const date = transactionDate(row);
    if (!firstPurchase.has(key) || date < firstPurchase.get(key)) firstPurchase.set(key, date);
    lifetimeRevenue.set(key, (lifetimeRevenue.get(key) || 0) + toNumber(row.gross ?? row.amount));
  });

  const periodDates = periodRevenue.map(transactionDate).filter(Boolean).sort();
  const startDate = periodDates[0] || '';
  const endDate = periodDates[periodDates.length - 1] || '';
  const payingKeys = new Set(periodRevenue.map(clientKey));
  const newPayingKeys = new Set(
    [...payingKeys].filter((key) => {
      const first = firstPurchase.get(key);
      return first && (!startDate || first >= startDate) && (!endDate || first <= endDate);
    }),
  );
  const returningKeys = new Set([...payingKeys].filter((key) => !newPayingKeys.has(key)));
  const marketingSpend = marketingInvestments.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const cac = newPayingKeys.size > 0 ? marketingSpend / newPayingKeys.size : null;
  const averageLifetimeRevenue = lifetimeRevenue.size > 0
    ? [...lifetimeRevenue.values()].reduce((a, b) => a + b, 0) / lifetimeRevenue.size
    : null;
  const ltv = averageLifetimeRevenue === null
    ? null
    : averageLifetimeRevenue * Math.max(0, toNumber(contributionMarginPct)) / 100;

  const visitsByClient = new Map();
  allRevenue.forEach((row) => {
    const key = clientKey(row);
    if (!visitsByClient.has(key)) visitsByClient.set(key, []);
    visitsByClient.get(key).push(transactionDate(row));
  });
  visitsByClient.forEach((dates) => dates.sort());
  const latestDate = [...visitsByClient.values()].flat().sort().at(-1);
  const retentionWithinDays = (days) => {
    if (!latestDate) return null;
    const latestTime = new Date(`${latestDate}T12:00:00Z`).getTime();
    const eligible = [...visitsByClient.values()].filter((dates) => {
      const first = new Date(`${dates[0]}T12:00:00Z`).getTime();
      return latestTime - first >= days * 86400000;
    });
    if (!eligible.length) return null;
    const retained = eligible.filter((dates) => {
      const first = new Date(`${dates[0]}T12:00:00Z`).getTime();
      return dates.slice(1).some((date) => {
        const visit = new Date(`${date}T12:00:00Z`).getTime();
        return visit > first && visit - first <= days * 86400000;
      });
    }).length;
    return roundMetric((retained / eligible.length) * 100);
  };
  const allIntervals = [];
  visitsByClient.forEach((dates) => {
    for (let index = 1; index < dates.length; index += 1) {
      const previous = new Date(`${dates[index - 1]}T12:00:00Z`).getTime();
      const current = new Date(`${dates[index]}T12:00:00Z`).getTime();
      allIntervals.push((current - previous) / 86400000);
    }
  });

  const byChannel = new Map();
  marketingInvestments.forEach((row) => {
    const channel = row.channel || 'Não informado';
    const current = byChannel.get(channel) || { channel, investment: 0, leads: 0, newPayingClients: 0 };
    current.investment += toNumber(row.amount);
    current.leads += toNumber(row.leads);
    current.newPayingClients += toNumber(row.new_paying_clients);
    byChannel.set(channel, current);
  });
  const channels = [...byChannel.values()].map((row) => ({
    ...row,
    cpl: row.leads > 0 ? roundMetric(row.investment / row.leads) : null,
    cac: row.newPayingClients > 0 ? roundMetric(row.investment / row.newPayingClients) : null,
    conversionPct: row.leads > 0 ? roundMetric((row.newPayingClients / row.leads) * 100) : null,
  }));

  return {
    uniquePayingClients: payingKeys.size,
    newPayingClients: newPayingKeys.size,
    returningClients: returningKeys.size,
    returningSharePct: roundMetric(safeDivide(returningKeys.size, payingKeys.size, 0) * 100),
    marketingSpend: roundMetric(marketingSpend),
    cac: roundMetric(cac),
    averageLifetimeRevenue: roundMetric(averageLifetimeRevenue),
    observedLtv: roundMetric(ltv),
    ltvCacRatio: cac && ltv !== null ? roundMetric(ltv / cac) : null,
    averagePurchaseFrequency: lifetimeRevenue.size ? roundMetric(allRevenue.length / lifetimeRevenue.size, 1) : null,
    averageDaysBetweenPurchases: allIntervals.length
      ? roundMetric(allIntervals.reduce((sum, value) => sum + value, 0) / allIntervals.length, 1)
      : null,
    repurchase30Pct: retentionWithinDays(30),
    repurchase60Pct: retentionWithinDays(60),
    repurchase90Pct: retentionWithinDays(90),
    channels,
  };
}

export function calculateOperationalMetrics({ appointments = [], transactions = [], model = {} } = {}) {
  const completed = appointments.filter((row) => COMPLETED_STATUSES.has(normalizeText(row.status)));
  const noShows = appointments.filter((row) => NO_SHOW_STATUSES.has(normalizeText(row.status)));
  const canceled = appointments.filter((row) => CANCELED_STATUSES.has(normalizeText(row.status)));
  const decided = completed.length + noShows.length + canceled.length;
  const procedureMap = new Map();
  transactions.filter(isRevenueTransaction).forEach((row) => {
    const name = row.procedure || 'Não informado';
    const current = procedureMap.get(name) || { name, sessions: 0, revenue: 0 };
    current.sessions += 1;
    current.revenue += toNumber(row.gross ?? row.amount);
    procedureMap.set(name, current);
  });
  const procedures = [...procedureMap.values()]
    .map((row) => ({ ...row, revenue: roundMetric(row.revenue), averageTicket: roundMetric(row.revenue / row.sessions) }))
    .sort((a, b) => b.revenue - a.revenue);

  const capacityConfigured = [
    model.rooms_count, model.professionals_capacity, model.operating_days_month,
    model.hours_per_day, model.average_session_minutes,
  ].every((value) => toNumber(value) > 0);
  let monthlyCapacity = null;
  let occupancyPct = null;
  if (capacityConfigured) {
    const parallelCapacity = Math.min(toNumber(model.rooms_count), toNumber(model.professionals_capacity));
    monthlyCapacity = Math.floor(
      parallelCapacity * toNumber(model.operating_days_month) * toNumber(model.hours_per_day)
      * 60 / toNumber(model.average_session_minutes),
    );
    occupancyPct = roundMetric(safeDivide(completed.length, monthlyCapacity, 0) * 100);
  }

  return {
    appointments: appointments.length,
    completed: completed.length,
    noShows: noShows.length,
    canceled: canceled.length,
    noShowRatePct: roundMetric(safeDivide(noShows.length, decided, 0) * 100),
    cancellationRatePct: roundMetric(safeDivide(canceled.length, decided, 0) * 100),
    monthlyCapacity,
    occupancyPct,
    capacityConfigured,
    procedures,
  };
}

export const calculateInitialInvestment = (model = {}) => roundMetric([
  'franchise_fee', 'construction_investment', 'equipment_investment', 'initial_inventory',
  'preopening_marketing', 'licenses_investment', 'working_capital', 'other_initial_investment',
].reduce((sum, key) => sum + toNumber(model[key]), 0));

function calculateIrr(cashFlows) {
  if (!cashFlows.some((v) => v < 0) || !cashFlows.some((v) => v > 0)) return null;
  let low = -0.9999;
  let high = 10;
  const npv = (rate) => cashFlows.reduce((sum, flow, index) => sum + flow / ((1 + rate) ** index), 0);
  if (npv(low) * npv(high) > 0) return null;
  for (let i = 0; i < 160; i += 1) {
    const mid = (low + high) / 2;
    if (npv(mid) > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

export function projectFranchiseScenario({
  model = {}, baseDre = {}, assumptions = {}, months,
} = {}) {
  const initialInvestment = calculateInitialInvestment(model);
  const projectionMonths = Math.max(1, Math.round(toNumber(months || assumptions.months || model.projection_months, 36)));
  const initialRevenue = toNumber(assumptions.initialRevenue, baseDre.netRevenue);
  const monthlyGrowthPct = toNumber(assumptions.monthlyGrowthPct);
  const annualFixedInflationPct = toNumber(assumptions.annualFixedInflationPct);
  const variableCostRatio = Math.max(0, toNumber(baseDre.variableCostRatio) / 100);
  const fixedBase = toNumber(baseDre.fixedCosts) + toNumber(baseDre.proLabore) + toNumber(baseDre.debtService);
  const annualDiscountRate = toNumber(assumptions.annualDiscountRate, toNumber(model.annual_discount_rate, 12));
  const monthlyDiscountRate = ((1 + annualDiscountRate / 100) ** (1 / 12)) - 1;
  const rows = [];
  let cumulative = -initialInvestment;
  let discountedCumulative = -initialInvestment;
  let paybackMonth = null;
  let discountedPaybackMonth = null;
  let totalCash = 0;

  for (let month = 1; month <= projectionMonths; month += 1) {
    const revenue = initialRevenue * ((1 + monthlyGrowthPct / 100) ** (month - 1));
    const fixedCosts = fixedBase * ((1 + annualFixedInflationPct / 100) ** ((month - 1) / 12));
    const variableCosts = revenue * variableCostRatio;
    const cashFlow = revenue - variableCosts - fixedCosts;
    const discountedCashFlow = cashFlow / ((1 + monthlyDiscountRate) ** month);
    cumulative += cashFlow;
    discountedCumulative += discountedCashFlow;
    totalCash += cashFlow;
    if (paybackMonth === null && cumulative >= 0) paybackMonth = month;
    if (discountedPaybackMonth === null && discountedCumulative >= 0) discountedPaybackMonth = month;
    rows.push({
      month,
      revenue: roundMetric(revenue),
      variableCosts: roundMetric(variableCosts),
      fixedCosts: roundMetric(fixedCosts),
      cashFlow: roundMetric(cashFlow),
      cumulative: roundMetric(cumulative),
    });
  }

  const cashFlows = [-initialInvestment, ...rows.map((row) => row.cashFlow)];
  const monthlyIrr = calculateIrr(cashFlows);
  return {
    initialInvestment,
    projectionMonths,
    paybackMonth,
    discountedPaybackMonth,
    npv: roundMetric(discountedCumulative),
    irrAnnualPct: monthlyIrr === null ? null : roundMetric((((1 + monthlyIrr) ** 12) - 1) * 100),
    roiPct: initialInvestment > 0 ? roundMetric(((totalCash - initialInvestment) / initialInvestment) * 100) : null,
    accumulatedCash: roundMetric(totalCash - initialInvestment),
    viableInHorizon: paybackMonth !== null && paybackMonth <= projectionMonths,
    rows,
  };
}

export function calculateFranchisorResult({ unitDres = [], feeLedger = [], networkInput = {} } = {}) {
  const calculatedRoyalties = unitDres.reduce((sum, dre) => sum + toNumber(dre.royalties), 0);
  const calculatedFund = unitDres.reduce((sum, dre) => sum + toNumber(dre.marketingFund), 0);
  const paidOrOpen = feeLedger.filter((row) => row.status !== 'cancelado');
  const franchiseFees = paidOrOpen
    .filter((row) => row.fee_type === 'taxa_franquia')
    .reduce((sum, row) => sum + toNumber(row.amount_paid || row.amount_due), 0);
  const royaltyLedger = paidOrOpen
    .filter((row) => row.fee_type === 'royalty')
    .reduce((sum, row) => sum + toNumber(row.amount_paid || row.amount_due), 0);
  const fundLedger = paidOrOpen
    .filter((row) => row.fee_type === 'fundo_marketing')
    .reduce((sum, row) => sum + toNumber(row.amount_paid || row.amount_due), 0);
  const royaltyRevenue = royaltyLedger || calculatedRoyalties;
  const marketingFundCollected = fundLedger || calculatedFund;
  const otherRevenue = toNumber(networkInput.product_margin_revenue) + toNumber(networkInput.other_operating_revenue);
  const operatingRevenue = royaltyRevenue + franchiseFees + otherRevenue;
  const operatingCosts = [
    'franchisor_payroll', 'technology_cost', 'field_support_cost',
    'sales_expansion_cost', 'administrative_cost', 'other_costs',
  ].reduce((sum, key) => sum + toNumber(networkInput[key]), 0);
  const ebitda = operatingRevenue - operatingCosts;
  return {
    royaltyRevenue: roundMetric(royaltyRevenue),
    franchiseFees: roundMetric(franchiseFees),
    otherRevenue: roundMetric(otherRevenue),
    operatingRevenue: roundMetric(operatingRevenue),
    operatingCosts: roundMetric(operatingCosts),
    ebitda: roundMetric(ebitda),
    ebitdaMarginPct: roundMetric(safeDivide(ebitda, operatingRevenue, 0) * 100),
    marketingFundCollected: roundMetric(marketingFundCollected),
    marketingFundSpent: roundMetric(networkInput.marketing_fund_spend),
    marketingFundBalance: roundMetric(marketingFundCollected - toNumber(networkInput.marketing_fund_spend)),
  };
}

export function assessFranchiseDataQuality({ model, monthlyInput, transactions = [], marketingInvestments = [] } = {}) {
  const checks = [
    { key: 'economic_model', label: 'Modelo econômico configurado', ok: Boolean(model?.configured), weight: 25 },
    { key: 'monthly_costs', label: 'Custos do mês informados', ok: Boolean(monthlyInput?.id), weight: 25 },
    { key: 'revenue', label: 'Vendas sincronizadas', ok: transactions.some(isRevenueTransaction), weight: 25 },
    { key: 'marketing', label: 'Investimento de marketing informado', ok: marketingInvestments.length > 0, weight: 15 },
    {
      key: 'clients', label: 'Vendas identificadas por cliente',
      ok: transactions.filter(isRevenueTransaction).some((row) => clientKey(row)), weight: 10,
    },
  ];
  const score = checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0);
  return { score, checks, missing: checks.filter((check) => !check.ok) };
}

const REQUIRED_FRANCHISE_DOCUMENTS = [
  ['cof', 'circular_oferta_franquia'],
  ['contrato', 'contrato_franquia'],
  ['manual_operacional', 'manual_operacao'],
  ['manual_marca', 'manual_identidade'],
  ['treinamento', 'plano_treinamento'],
  ['demonstracoes_financeiras', 'demonstracao_financeira'],
];

const latestTargets = (targets = [], referenceDate = '9999-12-31') => {
  const map = new Map();
  targets
    .filter((target) => !target.valid_from || target.valid_from <= referenceDate)
    .sort((a, b) => String(a.valid_from || '').localeCompare(String(b.valid_from || '')))
    .forEach((target) => map.set(target.metric_key || target.metricKey, target));
  return map;
};

const evaluateTargetStatus = (value, target) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'pending';
  const current = Number(value);
  const goal = toNumber(target.targetValue);
  const warning = toNumber(target.warningValue, goal);
  if (target.direction === 'lower_better') {
    if (current <= goal) return 'met';
    if (current <= warning) return 'attention';
    return 'critical';
  }
  if (current >= goal) return 'met';
  if (current >= warning) return 'attention';
  return 'critical';
};

export function calculateFranchiseReadiness({
  snapshot, targets = [], closes = [], audits = [], documents = [], unitId, referenceDate,
} = {}) {
  const targetOverrides = latestTargets(targets, referenceDate);
  const resolvedTargets = DEFAULT_FRANCHISE_HEALTH_TARGETS.map((defaultTarget) => {
    const override = targetOverrides.get(defaultTarget.metricKey);
    return override ? {
      ...defaultTarget,
      id: override.id,
      targetValue: toNumber(override.target_value, defaultTarget.targetValue),
      warningValue: toNumber(override.warning_value, defaultTarget.warningValue),
      criticalValue: toNumber(override.critical_value, defaultTarget.criticalValue),
      direction: override.direction || defaultTarget.direction,
    } : defaultTarget;
  });

  const unitCloses = closes
    .filter((close) => !unitId || close.unit_id === unitId)
    .filter((close) => close.status === 'fechado' && close.snapshot?.dre)
    .sort((a, b) => String(b.period_month).localeCompare(String(a.period_month)))
    .slice(0, 12);
  const currentMonth = referenceDate ? String(referenceDate).slice(0, 7) : '';
  const hasCurrentClose = unitCloses.some((close) => String(close.period_month).slice(0, 7) === currentMonth);
  const evidenceDres = [...unitCloses.map((close) => close.snapshot.dre)];
  if (snapshot?.dre && !hasCurrentClose) evidenceDres.unshift(snapshot.dre);
  const profitableMonths = evidenceDres.filter((dre) => toNumber(dre.ebitda) > 0).length;
  const historyMonths = unitCloses.length;

  const validDocumentTypes = new Set(
    documents
      .filter((document) => document.status === 'valido' && (!document.unit_id || !unitId || document.unit_id === unitId))
      .map((document) => normalizeText(document.document_type).replaceAll(' ', '_')),
  );
  const validRequiredDocuments = REQUIRED_FRANCHISE_DOCUMENTS.filter((aliases) => aliases.some((alias) => validDocumentTypes.has(alias))).length;
  const latestAudit = audits.find((audit) => audit.status === 'concluida' || audit.status === 'regularizada') || audits[0];
  const values = {
    data_quality_score: snapshot?.quality?.score,
    history_months: historyMonths,
    profitable_months_pct: evidenceDres.length ? (profitableMonths / evidenceDres.length) * 100 : null,
    ebitda_margin_pct: snapshot?.dre?.ebitdaMarginPct,
    net_cash_margin_pct: snapshot?.dre?.profitabilityPct,
    contribution_margin_pct: snapshot?.dre?.contributionMarginPct,
    safety_margin_pct: snapshot?.dre?.safetyMarginPct,
    cash_reserve_months: snapshot?.dre?.cashReserveMonths,
    debt_coverage_ratio: snapshot?.dre?.debtService > 0 ? snapshot?.dre?.debtCoverageRatio : null,
    payback_months: snapshot?.scenario?.paybackMonth,
    ltv_cac_ratio: snapshot?.customers?.ltvCacRatio,
    returning_share_pct: snapshot?.customers?.returningSharePct,
    no_show_rate_pct: snapshot?.operations?.noShowRatePct,
    cancellation_rate_pct: snapshot?.operations?.cancellationRatePct,
    occupancy_pct: snapshot?.operations?.capacityConfigured ? snapshot?.operations?.occupancyPct : null,
    audit_score: latestAudit?.overall_score ?? null,
    required_documents_pct: (validRequiredDocuments / REQUIRED_FRANCHISE_DOCUMENTS.length) * 100,
  };

  const metrics = resolvedTargets.map((target) => {
    const value = values[target.metricKey];
    const status = target.metricKey === 'debt_coverage_ratio' && snapshot?.dre?.debtService <= 0
      ? 'not_applicable'
      : evaluateTargetStatus(value, target);
    const gap = value === null || value === undefined
      ? null
      : target.direction === 'lower_better'
        ? Math.max(0, Number(value) - target.targetValue)
        : Math.max(0, target.targetValue - Number(value));
    return { ...target, value: roundMetric(value, 1), gap: roundMetric(gap, 1), status };
  });
  const statusWeights = { met: 1, attention: 0.55, critical: 0, pending: 0, not_applicable: 1 };
  const score = roundMetric(
    metrics.reduce((sum, metric) => sum + statusWeights[metric.status], 0) / metrics.length * 100,
    0,
  );
  const blockers = metrics.filter((metric) => metric.status === 'critical' || metric.status === 'pending');
  const insufficientHistory = historyMonths < (resolvedTargets.find((target) => target.metricKey === 'history_months')?.targetValue || 6);
  const minimumDataQuality = resolvedTargets.find((target) => target.metricKey === 'data_quality_score')?.targetValue || 90;
  const readinessStatus = insufficientHistory || snapshot?.quality?.score < minimumDataQuality
    ? 'building_evidence'
    : blockers.length > 0 || score < 75
      ? 'not_ready'
      : score < 90
        ? 'almost_ready'
        : 'ready';
  return {
    score,
    status: readinessStatus,
    metrics,
    blockers,
    metCount: metrics.filter((metric) => metric.status === 'met').length,
    attentionCount: metrics.filter((metric) => metric.status === 'attention').length,
    criticalCount: metrics.filter((metric) => metric.status === 'critical').length,
    pendingCount: metrics.filter((metric) => metric.status === 'pending').length,
    historyMonths,
    profitableMonths,
  };
}

export function buildFranchiseSnapshot({
  transactions = [], allTransactions = [], appointments = [], marketingInvestments = [],
  monthlyInput = {}, model = {}, periodStart, periodEnd,
} = {}) {
  const periodTransactions = filterPeriod(transactions, periodStart, periodEnd);
  const periodAppointments = filterPeriod(appointments, periodStart, periodEnd, appointmentDate);
  const dre = calculateUnitDre({ transactions: periodTransactions, monthlyInput, model });
  const customers = calculateCustomerMetrics({
    allTransactions: allTransactions.length ? allTransactions : transactions,
    periodTransactions,
    marketingInvestments,
    contributionMarginPct: dre.contributionMarginPct,
  });
  const operations = calculateOperationalMetrics({
    appointments: periodAppointments,
    transactions: periodTransactions,
    model,
  });
  const scenario = projectFranchiseScenario({ model, baseDre: dre });
  const quality = assessFranchiseDataQuality({ model, monthlyInput, transactions: periodTransactions, marketingInvestments });
  return { dre, customers, operations, scenario, quality };
}
