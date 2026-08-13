import { Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Bloqueia acesso direto por URL a módulos sem permissão.
// O sidebar esconde o item, mas sem este gate a URL direta abriria a página.
export default function ModuleGate({ module, adminOnly = false, children }) {
  const { canView, checkIsAdmin, loading } = useAuth();

  if (loading) return null;

  const allowed = adminOnly ? checkIsAdmin() : canView(module);

  if (!allowed) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'var(--danger-bg)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <Lock style={{ width: 28, height: 28, color: 'var(--danger)' }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 8 }}>
          Acesso Restrito
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 400, margin: '0 auto' }}>
          Seu cargo não possui permissão para acessar este módulo. Fale com o administrador.
        </p>
      </div>
    );
  }

  return children;
}
