import { supabase } from '../lib/supabase';

export const MATRIX_UNIT_ID = '00000000-0000-4000-8000-000000000001';
export const DEFAULT_NETWORK_ID = '00000000-0000-4000-8000-000000000010';

const isMissingSchemaError = (error) => ['42P01', 'PGRST204', 'PGRST205'].includes(error?.code)
  || /does not exist|schema cache/i.test(error?.message || '');

const throwUnlessMissing = (error) => {
  if (!error) return;
  if (isMissingSchemaError(error)) {
    const setupError = new Error('O módulo Franquia ainda não foi instalado no Supabase.');
    setupError.code = 'FRANCHISE_SETUP_REQUIRED';
    throw setupError;
  }
  throw error;
};

const fetchAll = async (table, configure, pageSize = 1000) => {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select('*');
    if (configure) query = configure(query);
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
};

export const monthPeriod = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = new Date(year, month + 1, 0);
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  return { start, end, month: start };
};

export async function loadFranchiseBundle({ periodMonth, unitId } = {}) {
  const period = monthPeriod(periodMonth || new Date());
  const unitResult = await supabase
    .from('franchise_units')
    .select('*, franchise_networks(*)')
    .order('is_pilot', { ascending: false })
    .order('name');
  throwUnlessMissing(unitResult.error);
  const units = unitResult.data || [];
  const selectedUnitId = unitId || units[0]?.id || MATRIX_UNIT_ID;
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) || units[0] || null;
  const networkId = selectedUnit?.network_id || DEFAULT_NETWORK_ID;
  const networkUnitIds = units.filter((unit) => unit.network_id === networkId).map((unit) => unit.id);

  const [
    modelResult, inputResult, marketingResult, feesResult, targetsResult, auditsResult,
    scenariosResult, closesResult, documentsResult, networkInputResult,
    transactions, appointments, clients,
  ] = await Promise.all([
    supabase.from('franchise_economic_models').select('*').eq('unit_id', selectedUnitId).maybeSingle(),
    supabase.from('franchise_monthly_inputs').select('*').eq('unit_id', selectedUnitId).eq('period_month', period.month).maybeSingle(),
    supabase.from('franchise_marketing_investments').select('*').eq('unit_id', selectedUnitId).eq('period_month', period.month).order('amount', { ascending: false }),
    supabase.from('franchise_fee_ledger').select('*').in('unit_id', networkUnitIds).eq('competence_month', period.month),
    supabase.from('franchise_targets').select('*').eq('unit_id', selectedUnitId),
    supabase.from('franchise_audits').select('*').eq('unit_id', selectedUnitId).order('audit_date', { ascending: false }).limit(12),
    supabase.from('franchise_scenarios').select('*').eq('unit_id', selectedUnitId).order('created_at', { ascending: false }),
    supabase.from('franchise_monthly_closes').select('*').in('unit_id', networkUnitIds).order('period_month', { ascending: false }).limit(240),
    supabase.from('franchise_compliance_documents').select('*').eq('network_id', networkId).order('created_at', { ascending: false }),
    supabase.from('franchise_network_monthly_inputs').select('*').eq('network_id', networkId).eq('period_month', period.month).maybeSingle(),
    fetchAll('sheet_transactions', (query) => query.eq('unit_id', selectedUnitId).order('date_ref', { ascending: true })),
    fetchAll('appointments', (query) => query.eq('unit_id', selectedUnitId).gte('appointment_date', period.start).lte('appointment_date', period.end)),
    fetchAll('clients', (query) => query.eq('unit_id', selectedUnitId)),
  ]);

  [
    modelResult, inputResult, marketingResult, feesResult, targetsResult, auditsResult,
    scenariosResult, closesResult, documentsResult, networkInputResult,
  ].forEach((result) => throwUnlessMissing(result.error));

  return {
    units,
    selectedUnit,
    period,
    model: modelResult.data || { unit_id: selectedUnitId, configured: false },
    monthlyInput: inputResult.data || { unit_id: selectedUnitId, period_month: period.month },
    marketingInvestments: marketingResult.data || [],
    feeLedger: feesResult.data || [],
    targets: targetsResult.data || [],
    audits: auditsResult.data || [],
    scenarios: scenariosResult.data || [],
    closes: closesResult.data || [],
    documents: documentsResult.data || [],
    networkInput: networkInputResult.data || { network_id: networkId, period_month: period.month },
    transactions,
    appointments,
    clients,
  };
}

const cleanPayload = (payload) => Object.fromEntries(
  Object.entries(payload).filter(([, value]) => value !== undefined),
);

export async function saveEconomicModel(payload) {
  const { data, error } = await supabase
    .from('franchise_economic_models')
    .upsert(cleanPayload(payload), { onConflict: 'unit_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveMonthlyInput(payload) {
  const { data, error } = await supabase
    .from('franchise_monthly_inputs')
    .upsert(cleanPayload(payload), { onConflict: 'unit_id,period_month' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveNetworkMonthlyInput(payload) {
  const { data, error } = await supabase
    .from('franchise_network_monthly_inputs')
    .upsert(cleanPayload(payload), { onConflict: 'network_id,period_month' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addMarketingInvestment(payload) {
  const { data, error } = await supabase
    .from('franchise_marketing_investments')
    .insert(cleanPayload(payload))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeMarketingInvestment(id) {
  const { error } = await supabase.from('franchise_marketing_investments').delete().eq('id', id);
  if (error) throw error;
}

export async function saveScenario(payload) {
  const { data, error } = await supabase.from('franchise_scenarios').insert(cleanPayload(payload)).select().single();
  if (error) throw error;
  return data;
}

export async function saveMonthlyClose(payload) {
  const { data, error } = await supabase
    .from('franchise_monthly_closes')
    .upsert(cleanPayload(payload), { onConflict: 'unit_id,period_month' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createFranchiseUnit(payload) {
  const { data, error } = await supabase.from('franchise_units').insert(cleanPayload(payload)).select().single();
  if (error) throw error;
  const { error: modelError } = await supabase.from('franchise_economic_models').insert({ unit_id: data.id });
  if (modelError) throw modelError;
  return data;
}
