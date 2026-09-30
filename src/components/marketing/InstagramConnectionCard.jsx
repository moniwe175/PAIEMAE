/* eslint-disable react/prop-types */
import {
  Instagram, CheckCircle, AlertTriangle, XCircle, RefreshCw,
  Key, ShieldCheck, ExternalLink, HelpCircle
} from 'lucide-react';

export default function InstagramConnectionCard({
  statusData,
  loading,
  onRefresh,
  onOpenConfig,
}) {
  const isConnected = statusData?.status === 'connected';
  const isError = statusData?.status === 'error';
  const account = statusData?.account;

  const fmtDate = (iso) => {
    if (!iso) return 'Nunca verificado';
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

  return (
    <div
      className="card section-gap"
      style={{
        borderLeft: isConnected
          ? '4px solid #10B981'
          : isError
          ? '4px solid #EF4444'
          : '4px solid #F59E0B',
        background: 'var(--bg-card, #ffffff)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        {/* Left Side: Avatar, Account Info & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              position: 'relative',
              width: 54,
              height: 54,
              borderRadius: 16,
              background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(225, 48, 108, 0.3)',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {account?.profile_picture_url ? (
              <img
                src={account.profile_picture_url}
                alt={account.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Instagram style={{ width: 28, height: 28, color: '#fff' }} />
            )}

            <div
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: isConnected ? '#10B981' : isError ? '#EF4444' : '#F59E0B',
                border: '2px solid #fff',
              }}
              title={isConnected ? 'Conectado' : isError ? 'Erro' : 'Pendente'}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-dark)' }}>
                {account?.name || (isConnected ? 'Conta Instagram Conectada' : 'Instagram da Clínica')}
              </h3>

              {isConnected ? (
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle style={{ width: 12, height: 12 }} /> Conectado Oficial (Meta API)
                </span>
              ) : isError ? (
                <span className="badge" style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <XCircle style={{ width: 12, height: 12 }} /> Erro de Conexão
                </span>
              ) : (
                <span className="badge" style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle style={{ width: 12, height: 12 }} /> Não Configurado
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 4, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
              {account?.username && (
                <a
                  href={`https://instagram.com/${account.username.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#E1306C', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}
                >
                  @{account.username.replace('@', '')} <ExternalLink style={{ width: 10, height: 10 }} />
                </a>
              )}

              {account?.followers_count !== undefined && (
                <span>
                  <strong>{account.followers_count.toLocaleString('pt-BR')}</strong> seguidores
                </span>
              )}

              {account?.media_count !== undefined && (
                <span>
                  <strong>{account.media_count.toLocaleString('pt-BR')}</strong> publicações
                </span>
              )}

              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                Última checagem: {fmtDate(statusData?.last_verified)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Action Controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onRefresh}
            disabled={loading}
            title="Verificar token e conexão na Meta Graph API agora"
          >
            <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Verificar Conexão
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={onOpenConfig}
            style={{
              background: 'linear-gradient(135deg, #E1306C 0%, #C13584 100%)',
              borderColor: 'transparent',
              color: '#fff',
            }}
          >
            <Key style={{ width: 13, height: 13 }} />
            {isConnected ? 'Credenciais & Webhook' : 'Conectar Instagram'}
          </button>
        </div>
      </div>

      {/* Error Details Notification */}
      {isError && statusData?.error && (
        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            fontSize: 12,
            color: '#991B1B',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <AlertTriangle style={{ width: 16, height: 16, color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Falha de autorização com a API da Meta:</strong> {statusData.error}
            <div style={{ marginTop: 4, color: '#7F1D1D', fontSize: 11 }}>
              Confira as variáveis de ambiente do backend e use <strong>Credenciais & Webhook</strong> para ver as instruções.
            </div>
          </div>
        </div>
      )}

      {/* Disconnected Notification with Quick Hint */}
      {!isConnected && !isError && (
        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: 8,
            fontSize: 12,
            color: '#92400E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HelpCircle style={{ width: 15, height: 15, color: '#D97706', flexShrink: 0 }} />
            <span>
              A API oficial do Instagram permite responder comentários com Direct privado automaticamente e cadastrar o lead no CRM.
            </span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onOpenConfig}
            style={{ padding: '2px 8px', fontSize: 11, color: '#B45309', border: '1px solid #FCD34D' }}
          >
            Configurar Token
          </button>
        </div>
      )}
    </div>
  );
}
