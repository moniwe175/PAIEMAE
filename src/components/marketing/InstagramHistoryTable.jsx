/* eslint-disable react/prop-types */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History, Search, ExternalLink, CheckCircle, AlertTriangle,
  XCircle, Clock, Users, ArrowUpRight, MessageSquare, RefreshCw
} from 'lucide-react';

export default function InstagramHistoryTable({
  interactions = [],
  loading,
  onRefresh,
  onForwardCrm,
}) {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [forwardingId, setForwardingId] = useState(null);

  const filtradas = useMemo(() => {
    return interactions.filter((item) => {
      const matchBusca =
        (item.usuario_instagram || '').toLowerCase().includes(busca.toLowerCase()) ||
        (item.comentario_texto || '').toLowerCase().includes(busca.toLowerCase()) ||
        (item.palavra_chave_detectada || '').toLowerCase().includes(busca.toLowerCase());

      const matchStatus =
        statusFiltro === 'todos' || item.status === statusFiltro;

      return matchBusca && matchStatus;
    });
  }, [interactions, busca, statusFiltro]);

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'sucesso':
        return { label: 'Enviada (DM)', badge: 'badge-success', icon: CheckCircle };
      case 'falha':
        return { label: 'Falha', badge: 'badge-danger', icon: XCircle };
      case 'processando':
        return { label: 'Processando', badge: 'badge-warning', icon: Clock };
      case 'pausado':
        return { label: 'Regra Pausada', badge: 'badge-warning', icon: Clock };
      case 'duplicado':
        return { label: 'Duplicado', badge: 'badge-warning', icon: AlertTriangle };
      case 'ignorado':
      default:
        return { label: 'Sem Palavra-chave', badge: 'badge-neutral', icon: MessageSquare };
    }
  };

  const handleForward = async (item) => {
    setForwardingId(item.id);
    await onForwardCrm({
      username: item.usuario_instagram,
      comment_text: item.comentario_texto,
      media_id: item.media_id,
      media_caption: item.media_caption,
      keyword: item.palavra_chave_detectada,
      campaign_name: item.campanha_nome,
    });
    setForwardingId(null);
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color, #E5E7EB)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <History style={{ width: 16, height: 16, color: '#E1306C' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>
            Histórico de Comentários & Respostas Privadas
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            ({filtradas.length} de {interactions.length})
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ width: 200 }}>
            <Search style={{ width: 13, height: 13 }} />
            <input
              className="search-input"
              placeholder="Buscar no histórico..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ fontSize: 12 }}
            />
          </div>

          <div className="tabs" style={{ fontSize: 11 }}>
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'sucesso', label: 'Enviadas' },
              { id: 'falha', label: 'Falhas' },
              { id: 'ignorado', label: 'Ignorados' },
            ].map((s) => (
              <button
                key={s.id}
                className={`tab-item${statusFiltro === s.id ? ' active' : ''}`}
                onClick={() => setStatusFiltro(s.id)}
                style={{ padding: '3px 8px' }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={onRefresh}
            disabled={loading}
            title="Atualizar histórico"
            style={{ padding: '5px 8px' }}
          >
            <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Table */}
      {loading && interactions.length === 0 ? (
        <div className="empty-state" style={{ padding: 36 }}>
          <RefreshCw style={{ animation: 'spin 1s linear infinite', width: 24, height: 24, color: '#E1306C' }} />
          <p style={{ marginTop: 8, fontSize: 12 }}>Carregando histórico de comentários...</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state" style={{ padding: 36 }}>
          <History style={{ width: 28, height: 28, color: 'var(--text-muted)' }} />
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            Nenhum comentário real registrado ainda. Simulações não entram neste histórico.
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Usuário Instagram</th>
                <th>Publicação</th>
                <th>Comentário Recebido</th>
                <th>Palavra-chave</th>
                <th>Resposta Privada / Erro</th>
                <th>Vínculo CRM</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((item) => {
                const st = getStatusBadge(item.status);
                const StIcon = st.icon;

                return (
                  <tr key={item.id || item.comment_id}>
                    {/* Data */}
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {fmtDate(item.created_at)}
                    </td>

                    {/* Usuário */}
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-dark)' }}>
                        {item.usuario_instagram}
                      </div>
                    </td>

                    {/* Publicação */}
                    <td>
                      <div style={{ maxWidth: 160 }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-dark)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={item.media_caption || item.media_id}
                        >
                          {item.media_caption || `ID: ${item.media_id}`}
                        </div>
                        {item.media_permalink && (
                          <a
                            href={item.media_permalink}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 10,
                              color: '#E1306C',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              textDecoration: 'none',
                            }}
                          >
                            Ver post <ExternalLink style={{ width: 9, height: 9 }} />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Comentário */}
                    <td>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-medium)',
                          maxWidth: 220,
                          lineHeight: 1.35,
                          background: 'var(--bg-main, #F9FAFB)',
                          padding: '4px 8px',
                          borderRadius: 6,
                          borderLeft: '2px solid #E1306C',
                        }}
                      >
                        &quot;{item.comentario_texto}&quot;
                      </div>
                    </td>

                    {/* Palavra-chave */}
                    <td>
                      {item.palavra_chave_detectada ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#059669',
                            background: '#ECFDF5',
                            padding: '2px 8px',
                            borderRadius: 4,
                          }}
                        >
                          {item.palavra_chave_detectada}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Resposta / Status */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span
                          className={`badge ${st.badge}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}
                        >
                          <StIcon style={{ width: 11, height: 11 }} /> {st.label}
                        </span>

                        {item.resposta_texto && (
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              maxWidth: 200,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={item.resposta_texto}
                          >
                            {item.resposta_texto}
                          </span>
                        )}

                        {item.erro_detalhes && (
                          <span
                            style={{
                              fontSize: 11,
                              color: '#DC2626',
                              maxWidth: 200,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={item.erro_detalhes}
                          >
                            {item.erro_detalhes}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* CRM Vínculo */}
                    <td>
                      {item.crm_lead_id ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigate('/crm')}
                          style={{
                            fontSize: 11,
                            color: '#059669',
                            background: '#ECFDF5',
                            border: '1px solid #A7F3D0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                          }}
                          title="Abrir interessados no CRM"
                        >
                          <Users style={{ width: 11, height: 11 }} />
                          Na Fila do CRM <ArrowUpRight style={{ width: 10, height: 10 }} />
                        </button>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleForward(item)}
                          disabled={forwardingId === item.id}
                          style={{
                            fontSize: 11,
                            color: '#4B5563',
                            border: '1px solid var(--border-color)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                          }}
                          title="Encaminhar manualmente para a fila de atendimento da recepção"
                        >
                          <Users style={{ width: 11, height: 11 }} />
                          {forwardingId === item.id ? 'Gravando...' : 'Enviar ao CRM'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
