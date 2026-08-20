import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ─── Helper ───────────────────────────────────────────────────

function handleError(error, fallback = null) {
  console.warn('[Supabase]', error?.message || error);
  return { data: fallback, error };
}

/**
 * Dia calendário ATUAL no fuso da clínica (America/Sao_Paulo), YYYY-MM-DD.
 * NUNCA usar UTC (toISOString) para caixa/planilha: a partir das 21h de
 * Brasília o UTC já é "amanhã", o que abria o caixa do dia seguinte
 * adiantado e com fundo herdado errado.
 */
export function todayBRT() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/**
 * Retorna o user_id do usuário autenticado atual.
 * Usado para garantir que todos os inserts/upserts tenham user_id correto para RLS.
 */
export async function getUserId() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
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
  const userId = tx.user_id || await getUserId();
  const { data, error } = await supabase.from('transactions').insert([{ ...tx, user_id: userId }]).select().single();
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
    profissional: (typeof tx.profissional === 'string' ? tx.profissional : tx.profissionalNome || tx.profissional_nome) || null,
    pagamento: tx.pagamento || tx.formaPagamento || tx.forma_pagamento || 'pix',
    forma_pagamento: tx.forma_pagamento || tx.formaPagamento || tx.pagamento || null,
    status: tx.status || 'paid',
    profissional_nome: tx.profissionalNome || tx.profissional_nome || (typeof tx.profissional === 'string' ? tx.profissional : null),
    comanda: comandaId,
    ordem: Number(tx.ordem ?? 0),
    hash: tx.hash || null,
    user_id: tx.user_id || await getUserId(),
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

// ─── Sheet Transactions (fonte real dos dados financeiros) ─────
// Os dados vêm do readdy.ai sincronizando a planilha Google Sheets.
// Filtros obrigatórios: is_metadata = false AND deleted_at IS NULL

export async function fetchSheetTransactions() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('sheet_transactions')
    .select('*')
    .is('deleted_at', null)
    .eq('date_ref', todayBRT())
    .order('date_ref', { ascending: false });
  if (error) return handleError(error, []);
  const filtered = (data || []).filter(r => {
    const rt = String(r.row_type || r.tipo || '').toLowerCase().trim();
    return rt !== 'header' && rt !== 'sumario';
  });
  return { data: filtered, error: null };
}

export async function fetchSheetTransactionsSummary() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', { receitas: 0, despesas: 0, sangrias: 0, count: { receitas: 0, despesas: 0, sangrias: 0 } });
  const { data, error } = await supabase
    .from('sheet_transactions')
    .select('row_type, tipo, gross')
    .is('deleted_at', null)
    .eq('date_ref', todayBRT());
  if (error) return handleError(error, { receitas: 0, despesas: 0, sangrias: 0, count: { receitas: 0, despesas: 0, sangrias: 0 } });
  const summary = { receitas: 0, despesas: 0, sangrias: 0, count: { receitas: 0, despesas: 0, sangrias: 0 } };
  (data || []).forEach(row => {
    const v = Number(row.gross) || 0;
    const rt = String(row.row_type || row.tipo || '').toLowerCase().trim();
    if (rt === 'header' || rt === 'sumario') return;
    if (rt.includes('sangria')) {
      summary.sangrias += v;
      summary.count.sangrias += 1;
    } else if (rt.includes('despesa') || rt.includes('saida') || rt.includes('saída') || rt.includes('gasto')) {
      summary.despesas += v;
      summary.count.despesas += 1;
    } else if (rt.includes('receita') || rt === '' || !rt) {
      summary.receitas += v;
      summary.count.receitas += 1;
    }
  });
  return { data: summary, error: null };
}

export async function upsertSheetTransaction(st) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');

  const comandaStr = st.comanda ? String(st.comanda).trim() : null;

  const payload = {
    date_ref: st.date_ref || todayBRT(),
    client: st.client || null,
    procedure: st.procedure || null,
    professional: st.professional || null,
    gross: Number(st.gross || 0),
    commission_percent: st.commission_percent != null ? Number(st.commission_percent) : null,
    commission_value: st.commission_value != null ? Number(st.commission_value) : null,
    payment_method: st.payment_method || 'Pix',
    pix: Number(st.pix || 0),
    credito: Number(st.credito || 0),
    debito: Number(st.debito || 0),
    dinheiro: Number(st.dinheiro || 0),
    repasse: Number(st.repasse || 0),
    comanda: comandaStr,
    row_type: st.row_type || 'receita',
    tipo: st.tipo || st.row_type || 'receita',
    origin: st.origin || 'planilha',
    is_metadata: false,
    deleted_at: null,
  };

  if (st.id) payload.id = st.id;
  if (st.connection_id) payload.connection_id = st.connection_id;

  // Se não tem ID, tenta encontrar registro existente por comanda
  if (!payload.id && comandaStr) {
    try {
      let query = supabase
        .from('sheet_transactions')
        .select('id')
        .eq('comanda', comandaStr)
        .is('deleted_at', null);

      const { data: existingList } = await query.order('created_at', { ascending: false }).limit(1);

      if (existingList && existingList.length > 0) {
        payload.id = existingList[0].id;
      }
    } catch (_) {}
  }

  try {
    let res;
    if (payload.id) {
      res = await supabase
        .from('sheet_transactions')
        .upsert([payload], { onConflict: 'id' })
        .select();
    } else {
      res = await supabase
        .from('sheet_transactions')
        .insert([payload])
        .select();
    }

    if (res.error) {
      console.warn('[Supabase] upsertSheetTransaction warning:', res.error.message || res.error);
      return handleError(res.error);
    }
    return { data: res.data?.[0] || payload, error: null };
  } catch (err) {
    console.warn('[Supabase] upsertSheetTransaction exception:', err?.message || err);
    return handleError(err);
  }
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
  const userId = exp.user_id || await getUserId();
  const { data, error } = await supabase.from('expenses').insert([{ ...exp, user_id: userId }]).select().single();
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
    user_id: exp.user_id || await getUserId(),
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
  const userId = com.user_id || await getUserId();
  const { data, error } = await supabase.from('comissoes').insert([{ ...com, user_id: userId }]).select().single();
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

/** Busca o registro de caixa do dia atual (status = 'aberto', date = hoje) */
export async function fetchTodayCashier() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', null);
  const today = todayBRT(); // YYYY-MM-DD no fuso da clínica
  const { data, error } = await supabase
    .from('cashier_state')
    .select('*')
    .eq('status', 'aberto')
    .eq('date', today)
    .maybeSingle();
  if (error) return handleError(error, null);
  return { data, error: null };
}

/** Busca qualquer registro de caixa do dia atual (aberto ou fechado) */
export async function fetchAnyCashierToday() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', null);
  const today = todayBRT();
  const { data, error } = await supabase
    .from('cashier_state')
    .select('*')
    .eq('date', today)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return handleError(error, null);
  return { data, error: null };
}

/** Busca o closing_balance do último caixa fechado (para herdar como opening_balance do próximo) */
export async function fetchLastClosingBalance() {
  if (!isSupabaseConfigured()) return { balance: 0, data: null, error: null };
  try {
    // Tenta primeiro no cashier_state (novo schema)
    const { data, error } = await supabase
      .from('cashier_state')
      .select('closing_balance, opening_balance, total_cash_in, total_cash_out, date')
      .eq('status', 'fechado')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const bal = Number(
        data.closing_balance ??
        (Number(data.opening_balance || 0) + Number(data.total_cash_in || 0) - Number(data.total_cash_out || 0))
      );
      return { balance: bal, data, error: null };
    }

    // Fallback: daily_reports (schema antigo)
    const { data: dr } = await supabase
      .from('daily_reports')
      .select('fundo_final_real, fundo_final_calculado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dr) {
      const bal = Number(dr.fundo_final_real ?? dr.fundo_final_calculado ?? 0);
      return { balance: bal, data: dr, error: null };
    }
  } catch (err) {
    console.warn('[Supabase] fetchLastClosingBalance exception:', err);
  }
  return { balance: 0, data: null, error: null };
}

/** Cria um novo caixa para hoje com o saldo herdado */
export async function openNewCashier(openingBalance = 0) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const today = todayBRT();
  // Somente colunas confirmadas em produção (sem campos legados
  // saldo/horaAbertura/dataAbertura/sangrias/user_id — não existem na tabela)
  const payload = {
    date: today,
    status: 'aberto',
    opening_balance: Number(openingBalance) || 0,
    closing_balance: null,
    total_cash_in: 0,
    total_cash_out: 0,
    opened_at: new Date().toISOString(),
    closed_at: null,
    auto_closed: false,
  };

  // Verifica se já existe um registro para hoje
  const { data: existing } = await supabase
    .from('cashier_state')
    .select('id')
    .eq('date', today)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from('cashier_state')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return handleError(error);
    return { data, error: null };
  }

  const { data, error } = await supabase
    .from('cashier_state')
    .insert([payload])
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

/** Fecha um caixa existente pelo id */
export async function closeCashierById(id, { closingBalance, autoClosed = false, totalCashIn = 0, totalCashOut = 0 }) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('cashier_state')
    .update({
      status: 'fechado',
      closing_balance: Number(closingBalance) || 0,
      total_cash_in: Number(totalCashIn) || 0,
      total_cash_out: Number(totalCashOut) || 0,
      closed_at: new Date().toISOString(),
      auto_closed: autoClosed,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

/** Atualiza total_cash_in e total_cash_out do caixa de hoje */
export async function updateCashierTotals(id, { totalCashIn, totalCashOut }) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('cashier_state')
    .update({
      total_cash_in: Number(totalCashIn) || 0,
      total_cash_out: Number(totalCashOut) || 0,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

/** Histórico dos últimos 30 dias de caixas */
export async function fetchCashierHistory(limit = 30) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('cashier_state')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

/** Insere uma sangria em cashier_sangrias e retorna o registro */
export async function insertSangria({ valor, motivo, cashierDate }) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const userId = await getUserId();
  const today = cashierDate || todayBRT();
  const payload = { valor: Number(valor), motivo: motivo || '', cashier_date: today };
  if (userId) payload.user_id = userId;
  const { data, error } = await supabase.from('cashier_sangrias').insert([payload]).select().single();
  if (error) return handleError(error);
  return { data, error: null };
}

/** Busca sangrias do dia atual */
export async function fetchTodaySangrias() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const today = todayBRT();
  const { data, error } = await supabase
    .from('cashier_sangrias')
    .select('*')
    .eq('cashier_date', today)
    .order('created_at', { ascending: true });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

/** Fecha caixas de dias anteriores que ainda estão abertos (auto-close frontend) */
export async function autoClosePreviousCashiers() {
  if (!isSupabaseConfigured()) return { closed: 0, error: null };
  const today = todayBRT();
  try {
    const { data: openOld, error } = await supabase
      .from('cashier_state')
      .select('*')
      .eq('status', 'aberto')
      .lt('date', today);

    if (error || !openOld?.length) return { closed: 0, error };

    for (const record of openOld) {
      const closingBal = Number(record.opening_balance || 0) + Number(record.total_cash_in || 0) - Number(record.total_cash_out || 0);
      await supabase.from('cashier_state').update({
        status: 'fechado',
        closing_balance: closingBal,
        closed_at: new Date().toISOString(),
        auto_closed: true,
      }).eq('id', record.id);
    }
    return { closed: openOld.length, error: null };
  } catch (err) {
    console.warn('[Supabase] autoClosePreviousCashiers exception:', err);
    return { closed: 0, error: err };
  }
}

/** Compatibilidade com código legado */
export async function fetchCashierState() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', null);
  const { data, error } = await supabase
    .from('cashier_state')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return handleError(error, null);
  return { data, error: null };
}

/** Compatibilidade com código legado */
export async function upsertCashierState(state) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const userId = state.user_id || await getUserId();
  const today = todayBRT();
  const stateWithUser = {
    ...state,
    user_id: userId,
    date: state.date || today,
    opening_balance: state.opening_balance ?? state.saldo ?? 0,
    opened_at: state.opened_at || new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('cashier_state')
    .select('id')
    .eq('date', today)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase.from('cashier_state').update(stateWithUser).eq('id', existing.id).select().single();
    if (error) return handleError(error);
    return { data, error: null };
  }
  const { data, error } = await supabase.from('cashier_state').insert([stateWithUser]).select().single();
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
  const userId = config.user_id || await getUserId();
  const configWithUser = { ...config, user_id: userId };
  const { data, error } = await supabase
    .from('split_config')
    .upsert(configWithUser, { onConflict: 'profissional' })
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
  const userId = log.user_id || await getUserId();
  // Mapear para colunas reais do banco (event e status são NOT NULL)
  const dbLog = {
    event: log.event || log.type || 'info',
    status: log.status || (log.type === 'error' ? 'error' : 'success'),
    details: log.message || log.details || null,
    type: log.type || null,
    message: log.message || null,
    user_id: userId,
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

// Helpers de validação e geração de UUID
function isUuid(str) {
  return typeof str === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
}

function generateUuidFromSeed(seedStr) {
  if (isUuid(seedStr)) return seedStr;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch (e) {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function fetchSheetConnections() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase.from('sheet_connections').select('*');
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function upsertSheetConnection(connection) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');

  const rawId = (connection.id || connection.sheet_id || '').toString();
  const uuid = generateUuidFromSeed(rawId);
  const extractSheetId = connection.sheetId || connection.sheet_id || connection.url?.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || connection.sheet_url?.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || null;
  const userId = connection.user_id || await getUserId();

  // ── Tentativa 1: Payload EN com UUID (schema padrão Supabase)
  const payloadEN = {
    id: uuid,
    name: connection.name || connection.nome || connection.sheetName || 'Planilha',
    provider: connection.provider || connection.tipo || 'google',
    sheet_url: connection.url || connection.sheet_url || connection.sheetUrl || '',
    status: connection.status || 'aguardando',
    auto_sync: connection.auto_sync ?? connection.autoSync ?? true,
    poll_interval: connection.pollingInterval || connection.poll_interval || 60,
    rows_synced: connection.linhasSincronizadas || connection.rows_synced || 0,
    sheet_id: extractSheetId,
    api_key: connection.googleApiKey || connection.api_key || null,
    range: connection.range || 'A1:Z1000',
    user_id: userId,
  };

  let { data, error } = await supabase
    .from('sheet_connections')
    .upsert([payloadEN], { onConflict: 'id' })
    .select();

  // ── Tentativa 2: Payload PT com UUID (caso a tabela use nomes em português)
  if (error) {
    console.warn('[Supabase] Tentativa EN falhou, tentando Payload PT:', error.message);
    const payloadPT = {
      id: uuid,
      nome: connection.nome || connection.name || connection.sheetName || 'Planilha',
      tipo: connection.tipo || connection.provider || 'google',
      url: connection.url || connection.sheet_url || connection.sheetUrl || '',
      status: connection.status || 'aguardando',
      auto_sync: connection.autoSync ?? connection.auto_sync ?? true,
      polling_interval: connection.pollingInterval || connection.poll_interval || 60,
      linhas_sincronizadas: connection.linhasSincronizadas || connection.rows_synced || 0,
      sheet_id: extractSheetId,
      api_key: connection.googleApiKey || connection.api_key || null,
      range: connection.range || 'A1:Z1000',
      user_id: userId,
    };

    const res2 = await supabase
      .from('sheet_connections')
      .upsert([payloadPT], { onConflict: 'id' })
      .select();

    data = res2.data;
    error = res2.error;
  }

  // ── Tentativa 3: Se o id na tabela for do tipo TEXT (e não UUID), tenta com rawId original
  if (error && rawId && !isUuid(rawId)) {
    console.warn('[Supabase] Tentativa com UUID falhou, tentando string rawId:', error.message);
    const payloadText = { ...payloadEN, id: rawId };
    const res3 = await supabase
      .from('sheet_connections')
      .upsert([payloadText], { onConflict: 'id' })
      .select();

    data = res3.data;
    error = res3.error;
  }

  if (error) {
    console.error('[Supabase] upsertSheetConnection erro final:', error);
    return handleError(error);
  }

  const resultData = Array.isArray(data) ? data[0] : data;
  return { data: resultData || payloadEN, error: null };
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

  const dataStr = report.data || report.data_caixa || new Date().toLocaleDateString('pt-BR');
  
  const dbReport = {
    data: dataStr,
    data_caixa: report.data_caixa || (dataStr.includes('/') ? dataStr.split('/').reverse().join('-') : dataStr),
    fundo_inicial: Number(report.fundo_inicial ?? 0),
    total_dinheiro: Number(report.total_dinheiro ?? 0),
    total_pix: Number(report.total_pix ?? 0),
    total_credito: Number(report.total_credito ?? 0),
    total_debito: Number(report.total_debito ?? 0),
    fundo_final_calculado: Number(report.fundo_final_calculado ?? (Number(report.fundo_inicial ?? 0) + Number(report.total_dinheiro ?? 0))),
    fundo_final_real: Number(report.fundo_final_real ?? report.fundo_final ?? 0),
    diferenca: Number(report.diferenca ?? (Number(report.fundo_final_real ?? report.fundo_final ?? 0) - (Number(report.fundo_inicial ?? 0) + Number(report.total_dinheiro ?? 0)))),
    status: report.status || (Number(report.diferenca ?? 0) === 0 ? 'ok' : 'erro'),
    observacoes: report.observacoes || null,
    sheet_snapshot: report.sheet_snapshot || null,
  };

  if (report.user_id) dbReport.user_id = report.user_id;
  else dbReport.user_id = await getUserId();

  // Tentativa 1: upsert normal
  let { data, error } = await supabase
    .from('daily_reports')
    .upsert([dbReport])
    .select()
    .single();

  if (error) {
    console.warn('[Supabase] insertDailyReport warning, tentando insert simples:', error.message);
    const res = await supabase.from('daily_reports').insert([dbReport]).select().single();
    data = res.data;
    error = res.error;
  }

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
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function fetchDailyReportByDate(dateStr) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .or(`data.eq.${dateStr},data_caixa.eq.${dateStr}`)
    .maybeSingle();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function fetchLastClosedCashierBalance() {
  if (!isSupabaseConfigured()) return { balance: 0, error: null };
  try {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('fundo_final_real, fundo_final_calculado, fundo_inicial, total_dinheiro, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase] fetchLastClosedCashierBalance warning:', error.message);
      return { balance: 0, error };
    }

    if (data) {
      const lastVal = Number(data.fundo_final_real ?? data.fundo_final_calculado ?? 0);
      return { balance: lastVal, error: null };
    }
  } catch (err) {
    console.warn('[Supabase] fetchLastClosedCashierBalance exception:', err);
  }
  return { balance: 0, error: null };
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
  const userId = campaign.user_id || await getUserId();
  const { data, error } = await supabase.from('campaigns').insert([{ ...campaign, user_id: userId }]).select().single();
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
  const userId = client.user_id || await getUserId();
  const { data, error } = await supabase.from('clients').insert([{ ...client, user_id: userId }]).select().single();
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
  // A tabela appointments NÃO possui coluna user_id — remover antes de inserir
  // eslint-disable-next-line no-unused-vars
  const { user_id, ...aptPayload } = apt;
  const { data, error } = await supabase.from('appointments').insert([aptPayload]).select().single();
  if (error) {
    console.error('[Supabase] insertAppointment error:', error);
    return handleError(error);
  }
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
  const userId = anamnese.user_id || await getUserId();
  const { data, error } = await supabase
    .from('anamneses')
    .upsert([{ ...anamnese, user_id: userId }], { onConflict: 'id' })
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
  const userId = item.user_id || await getUserId();
  const { data, error } = await supabase.from('inventory').insert([{ ...item, user_id: userId }]).select().single();
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


// ─── Motor Marketing — Templates ─────────────────────────────

export async function fetchTemplates() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .order('tool_id', { ascending: true });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function updateTemplate(toolId, text) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('message_templates')
    .update({ template_text: text, updated_at: new Date().toISOString() })
    .eq('tool_id', toolId)
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function toggleTemplate(toolId, active) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('message_templates')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('tool_id', toolId)
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

// ─── Motor Marketing — Queue ──────────────────────────────────

export async function fetchQueue(status = null) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  let query = supabase
    .from('marketing_queue')
    .select('*')
    .order('scheduled_at', { ascending: true })
    .limit(100);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function fetchQueueHistory() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('marketing_queue')
    .select('*')
    .in('status', ['sent', 'failed', 'cancelled', 'expired'])
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function fetchQueuePendingCount() {
  if (!isSupabaseConfigured()) return { data: 0, error: null };
  const { count, error } = await supabase
    .from('marketing_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return { data: 0, error };
  return { data: count || 0, error: null };
}

export async function approveMessage(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('marketing_queue')
    .update({
      status: 'approved',
      approved_by: 'gestora',
      approved_at: new Date().toISOString(),
      // Aprovar renova o relógio: a Regra de Vencimento (1h) conta a partir
      // da aprovação, não da geração — útil quando o worker estava desligado.
      scheduled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function discardMessage(id) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('marketing_queue')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

// ─── Access Requests ──────────────────────────────────────────

export async function requestAccess({ nome, email, telefone, mensagem }) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('access_requests')
    .insert([{ nome, email, telefone, mensagem, status: 'pending' }])
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function checkUserAccessStatus(email) {
  if (!isSupabaseConfigured()) return { data: null, error: null };
  const { data, error } = await supabase
    .from('access_requests')
    .select('status')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return handleError(error);
  return { data, error: null };
}

export async function fetchAccessRequests() {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured', []);
  const { data, error } = await supabase
    .from('access_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return handleError(error, []);
  return { data: data || [], error: null };
}

export async function updateAccessRequestStatus(id, status) {
  if (!isSupabaseConfigured()) return handleError('Supabase not configured');
  const { data, error } = await supabase
    .from('access_requests')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) return handleError(error);
  return { data, error: null };
}
