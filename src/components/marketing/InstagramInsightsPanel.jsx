/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw, TrendingUp, Users, Eye, Bookmark, Share2, CheckCircle2, AlertTriangle, CalendarCheck, CircleDollarSign, UserCheck } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getInstagramInsights } from '../../services/instagramService';
import { fetchCanalStats } from '../../services/inteligenciaComercialService';
import { buildMarketingActions, buildMarketingScoreboard, calculateContentConsistency, findInstagramChannel } from '../../lib/marketingConsistency';
import './instagram-insights.css';

const formatNumber = value => value == null ? '—' : Number(value).toLocaleString('pt-BR');
const shortDate = value => {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

const formatMoney = value => value == null ? '—' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateRange = days => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { from: start.toISOString().slice(0, 10), to: today };
};

function MarketingScoreboard({ days, consistency, scoreboard, actions, mediaSummary, commercialError }) {
  const items = [
    { rank: 1, label: 'Vendas comprovadas', value: formatNumber(scoreboard.sales), detail: scoreboard.revenue == null ? 'receita ainda não atribuída' : `${formatMoney(scoreboard.revenue)} atribuídos`, icon: CircleDollarSign, source: 'CRM + financeiro' },
    { rank: 2, label: 'Oportunidades (MQL)', value: formatNumber(scoreboard.mql), detail: scoreboard.leadToMqlPct == null ? 'leads que chegaram ao agendamento' : `${scoreboard.leadToMqlPct}% dos leads agendaram`, icon: UserCheck, source: 'CRM + Agenda' },
    { rank: 3, label: 'Leads do Instagram', value: formatNumber(scoreboard.leads), detail: 'interessados criados no período', icon: Users, source: 'CRM' },
    { rank: 4, label: 'Encaminhamentos', value: formatNumber(scoreboard.shares), detail: 'vezes que o conteúdo foi compartilhado', icon: Share2, source: 'Meta' },
    { rank: 5, label: 'Alcance dos conteúdos', value: formatNumber(scoreboard.reach), detail: 'soma por publicação; não são pessoas únicas', icon: Eye, source: 'Meta' },
    { rank: 6, label: 'Engajamentos', value: formatNumber(scoreboard.engagements), detail: scoreboard.engagementRatePct == null ? 'curtidas, comentários, salvos e compartilhamentos' : `taxa sobre alcance: ${scoreboard.engagementRatePct}%`, icon: TrendingUp, source: 'Meta' },
    { rank: 7, label: 'Seguidores atuais', value: formatNumber(scoreboard.followers), detail: 'indicador de apoio, não o objetivo final', icon: Users, source: 'Meta' },
  ];
  return <div className="mi-scoreboard">
    <div className="mi-scoreboard-head">
      <div><span className="mi-kicker">CONSTÂNCIA QUE VIRA VENDA</span><h3>Não precisa viralizar. Precisa aparecer e converter.</h3><p>O placar segue a ordem do que mais importa para o negócio: vendas primeiro, seguidores por último.</p></div>
      <div className={`mi-today ${consistency.postedToday ? 'done' : 'pending'}`}>{consistency.postedToday ? <CheckCircle2/> : <CalendarCheck/>}<div><strong>{consistency.postedToday ? 'Publicado hoje' : 'Falta publicar hoje'}</strong><small>{consistency.currentStreak} dia(s) de sequência atual</small></div></div>
    </div>
    <div className="mi-consistency">
      <div><span>Dias com publicação</span><strong>{consistency.activeDays}/{days}</strong><small>{consistency.coveragePct}% de presença no período</small></div>
      <div><span>Ritmo médio</span><strong>{consistency.cadencePerWeek}/semana</strong><small>{consistency.posts} conteúdo(s) encontrado(s)</small></div>
      <div><span>Maior intervalo</span><strong>{consistency.longestGap} dia(s)</strong><small>sem publicação entre conteúdos</small></div>
      <div><span>Última publicação</span><strong>{consistency.lastPostDate ? shortDate(consistency.lastPostDate) : '—'}</strong><small>{consistency.daysSinceLastPost == null ? 'sem conteúdo no período' : consistency.daysSinceLastPost === 0 ? 'hoje' : `há ${consistency.daysSinceLastPost} dia(s)`}</small></div>
    </div>
    <div className="mi-priority-grid">{items.map(item => <div className={`mi-priority mi-rank-${item.rank}`} key={item.rank}><div className="mi-priority-top"><span className="mi-rank">{item.rank}</span><item.icon/><small>{item.source}</small></div><strong>{item.value}</strong><span>{item.label}</span><p>{item.detail}</p></div>)}</div>
    <div className="mi-bottom-grid">
      <div className="mi-actions"><h4>Próximas ações</h4>{actions.map(action => <div className={`mi-action ${action.level}`} key={action.title}>{action.level === 'ok' ? <CheckCircle2/> : <AlertTriangle/>}<div><strong>{action.title}</strong><p>{action.detail}</p></div></div>)}</div>
      <div className="mi-funnel"><h4>Conversão do conteúdo em negócio</h4><div><span>Leads → agendamento</span><strong>{scoreboard.leadToMqlPct == null ? 'Pendente' : `${scoreboard.leadToMqlPct}%`}</strong></div><div><span>Agendamento → atendimento</span><strong>{scoreboard.mqlToSalePct == null ? 'Pendente' : `${scoreboard.mqlToSalePct}%`}</strong></div>{commercialError && <p className="mi-warning">{commercialError}</p>}<small>Vendas e receita só aparecem quando a origem Instagram e o vínculo financeiro estão comprovados.</small></div>
    </div>
    <p className="mi-coverage">Insights consolidados de {mediaSummary?.covered_posts ?? 0} de {mediaSummary?.posts_count ?? 0} conteúdos recentes (máximo de {mediaSummary?.limit || 12}). “—” significa dado indisponível, nunca zero inventado.</p>
  </div>;
}

export default function InstagramInsightsPanel({ statusData, posts = [] }) {
  const [days, setDays] = useState(30);
  const [mediaId, setMediaId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [channelRows, setChannelRows] = useState(null);
  const [commercialError, setCommercialError] = useState('');

  useEffect(() => {
    if (!mediaId && posts.length) setMediaId(posts[0].id);
  }, [mediaId, posts]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getInstagramInsights(days, mediaId).then(data => {
      if (active) {
        setResult(data);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [days, mediaId, refreshKey]);

  useEffect(() => {
    let active = true;
    const range = dateRange(days);
    fetchCanalStats(range.from, range.to).then(({ data, error }) => {
      if (!active) return;
      setChannelRows(error ? null : (data || []));
      setCommercialError(error ? 'A atribuição do CRM ainda não está disponível para este período.' : '');
    });
    return () => { active = false; };
  }, [days, refreshKey]);

  const reach = useMemo(() => (result?.reach || []).map(item => ({
    day: shortDate(item.date),
    reach: item.value,
  })), [result]);
  const selectedPost = posts.find(post => post.id === mediaId);
  const media = result?.media;
  const consistency = useMemo(() => calculateContentConsistency(posts, days), [posts, days]);
  const instagramChannel = useMemo(() => channelRows === null ? null : findInstagramChannel(channelRows), [channelRows]);
  const scoreboard = useMemo(() => buildMarketingScoreboard({
    channel: instagramChannel,
    mediaSummary: result?.media_summary,
    followers: statusData?.account?.followers_count,
    accountTotals: result?.totals,
  }), [instagramChannel, result, statusData]);
  const actions = useMemo(() => buildMarketingActions({ consistency, scoreboard }), [consistency, scoreboard]);

  const infoCard = (label, value, Icon) => (
    <div className="stat-card" key={label}>
      <div className="stat-card-icon" style={{ background: '#E1306C18' }}>
        <Icon style={{ color: '#C02662' }} />
      </div>
      <div className="stat-value" style={{ color: '#C02662' }}>{formatNumber(value)}</div>
      <div className="stat-label">{label}</div>
    </div>
  );

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }} aria-label="Insights do Instagram">
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 18 }}>
            <BarChart3 size={20} /> Insights do Instagram
          </h2>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Dados oficiais da conta conectada · alcance diário e desempenho das publicações
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="insights-period" className="sr-only">Período</label>
          <select id="insights-period" className="form-select" value={days} onChange={event => setDays(Number(event.target.value))}>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
          <button type="button" className="btn btn-ghost" onClick={() => setRefreshKey(key => key + 1)} disabled={loading}>
            <RefreshCw size={15} /> Atualizar
          </button>
        </div>
      </div>

      {!statusData?.configured && (
        <div className="card" role="status">Conecte sua conta profissional do Instagram na aba Automação para consultar os Insights.</div>
      )}
      {result?.error && <div className="card" role="alert" style={{ color: '#991B1B' }}>{result.error}</div>}
      {loading && <div className="card" role="status">Consultando Insights na Meta...</div>}

      {result?.ok && !loading && (
        <>
          <MarketingScoreboard
            days={days}
            consistency={consistency}
            scoreboard={scoreboard}
            actions={actions}
            mediaSummary={result.media_summary}
            commercialError={commercialError}
          />
          <div className="card">
            <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Alcance diário</h3>
            {reach.length ? (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reach} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" interval="preserveStartEnd" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={value => [formatNumber(value), 'Alcance']} />
                    <Line type="monotone" dataKey="reach" stroke="#C02662" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <p style={{ color: 'var(--text-muted)' }}>A Meta não retornou dados de alcance para este período.</p>}
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 0 }}>
              Cada ponto representa o alcance informado pela Meta para um dia. Os valores diários não são somados, pois pessoas podem aparecer em mais de um dia.
            </p>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Desempenho por publicação</h3>
            {posts.length ? (
              <>
                <label htmlFor="insights-post" className="form-label">Publicação ou Reel</label>
                <select id="insights-post" className="form-select" value={mediaId} onChange={event => setMediaId(event.target.value)} style={{ width: '100%', maxWidth: 560 }}>
                  {posts.map(post => (
                    <option key={post.id} value={post.id}>
                      {post.media_type} · {post.caption?.slice(0, 85) || 'Sem legenda'}
                    </option>
                  ))}
                </select>
                <div className="grid-4 section-gap" style={{ marginTop: 16 }}>
                  {infoCard('Alcance', media?.reach, Eye)}
                  {infoCard('Visualizações', media?.views, BarChart3)}
                  {infoCard('Salvamentos', media?.saved, Bookmark)}
                  {infoCard('Compartilhamentos', media?.shares, Share2)}
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
                  <span>Curtidas: <strong>{formatNumber(selectedPost?.like_count)}</strong></span>
                  <span>Comentários: <strong>{formatNumber(selectedPost?.comments_count)}</strong></span>
                  {selectedPost?.permalink && <a href={selectedPost.permalink} target="_blank" rel="noreferrer">Abrir publicação no Instagram</a>}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 0 }}>
                  “—” indica que a Meta não disponibilizou a métrica para esta mídia ou conta. Apenas publicações recentes carregadas na aba Automação aparecem aqui.
                </p>
              </>
            ) : <p style={{ color: 'var(--text-muted)' }}>Nenhuma publicação carregada. Conecte a conta e atualize a aba Automação.</p>}
          </div>
        </>
      )}
    </section>
  );
}
