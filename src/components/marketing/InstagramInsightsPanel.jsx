/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw, TrendingUp, Users, Eye, Bookmark, Share2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getInstagramInsights } from '../../services/instagramService';

const formatNumber = value => value == null ? '—' : Number(value).toLocaleString('pt-BR');
const shortDate = value => {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

export default function InstagramInsightsPanel({ statusData, posts = [] }) {
  const [days, setDays] = useState(30);
  const [mediaId, setMediaId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

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

  const reach = useMemo(() => (result?.reach || []).map(item => ({
    day: shortDate(item.date),
    reach: item.value,
  })), [result]);
  const latest = reach.at(-1)?.reach;
  const peak = reach.length ? Math.max(...reach.map(item => item.reach)) : null;
  const selectedPost = posts.find(post => post.id === mediaId);
  const media = result?.media;

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
          <div className="grid-4 section-gap">
            {infoCard('Seguidores atuais', statusData?.account?.followers_count, Users)}
            {infoCard('Visualizações no período', result.totals?.views, BarChart3)}
            {infoCard('Interações no período', result.totals?.total_interactions, TrendingUp)}
            {infoCard('Alcance do último dia disponível', latest, Eye)}
            {infoCard('Maior alcance diário no período', peak, TrendingUp)}
            {infoCard('Dias com dados', reach.length, BarChart3)}
          </div>
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
