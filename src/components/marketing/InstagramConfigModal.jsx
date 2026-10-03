/* eslint-disable react/prop-types */
import { useState } from 'react';
import { Copy, XCircle, RefreshCw, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getInstagramDiagnostics } from '../../services/instagramService';

export default function InstagramConfigModal({ onClose, onSaved }) {
  const webhookUrl = `${window.location.origin}/api/instagram-webhook`;
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [diagData, setDiagData] = useState(null);
  const [diagError, setDiagError] = useState(null);

  const handleRunDiag = async () => {
    setLoadingDiag(true);
    setDiagError(null);
    try {
      const res = await getInstagramDiagnostics();
      if (!res.ok) {
        setDiagError(res.error || 'Falha ao executar diagnóstico.');
      } else {
        setDiagData(res.diagnostics);
      }
    } catch (err) {
      setDiagError(err.message);
    } finally {
      setLoadingDiag(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Configurar Meta"
        onClick={(event) => event.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <span className="modal-title">Conectar Instagram à Meta</span>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><XCircle /></button>
        </div>
        <p>Configure no ambiente do backend hospedado as variáveis <code>META_ACCESS_TOKEN</code>,
          <code> INSTAGRAM_ACCOUNT_ID</code>, <code> META_APP_SECRET</code>, <code> META_APP_ID</code> e
          <code> META_VERIFY_TOKEN</code>. Depois, publique a versão do backend.</p>
        <p>Cadastre no painel da Meta a URL de callback abaixo e o mesmo valor de
          <code> META_VERIFY_TOKEN</code>. Assine o evento <code>comments</code> do objeto Instagram.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <input className="form-input" value={webhookUrl} readOnly aria-label="URL do webhook" />
          <button className="btn btn-ghost" aria-label="Copiar URL"
            onClick={() => navigator.clipboard?.writeText(webhookUrl)}><Copy /></button>
        </div>

        <div style={{ marginTop: 16, marginBottom: 16, padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity style={{ width: 16, height: 16, color: '#3b82f6' }} /> Diagnóstico Técnico do Token
            </span>
            <button className="btn btn-secondary btn-sm" onClick={handleRunDiag} disabled={loadingDiag}>
              {loadingDiag ? 'Consultando Meta...' : 'Executar Diagnóstico'}
            </button>
          </div>

          {diagError && (
            <div style={{ color: '#ef4444', fontSize: 12, padding: 8, background: '#fee2e2', borderRadius: 4 }}>
              <AlertTriangle style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
              {diagError}
            </div>
          )}

          {diagData && (
            <div style={{ fontSize: 12, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: 8, background: '#ffffff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>1. Aplicativo Meta (App ID)</div>
                <div><strong>App ID:</strong> <code>{diagData.debug_token?.app_id || 'N/A'}</code> ({diagData.debug_token?.application || 'Sem nome'})</div>
                <div style={{ marginTop: 2, color: diagData.comparisons?.app?.matches ? '#16a34a' : '#dc2626' }}>
                  {diagData.comparisons?.app?.matches ? <CheckCircle2 style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} /> : <AlertTriangle style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />}
                  {diagData.comparisons?.app?.detail}
                </div>
              </div>

              <div style={{ padding: 8, background: '#ffffff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>2. Identidade e Tipo do Token</div>
                <div><strong>Tipo do Token:</strong> <span className="badge" style={{ fontWeight: 600 }}>{diagData.debug_token?.type || 'UNKNOWN'}</span> (extraído de /debug_token)</div>
                <div><strong>Identidade (/me):</strong> {diagData.me_identity?.name || 'N/A'} (ID: <code>{diagData.me_identity?.id || 'N/A'}</code>)</div>
                <div style={{ marginTop: 2, color: diagData.debug_token?.is_valid ? '#16a34a' : '#dc2626' }}>
                  <strong>Validade:</strong> {diagData.debug_token?.is_valid ? 'Token Válido' : 'Token Inválido'} • Expira em: {diagData.debug_token?.expires_at || 'Nunca'}
                </div>
                {diagData.debug_token?.scopes && (
                  <div style={{ marginTop: 4 }}>
                    <strong>Permissões (Scopes):</strong> <code>{diagData.debug_token.scopes.join(', ') || 'Nenhuma'}</code>
                  </div>
                )}
              </div>

              <div style={{ padding: 8, background: '#ffffff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>3. Vínculo da Página do Facebook (1640332469521785)</div>
                <div style={{ color: diagData.comparisons?.page?.matches ? '#16a34a' : '#dc2626' }}>
                  {diagData.comparisons?.page?.matches ? <CheckCircle2 style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} /> : <AlertTriangle style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />}
                  {diagData.comparisons?.page?.detail}
                </div>
              </div>

              <div style={{ padding: 8, background: '#ffffff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>4. Vínculo da Conta Instagram (17841403407235131)</div>
                <div><strong>ID Configurado no Backend:</strong> <code>{diagData.configured_account_id}</code></div>
                <div style={{ marginTop: 2, color: diagData.comparisons?.instagram?.status === 'OK' ? '#16a34a' : '#d97706' }}>
                  {diagData.comparisons?.instagram?.status === 'OK' ? <CheckCircle2 style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} /> : <AlertTriangle style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />}
                  {diagData.comparisons?.instagram?.detail}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                  * {diagData.comparisons?.instagram?.rule_note}
                </div>
              </div>

              {diagData.last_database_interaction && (
                <div style={{ padding: 8, background: '#fff1f2', borderRadius: 6, border: '1px solid #fecdd3' }}>
                  <div style={{ fontWeight: 600, color: '#9f1239', marginBottom: 4 }}>5. Último Erro de Envio Registrado nos Logs</div>
                  <div><strong>Comentário:</strong> &quot;{diagData.last_database_interaction.comentario_texto}&quot; por @{diagData.last_database_interaction.usuario_instagram}</div>
                  <div><strong>Status:</strong> {diagData.last_database_interaction.status} ({new Date(diagData.last_database_interaction.created_at).toLocaleString()})</div>
                  <div style={{ marginTop: 4, color: '#b91c1c', fontWeight: 500 }}>
                    <strong>Erro da Meta:</strong> {diagData.last_database_interaction.erro_detalhes || 'Nenhum erro registrado'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <p style={{ fontSize: 12, color: '#64748b' }}>
          As credenciais não são digitadas no ERP. Elas são lidas diretamente das variáveis do backend da Vercel.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
          <button className="btn btn-primary" onClick={() => { onSaved?.(); onClose(); }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Verificar conexão
          </button>
        </div>
      </div>
    </div>
  );
}

