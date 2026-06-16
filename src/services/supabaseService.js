import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ─── Helper ───────────────────────────────────────────────────

function handleError(error, fallback = null) {
  console.warn('[Supabase]', error?.message || error);
  return { data: fallback, error };
}

// ─── Connectivity Check ───────────────────────────────────────

export async function checkSupabaseConnection() {
  if (!isSupabaseConfigured()) return { connected: false, error: 'Supabase not configured' };
  try {
    const { error } = await supabase.from('transactions').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return { connected: true, error: null };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

// ─── Transactions ─────────────────────────────────────────────

export async function fetchTransactions() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertTransaction(tx) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('transactions').insert([tx]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function upsertTransaction(tx) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('transactions')
    .upsert([tx], { onConflict: 'id' })
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function deleteTransaction(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) return handleError(error);
  return { data: true, error: null };
}

// ─── Expenses ─────────────────────────────────────────────────

export async function fetchExpenses() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertExpense(exp) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('expenses').insert([exp]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function upsertExpense(exp) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('expenses')
    .upsert([exp], { onConflict: 'id' })
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function deleteExpense(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) return handleError(error);
  return { data: true, error: null };
}

// ─── Commissions (Comissoes) ──────────────────────────────────

export async function fetchComissoes() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('comissoes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertComissao(com) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('comissoes').insert([com]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function updateComissao(id, updates) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('comissoes').update(updates).eq('id', id).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

// ─── Cashier State ────────────────────────────────────────────

export async function fetchCashierState() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', null);
  const { data, error } = await supabase
    .from('cashier_state')
    .select('*')
    .maybeSingle();
  if (error) return handleError(error, null);
  return { data, error: null };
}

export async function upsertCashierState(state) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data: existing } = await supabase.from('cashier_state').select('id').maybeSingle();
  if (existing?.id) {
    const { data, error } = await supabase.from('cashier_state').update(state).eq('id', existing.id).select().single();
    if (error) return handleError(error);
    return { data, error: null };
  }
  const { data, error } = await supabase.from('cashier_state').insert([state]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

// ─── Split Config ─────────────────────────────────────────────

export async function fetchSplitConfig() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase.from('split_config').select('*');
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function upsertSplitConfig(config) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('split_config')
    .upsert(config, { onConflict: 'profissional' })
    .select();
  if (error) return handleError(error);
  return { data, error: null };
}

// ─── Sync Logs ────────────────────────────────────────────────

export async function fetchSyncLogs(limit = 200) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertSyncLog(log) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('sync_logs').insert([log]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function clearSyncLogs() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('sync_logs').delete().neq('id', 0);
  if (error) return handleError(error);
  return { data: true, error: null };
}

// ─── Sheet Connections ────────────────────────────────────────

export async function fetchSheetConnections() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase.from('sheet_connections').select('*');
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function upsertSheetConnection(connection) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('sheet_connections')
    .upsert(connection, { onConflict: 'id' })
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function deleteSheetConnection(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('sheet_connections').delete().eq('id', id);
  if (error) return handleError(error);
  return { data: true, error: null };
}

// ─── Realtime Subscriptions ───────────────────────────────────

export function subscribeToTable(table, callback) {
  if (!isSupabaseConfigured()) return null;
  return supabase
    .channel(`${table}_changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      callback(payload);
    })
    .subscribe();
}

export function unsubscribeChannel(channel) {
  if (channel) supabase.removeChannel(channel);
}

// ─── Daily Reports (Caixa Fechamento) ─────────────────────────

export async function insertDailyReport(report) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('daily_reports')
    .upsert([report], { onConflict: 'user_id,data_caixa' })
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function fetchDailyReports(limit = 30) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .order('data_caixa', { ascending: false })
    .limit(limit);
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function fetchDailyReportByDate(dateStr) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('data_caixa', dateStr)
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

// ─── Campaigns (Marketing) ─────────────────────────────────

export async function fetchCampaigns() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertCampaign(campaign) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('campaigns').insert([campaign]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function updateCampaign(id, updates) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('campaigns').update(updates).eq('id', id).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function deleteCampaign(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) return handleError(error);
  return { data: true, error: null };
}

// ─── Auth ─────────────────────────────────────────────────────

export async function signUp(email, password, metadata = {}) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
  if (error) return handleError(error);
  return { data, error: null };
}

export async function signIn(email, password) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return handleError(error);
  return { data, error: null };
}

export async function signOut() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.auth.signOut();
  if (error) return handleError(error);
  return { data: true, error: null };
}

export async function resetPassword(email) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) return handleError(error);
  return { data, error: null };
}

export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured()) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange(callback);
}
