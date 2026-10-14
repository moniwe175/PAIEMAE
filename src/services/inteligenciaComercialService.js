/**
 * inteligenciaComercialService.js
 * Serviço dedicado ao módulo de Inteligência Comercial do PAIEMAE.
 *
 * Regras:
 * - Usa await + {data, error} — nunca .catch() em query builders.
 * - Totais via RPC server-side para evitar limitação de 3.000 registros.
 * - Recebimentos indisponíveis sem commercial_record_links (sheet_transactions.client é texto).
 * - Não altera campaigns, crm_leads, appointments, clients, sheet_transactions nem Instagram.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

function cfg() {
  return isSupabaseConfigured();
}

function handleErr(err, fallback = null) {
  console.warn('[IC Service]', err?.message || err);
  return { data: fallback, error: err };
}

// ─── Setup Check ─────────────────────────────────────────────────────────────
/**
 * Verifica se as tabelas e RPCs da Inteligência Comercial estão disponíveis.
 * Retorna { ready: true } ou { ready: false, reason, detail }.
 */
export async function checkIntelligenceSetup() {
  if (!cfg()) return { ready: false, reason: 'supabase_not_configured' };
  try {
    const { error } = await supabase
      .from('marketing_segments')
      .select('id', { count: 'exact', head: true });
    if (error) return { ready: false, reason: 'tables_missing', detail: error.message };
    return { ready: true };
  } catch (err) {
    return { ready: false, reason: 'error', detail: err?.message };
  }
}

// ─── Métricas da Visão Geral ──────────────────────────────────────────────────
/**
 * Busca métricas agregadas via RPC server-side.
 * Evita busca paginada de clientes no frontend.
 *
 * @param {string} dateFrom YYYY-MM-DD
 * @param {string} dateTo   YYYY-MM-DD
 */
export async function fetchOverviewMetrics(dateFrom, dateTo) {
  if (!cfg()) return handleErr('Supabase not configured');
  const { data, error } = await supabase.rpc('fn_ic_overview_metrics', {
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });
  if (error) return handleErr(error);
  return { data, error: null };
}

// ─── Estatísticas por Canal ───────────────────────────────────────────────────
/**
 * Retorna tabela de desempenho por canal de origem dos leads.
 * Atribuição simples: lead.origem → lead.appointment_id → atendimento no período.
 */
export async function fetchCanalStats(dateFrom, dateTo) {
  if (!cfg()) return handleErr('Supabase not configured', []);
  const { data, error } = await supabase.rpc('fn_ic_canal_stats', {
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });
  if (error) return handleErr(error, []);
  return { data: data || [], error: null };
}

// ─── RFM de Clientes ─────────────────────────────────────────────────────────
/**
 * Recência e frequência de atendimento por cliente.
 * Valor (V) indisponível: sheet_transactions.client é texto sem FK.
 *
 * @param {string} dateFrom
 * @param {string} dateTo
 * @param {number} limit   padrão 50
 * @param {number} offset  padrão 0
 */
export async function fetchClientRFM(dateFrom, dateTo, limit = 50, offset = 0) {
  if (!cfg()) return handleErr('Supabase not configured', []);
  const { data, error } = await supabase.rpc('fn_ic_client_rfm', {
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) return handleErr(error, []);
  return { data: data || [], error: null };
}

// ─── Segmentos ────────────────────────────────────────────────────────────────
export async function fetchSegments() {
  if (!cfg()) return handleErr('Supabase not configured', []);
  const { data, error } = await supabase
    .from('marketing_segments')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: false });
  if (error) return handleErr(error, []);
  return { data: data || [], error: null };
}

/**
 * Cria um novo segmento.
 * @param {object} segment  { name, description, entity_base, conditions, janela_dias }
 * @param {string} authorId
 * @param {string} authorName
 */
export async function saveSegment(segment, authorId, authorName) {
  if (!cfg()) return handleErr('Supabase not configured');
  const payload = {
    name: segment.name,
    description: segment.description || null,
    entity_base: segment.entity_base,
    conditions: segment.conditions || [],
    janela_dias: segment.janela_dias || null,
    author_id: authorId || null,
    author_name: authorName || null,
    version: 1,
    archived: false,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('marketing_segments')
    .insert([payload])
    .select()
    .single();
  if (error) return handleErr(error);
  return { data, error: null };
}

/**
 * Atualiza um segmento com controle de concorrência otimista.
 * Retorna { error: { code: 'CONFLICT' } } se a versão não bater.
 */
export async function updateSegment(id, updates, currentVersion) {
  if (!cfg()) return handleErr('Supabase not configured');
  // Verifica versão antes de sobrescrever
  const { data: current, error: fetchErr } = await supabase
    .from('marketing_segments')
    .select('version')
    .eq('id', id)
    .single();
  if (fetchErr) return handleErr(fetchErr);
  if (current.version !== currentVersion) {
    return {
      data: null,
      error: {
        message: 'Conflito: este segmento foi editado por outra pessoa. Recarregue antes de salvar.',
        code: 'CONFLICT',
      },
    };
  }
  const { data, error } = await supabase
    .from('marketing_segments')
    .update({
      ...updates,
      version: currentVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return handleErr(error);
  return { data, error: null };
}

export async function archiveSegment(id) {
  if (!cfg()) return handleErr('Supabase not configured');
  const { data, error } = await supabase
    .from('marketing_segments')
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return handleErr(error);
  return { data, error: null };
}

// ─── Preview de Segmento ──────────────────────────────────────────────────────
/**
 * Executa preview server-side com campos validados.
 * @param {'lead'|'cliente'} entityBase
 * @param {Array<{field,operator,value}>} conditions
 * @param {number} limit
 */
export async function previewSegment(entityBase, conditions, limit = 20) {
  if (!cfg()) return handleErr('Supabase not configured');
  const fnName = entityBase === 'lead'
    ? 'fn_ic_segment_preview_leads'
    : 'fn_ic_segment_preview_clients';
  const { data, error } = await supabase.rpc(fnName, {
    p_conditions: conditions,
    p_limit: limit,
  });
  if (error) return handleErr(error);
  // data pode ter { error: 'Campo não permitido...' } se validação falhar no servidor
  return { data, error: null };
}

// ─── Perfis ICP ───────────────────────────────────────────────────────────────
export async function fetchIcpProfiles() {
  if (!cfg()) return handleErr('Supabase not configured', []);
  const { data, error } = await supabase
    .from('marketing_icp_profiles')
    .select('*, marketing_segments(id, name)')
    .order('created_at', { ascending: false });
  if (error) return handleErr(error, []);
  return { data: data || [], error: null };
}

export async function saveIcpProfile(profile) {
  if (!cfg()) return handleErr('Supabase not configured');
  const { data, error } = await supabase
    .from('marketing_icp_profiles')
    .insert([{ ...profile, updated_at: new Date().toISOString() }])
    .select()
    .single();
  if (error) return handleErr(error);
  return { data, error: null };
}

export async function updateIcpProfile(id, updates) {
  if (!cfg()) return handleErr('Supabase not configured');
  const { data, error } = await supabase
    .from('marketing_icp_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return handleErr(error);
  return { data, error: null };
}

// ─── Brief de Campanha ───────────────────────────────────────────────────────
/**
 * Busca ou cria um brief para uma campanha existente.
 * Usa maybeSingle para não errar quando ainda não existe.
 */
export async function fetchCampaignBrief(campaignId) {
  if (!cfg()) return handleErr('Supabase not configured');
  const { data, error } = await supabase
    .from('marketing_campaign_briefs')
    .select('*')
    .eq('campaign_id', Number(campaignId))
    .maybeSingle();
  if (error) return handleErr(error);
  return { data, error: null };
}

/**
 * Salva ou atualiza o brief de uma campanha (upsert por campaign_id).
 * Não toca nos campos originais de campaigns.
 * Dupla chamada é idempotente (unique campaign_id).
 */
export async function saveCampaignBrief(brief) {
  if (!cfg()) return handleErr('Supabase not configured');
  const payload = {
    ...brief,
    campaign_id: Number(brief.campaign_id),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('marketing_campaign_briefs')
    .upsert([payload], { onConflict: 'campaign_id' })
    .select()
    .single();
  if (error) return handleErr(error);
  return { data, error: null };
}

// ─── Configurações Comerciais ─────────────────────────────────────────────────
const SETTINGS_ID = 'a0000000-0000-0000-0000-000000000001';

export async function fetchCommercialSettings() {
  if (!cfg()) return handleErr('Supabase not configured');
  const { data, error } = await supabase
    .from('marketing_commercial_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .maybeSingle();
  if (error) return handleErr(error);
  return { data, error: null };
}

export async function saveCommercialSettings(settings, userId) {
  if (!cfg()) return handleErr('Supabase not configured');
  const payload = {
    id: SETTINGS_ID,
    ...settings,
    updated_at: new Date().toISOString(),
    updated_by: userId || null,
  };
  const { data, error } = await supabase
    .from('marketing_commercial_settings')
    .upsert([payload], { onConflict: 'id' })
    .select()
    .single();
  if (error) return handleErr(error);
  return { data, error: null };
}

// ─── Helpers de data ─────────────────────────────────────────────────────────
/**
 * Calcula from/to em BRT para presets de período.
 * @param {'7d'|'30d'|'90d'|'12m'} preset
 * @returns {{ from: string, to: string }} datas YYYY-MM-DD
 */
export function getDateRange(preset) {
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const todayDate = new Date(todayStr + 'T00:00:00');
  const fromDate = new Date(todayDate);

  switch (preset) {
    case '7d':  fromDate.setDate(fromDate.getDate() - 6);       break;
    case '30d': fromDate.setDate(fromDate.getDate() - 29);      break;
    case '90d': fromDate.setDate(fromDate.getDate() - 89);      break;
    case '12m': fromDate.setFullYear(fromDate.getFullYear() - 1); break;
    default:    fromDate.setDate(fromDate.getDate() - 29);
  }

  return {
    from: fromDate.toISOString().slice(0, 10),
    to: todayStr,
    label: preset,
  };
}

/**
 * Formata uma data ISO como dd/mm/yyyy.
 */
export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Formata valor monetário em BRL.
 */
export function fmtBRL(val) {
  return `R$ ${(Number(val) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
