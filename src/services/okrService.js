import { supabase, isSupabaseConfigured } from '../lib/supabase';

function handleError(error, fallback = null) {
  console.warn('[OKR Service]', error?.message || error);
  return { data: fallback, error: error?.message || error };
}

// ─── Ciclos OKR ──────────────────────────────────────────────

export async function fetchCiclos() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('ciclos_okr')
    .select('*')
    .order('data_inicio', { ascending: false });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertCiclo(ciclo) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('ciclos_okr').insert([ciclo]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function updateCiclo(id, updates) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('ciclos_okr').update(updates).eq('id', id).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function deleteCiclo(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('ciclos_okr').delete().eq('id', id);
  if (error) return handleError(error);
  return { error: null };
}

// ─── Objetivos ───────────────────────────────────────────────

export async function fetchObjetivos(cicloId) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  let query = supabase.from('objetivos').select('*, key_results(*)').order('ordem', { ascending: true });
  if (cicloId) query = query.eq('ciclo_id', cicloId);
  const { data, error } = await query;
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertObjetivo(obj) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('objetivos').insert([obj]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function updateObjetivo(id, updates) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('objetivos').update(updates).eq('id', id).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function deleteObjetivo(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('objetivos').delete().eq('id', id);
  if (error) return handleError(error);
  return { error: null };
}

// ─── Key Results ─────────────────────────────────────────────

export async function fetchKeyResults(objetivoId) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  let query = supabase.from('key_results').select('*').order('created_at', { ascending: true });
  if (objetivoId) query = query.eq('objetivo_id', objetivoId);
  const { data, error } = await query;
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertKeyResult(kr) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('key_results').insert([kr]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function updateKeyResult(id, updates) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('key_results').update(updates).eq('id', id).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function deleteKeyResult(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('key_results').delete().eq('id', id);
  if (error) return handleError(error);
  return { error: null };
}

// ─── KR Weekly Snapshots ─────────────────────────────────────

export async function fetchKRSnapshots(krId) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('kr_weekly_snapshots')
    .select('*')
    .eq('kr_id', krId)
    .order('semana', { ascending: true });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertSnapshot(snapshot) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('kr_weekly_snapshots').upsert([snapshot]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

// ─── Sticky Notes ────────────────────────────────────────────

export async function fetchStickyNotes() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('sticky_notes')
    .select('*')
    .eq('dismissed', false)
    .order('ordem', { ascending: true });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertStickyNote(note) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('sticky_notes').insert([note]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function updateStickyNote(id, updates) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('sticky_notes').update(updates).eq('id', id).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function dismissStickyNote(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('sticky_notes').update({ dismissed: true }).eq('id', id);
  if (error) return handleError(error);
  return { error: null };
}

// ─── Strategic Tasks ─────────────────────────────────────────

export async function fetchStrategicTasks() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('strategic_tasks')
    .select('*')
    .order('ordem', { ascending: true });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertStrategicTask(task) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('strategic_tasks').insert([task]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function updateStrategicTask(id, updates) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('strategic_tasks').update(updates).eq('id', id).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function moveStrategicTask(id, coluna) {
  return updateStrategicTask(id, { coluna });
}

export async function deleteStrategicTask(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('strategic_tasks').delete().eq('id', id);
  if (error) return handleError(error);
  return { error: null };
}
