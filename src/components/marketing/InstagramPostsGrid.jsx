/* eslint-disable react/prop-types */
import { useState, useMemo } from 'react';
import {
  Image as ImageIcon, Film, Layers, MessageSquare, Heart,
  ExternalLink, Search, CheckCircle, Pause, Sparkles, RefreshCw
} from 'lucide-react';

export default function InstagramPostsGrid({
  posts = [],
  rules = [],
  selectedPost,
  onSelectPost,
  loading,
  onRefresh,
}) {
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');

  // Mapa de regras por media_id
  const rulesMap = useMemo(() => {
    const map = {};
    rules.forEach((r) => {
      map[r.media_id] = r;
    });
    return map;
  }, [rules]);

  // Filtragem
  const filtradas = useMemo(() => {
    return posts.filter((p) => {
      const matchBusca = (p.caption || '').toLowerCase().includes(busca.toLowerCase());
      const matchTipo =
        tipoFiltro === 'todos' ||
        (tipoFiltro === 'video' && (p.media_type === 'VIDEO' || p.media_type === 'REELS')) ||
        (tipoFiltro === 'image' && p.media_type === 'IMAGE') ||
        (tipoFiltro === 'carousel' && p.media_type === 'CAROUSEL_ALBUM');
      return matchBusca && matchTipo;
    });
  }, [posts, busca, tipoFiltro]);

  const getMediaBadge = (type) => {
    if (type === 'VIDEO' || type === 'REELS') {
      return { label: 'Reel / Vídeo', icon: Film, color: '#8B5CF6' };
    }
    if (type === 'CAROUSEL_ALBUM') {
      return { label: 'Carrossel', icon: Layers, color: '#3B82F6' };
    }
    return { label: 'Foto', icon: ImageIcon, color: '#EC4899' };
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dark)' }}>
            <Sparkles style={{ width: 16, height: 16, color: '#E1306C' }} />
            Publicações & Reels da Conta
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
              ({posts.length} carregadas)
            </span>
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Selecione uma publicação para configurar ou editar a regra de automação de comentários.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ width: 220 }}>
            <Search style={{ width: 14, height: 14 }} />
            <input
              className="search-input"
              placeholder="Buscar na legenda..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ fontSize: 12 }}
            />
          </div>

          <div className="tabs" style={{ fontSize: 12 }}>
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'video', label: 'Reels' },
              { id: 'image', label: 'Fotos' },
              { id: 'carousel', label: 'Carrossel' },
            ].map((t) => (
              <button
                key={t.id}
                className={`tab-item${tipoFiltro === t.id ? ' active' : ''}`}
                onClick={() => setTipoFiltro(t.id)}
                style={{ padding: '4px 10px', fontSize: 11 }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={onRefresh}
            disabled={loading}
            title="Recarregar publicações da Meta"
            style={{ padding: '6px 10px' }}
          >
            <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Grid of Posts */}
      {loading && posts.length === 0 ? (
        <div className="empty-state" style={{ padding: 40 }}>
          <RefreshCw style={{ animation: 'spin 1s linear infinite', width: 28, height: 28, color: '#E1306C' }} />
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>Carregando publicações do Instagram...</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state" style={{ padding: 30 }}>
          <ImageIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} />
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            Nenhuma publicação encontrada para o filtro atual.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {filtradas.map((post) => {
            const isSelected = selectedPost?.id === post.id;
            const rule = rulesMap[post.id];
            const badge = getMediaBadge(post.media_type);
            const BadgeIcon = badge.icon;

            return (
              <div
                key={post.id}
                onClick={() => onSelectPost(post)}
                style={{
                  borderRadius: 12,
                  border: isSelected
                    ? '2.5px solid #E1306C'
                    : '1px solid var(--border-color, #E5E7EB)',
                  background: isSelected ? 'rgba(225, 48, 108, 0.02)' : 'var(--bg-main, #FAFAFA)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease-in-out',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: isSelected
                    ? '0 6px 16px rgba(225, 48, 108, 0.15)'
                    : '0 2px 6px rgba(0, 0, 0, 0.03)',
                }}
              >
                {/* Media Image / Thumbnail */}
                <div style={{ position: 'relative', width: '100%', height: 160, background: '#111' }}>
                  {post.thumbnail_url || post.media_url ? (
                    <img
                      src={post.thumbnail_url || post.media_url}
                      alt={post.caption}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ImageIcon style={{ width: 36, height: 36, color: '#666' }} />
                    </div>
                  )}

                  {/* Top Badges */}
                  <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 6 }}>
                    <span
                      style={{
                        background: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(4px)',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <BadgeIcon style={{ width: 11, height: 11 }} /> {badge.label}
                    </span>
                  </div>

                  {post.permalink && (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(4px)',
                        color: '#fff',
                        borderRadius: 6,
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Ver no Instagram"
                    >
                      <ExternalLink style={{ width: 12, height: 12 }} />
                    </a>
                  )}

                  {/* Bottom Stats on image */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)',
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MessageSquare style={{ width: 12, height: 12 }} />
                      {post.comments_count || 0}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Heart style={{ width: 12, height: 12 }} />
                      {post.like_count || 0}
                    </span>
                  </div>
                </div>

                {/* Content & Rule Status */}
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--text-dark)',
                      lineHeight: 1.45,
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      fontWeight: 500,
                    }}
                    title={post.caption}
                  >
                    {post.caption || '(Sem legenda)'}
                  </p>

                  {/* Rule Badge indicator */}
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-light, #F3F4F6)' }}>
                    {rule ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 11,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            color: rule.status === 'ativo' ? '#059669' : '#D97706',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {rule.status === 'ativo' ? (
                            <CheckCircle style={{ width: 12, height: 12 }} />
                          ) : (
                            <Pause style={{ width: 12, height: 12 }} />
                          )}
                          &quot;{rule.palavra_chave}&quot;
                        </span>
                        <span
                          className={`badge ${rule.status === 'ativo' ? 'badge-success' : 'badge-warning'}`}
                          style={{ fontSize: 10, padding: '1px 6px' }}
                        >
                          {rule.status === 'ativo' ? 'Ativa' : 'Pausada'}
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>Sem regra</span>
                        <span style={{ color: '#E1306C', fontWeight: 600 }}>+ Configurar</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
