import { useState } from 'react';
import { ChevronDown, ChevronRight, Target, Plus, Trash2, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';
import TrendChart from './TrendChart';
import KRInlineForm from './KRInlineForm';

const STATUS_MAP = {
  no_alvo: { label: 'NO ALVO', color: '#10B981', bg: '#ECFDF5', icon: CheckCircle2 },
  alerta: { label: 'ALERTA', color: '#F59E0B', bg: '#FFFBEB', icon: AlertTriangle },
  critico: { label: 'CRITICO', color: '#EF4444', bg: '#FEF2F2', icon: AlertOctagon },
};

function KRRow({ kr, onUpdate, onDelete, snapshots }) {
  const [expanded, setExpanded] = useState(false);
  const st = STATUS_MAP[kr.status] || STATUS_MAP.no_alvo;
  const StIcon = st.icon;
  const progress = kr.valor_meta > 0 ? Math.min(100, Math.round((Number(kr.valor_atual) / Number(kr.valor_meta)) * 100)) : 0;

  return (
    <div style={{ borderLeft: `3px solid ${st.color}`, marginLeft: 20, paddingLeft: 14, marginBottom: 10 }}>
      <div onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
        {expanded ? <ChevronDown style={{ width: 14, height: 14, color: '#9CA3AF' }} /> : <ChevronRight style={{ width: 14, height: 14, color: '#9CA3AF' }} />}
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dark)', flex: 1 }}>{kr.titulo}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <StIcon style={{ width: 9, height: 9 }} />{st.label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>{progress}%</span>
      </div>
      {/* Progress bar */}
      <div style={{ height: 5, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden', marginLeft: 22, marginBottom: 4 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: st.color, borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
      <div style={{ marginLeft: 22, fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
        {kr.metrica === 'R$' ? 'R$ ' : ''}{Number(kr.valor_atual).toLocaleString('pt-BR')} / {kr.metrica === 'R$' ? 'R$ ' : ''}{Number(kr.valor_meta).toLocaleString('pt-BR')}{kr.metrica === '%' ? '%' : ''}
      </div>
      {expanded && (
        <div style={{ marginLeft: 22, marginTop: 6 }}>
          <TrendChart kr={kr} snapshots={snapshots[kr.id] || []} />
          {kr.action_hint && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: st.bg, borderRadius: 8, fontSize: 11, color: st.color, fontWeight: 500, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <StIcon style={{ width: 12, height: 12, flexShrink: 0, marginTop: 1 }} />
              {kr.action_hint}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={() => onDelete?.(kr.id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FFF5F5', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Trash2 style={{ width: 10, height: 10 }} />Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OKRTree({ objetivos = [], snapshots = {}, onAddObjetivo, onAddKR, onDeleteObjetivo, onDeleteKR, onUpdateKR }) {
  const [expandedObj, setExpandedObj] = useState({});
  const [addingKR, setAddingKR] = useState(null); // obj.id currently adding KR to

  return (
    <div>
      {objetivos.map(obj => {
        const isExpanded = expandedObj[obj.id] !== false;
        const krs = obj.key_results || [];
        const isAdding = addingKR === obj.id;
        return (
          <div key={obj.id} className="card" style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
            {/* Objective header */}
            <div
              onClick={() => setExpandedObj(prev => ({ ...prev, [obj.id]: !isExpanded }))}
              style={{ padding: '14px 18px', background: 'linear-gradient(135deg,#FDF8F5,#fff)', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <Target style={{ width: 16, height: 16, color: 'var(--color-primary)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Objetivo</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>{obj.titulo}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{krs.length} KR(s)</span>
              {isExpanded ? <ChevronDown style={{ width: 16, height: 16, color: '#9CA3AF' }} /> : <ChevronRight style={{ width: 16, height: 16, color: '#9CA3AF' }} />}
            </div>
            {isExpanded && (
              <div style={{ padding: '14px 18px' }}>
                {krs.map(kr => (
                  <KRRow key={kr.id} kr={kr} snapshots={snapshots} onUpdate={onUpdateKR} onDelete={onDeleteKR} />
                ))}
                {krs.length === 0 && !isAdding && <div style={{ textAlign: 'center', padding: '16px 0', color: '#D1D5DB', fontSize: 12 }}>Nenhum Key Result definido</div>}
                {isAdding && (
                  <div style={{ marginTop: 10 }}>
                    <KRInlineForm
                      onSave={(krData) => { onAddKR?.(obj.id, krData); setAddingKR(null); }}
                      onCancel={() => setAddingKR(null)}
                    />
                  </div>
                )}
                {!isAdding && (
                  <button onClick={() => setAddingKR(obj.id)} style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-accent-soft)', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus style={{ width: 12, height: 12 }} />Adicionar Key Result
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={onAddObjetivo} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', gap: 6, marginTop: 6 }}>
        <Plus style={{ width: 14, height: 14 }} />Adicionar Objetivo
      </button>
    </div>
  );
}
