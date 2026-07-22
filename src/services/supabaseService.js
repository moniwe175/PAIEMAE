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
    .order('ordem', { ascending: true });
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

  const comandaId = String(tx.comanda || tx.id || '').trim();

  // Normalizar campos para corresponder exatamente ao schema do banco
  const dbTx = {
    id: comandaId,
    tipo: tx.tipo || 'receita',
    descricao: tx.desc || tx.descricao || tx.procedimento || tx.cliente || null,
    categoria: tx.categoria || null,
    data: tx.data || new Date().toLocaleDateString('pt-BR'),
    valor: Number(tx.valor ?? tx.total ?? 0),
    total: Number(tx.total ?? tx.valor ?? 0),
    origem: tx.origem || 'planilha',
    hora: tx.hora || null,
    cliente: tx.cliente || null,
    procedimento: tx.procedimento || null,
    clinica: Number(tx.clinica ?? 0),
    profissional: Number(tx.profissional ?? 0),
    pagamento: tx.pagamento || tx.formaPagamento || tx.forma_pagamento || 'pix',
    forma_pagamento: tx.forma_pagamento || tx.formaPagamento || tx.pagamento || null,
    status: tx.status || 'paid',
    profissional_nome: tx.profissionalNome || tx.profissional_nome || null,
    comanda: comandaId,
    ordem: Number(tx.ordem ?? 0),
    user_id: tx.user_id || null,
  };

  const { data, error } = await supabase
    .from('transactions')
    .upsert([dbTx], { onConflict: 'id' })
    .select()
    .single();
  if (error) {
    console.error('[Supabase] upsertTransaction error:', error);
    return handleError(error);
  }
  return { data, error: null };
}

export async function deleteTransaction(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) return handleError(error);
  return { data: true, error: null };
}

export async function fetchAllTransactionIds() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase.from('transactions').select('id');
  if (error) return handleError(error, []);
  return { data: (data || []).map(row => String(row.id)), error: null };
}

export async function deleteTransactionsByIds(idsToDelete) {
  if (!isSupabaseConfigured() || !idsToDelete || idsToDelete.length === 0) return { data: true, error: null };
  const { error } = await supabase.from('transactions').delete().in('id', idsToDelete);
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

  // Normalizar campos para corresponder exatamente ao schema do banco
  const dbExp = {
    id: (exp.id || '').toString(),
    data: exp.data || new Date().toLocaleDateString('pt-BR'),
    descricao: exp.descricao || exp.description || exp.categoria || 'Despesa',
    categoria: exp.categoria || exp.category || 'Outros',
    valor: Number(exp.valor ?? exp.amount ?? 0),
    metodo_pagamento: exp.metodo_pagamento || exp.metodoPagamento || exp.metodo || 'Outros',
    origem: exp.origem || 'manual',
    tipo: exp.tipo || 'despesa',
    user_id: exp.user_id || null,
  };

  const { data, error } = await supabase
    .from('expenses')
    .upsert([dbExp], { onConflict: 'id' })
    .select()
    .single();
  if (error) {
    console.error('[Supabase] upsertExpense error:', error);
    return handleError(error);
  }
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
  // Mapear para colunas reais do banco (event e status são NOT NULL)
  const dbLog = {
    event: log.event || log.type || 'info',
    status: log.status || (log.type === 'error' ? 'error' : 'success'),
    details: log.message || log.details || null,
    type: log.type || null,
    message: log.message || null,
  };
  const { data, error } = await supabase.from('sync_logs').insert([dbLog]).select().single();
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

  // Mapear para colunas reais da tabela
  const dbConnection = {
    provider: connection.provider || connection.tipo || 'google',
    name: connection.nome || connection.name || connection.sheetName || 'Planilha',
    sheet_url: connection.url || connection.sheetUrl || connection.sheet_url || '',
    status: connection.status || 'aguardando',
    sync_mode: connection.syncMode || connection.sync_mode || 'polling60',
    poll_interval: connection.pollingInterval || connection.poll_interval || 60,
    auto_sync: connection.autoSync ?? connection.auto_sync ?? true,
    rows_synced: connection.linhasSincronizadas || connection.rows_synced || 0,
    // Colunas opcionais
    sheet_id: connection.sheetId || connection.sheet_id || null,
    api_key: connection.googleApiKey || connection.api_key || null,
    range: connection.range || 'A1:Z1000',
    user_id: connection.user_id || null,
  };

  // Só inclui o id se for um UUID válido (evita erro de casting com strings como 'sheet_1')
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (connection.id && uuidRegex.test(connection.id)) {
    dbConnection.id = connection.id;
  }
  // Se nao tem UUID valido, nao inclui id para o banco gerar automaticamente

  const { data, error } = await supabase
    .from('sheet_connections')
    .upsert(dbConnection, { onConflict: 'id' })
    .select()
    .single();
  if (error) {
    console.error('[Supabase] upsertSheetConnection error:', error);
    return handleError(error);
  }
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

  // Remover user_id se nao for fornecido (coluna nullable)
  const dbReport = { ...report };
  if (!dbReport.user_id) delete dbReport.user_id;
  // Remover id para deixar o banco gerar UUID automaticamente
  if (!dbReport.id) delete dbReport.id;

  // Usar onConflict apenas em data_caixa (user_id pode ser null)
  const { data, error } = await supabase
    .from('daily_reports')
    .upsert([dbReport], { onConflict: 'data_caixa' })
    .select()
    .single();
  if (error) {
    console.error('[Supabase] insertDailyReport error:', error);
    return handleError(error);
  }
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

// ─── Marketing Engine Settings ──────────────────────────────

export async function getMarketingEngineStatus() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', { enabled: true });
  const { data, error } = await supabase
    .from('marketing_engine_settings')
    .select('enabled, updated_at, updated_by')
    .eq('id', 1)
    .maybeSingle();
  if (error) return handleError(error, { enabled: true, updated_at: null, updated_by: null });
  return { data: data || { enabled: true, updated_at: null, updated_by: null }, error: null };
}

export async function setMarketingEngineEnabled(enabled) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('marketing_engine_settings')
    .update({ enabled, updated_at: new Date().toISOString(), updated_by: 'frontend' })
    .eq('id', 1)
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
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

// ─── Clients (Patients) ───────────────────────────────────────

export async function fetchClients() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  try {
    // Fetch all clients in parallel batches of 1000 to bypass Supabase row limit
    const [batch1, batch2, batch3] = await Promise.all([
      supabase.from('clients').select('*').order('name', { ascending: true }).range(0, 999),
      supabase.from('clients').select('*').order('name', { ascending: true }).range(1000, 1999),
      supabase.from('clients').select('*').order('name', { ascending: true }).range(2000, 2999),
    ]);
    const allData = [
      ...(batch1.data || []),
      ...(batch2.data || []),
      ...(batch3.data || []),
    ];
    return { data: allData, error: null };
  } catch (err) {
    return handleError(err, []);
  }
}

export async function insertClient(client) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('clients').insert([client]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function updateClient(id, updates) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('clients').update(updates).eq('id', id).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function deleteClient(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) return handleError(error);
  return { data: true, error: null };
}

// ─── Appointments ─────────────────────────────────────────────

export async function fetchAppointments() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertAppointment(apt) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('appointments').insert([apt]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function updateAppointment(id, updates) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('appointments').update(updates).eq('id', id).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function deleteAppointment(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('appointments').delete().eq('id', id);
  if (error) return handleError(error);
  return { data: true, error: null };
}

// ─── Anamneses ────────────────────────────────────────────────

export async function fetchAnamneses() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('anamneses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function upsertAnamnese(anamnese) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('anamneses')
    .upsert([anamnese], { onConflict: 'id' })
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function deleteAnamnese(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('anamneses').delete().eq('id', id);
  if (error) return handleError(error);
  return { data: true, error: null };
}

// ─── Inventory (Estoque) ────────────────────────────────────

export async function fetchInventory() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertInventoryItem(item) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('inventory').insert([item]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function updateInventoryItem(id, updates) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('inventory').update(updates).eq('id', id).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function deleteInventoryItem(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('inventory').delete().eq('id', id);
  if (error) return handleError(error);
  return { data: true, error: null };
}

// ─── Packages (Pacotes) ─────────────────────────────────────

export async function fetchPackages() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertPackage(pkg) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  console.log('[PACKAGES] Inserting package:', pkg);
  const { data, error } = await supabase.from('packages').insert([pkg]).select().single();
  if (error) {
    console.error('[PACKAGES] Error inserting:', error);
    return handleError(error);
  }
  console.log('[PACKAGES] Insert successful:', data);
  return { data, error: null };
}

export async function updatePackage(id, updates) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('packages').update(updates).eq('id', id).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function deletePackage(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('packages').delete().eq('id', id);
  if (error) return handleError(error);
  return { data: true, error: null };
}

// ─── Kanban Leads ───────────────────────────────────────────

export async function fetchKanbanLeads() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('kanban_leads')
    .select('*')
    .order('ordem', { ascending: true });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function insertKanbanLead(lead) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('kanban_leads').insert([lead]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function updateKanbanLead(id, updates) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase.from('kanban_leads').update(updates).eq('id', id).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function deleteKanbanLead(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { error } = await supabase.from('kanban_leads').delete().eq('id', id);
  if (error) return handleError(error);
  return { data: true, error: null };
}

