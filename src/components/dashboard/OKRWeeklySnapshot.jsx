import { Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, AlertOctagon } from 'lucide-react';

const STATUS_MAP = {
  no_alvo: { label: 'NO ALVO', color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', icon: CheckCircle2 },
  alerta: { label: 'ALERTA', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', icon: AlertTriangle },
  critico: { label: 'CRITICO', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', icon: AlertOctagon },
};

function KRBadge({ kr, onClick }) {
  const st = STATUS_MAP[kr.status] || STATUS_MAP.no_alvo;
  const StIcon = st.icon;
  const progress = kr.valor_meta > 0 ? Math.min(100, Math.round((Number(kr.valor_atual) / Number(kr.valor_meta)) * 100)) : 0;

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: `1.5px solid ${st.border}`,
        borderRadius: 10,
        padding: '10px 14px',
        cursor: kr.status !== 'no_alvo' ? 'pointer' : 'default',
        minWidth: 200,
        flex: '1 1 200px',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { if (kr.status !== 'no_alvo') e.currentTarget.style.boxShadow = `0 2px 12px ${st.color}20`; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dark)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kr.titulo}</span>
        <span style={{
          fontSize: 9, fontWeight: 800, color: st.color, background: st.bg,
          padding: '2px 8px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 3, letterSpacing: 0.3,
        }}>
          <StIcon style={{ width: 9, height: 9 }} />{st.label}
        </span>
      </div>
      {/* Progress bar */}
      <div style={{ height: 6, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: st.color, borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {kr.metrica === 'R$' ? 'R$ ' : ''}{Number(kr.valor_atual).toLocaleString('pt-BR')} / {kr.metrica === 'R$' ? 'R$ ' : ''}{Number(kr.valor_meta).toLocaleString('pt-BR')}{kr.metrica === '%' ? '%' : ''}
        </span>
        <span style={{ fontWeight: 700, color: st.color }}>{progress}%</span>
      </div>
    </div>
  );
}

export default function OKRWeeklySnapshot({ keyResults = [], onKRClick }) {
  if (keyResults.length === 0) return null;

  const alertCount = keyResults.filter(kr => kr.status !== 'no_alvo').length;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Target style={{ width: 16, height: 16, color: 'var(--color-primary)' }} />
        <span className="card-title" style={{ margin: 0 }}>Desdobramento de Metas Semanais (OKR)</span>
        {alertCount > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#EF4444',
            background: '#FEF2F2', padding: '2px 10px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <AlertTriangle style={{ width: 10, height: 10 }} />{alertCount} alerta(s)
          </span>
        )}
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', gap: 10, overflowX: 'auto', flexWrap: 'wrap' }}>
        {keyResults.map(kr => (
          <KRBadge key={kr.id} kr={kr} onClick={() => onKRClick?.(kr)} />
        ))}
      </div>
    </div>
  );
}
