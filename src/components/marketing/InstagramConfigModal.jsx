/* eslint-disable react/prop-types */
import { Copy, XCircle, RefreshCw } from 'lucide-react';

export default function InstagramConfigModal({ onClose, onSaved }) {
  const webhookUrl = `${window.location.origin}/api/instagram-webhook`;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Configurar Meta"
        onClick={(event) => event.stopPropagation()} style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <span className="modal-title">Conectar Instagram à Meta</span>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><XCircle /></button>
        </div>
        <p>Configure no ambiente do backend hospedado as variáveis <code>META_ACCESS_TOKEN</code>,
          <code> INSTAGRAM_ACCOUNT_ID</code>, <code> META_APP_SECRET</code> e
          <code> META_VERIFY_TOKEN</code>. Depois, publique a versão do backend.</p>
        <p>Cadastre no painel da Meta a URL de callback abaixo e o mesmo valor de
          <code> META_VERIFY_TOKEN</code>. Assine o evento <code>comments</code> do objeto Instagram.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <input className="form-input" value={webhookUrl} readOnly aria-label="URL do webhook" />
          <button className="btn btn-ghost" aria-label="Copiar URL"
            onClick={() => navigator.clipboard?.writeText(webhookUrl)}><Copy /></button>
        </div>
        <p>As credenciais não são digitadas no ERP. Após configurar, use “Verificar conexão” para
          consultar a conta na API oficial da Meta.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
          <button className="btn btn-primary" onClick={() => { onSaved?.(); onClose(); }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Verificar conexão
          </button>
        </div>
      </div>
    </div>
  );
}
