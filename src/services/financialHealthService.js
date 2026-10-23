import { supabase } from '../lib/supabase';
import { MATRIX_UNIT_ID } from './franchiseService';

const missingSchema = (error) => ['42P01', 'PGRST204', 'PGRST205'].includes(error?.code)
  || /does not exist|schema cache/i.test(error?.message || '');

const assertResult = (result) => {
  if (!result?.error) return result?.data;
  if (missingSchema(result.error)) {
    const error = new Error('A Central Financeira ainda não foi instalada no Supabase.');
    error.code = 'FINANCIAL_SETUP_REQUIRED';
    throw error;
  }
  throw result.error;
};

const fetchAll = async (table, configure, pageSize = 1000) => {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select('*');
    if (configure) query = configure(query);
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
};

export async function loadFinancialBundle({ unitId = MATRIX_UNIT_ID, periodMonth } = {}) {
  const month = String(periodMonth || new Date().toISOString().slice(0, 7)).slice(0, 7);
  const monthDate = `${month}-01`;
  const [model, input, monthlyHistory, entries, budgets, serviceCosts, allTransactions, marketing] = await Promise.all([
    supabase.from('franchise_economic_models').select('*').eq('unit_id', unitId).maybeSingle(),
    supabase.from('franchise_monthly_inputs').select('*').eq('unit_id', unitId).eq('period_month', monthDate).maybeSingle(),
    supabase.from('franchise_monthly_inputs').select('*').eq('unit_id', unitId).order('period_month'),
    supabase.from('financial_entries').select('*').eq('unit_id', unitId).order('due_date'),
    supabase.from('financial_budgets').select('*').eq('unit_id', unitId).eq('period_month', monthDate).order('category'),
    supabase.from('financial_service_costs').select('*').eq('unit_id', unitId).order('service_name'),
    fetchAll('sheet_transactions', (query) => query.eq('unit_id', unitId).eq('is_metadata', false).is('deleted_at', null).order('date_ref')),
    supabase.from('franchise_marketing_investments').select('*').eq('unit_id', unitId).eq('period_month', monthDate),
  ]);
  return {
    unitId,
    periodMonth: monthDate,
    model: assertResult(model) || { unit_id: unitId, configured: false },
    monthlyInput: assertResult(input) || { unit_id: unitId, period_month: monthDate, cash_reconciled: false },
    monthlyHistory: assertResult(monthlyHistory) || [],
    entries: assertResult(entries) || [],
    budgets: assertResult(budgets) || [],
    serviceCosts: assertResult(serviceCosts) || [],
    allTransactions,
    marketingInvestments: assertResult(marketing) || [],
  };
}

const clean = (payload) => Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

export async function saveFinancialMonthlyInput(payload) {
  const { data, error } = await supabase.from('franchise_monthly_inputs')
    .upsert(clean(payload), { onConflict: 'unit_id,period_month' }).select().single();
  if (error) throw error;
  return data;
}

export async function saveFinancialModel(payload) {
  const { data, error } = await supabase.from('franchise_economic_models')
    .upsert(clean(payload), { onConflict: 'unit_id' }).select().single();
  if (error) throw error;
  return data;
}

export async function saveFinancialEntry(payload) {
  const { data, error } = await supabase.from('financial_entries').upsert(clean(payload)).select().single();
  if (error) throw error;
  return data;
}

export async function removeFinancialEntry(id) {
  const { error } = await supabase.from('financial_entries').delete().eq('id', id);
  if (error) throw error;
}

export async function importFinancialEntries(rows, unitId = MATRIX_UNIT_ID) {
  if (!rows.length) return [];
  const payload = rows.map((row) => ({ ...row, unit_id: unitId, source: 'csv' }));
  const { data, error } = await supabase.from('financial_entries')
    .upsert(payload, { onConflict: 'unit_id,external_id' }).select();
  if (error) throw error;
  return data || [];
}

export async function saveBudget(payload) {
  const { data, error } = await supabase.from('financial_budgets')
    .upsert(clean(payload), { onConflict: 'unit_id,period_month,category' }).select().single();
  if (error) throw error;
  return data;
}

export async function saveServiceCost(payload) {
  const { data, error } = await supabase.from('financial_service_costs')
    .upsert(clean(payload), { onConflict: 'unit_id,service_name' }).select().single();
  if (error) throw error;
  return data;
}
