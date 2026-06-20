// ─── Auto-generation engine for Sticky Notes ─────────────────
// Derives priority notes from current system state (stock, OKRs, etc.)

function genAutoId(source, key) {
  return `auto_${source}_${key}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function generateAutoNotes({ stockAlerts = [], okrs = [], appointments = [] } = {}) {
  const notes = [];

  // Stock critical -> URGENTE
  stockAlerts.forEach(item => {
    const ratio = item.minimo > 0 ? item.estoque / item.minimo : 1;
    if (ratio <= 0.5) {
      notes.push({
        id: genAutoId('estoque', item.nome),
        texto: `Repor estoque: ${item.nome} (${item.estoque} unid., min: ${item.minimo})`,
        prioridade: 'urgente',
        source: 'estoque',
        auto_generated: true,
      });
    } else if (ratio <= 1) {
      notes.push({
        id: genAutoId('estoque', item.nome),
        texto: `Estoque baixo: ${item.nome} (${item.estoque} unid., min: ${item.minimo})`,
        prioridade: 'medio',
        source: 'estoque',
        auto_generated: true,
      });
    }
  });

  // KR off-track -> URGENTE or MEDIO
  okrs.forEach(kr => {
    if (kr.status === 'critico') {
      notes.push({
        id: genAutoId('okr', kr.id),
        texto: kr.action_hint || `KR critico: ${kr.titulo} — acao imediata necessaria`,
        prioridade: 'urgente',
        source: 'okr',
        source_kr_id: kr.id,
        auto_generated: true,
      });
    } else if (kr.status === 'alerta') {
      notes.push({
        id: genAutoId('okr', kr.id),
        texto: kr.action_hint || `KR em alerta: ${kr.titulo} — revisar estrategia`,
        prioridade: 'medio',
        source: 'okr',
        source_kr_id: kr.id,
        auto_generated: true,
      });
    }
  });

  // High no-show rate -> MEDIO
  const todayStr = new Date().toISOString().split('T')[0];
  const todayApts = appointments.filter(a => a.data === todayStr);
  const noShows = todayApts.filter(a => a.status === 'cliente_faltou');
  if (todayApts.length > 0 && noShows.length / todayApts.length > 0.25) {
    notes.push({
      id: genAutoId('agenda', 'noshow'),
      texto: `Alta taxa de No-Show hoje: ${noShows.length}/${todayApts.length}. Ativar regua de confirmacao.`,
      prioridade: 'medio',
      source: 'agenda',
      auto_generated: true,
    });
  }

  return notes;
}
