export const AUTOMATIC_AUDIENCE_RULES = Object.freeze({
  activeDays: 45,
  returnDays: 90,
  riskDays: 120,
  highValuePercentile: 0.8,
});

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function mostFrequent(values) {
  const counts = new Map();
  values.map(normalizeText).filter(Boolean).forEach(value => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0]?.[0] || null;
}

function percentile(values, percentileValue) {
  const ordered = values.map(asNumber).filter(value => value > 0).sort((a, b) => a - b);
  if (ordered.length === 0) return null;
  const index = Math.max(0, Math.ceil(ordered.length * percentileValue) - 1);
  return ordered[index];
}

function summarizeAudience(definition, members) {
  const totalValue = members.reduce((sum, member) => sum + member.totalValue, 0);
  const totalVisits = members.reduce((sum, member) => sum + member.totalVisits, 0);

  return {
    ...definition,
    count: members.length,
    members,
    totalValue,
    averageValue: members.length ? totalValue / members.length : 0,
    averageVisits: members.length ? totalVisits / members.length : 0,
    topSource: mostFrequent(members.map(member => member.source)),
    topService: mostFrequent(members.flatMap(member => member.services)),
  };
}

function buildProfile(members, highValueThreshold) {
  const recent = members.filter(member => member.daysSinceVisit <= AUTOMATIC_AUDIENCE_RULES.returnDays);
  const recurring = recent.filter(member => member.totalVisits >= 2);
  const highValueRecurring = recurring.filter(member => (
    highValueThreshold != null && member.totalValue >= highValueThreshold
  ));
  // Amostras muito pequenas de alto valor distorcem o perfil. Só restringe ao
  // topo financeiro quando há evidência suficiente; caso contrário usa todos
  // os clientes que realmente retornaram.
  const evidence = highValueRecurring.length >= 3
    ? highValueRecurring
    : recurring.length ? recurring : recent;
  const totalValue = evidence.reduce((sum, member) => sum + member.totalValue, 0);
  const totalVisits = evidence.reduce((sum, member) => sum + member.totalVisits, 0);
  const topSource = mostFrequent(evidence.map(member => member.source));
  const topService = mostFrequent(evidence.flatMap(member => member.services));
  const confidence = evidence.length >= 10 ? 'alta' : evidence.length >= 5 ? 'média' : 'inicial';

  return {
    name: 'Perfil com maior chance de retorno',
    sampleCount: evidence.length,
    topSource,
    topService,
    averageValue: evidence.length ? totalValue / evidence.length : 0,
    averageVisits: evidence.length ? totalVisits / evidence.length : 0,
    confidence,
    summary: evidence.length === 0
      ? 'O perfil será identificado automaticamente após os primeiros atendimentos finalizados.'
      : [
          topService ? `Procura principalmente ${topService}` : null,
          topSource ? `chega mais por ${topSource}` : null,
          `tem média de ${(totalVisits / evidence.length).toFixed(1)} atendimentos`,
        ].filter(Boolean).join(', ') + '.',
  };
}

/**
 * Transforma o histórico real de atendimento em públicos úteis para a clínica.
 * Não persiste rótulos nem exige manutenção manual: cada abertura recalcula tudo.
 */
export function buildAutomaticAudienceInsights(rfmRows = [], appointments = []) {
  const servicesByClient = new Map();

  appointments.forEach(appointment => {
    if (String(appointment?.status || '').toLowerCase() !== 'finalizado') return;
    if (appointment?.client_id == null) return;
    const service = normalizeText(appointment.procedure);
    if (!service) return;
    const key = String(appointment.client_id);
    const services = servicesByClient.get(key) || [];
    services.push(service);
    servicesByClient.set(key, services);
  });

  const members = rfmRows.map(row => ({
    id: row.client_id,
    name: row.client_name || 'Cliente sem nome',
    source: normalizeText(row.client_source) || null,
    daysSinceVisit: asNumber(row.dias_sem_atendimento),
    totalVisits: asNumber(row.atendimentos_total),
    periodVisits: asNumber(row.atendimentos_periodo),
    totalValue: asNumber(row.valor_total),
    periodValue: asNumber(row.valor_periodo),
    lastVisit: row.ultimo_atendimento || null,
    services: servicesByClient.get(String(row.client_id)) || [],
  }));

  const highValueThreshold = percentile(
    members.map(member => member.totalValue),
    AUTOMATIC_AUDIENCE_RULES.highValuePercentile,
  );

  const definitions = [
    {
      id: 'novos',
      name: 'Novos clientes',
      description: 'Fizeram o primeiro atendimento recentemente e precisam de acompanhamento.',
      rule: '1 atendimento e visita nos últimos 45 dias',
      action: 'Acompanhar a experiência e orientar o próximo cuidado.',
      color: '#3B82F6',
      matches: member => member.totalVisits === 1 && member.daysSinceVisit <= AUTOMATIC_AUDIENCE_RULES.activeDays,
    },
    {
      id: 'recorrentes',
      name: 'Clientes recorrentes',
      description: 'Já retornaram e continuam ativos na clínica.',
      rule: '2 ou mais atendimentos e visita nos últimos 45 dias',
      action: 'Manter relacionamento e continuidade do tratamento.',
      color: '#10B981',
      matches: member => member.totalVisits >= 2 && member.daysSinceVisit <= AUTOMATIC_AUDIENCE_RULES.activeDays,
    },
    {
      id: 'retorno',
      name: 'Hora de retornar',
      description: 'Estão entrando na janela em que um novo contato pode ser útil.',
      rule: 'Último atendimento entre 46 e 90 dias',
      action: 'Convidar para avaliar a necessidade de retorno.',
      color: '#8B5CF6',
      matches: member => member.daysSinceVisit > AUTOMATIC_AUDIENCE_RULES.activeDays
        && member.daysSinceVisit <= AUTOMATIC_AUDIENCE_RULES.returnDays,
    },
    {
      id: 'risco',
      name: 'Em risco de não voltar',
      description: 'Passaram da janela normal de retorno e merecem atenção.',
      rule: 'Último atendimento entre 91 e 120 dias',
      action: 'Fazer uma abordagem de cuidado antes da inatividade.',
      color: '#D97706',
      matches: member => member.daysSinceVisit > AUTOMATIC_AUDIENCE_RULES.returnDays
        && member.daysSinceVisit <= AUTOMATIC_AUDIENCE_RULES.riskDays,
    },
    {
      id: 'reativar',
      name: 'Reativar',
      description: 'Clientes antigos sem atendimento recente.',
      rule: 'Mais de 120 dias sem atendimento',
      action: 'Usar uma campanha de reativação com contexto do histórico.',
      color: '#DC2626',
      matches: member => member.daysSinceVisit > AUTOMATIC_AUDIENCE_RULES.riskDays,
    },
    {
      id: 'alto_valor',
      name: 'Maior valor para a clínica',
      description: 'Faixa superior de receita histórica entre os clientes analisados.',
      rule: highValueThreshold == null
        ? 'Calculado quando houver receitas conciliadas'
        : `20% superiores a partir de ${highValueThreshold.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      action: 'Priorizar experiência, retenção e continuidade.',
      color: '#C0841A',
      matches: member => highValueThreshold != null && member.totalValue >= highValueThreshold,
    },
  ];

  const audiences = definitions.map(definition => {
    const { matches, ...publicDefinition } = definition;
    return summarizeAudience(publicDefinition, members.filter(matches));
  });

  return {
    audiences,
    profile: buildProfile(members, highValueThreshold),
    totalClients: members.length,
    highValueThreshold,
  };
}
