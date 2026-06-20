import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

const STATUS_COLORS = {
  no_alvo: { line: '#10B981', fill: '#10B98120' },
  alerta: { line: '#F59E0B', fill: '#F59E0B20' },
  critico: { line: '#EF4444', fill: '#EF444420' },
};

export default function TrendChart({ kr, snapshots = [] }) {
  const colors = STATUS_COLORS[kr.status] || STATUS_COLORS.no_alvo;
  const target = Number(kr.valor_meta);

  // Build chart data from snapshots
  const data = snapshots.length > 0
    ? snapshots.map(s => ({
        semana: new Date(s.semana + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        valor: Number(s.valor),
        meta: target,
      }))
    : [
        { semana: 'W1', valor: Number(kr.valor_inicial), meta: target },
        { semana: 'Atual', valor: Number(kr.valor_atual), meta: target },
      ];

  return (
    <div style={{ marginTop: 10, padding: '12px 14px', background: '#FAFAFA', borderRadius: 10, border: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Tendencia Semanal</div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis dataKey="semana" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 11 }}
            formatter={(v) => kr.metrica === 'R$' ? `R$ ${Number(v).toLocaleString('pt-BR')}` : `${v}${kr.metrica === '%' ? '%' : ''}`}
          />
          <ReferenceLine y={target} stroke="#9CA3AF" strokeDasharray="5 5" label={{ value: 'Meta', position: 'right', fontSize: 9, fill: '#9CA3AF' }} />
          <Area type="monotone" dataKey="valor" stroke={colors.line} fill={colors.fill} strokeWidth={2} dot={{ fill: colors.line, r: 3 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
