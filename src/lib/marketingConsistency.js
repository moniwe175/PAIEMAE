const DAY = 86400000;
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const numberOrNull = (value) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const saoPauloDate = (value) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));

export function findInstagramChannel(rows = []) {
  const row = rows.find((item) => normalize(item.canal).includes('instagram'));
  if (!row) return rows.length ? {
    canal: 'Instagram', interessados_total: 0, interessados_com_agendamento: 0,
    clientes_atendidos_vinculados: 0, recebimentos_atribuidos: 0,
  } : null;
  return row;
}

export function calculateContentConsistency(posts = [], days = 30, now = new Date()) {
  const today = saoPauloDate(now);
  const start = new Date(`${today}T12:00:00Z`); start.setUTCDate(start.getUTCDate() - days + 1);
  const startKey = start.toISOString().slice(0, 10);
  const recent = posts.filter((post) => {
    const time = new Date(post.timestamp).getTime();
    if (!Number.isFinite(time)) return false;
    const key = saoPauloDate(post.timestamp);
    return key >= startKey && key <= today;
  });
  const activeDays = new Set(recent.map((post) => saoPauloDate(post.timestamp)));
  const sortedDates = [...activeDays].sort();
  const lastDate = sortedDates.at(-1) || null;
  const daysSinceLastPost = lastDate ? Math.floor((new Date(`${today}T12:00:00Z`) - new Date(`${lastDate}T12:00:00Z`)) / DAY) : null;
  let streak = 0;
  if (lastDate) {
    const cursor = new Date(`${lastDate}T12:00:00Z`);
    while (activeDays.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
  }
  let longestGap = 0;
  for (let index = 1; index < sortedDates.length; index += 1) {
    const gap = Math.round((new Date(`${sortedDates[index]}T12:00:00Z`) - new Date(`${sortedDates[index - 1]}T12:00:00Z`)) / DAY) - 1;
    longestGap = Math.max(longestGap, gap);
  }
  return {
    posts: recent.length,
    activeDays: activeDays.size,
    coveragePct: Math.round(activeDays.size / days * 100),
    cadencePerWeek: Math.round((recent.length / days * 7) * 10) / 10,
    postedToday: activeDays.has(today),
    daysSinceLastPost,
    currentStreak: streak,
    longestGap,
    lastPostDate: lastDate,
  };
}

export function buildMarketingScoreboard({ channel, mediaSummary, followers, accountTotals } = {}) {
  const totals = mediaSummary?.totals || {};
  const reach = numberOrNull(totals.reach);
  const engagements = numberOrNull(totals.engagements);
  const leads = channel ? numberOrNull(channel.interessados_total) : null;
  const mql = channel ? numberOrNull(channel.interessados_com_agendamento) : null;
  const sales = channel ? numberOrNull(channel.clientes_atendidos_vinculados) : null;
  return {
    sales,
    revenue: channel ? numberOrNull(channel.recebimentos_atribuidos) : null,
    mql,
    leads,
    shares: numberOrNull(totals.shares),
    reach,
    engagements: engagements ?? numberOrNull(accountTotals?.total_interactions),
    engagementRatePct: reach && engagements !== null ? Math.round(engagements / reach * 1000) / 10 : null,
    followers: numberOrNull(followers),
    leadToMqlPct: leads ? Math.round((mql || 0) / leads * 1000) / 10 : null,
    mqlToSalePct: mql ? Math.round((sales || 0) / mql * 1000) / 10 : null,
  };
}

export function buildMarketingActions({ consistency, scoreboard } = {}) {
  const actions = [];
  if (!consistency?.postedToday) actions.push({ level: 'today', title: 'Publicar hoje', detail: consistency?.lastPostDate ? `Última publicação: ${consistency.lastPostDate.split('-').reverse().join('/')}.` : 'Nenhuma publicação encontrada no período.' });
  if (scoreboard?.leads > 0 && scoreboard?.mql === 0) actions.push({ level: 'attention', title: 'Leads não estão avançando', detail: 'Há interessados do Instagram, mas nenhum chegou ao agendamento.' });
  if (scoreboard?.mql > 0 && scoreboard?.sales === 0) actions.push({ level: 'attention', title: 'Agendamentos ainda não viraram atendimento', detail: 'Acompanhe confirmação, faltas e conclusão dos agendamentos.' });
  if (scoreboard?.shares === 0) actions.push({ level: 'idea', title: 'Conteúdo sem encaminhamento registrado', detail: 'Teste conteúdo útil que alguém teria motivo para enviar a outra pessoa.' });
  if (!actions.length) actions.push({ level: 'ok', title: 'Rotina em movimento', detail: 'Continue publicando e acompanhe se o conteúdo chega a leads e vendas.' });
  return actions;
}
