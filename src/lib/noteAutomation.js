// ─── Auto-generation engine for Sticky Notes ─────────────────
// Derives priority notes from current system state (stock, OKRs, etc.)

function genAutoId(source, key) {
  return `auto_${source}_${key}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

// Computes the calendar date from a due_day integer and the cycle's start_date.
// e.g. due_day=15 + cycle.start_date='2026-07-01' => Date(2026, 6, 15)
function dueDayToDate(dueDay, cycleStartDate) {
  if (!dueDay || !cycleStartDate) return null;
  const ref = new Date(cycleStartDate);
  return new Date(ref.getFullYear(), ref.getMonth(), dueDay);
}

// Returns 'urgente' | 'medio' | 'pouca' based on days remaining.
// Urgente: overdue or ≤2 days  |  Medio: 3–5 days  |  Pouca: >5 days
function classifyPriority(dueDate, today) {
  if (!dueDate) return 'pouca';
  const msPerDay = 1000 * 60 * 60 * 24;
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const daysRemaining = Math.floor((dueMidnight - todayMidnight) / msPerDay);
  if (daysRemaining <= 2) return 'urgente';
  if (daysRemaining <= 5) return 'medio';
  return 'pouca';
}

// Format a Date as dd/MM for display.
function formatDateBR(date) {
  if (!date) return null;
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function generateAutoNotes({ stockAlerts = [], okrs = [], appointments = [], okrTasks = [], okrCycle = null } = {}) {
  const notes = [];
  const today = new Date();

  // ── 1. Stock alerts (unchanged behaviour) ──────────────────────────────────
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

  // ── 2. OKR Tasks from Estratégia (new behaviour) ────────────────────────────
  // These replace the old kr.status-based notes. Each non-done task becomes a note.
  okrTasks.forEach(task => {
    const dueDate = dueDayToDate(task.dueDay, okrCycle?.start_date);
    console.log('[DEBUG OKR] Task:', task.title, '| dueDay:', task.dueDay, '| cycleStartDate:', okrCycle?.start_date, '| dueDate:', dueDate?.toISOString());
    const prioridade = classifyPriority(dueDate, today);
    const formattedDate = formatDateBR(dueDate);

    // Use same midnight comparison as classifyPriority for consistency
    const msPerDay = 1000 * 60 * 60 * 24;
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueMidnight = dueDate ? new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()) : null;

    console.log('[DEBUG OKR] today:', today.toISOString(), '| todayMidnight:', todayMidnight.toISOString(), '| dueMidnight:', dueMidnight?.toISOString(), '| isOverdue:', dueMidnight ? dueMidnight < todayMidnight : false, '| prioridade:', prioridade);

    notes.push({
      id: genAutoId('okrtask', task.id),
      texto: task.title,
      prioridade,
      source: 'OKR',
      auto_generated: true,
      // Extra fields used by StickyNotesPanel for display:
      dueDate,            // JS Date object
      dueDateStr: formattedDate, // "15/07" formatted string
      isOverdue: dueMidnight ? dueMidnight < todayMidnight : false,
      okrTask: true,      // flag so Dashboard can distinguish from stock notes
    });
  });

  // ── 3. Legacy KR status-based notes (kept for compatibility if passed) ──────
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

  // ── 4. High no-show rate (unchanged) ────────────────────────────────────────
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

