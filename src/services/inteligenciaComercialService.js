/**
 * inteligenciaComercialService.js
 * Serviço dedicado ao módulo de Inteligência Comercial do PAIEMAE.
 *
 * Regras:
 * - Usa await + {data, error} — nunca .catch() em query builders.
 * - Totais via RPC server-side para evitar limitação de 3.000 registros.
 * - Recebimentos conciliados com base em commercial_record_links + sheet_transactions.
 * - Concorrência otimista atômica (compare-and-set em UPDATE por id e version).
 * - Não altera campaigns, crm_leads, appointments, clients, sheet_transactions nem Instagram.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

function cfg() {
  return isSupabaseConfigured();
}

function handleErr(err, fallback = null) {
  const msg = err?.message || (typeof err === 'string' ? err : 'Erro desconhecido');
  console.warn('[IC Service]', msg);
  return { data: fallback, error: err || new Error(msg) };
}

// ─── Setup Check ─────────────────────────────────────────────────────────────
/**
 * Verifica se as tabelas e RPCs da Inteligência Comercial estão disponíveis.
 * Retorna { ready: true } ou { ready: false, reason, detail }.
 */
export async function checkIntelligenceSetup() {
  if (!cfg()) return { ready: false, reason: 'supabase_not_configured' };
  try {
    const { error: tblErr } = await supabase
      .from('marketing_segments')
      .select('id', { count: 'exact', head: true });

    if (tblErr) {
      if (tblErr.code === '42P01' || tblErr.message?.includes('does not exist')) {
        return { ready: false, reason: 'tables_missing', detail: tblErr.message };
      }
      return { ready: false, reason: 'connection_or_permission', detail: tblErr.message };
    }

    // Testa se a RPC principal existe
    const today = new Date().toISOString().slice(0, 10);
    const { error: rpcErr } = await supabase.rpc('fn_ic_overview_metrics', {
      p_date_from: today,
      p_date_to: today,
    });
    if (rpcErr && (rpcErr.code === '42883' || rpcErr.message?.includes('does not exist'))) {
      return { ready: false, reason: 'rpc_missing', detail: rpcErr.message };
    }

    return { ready: true };
  } catch (err) {
    return { ready: false, reason: 'error', detail: err?.message };
  }
}

// ─── Métricas da Visão Geral ──────────────────────────────────────────────────
/**
 * Busca métricas agregadas via RPC server-side com recebimentos conciliados.
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
 * Atribuição simples: lead.origem → agendamento válido → receita vinculada.
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
 * Recência e frequência de atendimento por cliente, com valor financeiro conciliado.
 *
 * @param {string} dateFrom
 * @param {string} dateTo
 * @param {number} limit
 * @param {number} offset
 * @param {'atendidos_periodo'|'sem_retorno'|'todos'} filterMode
 */
export async function fetchClientRFM(dateFrom, dateTo, limit = 50, offset = 0, filterMode = 'atendidos_periodo') {
  if (!cfg()) return handleErr('Supabase not configured', []);
  const { data, error } = await supabase.rpc('fn_ic_client_rfm', {
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_limit: limit,
    p_offset: offset,
    p_filter_mode: filterMode,
  });
  if (error) return handleErr(error, []);
  return { data: data || [], error: null };
}

// ─── Segmentos ────────────────────────────────────────────────────────────────
export async function fetchSegments({ includeArchived = false } = {}) {
  if (!cfg()) return handleErr('Supabase not configured', []);
  let query = supabase
    .from('marketing_segments')
    .select('*')
    .order('created_at', { ascending: false });

  if (!includeArchived) {
    query = query.eq('archived', false);
  }

  const { data, error } = await query;
  if (error) return handleErr(error, []);
  return { data: data || [], error: null };
}

/**
 * Cria um novo segmento salvo.
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
    janela_dias: segment.janela_dias ? Number(segment.janela_dias) : null,
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
 * Atualiza um segmento com controle de concorrência atômico (compare-and-set).
 * O filtro exige simultaneamente id e version esperada.
 * Se nenhuma linha for atualizada, identifica conflito de edição sem sobrescrever.
 */
export async function updateSegment(id, updates, currentVersion) {
  if (!cfg()) return handleErr('Supabase not configured');
  
  const expectedVer = Number(currentVersion) || 1;
  const nextVer = expectedVer + 1;
  
  const payload = {
    ...updates,
    version: nextVer,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('marketing_segments')
    .update(payload)
    .eq('id', id)
    .eq('version', expectedVer)
    .select();

  if (error) return handleErr(error);

  if (!data || data.length === 0) {
    return {
      data: null,
      error: {
        message: 'Conflito de concorrência: este segmento foi editado ou arquivado por outro usuário. Recarregue antes de salvar.',
        code: 'CONFLICT',
      },
    };
  }

  return { data: data[0], error: null };
}

/**
 * Arquiva um segmento com verificação atômica de versão.
 */
export async function archiveSegment(id, currentVersion) {
  if (!cfg()) return handleErr('Supabase not configured');

  const expectedVer = Number(currentVersion) || 1;
  const nextVer = expectedVer + 1;

  const { data, error } = await supabase
    .from('marketing_segments')
    .update({
      archived: true,
      version: nextVer,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('version', expectedVer)
    .select();

  if (error) return handleErr(error);

  if (!data || data.length === 0) {
    return {
      data: null,
      error: {
        message: 'Conflito ao arquivar: o segmento foi modificado ou já arquivado por outro usuário.',
        code: 'CONFLICT',
      },
    };
  }

  return { data: data[0], error: null };
}

// ─── Preview de Segmento ──────────────────────────────────────────────────────
/**
 * Executa prévia server-side com validação estrita de operadores e tipos.
 *
 * @param {'lead'|'cliente'} entityBase
 * @param {Array<{field,operator,value}>} conditions
 * @param {number} limit
 * @param {number|null} janelaDias
 */
export async function previewSegment(entityBase, conditions, limit = 20, janelaDias = null) {
  if (!cfg()) return handleErr('Supabase not configured');

  if (entityBase === 'lead') {
    const { data, error } = await supabase.rpc('fn_ic_segment_preview_leads', {
      p_conditions: conditions || [],
      p_limit: limit,
    });
    if (error) return handleErr(error);
    return { data, error: null };
  }

  // entityBase === 'cliente'
  const { data, error } = await supabase.rpc('fn_ic_segment_preview_clients', {
    p_conditions: conditions || [],
    p_limit: limit,
    p_janela_dias: janelaDias ? Number(janelaDias) : null,
  });
  if (error) return handleErr(error);
  return { data, error: null };
}

// ─── Perfis ICP ───────────────────────────────────────────────────────────────
export async function fetchIcpProfiles() {
  if (!cfg()) return handleErr('Supabase not configured', []);
  const { data, error } = await supabase
    .from('marketing_icp_profiles')
    .select('*, marketing_segments(id, name, conditions, janela_dias, version)')
    .order('created_at', { ascending: false });
  if (error) return handleErr(error, []);
  return { data: data || [], error: null };
}

export async function saveIcpProfile(profile) {
  if (!cfg()) return handleErr('Supabase not configured');
  const payload = {
    name: profile.name,
    necessidades: profile.necessidades || null,
    servicos_interesse: profile.servicos_interesse || [],
    regiao: profile.regiao || null,
    criterios_relacionamento: profile.criterios_relacionamento || null,
    segment_id: profile.segment_id || null,
    responsavel: profile.responsavel || null,
    status: profile.status || 'hipotese',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('marketing_icp_profiles')
    .insert([payload])
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

/**
 * Validação formal de um ICP pela gestão.
 */
export async function validateIcpProfile(id, userId, userName) {
  if (!cfg()) return handleErr('Supabase not configured');
  const payload = {
    status: 'validado',
    validated_at: new Date().toISOString(),
    validated_by: userId || null,
    validator_name: userName || 'Gestão',
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('marketing_icp_profiles')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) return handleErr(error);
  return { data, error: null };
}

// ─── Brief de Campanha com Snapshot de Público ───────────────────────────────
export async function fetchCampaignBrief(campaignId) {
  if (!cfg()) return handleErr('Supabase not configured');
  const { data, error } = await supabase
    .from('marketing_campaign_briefs')
    .select('*, marketing_segments(id, name, version)')
    .eq('campaign_id', Number(campaignId))
    .maybeSingle();
  if (error) return handleErr(error);
  return { data, error: null };
}

/**
 * Salva ou atualiza o brief de uma campanha (upsert por campaign_id).
 * Guarda snapshot imutável dos critérios do segmento no momento do vínculo.
 */
export async function saveCampaignBrief(brief) {
  if (!cfg()) return handleErr('Supabase not configured');
  const campaignId = Number(brief.campaign_id);
  if (!campaignId) return handleErr('campaign_id é obrigatório para salvar o brief');

  // Busca brief existente para preservar campos não enviados nos dois sentidos
  const { data: existing } = await supabase
    .from('marketing_campaign_briefs')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle();

  // Helper de mesclagem: valor explicitamente enviado tem prioridade;
  // se undefined, mantém o valor existente no banco
  const pick = (field, fallback = null) => {
    if (brief[field] !== undefined) return brief[field];
    if (existing && existing[field] !== undefined) return existing[field];
    return fallback;
  };

  const segmentId = pick('segment_id');
  const payload = {
    campaign_id: campaignId,
    objetivo: pick('objetivo'),
    meta: pick('meta'),
    publico_descricao: pick('publico_descricao'),
    segment_id: segmentId,
    segment_version: pick('segment_version') != null ? Number(pick('segment_version')) : null,
    conditions_snapshot: pick('conditions_snapshot'),
    estimated_count: pick('estimated_count') != null ? Number(pick('estimated_count')) : null,
    snapshot_date: pick('snapshot_date') || (segmentId ? (existing?.snapshot_date || new Date().toISOString()) : null),
    responsavel: pick('responsavel'),
    okr_kr_ref: pick('okr_kr_ref'),
    orcamento_planejado: pick('orcamento_planejado') != null ? Number(pick('orcamento_planejado')) : null,
    investimento_realizado: pick('investimento_realizado') != null ? Number(pick('investimento_realizado')) : null,
    resultado_observado: pick('resultado_observado'),
    decisao: pick('decisao'),
    aprendizado: pick('aprendizado'),
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

// ─── Conciliação Financeira (commercial_record_links) ─────────────────────────
/**
 * Busca transações da planilha ainda não conciliadas no período.
 */
export async function fetchUnlinkedTransactions(dateFrom, dateTo, limit = 50, offset = 0) {
  if (!cfg()) return handleErr('Supabase not configured', []);
  const { data, error } = await supabase.rpc('fn_ic_unlinked_transactions', {
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) return handleErr(error, []);
  return { data: data || [], error: null };
}

/**
 * Cria associação manual confirmada entre transação financeira e cliente.
 */
export async function linkCommercialRecord({ sourceTable = 'sheet_transactions', sourceId, clientId, authorId, authorName, note }) {
  if (!cfg()) return handleErr('Supabase not configured');
  const payload = {
    source_table: sourceTable,
    source_id: String(sourceId),
    client_id: Number(clientId),
    author_id: authorId || null,
    author_name: authorName || 'Equipe',
    confirmed_at: new Date().toISOString(),
    note: note || null,
  };
  const { data, error } = await supabase
    .from('commercial_record_links')
    .insert([payload])
    .select()
    .single();
  if (error) return handleErr(error);
  return { data, error: null };
}

/**
 * Remove associação confirmada.
 */
export async function unlinkCommercialRecord(linkId) {
  if (!cfg()) return handleErr('Supabase not configured');
  const { error } = await supabase
    .from('commercial_record_links')
    .delete()
    .eq('id', linkId);
  if (error) return handleErr(error);
  return { success: true, error: null };
}

export async function fetchCommercialLinks(limit = 100, offset = 0) {
  if (!cfg()) return handleErr('Supabase not configured', []);
  const { data, error } = await supabase
    .from('commercial_record_links')
    .select('*, clients(id, name, phone)')
    .order('confirmed_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return handleErr(error, []);
  return { data: data || [], error: null };
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
    meta_mensal_atendimentos: settings.meta_mensal_atendimentos ? Number(settings.meta_mensal_atendimentos) : null,
    meta_mensal_interessados: settings.meta_mensal_interessados ? Number(settings.meta_mensal_interessados) : null,
    okr_kr_ref: settings.okr_kr_ref || null,
    definicao_metrica_principal: settings.definicao_metrica_principal || null,
    periodo_padrao_dias: settings.periodo_padrao_dias ? Number(settings.periodo_padrao_dias) : 30,
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

// ─── Helpers de data (Aritmética Pura sem Conversão de Fuso Indesejada) ───────
/**
 * Calcula from/to em America/Sao_Paulo com aritmética de calendário pura.
 * Não sofre distorção por fuso do navegador do cliente (ex: UTC+14 ou UTC-10).
 *
 * @param {'7d'|'30d'|'90d'|'12m'} preset
 * @param {string|null} refDateStr YYYY-MM-DD opcional para testes
 * @returns {{ from: string, to: string, label: string }} datas YYYY-MM-DD
 */
export function getDateRange(preset, refDateStr = null) {
  let todayStr = refDateStr;
  if (!todayStr) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    todayStr = formatter.format(new Date());
  }

  const [y, m, d] = todayStr.split('-').map(Number);
  
  // Utiliza Date.UTC para garantir aritmética puramente ordinal
  let fromStr;
  if (preset === '7d') {
    // 7 dias inclusivos = hoje + 6 dias anteriores
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 6);
    fromStr = dt.toISOString().slice(0, 10);
  } else if (preset === '30d') {
    // 30 dias inclusivos = hoje + 29 dias anteriores
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 29);
    fromStr = dt.toISOString().slice(0, 10);
  } else if (preset === '90d') {
    // 90 dias inclusivos = hoje + 89 dias anteriores
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 89);
    fromStr = dt.toISOString().slice(0, 10);
  } else if (preset === '12m') {
    const dt = new Date(Date.UTC(y - 1, m - 1, d));
    fromStr = dt.toISOString().slice(0, 10);
  } else {
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 29);
    fromStr = dt.toISOString().slice(0, 10);
  }

  return {
    from: fromStr,
    to: todayStr,
    label: preset,
  };
}

/**
 * Formata data ISO para dd/mm/yyyy.
 */
export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Formata valor monetário em BRL.
 */
export function fmtBRL(val) {
  const n = Number(val);
  if (isNaN(n)) return 'R$ 0,00';
  return `R$ ${n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Converte intervalo de datas YYYY-MM-DD para limites de timestamp ISO UTC
 * correspondentes ao início (00:00:00) e fim (23:59:59.999) em America/Sao_Paulo (UTC-3).
 *
 * Ex: from = '2026-09-01' -> startIso = '2026-09-01T03:00:00.000Z'
 *     to   = '2026-09-30' -> endIso   = '2026-10-01T02:59:59.999Z'
 */
export function getIsoDateRangeSaoPaulo(from, to) {
  const startIso = new Date(`${from}T00:00:00-03:00`).toISOString();
  const endIso = new Date(`${to}T23:59:59.999-03:00`).toISOString();
  return { startIso, endIso };
}

