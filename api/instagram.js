/* global process */
// ============================================================================
// api/instagram.js — BACKEND DA INTEGRAÇÃO INSTAGRAM / META GRAPH API
// ----------------------------------------------------------------------------
// Executa em ambiente seguro Node.js (Vercel Serverless / Vite Dev Middleware).
// NUNCA expõe tokens, app secrets ou chaves de serviço ao frontend React/Vite.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://ecwizjyflxcickbfzhcp.supabase.co';
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';
const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// Rastreamento de comentários testados em simulação recente (para teste de idempotência)
const simulatedCommentSet = new Set();

// Obter cliente com privilégio de serviço
function getDb() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey || !SUPABASE_URL) throw new Error('Configure SUPABASE_SERVICE_KEY e SUPABASE_URL no backend.');
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false },
  });
}

// A service key ignora RLS; conferir a sessão e o cargo antes de qualquer uso.
async function authorize(req, db, action) {
  const header = req.headers?.authorization || '';
  const token = /^Bearer (\S+)$/i.exec(header)?.[1];
  if (!token) return { status: 401, error: 'Faça login para acessar o Marketing.' };
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return { status: 401, error: 'Sessão inválida ou expirada.' };
  const { data: profile, error: profileError } = await db.from('profiles')
    .select('role,cargo,permissions').eq('id', user.id).maybeSingle();
  if (profileError || !profile) return { status: 403, error: 'Perfil sem acesso.' };

  // Diagnóstico técnico é restrito estritamente a administradores
  if (action === 'diagnose' && profile.role !== 'admin') {
    return { status: 403, error: 'Apenas administradores podem executar o diagnóstico.' };
  }

  if (profile.role === 'admin') return { user };
  let permissions = profile.permissions || {};
  if (profile.cargo) {
    const { data: roleRow, error: roleError } = await db.from('roles')
      .select('permissions').eq('name', profile.cargo).maybeSingle();
    if (!roleError && roleRow?.permissions && Object.keys(roleRow.permissions).length) {
      permissions = roleRow.permissions;
    }
  }
  const allowed = (module, level) => {
    const p = permissions[module];
    return typeof p === 'boolean' ? p : p?.[level] === true;
  };
  const level = req.method === 'GET' ? 'ver' : 'edit';
  if (!allowed('marketing', level) || (action === 'forward_crm' && !allowed('crm', 'edit'))) {
    return { status: 403, error: 'Sem permissão para esta ação.' };
  }
  return { user };
}

// ─── Carregar Credenciais da Meta ────────────────────────────────────────────
async function getMetaConfig(db) {
  void db;
  if (process.env.META_ACCESS_TOKEN && process.env.INSTAGRAM_ACCOUNT_ID) {
    return {
      accessToken: process.env.META_ACCESS_TOKEN.trim(),
      accountId: process.env.INSTAGRAM_ACCOUNT_ID.trim(),
      pageId: process.env.META_PAGE_ID ? process.env.META_PAGE_ID.trim() : null,
      source: 'environment',
    };
  }
  return null;
}

// ─── Validação Oficial da Conta Profissional na Graph API ────────────────────
async function validateMetaAccount(accessToken, accountId) {
  if (!accessToken || !accountId) {
    return {
      ok: false,
      status: 'disconnected',
      error: 'Token de acesso Meta e ID da Conta Profissional são obrigatórios.',
    };
  }

  try {
    const url = `${META_BASE_URL}/${accountId}?fields=id,username,name,profile_picture_url,biography,followers_count,media_count`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();

    if (!res.ok || data.error) {
      const err = data.error || {};
      let friendlyMsg = err.message || 'Erro ao comunicar com a Meta Graph API.';
      if (err.code === 190) {
        friendlyMsg = 'Token de acesso Meta inválido ou expirado. Gere um novo token no Meta for Developers.';
      } else if (err.code === 100) {
        friendlyMsg = `Conta Instagram ID "${accountId}" não foi encontrada ou não pertence ao usuário autorizado.`;
      } else if (err.code === 200) {
        friendlyMsg = 'Permissões insuficientes. Conceda instagram_basic, instagram_manage_comments e instagram_manage_messages.';
      }

      return {
        ok: false,
        status: 'error',
        error: friendlyMsg,
        raw_error: err,
        code: err.code,
        subcode: err.error_subcode,
        last_verified: new Date().toISOString(),
      };
    }

    return {
      ok: true,
      status: 'connected',
      account: {
        id: data.id,
        username: data.username || accountId,
        name: data.name || data.username || 'Conta Instagram',
        profile_picture_url: data.profile_picture_url || null,
        followers_count: data.followers_count || 0,
        media_count: data.media_count || 0,
      },
      last_verified: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      status: 'error',
      error: `Falha na requisição de rede para a Meta: ${err.message}`,
      last_verified: new Date().toISOString(),
    };
  }
}

// ─── Listagem de Publicações e Reels Reais ───────────────────────────────────
async function fetchAccountMedia(accessToken, accountId) {
  try {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count';
    const url = `${META_BASE_URL}/${accountId}/media?fields=${fields}&limit=25`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();

    if (!res.ok || data.error) {
      return {
        ok: false,
        error: data.error?.message || 'Falha ao buscar publicações da conta.',
        media: [],
      };
    }

    const items = (data.data || []).map((m) => ({
      id: m.id,
      caption: m.caption || '(Sem legenda)',
      media_type: m.media_type, // IMAGE, VIDEO, CAROUSEL_ALBUM
      media_url: m.media_url || m.thumbnail_url || '',
      thumbnail_url: m.thumbnail_url || m.media_url || '',
      permalink: m.permalink || `https://www.instagram.com/p/${m.id}/`,
      timestamp: m.timestamp,
      comments_count: m.comments_count || 0,
      like_count: m.like_count || 0,
    }));

    return { ok: true, media: items };
  } catch (err) {
    return { ok: false, error: err.message, media: [] };
  }
}

// Insights são consultados sob demanda. A Meta pode omitir métricas por tipo de
// mídia ou por falta de dados; ausência nunca deve ser apresentada como zero.
function insightNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

async function requestMetaInsight(accessToken, objectId, params) {
  const url = new URL(`${META_BASE_URL}/${encodeURIComponent(objectId)}/insights`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    const error = new Error(payload.error?.message || 'Não foi possível consultar os Insights na Meta.');
    error.code = payload.error?.code;
    throw error;
  }
  return payload.data || [];
}

export function insightErrorMessage(error) {
  if (error.code === 190) return 'Token da Meta expirado. Atualize META_ACCESS_TOKEN no backend.';
  if (error.code === 10 || error.code === 200) {
    return 'A conta ainda não autorizou instagram_manage_insights. Adicione a permissão no app da Meta e gere um novo token.';
  }
  return error.message || 'Falha ao consultar Insights do Instagram.';
}

export async function fetchInstagramInsights(accessToken, accountId, days, mediaId) {
  const until = new Date();
  const since = new Date(until.getTime() - days * 86400000);
  const metrics = await requestMetaInsight(accessToken, accountId, {
    metric: 'reach',
    period: 'day',
    metric_type: 'time_series',
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  });
  const reach = metrics.find(item => item.name === 'reach');
  const series = (reach?.values || []).map(item => ({
    date: item.end_time || '',
    value: insightNumber(item.value),
  })).filter(item => item.date && item.value !== null);

  const accountMetrics = await Promise.allSettled(['views', 'total_interactions'].map(async metric => {
    const data = await requestMetaInsight(accessToken, accountId, {
      metric,
      period: 'day',
      metric_type: 'total_value',
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
    });
    const result = data.find(item => item.name === metric);
    return insightNumber(result?.total_value?.value);
  }));
  const totals = Object.fromEntries(['views', 'total_interactions'].map((metric, index) => [
    metric,
    accountMetrics[index].status === 'fulfilled' ? accountMetrics[index].value : null,
  ]));

  let media = null;
  if (mediaId) {
    // Não deixa o navegador pedir métricas de uma publicação fora desta conta.
    const owned = await fetchAccountMedia(accessToken, accountId);
    if (!owned.ok) throw new Error(owned.error);
    if (!owned.media.some(item => item.id === mediaId)) throw new Error('Publicação não encontrada na conta conectada.');
    const values = await Promise.allSettled(['reach', 'views', 'saved', 'shares'].map(async metric => {
      const data = await requestMetaInsight(accessToken, mediaId, { metric });
      const result = data.find(item => item.name === metric);
      return insightNumber(result?.total_value?.value ?? result?.values?.at(-1)?.value);
    }));
    media = { id: mediaId };
    ['reach', 'views', 'saved', 'shares'].forEach((metric, index) => {
      media[metric] = values[index].status === 'fulfilled' ? values[index].value : null;
    });
    if (values.every(item => item.status === 'rejected')) {
      const first = values[0].reason;
      if (first.code === 10 || first.code === 200 || first.code === 190) throw first;
    }
  }

  return { ok: true, period_days: days, reach: series, totals, media, updated_at: new Date().toISOString() };
}

// ─── Disparo de Resposta Privada ao Comentário (Via ID da Página do Facebook) ───────────
// Endpoint : POST https://graph.facebook.com/v26.0/{META_PAGE_ID}/messages
// Body     : { recipient: { comment_id }, message: { text } }
// Auth     : Bearer {page-access-token} no header Authorization
async function sendPrivateReply(accessToken, pageId, commentId, messageText) {
  if (!accessToken) {
    return { ok: false, error: 'Token Meta ausente para envio de resposta privada.' };
  }
  if (!pageId) {
    return {
      ok: false,
      error: 'ID da Página ausente (META_PAGE_ID). Configure META_PAGE_ID nas variáveis de ambiente da Vercel para permitir o envio do Direct.',
    };
  }
  if (!commentId) {
    return { ok: false, error: 'ID do comentário ausente; não é possível enviar resposta privada.' };
  }

  const url = `${META_BASE_URL}/${pageId}/messages`;
  const body = {
    recipient: { comment_id: commentId },
    message:   { text: messageText },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    console.log('[Instagram/sendPrivateReply] status=%d payload=%s',
      res.status, JSON.stringify(data).slice(0, 500));

    if (!res.ok || data.error) {
      const err = data.error || {};
      const diagnostic = {
        code:          err.code,
        error_subcode: err.error_subcode,
        fbtrace_id:    err.fbtrace_id,
        type:          err.type,
        raw_message:   err.message,
      };

      let friendly = err.message || 'Falha ao enviar resposta privada.';
      if (err.code === 3) {
        friendly = `(#3) App sem capacidade. Verifique permissões do app ou se META_PAGE_ID está correto. fbtrace_id: ${err.fbtrace_id || 'N/A'}`;
      } else if (err.code === 10) {
        friendly = `(#10) Permissão insuficiente: instagram_manage_messages ausente no token de Página. fbtrace_id: ${err.fbtrace_id || 'N/A'}`;
      } else if (err.code === 100 && err.error_subcode === 2018028) {
        friendly = '(#100/2018028) Janela expirada: mais de 7 dias desde o comentário, ou resposta já enviada.';
      } else if (err.code === 100) {
        friendly = `(#100) Parâmetro inválido: ${err.message}`;
      } else if (err.code === 190) {
        friendly = `(#190) Token inválido ou expirado. Gere um novo token de Página. fbtrace_id: ${err.fbtrace_id || 'N/A'}`;
      } else if (err.code === 200 || err.code === 230) {
        friendly = `(#${err.code}) Permissões de Página insuficientes para envio de mensagens.`;
      }

      return { ok: false, error: friendly, diagnostic };
    }

    if (!data.message_id && !data.id) {
      return {
        ok: false,
        error: 'Resposta da Meta não retornou message_id válido.',
        raw: data,
      };
    }

    return {
      ok: true,
      recipient_id: data.recipient_id || null,
      message_id:   data.message_id || data.id,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Erro de rede ao enviar resposta privada: ${err.message}`,
    };
  }
}

// ─── Diagnóstico Oficial da Conexão Meta e Token (Apenas Leitura) ─────────────
async function runDiagnostics(db) {
  const EXPECTED_APP_ID = '2504035933430354';
  const EXPECTED_PAGE_ID = '1640332469521785';
  const EXPECTED_INSTAGRAM_ID = '17841403407235131';

  const config = await getMetaConfig(db);
  if (!config?.accessToken || !config?.accountId) {
    return {
      ok: false,
      error: 'Credenciais META_ACCESS_TOKEN e/ou INSTAGRAM_ACCOUNT_ID ausentes no ambiente do backend.',
      env_present: {
        META_ACCESS_TOKEN: !!process.env.META_ACCESS_TOKEN,
        INSTAGRAM_ACCOUNT_ID: !!process.env.INSTAGRAM_ACCOUNT_ID,
        META_PAGE_ID: !!process.env.META_PAGE_ID,
        META_APP_SECRET: !!process.env.META_APP_SECRET,
        META_VERIFY_TOKEN: !!process.env.META_VERIFY_TOKEN,
        META_APP_ID: !!process.env.META_APP_ID,
      },
    };
  }

  const { accessToken, accountId, pageId } = config;
  const appId = process.env.META_APP_ID ? process.env.META_APP_ID.trim() : null;
  const appSecret = process.env.META_APP_SECRET ? process.env.META_APP_SECRET.trim() : null;

  const results = {
    timestamp: new Date().toISOString(),
    endpoint_contract: `POST ${META_BASE_URL}/${pageId || '{META_PAGE_ID}'}/messages { recipient: { comment_id } }`,
    configured_account_id: accountId,
    configured_page_id: pageId || '(não configurado no backend)',
    env_status: {
      has_access_token: !!accessToken,
      token_length: accessToken.length,
      has_page_id: !!pageId,
      has_app_secret: !!appSecret,
      has_app_id: !!appId,
      app_id_configured: appId || '(não configurado no backend)',
    },
    debug_token: null,
    me_identity: null,
    linked_accounts: null,
    comparisons: null,
    last_database_interaction: null,
  };

  // 1. /debug_token: app_id, type, is_valid, scopes, granular_scopes e validade
  try {
    const debugAuthToken = (appId && appSecret) ? `${appId}|${appSecret}` : accessToken;
    const debugUrl = `${META_BASE_URL}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(debugAuthToken)}`;
    const debugRes = await fetch(debugUrl);
    const debugJson = await debugRes.json();
    if (debugJson.data) {
      const d = debugJson.data;
      results.debug_token = {
        ok: true,
        app_id: d.app_id || null,
        type: d.type || 'UNKNOWN',
        application: d.application || null,
        is_valid: !!d.is_valid,
        scopes: Array.isArray(d.scopes) ? d.scopes : [],
        granular_scopes: Array.isArray(d.granular_scopes) ? d.granular_scopes : [],
        expires_at: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : 'Never / Long-lived',
        data_access_expires_at: d.data_access_expires_at ? new Date(d.data_access_expires_at * 1000).toISOString() : null,
        user_id: d.user_id || null,
      };
    } else {
      results.debug_token = {
        ok: false,
        error: debugJson.error || debugJson,
        note: !appId || !appSecret ? 'Adicione META_APP_ID e META_APP_SECRET na Vercel para inspecionar via App Access Token.' : null,
      };
    }
  } catch (err) {
    results.debug_token = { ok: false, error: err.message };
  }

  // 2. /me?fields=id,name: identidade à qual o token pertence (tipo vem do /debug_token)
  try {
    const meUrl = `${META_BASE_URL}/me?fields=id,name`;
    const meRes = await fetch(meUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const meJson = await meRes.json();
    results.me_identity = {
      id: meJson.id || null,
      name: meJson.name || null,
      token_type_from_debug: results.debug_token?.type || 'UNKNOWN',
    };
  } catch (err) {
    results.me_identity = { ok: false, error: err.message };
  }

  // 3. Consulta de contas e vínculo de Página e Instagram (sem access_token e sem credenciais)
  let sanitizedAccounts = null;
  let expectedPageQuery = null;
  let expectedIgDirect = null;

  try {
    // 3a. /me/accounts: campos estritamente id, name, instagram_business_account (sem access_token)
    try {
      const accountsRes = await fetch(`${META_BASE_URL}/me/accounts?fields=id,name,instagram_business_account{id,username}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const accountsJson = await accountsRes.json();
      if (Array.isArray(accountsJson?.data)) {
        sanitizedAccounts = accountsJson.data.map((acc) => ({
          id: acc.id,
          name: acc.name,
          instagram_business_account: acc.instagram_business_account ? {
            id: acc.instagram_business_account.id,
            username: acc.instagram_business_account.username || null,
          } : null,
        }));
      }
    } catch (_) {}

    // 3b. Consulta direta à Página esperada (1640332469521785) para verificar o vínculo oficial com o Instagram
    try {
      const pageRes = await fetch(`${META_BASE_URL}/${EXPECTED_PAGE_ID}?fields=id,name,instagram_business_account{id,username}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expectedPageQuery = await pageRes.json();
    } catch (err) {
      expectedPageQuery = { error: err.message };
    }

    // 3c. Consulta direta à conta Instagram para metadados públicos informativos
    try {
      const igRes = await fetch(`${META_BASE_URL}/${EXPECTED_INSTAGRAM_ID}?fields=id,username,name`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expectedIgDirect = await igRes.json();
    } catch (err) {
      expectedIgDirect = { error: err.message };
    }

    results.linked_accounts = {
      accounts_managed: sanitizedAccounts,
      expected_page_details: expectedPageQuery?.id ? {
        id: expectedPageQuery.id,
        name: expectedPageQuery.name,
        instagram_business_account: expectedPageQuery.instagram_business_account || null,
      } : (expectedPageQuery?.error ? { error: expectedPageQuery.error.message || expectedPageQuery.error } : null),
      expected_instagram_details: expectedIgDirect?.id ? {
        id: expectedIgDirect.id,
        username: expectedIgDirect.username,
        name: expectedIgDirect.name,
      } : (expectedIgDirect?.error ? { error: expectedIgDirect.error.message || expectedIgDirect.error } : null),
    };
  } catch (err) {
    results.linked_accounts = { ok: false, error: err.message };
  }

  // 4. Comparações separadas: Aplicativo, Página e Instagram
  const actualAppId = results.debug_token?.app_id || null;
  const appMatches = actualAppId === EXPECTED_APP_ID;

  const tokenType = results.debug_token?.type || 'UNKNOWN';
  const isPageTokenForExpected = tokenType === 'PAGE' && results.me_identity?.id === EXPECTED_PAGE_ID;
  const userManagesExpectedPage = Array.isArray(sanitizedAccounts) && sanitizedAccounts.some((acc) => acc.id === EXPECTED_PAGE_ID);
  const pageMatches = isPageTokenForExpected || userManagesExpectedPage;

  const pageLinkedIgId = expectedPageQuery?.instagram_business_account?.id || null;
  const pageLinkedIgMatches = pageLinkedIgId === EXPECTED_INSTAGRAM_ID;
  const configuredIgMatches = accountId === EXPECTED_INSTAGRAM_ID;

  results.comparisons = {
    app: {
      expected: EXPECTED_APP_ID,
      actual: actualAppId,
      matches: appMatches,
      status: appMatches ? 'OK' : 'DIVERGÊNCIA',
      detail: appMatches
        ? `O token pertence ao App esperado (${EXPECTED_APP_ID}).`
        : `Token pertence ao App ${actualAppId || 'desconhecido'}, diferente de ${EXPECTED_APP_ID}.`,
    },
    page: {
      expected: EXPECTED_PAGE_ID,
      token_type: tokenType,
      actual_identity_id: results.me_identity?.id || null,
      matches: pageMatches,
      status: pageMatches ? 'OK' : 'DIVERGÊNCIA',
      detail: isPageTokenForExpected
        ? `Token é da Página esperada (${EXPECTED_PAGE_ID}).`
        : (userManagesExpectedPage
          ? `Token de Usuário que administra a Página esperada (${EXPECTED_PAGE_ID}).`
          : `A identidade do token não corresponde à Página esperada (${EXPECTED_PAGE_ID}).`),
    },
    instagram: {
      expected: EXPECTED_INSTAGRAM_ID,
      configured_in_backend: accountId,
      configured_matches_expected: configuredIgMatches,
      page_linked_instagram_id: pageLinkedIgId,
      page_link_matches_expected: pageLinkedIgMatches,
      status: (configuredIgMatches && pageLinkedIgMatches) ? 'OK' : 'ATENÇÃO',
      rule_note: 'Uma consulta direta ao Instagram bem-sucedida não comprova o vínculo com a Página esperada.',
      detail: pageLinkedIgMatches
        ? `A Página ${EXPECTED_PAGE_ID} possui vínculo confirmado com o Instagram ${EXPECTED_INSTAGRAM_ID}.`
        : (pageLinkedIgId
          ? `A Página ${EXPECTED_PAGE_ID} está vinculada a outro Instagram (${pageLinkedIgId}), diferente de ${EXPECTED_INSTAGRAM_ID}.`
          : `Não foi encontrado vínculo direto entre a Página ${EXPECTED_PAGE_ID} e uma conta Instagram profissional.`),
    },
  };

  // 5. Histórico do último comentário registrado no banco (para inspecionar erro prévio sem disparar mensagens)
  try {
    const { data: lastInteraction } = await db
      .from('instagram_interactions')
      .select('comment_id, media_id, usuario_instagram, comentario_texto, palavra_chave_detectada, status, resposta_enviada, erro_detalhes, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    results.last_database_interaction = lastInteraction || null;
  } catch (err) {
    results.last_database_interaction = { error: err.message };
  }

  return { ok: true, diagnostics: results };
}

// ─── Encaminhamento Idempotente para o CRM (crm_leads) ───────────────────────
async function forwardToCrm(db, { username, commentText, keyword, campaignName }) {
  if (!username) return null;

  const normalizedHandle = username.startsWith('@') ? username : `@${username}`;
  const now = new Date().toISOString();

  try {
    // 1. Prevenção de duplicatas: verificar se já existe lead para este Instagram
    const { data: existingLeads, error: lookupError } = await db
      .from('crm_leads')
      .select('id, nome, status, instagram, telefone')
      .eq('instagram', normalizedHandle)
      .limit(1);
    if (lookupError) return { ok: false, error: lookupError.message };

    let leadId = null;
    let isNewLead = false;

    if (existingLeads && existingLeads.length > 0) {
      leadId = existingLeads[0].id;
      // Atualiza data do lead existente
      const { error: updateError } = await db
        .from('crm_leads')
        .update({
          updated_at: now,
          servico_interesse: campaignName || 'Instagram',
        })
        .eq('id', leadId);
      if (updateError) return { ok: false, error: updateError.message, lead_id: leadId };
    } else {
      // 2. Novo lead na fila "Responder" da recepção
      // NÃO INVENTA TELEFONE (telefone: null)
      const newLeadPayload = {
        nome: normalizedHandle,
        instagram: normalizedHandle,
        telefone: null,
        email: null,
        origem: 'Instagram',
        servico_interesse: campaignName || `Interesse (Regra: ${keyword})`,
        status: 'aguardando_resposta',
        responsavel: null,
        created_at: now,
        updated_at: now,
      };

      const { data: inserted, error: insertErr } = await db
        .from('crm_leads')
        .insert([newLeadPayload])
        .select()
        .single();

      if (insertErr) {
        console.error('[Instagram->CRM] Erro ao criar lead:', insertErr);
        return { ok: false, error: insertErr.message };
      }

      leadId = inserted?.id;
      isNewLead = true;
    }

    // 3. Registrar nota de histórico em crm_interactions
    if (leadId) {
      const interactionNote = `[Instagram] Comentou na publicação: "${commentText}". Palavra-chave: "${keyword}". Campanha: "${campaignName || 'Direta'}". Notificada recepção para atendimento inicial.`;
      const { error: interactionError } = await db
        .from('crm_interactions')
        .insert([
          {
            lead_id: leadId,
            tipo: 'contato',
            conteudo: interactionNote,
            autor: 'Automação Instagram',
            created_at: now,
          },
        ]);
      if (interactionError) return { ok: false, error: interactionError.message, lead_id: leadId };
    }

    let fullLead = null;
    if (leadId) {
      const { data: leadData } = await db.from('crm_leads').select('*').eq('id', leadId).single();
      fullLead = leadData;
    }

    return { ok: true, lead_id: leadId, lead: fullLead, is_new: isNewLead, handle: normalizedHandle };
  } catch (err) {
    console.error('[Instagram->CRM] Erro geral:', err);
    return { ok: false, error: err.message };
  }
}

// Resposta pública: o nó é o comentário, separado do envio privado pela Página.
async function sendPublicReply(accessToken, commentId, messageText) {
  try {
    const response = await fetch(`${META_BASE_URL}/${encodeURIComponent(commentId)}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ message: messageText }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      const error = data.error || {};
      return {
        status: response.status >= 500 ? 'incerto' : 'falha',
        error: error.message || `A Meta recusou a resposta pública (HTTP ${response.status}).`,
        diagnostic: { code: error.code, error_subcode: error.error_subcode, fbtrace_id: error.fbtrace_id },
      };
    }
    if (!data.id) {
      return { status: 'incerto', error: 'A Meta não retornou o ID da resposta pública. Confira o comentário antes de tentar novamente.' };
    }
    return { status: 'enviada', id: String(data.id), sent_at: new Date().toISOString() };
  } catch {
    // A requisição pode ter chegado à Meta. Não repetir automaticamente.
    return { status: 'incerto', error: 'Não foi possível confirmar a resposta pública. Confira o comentário no Instagram; não houve nova tentativa automática.' };
  }
}

function publicReplyValidation(enabled, message) {
  if (typeof enabled !== 'boolean') return 'A opção de resposta pública deve ser verdadeiro ou falso.';
  if (typeof message !== 'string') return 'O texto da resposta pública deve ser uma mensagem.';
  if (enabled && !message.trim()) return 'Digite a resposta pública antes de ativá-la.';
  if (message.trim().length > 500) return 'A resposta pública aceita até 500 caracteres.';
  return null;
}

// ─── Processamento de Evento de Comentário ───────────────────────────────────
export async function processCommentEvent(db, {
  commentId,
  mediaId,
  userId = '',
  username,
  text,
  mediaCaption = '',
  mediaPermalink = '',
  isTestSimulation = false,
  rule: explicitRule = null,
}) {
  if (!commentId || !mediaId || !text) throw new Error('Evento de comentário incompleto.');
  // Evita que uma resposta publicada pela própria conta acione a automação.
  if (!isTestSimulation && userId && String(userId) === String(process.env.INSTAGRAM_ACCOUNT_ID)) {
    return { ok: true, matched: false, status: 'ignorado', steps: [] };
  }
  const safeUsername = (username || '').replace(/^@/, '');
  const steps = [];
  steps.push({
    step: 'init',
    message: isTestSimulation
      ? `[SIMULAÇÃO] Testando comentário "${text}" de @${username} (sem disparo real na Meta e sem alteração no CRM)`
      : `Iniciando análise do comentário ${commentId} de @${username}`,
  });

  // Em produção, o INSERT UNIQUE reserva o comentário antes de qualquer envio.
  if (isTestSimulation) {
    if (simulatedCommentSet.has(commentId)) {
      steps.push({
        step: 'duplicate',
        message: 'Comentário com ID idêntico já foi simulado nesta execução.',
      });
      return {
        ok: true,
        duplicate: true,
        status: 'duplicado',
        message: 'Comentário de simulação repetido nesta execução.',
        steps,
      };
    }
  } else {
    const { error: claimError } = await db.from('instagram_interactions').insert([{
      comment_id: commentId,
      media_id: mediaId,
      usuario_instagram: safeUsername ? `@${safeUsername}` : '@desconhecido',
      comentario_texto: text,
      status: 'processando',
    }]);
    if (claimError?.code === '23505') {
      return { ok: true, duplicate: true, status: 'duplicado', steps };
    }
    if (claimError) throw new Error(`Não foi possível reservar o comentário: ${claimError.message}`);
  }

  // 2. Localizar regra da publicação (usando a informada ou consultando no banco)
  let rule = isTestSimulation ? explicitRule : null;
  if (!rule) {
    const { data: ruleRow, error: ruleErr } = await db
      .from('instagram_rules')
      .select('*')
      .eq('media_id', mediaId).maybeSingle();
    if (ruleErr) throw new Error(`Falha ao consultar regra: ${ruleErr.message}`);
    rule = ruleRow;
  }

  if (!rule) {
    if (!isTestSimulation) await recordInteraction(db, { commentId, status: 'ignorado' });
    steps.push({ step: 'no_rule', message: `Nenhuma regra configurada para a publicação ${mediaId}.` });
    return {
      ok: true,
      matched: false,
      status: 'ignorado',
      message: 'Nenhuma regra configurada para esta publicação.',
      steps,
    };
  }

  steps.push({
    step: 'rule_found',
    message: `Regra encontrada: Palavra-chave "${rule.palavra_chave}", Status "${rule.status}"`,
  });

  // 3. Verificar se a regra está pausada
  if (rule.status === 'pausado') {
    steps.push({ step: 'rule_paused', message: 'A regra está PAUSADA. Nenhuma resposta privada seria enviada.' });
    if (!isTestSimulation) {
      await recordInteraction(db, {
        commentId,
        mediaId,
        mediaCaption,
        mediaPermalink,
        username: safeUsername,
        text,
        regraId: rule.id,
        palavraChave: rule.palavra_chave,
        status: 'pausado',
        erro: 'Regra da publicação está pausada.',
      });
    }
    return {
      ok: true,
      matched: true,
      status: 'pausado',
      rule_status: 'pausado',
      message: 'Regra da publicação está pausada. Disparo cancelado.',
      steps,
    };
  }

  // 4. Verificar se o comentário contém a palavra-chave
  const normalize = (value) => value.normalize('NFD').replace(/\p{M}/gu, '');
  const normalizedComment = normalize(text.trim());
  const normalizedKeyword = normalize((rule.palavra_chave || '').trim());
  const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasMatch = !!normalizedKeyword && new RegExp(`(?<![\\p{L}\\p{N}])${escapedKeyword}(?![\\p{L}\\p{N}])`, 'iu').test(normalizedComment);

  if (!hasMatch) {
    steps.push({ step: 'keyword_mismatch', message: `Comentário "${text}" não contém a palavra-chave "${rule.palavra_chave}".` });
    if (!isTestSimulation) {
      await recordInteraction(db, {
        commentId,
        mediaId,
        mediaCaption,
        mediaPermalink,
        username: safeUsername,
        text,
        regraId: rule.id,
        palavraChave: rule.palavra_chave,
        status: 'ignorado',
        erro: 'Palavra-chave não corresponde.',
      });
    }
    return {
      ok: true,
      matched: false,
      status: 'ignorado',
      message: 'Comentário recebido, mas não corresponde à palavra-chave.',
      steps,
    };
  }

  steps.push({ step: 'keyword_matched', message: `Palavra-chave "${rule.palavra_chave}" detectada no comentário!` });

  // 5. Montar texto da resposta privada
  let resposta = rule.resposta_privada || 'Olá! Obrigado pelo seu interesse!';
  resposta = resposta
    .replace(/\{\{usuario\}\}/gi, safeUsername ? `@${safeUsername}` : 'você')
    .replace(/\{\{nome\}\}/gi, safeUsername || 'você')
    .replace(/\{\{post\}\}/gi, mediaCaption ? `"${mediaCaption.slice(0, 30)}..."` : 'publicação');

  const publicEnabled = rule.responder_comentario === true;
  const publicText = (rule.resposta_publica || '').trim()
    .replace(/\{\{usuario\}\}/gi, safeUsername ? `@${safeUsername}` : 'você')
    .replace(/\{\{nome\}\}/gi, safeUsername || 'você')
    .replace(/\{\{post\}\}/gi, mediaCaption ? `"${mediaCaption.slice(0, 30)}..."` : 'publicação');

  // 6. Diferenciação Clara: Simulação vs Operação Real
  if (isTestSimulation) {
    // SIMULAÇÃO: NÃO chama a Meta e NÃO cria lead real no CRM
    simulatedCommentSet.add(commentId);
    steps.push({
      step: 'simulation_dm',
      message: `[SIMULAÇÃO] Resposta privada formatada para envio: "${resposta}" (Nenhum Direct enviado pela Meta em modo simulação).`,
    });

    steps.push({
      step: 'simulation_public_reply',
      message: publicEnabled
        ? `[SIMULAÇÃO] Após o sucesso da DM, responderia ao comentário: "${publicText}". Nenhum comentário publicado.`
        : '[SIMULAÇÃO] Resposta pública desativada nesta regra.',
    });

    const crmPreview = {
      would_forward: rule.encaminhar_crm !== false,
      lead_data: {
        nome: `@${username}`,
        instagram: `@${username}`,
        telefone: null,
        origem: 'Instagram',
        origem_outro: mediaCaption ? `Post: ${mediaCaption.slice(0, 50)}...` : `Post ID: ${mediaId}`,
        servico_interesse: rule.campanha_nome || `Interesse (Regra: ${rule.palavra_chave})`,
        status: 'aguardando_resposta',
      },
    };

    steps.push({
      step: 'simulation_crm',
      message: rule.encaminhar_crm !== false
        ? `[SIMULAÇÃO] Perfil @${username} seria encaminhado à fila "Responder" do CRM (sem telefone inventado e sem duplicar). Nenhum registro gravado em simulação.`
        : '[SIMULAÇÃO] Regra configurada para NÃO encaminhar ao CRM.',
    });

    return {
      ok: true,
      simulated: true,
      is_simulation: true,
      meta_api_sent: false,
      crm_persisted: false,
      matched: true,
      status: 'sucesso',
      rule_id: rule.id,
      response_sent: false,
      response_text: resposta,
      public_reply: { status: publicEnabled ? 'simulado' : 'desativado', text: publicText, sent: false },
      crm_preview: crmPreview,
      steps,
    };
  }

  // OPERAÇÃO REAL (Webhook Oficial)
  const metaConfig = await getMetaConfig(db);
  let metaResponse = null;
  let responseSent = false;
  let sendError = null;

  if (metaConfig?.accessToken && metaConfig?.accountId) {
    steps.push({ step: 'meta_send', message: 'Chamando Meta Graph API para envio real da resposta privada...' });
    metaResponse = await sendPrivateReply(
      metaConfig.accessToken,
      metaConfig.pageId || process.env.META_PAGE_ID,
      commentId,
      resposta
    );

    if (metaResponse.ok) {
      responseSent = true;
      steps.push({ step: 'meta_success', message: `Direct enviado na Meta com sucesso (ID ${metaResponse.message_id})!` });
    } else {
      sendError = metaResponse.error;
      steps.push({ step: 'meta_error', message: `Falha da Meta: ${metaResponse.error}` });
    }
  } else {
    sendError = 'Credenciais Meta ausentes para envio real.';
    steps.push({ step: 'meta_error', message: sendError });
  }

  let publicReply = {
    status: publicEnabled ? 'nao_enviada' : 'desativado',
    text: publicEnabled ? publicText : null,
    sent: false,
  };
  if (publicEnabled && responseSent) {
    const validationError = publicReplyValidation(true, publicText);
    if (validationError) {
      publicReply = { ...publicReply, status: 'falha', error: validationError };
    } else {
      // Checkpoint durável da DM antes do segundo efeito externo.
      publicReply.status = 'processando';
      await recordInteraction(db, {
        commentId, status: 'processando', respostaEnviada: true, respostaTexto: resposta,
        metadata: { dm_message_id: metaResponse.message_id, public_reply: publicReply },
      });
      steps.push({ step: 'public_send', message: 'DM confirmada. Enviando a resposta pública ao comentário...' });
      publicReply = { ...publicReply, ...await sendPublicReply(metaConfig.accessToken, commentId, publicText) };
      publicReply.sent = publicReply.status === 'enviada';
    }
    steps.push({
      step: publicReply.sent ? 'public_success' : 'public_error',
      message: publicReply.sent
        ? `Resposta pública enviada (ID ${publicReply.id}).`
        : `DM enviada; resposta pública não confirmada: ${publicReply.error}`,
    });
  } else if (publicEnabled) {
    publicReply.reason = 'A resposta pública exige o sucesso confirmado da DM.';
    steps.push({ step: 'public_skipped', message: publicReply.reason });
  }

  // Encaminhar interesse real ao CRM
  let crmResult = null;
  if (rule.encaminhar_crm !== false && safeUsername) {
    steps.push({ step: 'crm_forward', message: 'Encaminhando perfil do interessado ao CRM...' });
    crmResult = await forwardToCrm(db, {
      username: safeUsername,
      commentText: text,
      mediaId,
      mediaCaption: mediaCaption || rule.media_caption,
      keyword: rule.palavra_chave,
      campaignName: rule.campanha_nome,
    });

    if (crmResult?.ok) {
      steps.push({
        step: 'crm_success',
        message: crmResult.is_new
          ? `Novo interessado criado no CRM (${crmResult.handle}) aguardando atendimento da recepção!`
          : `Interesse vinculado ao lead existente no CRM (${crmResult.handle}) sem duplicar.`,
      });
    }
  }

  // Gravar histórico auditável no banco
  const interactionRecord = await recordInteraction(db, {
    commentId,
    mediaId,
    mediaCaption: mediaCaption || rule.media_caption,
    mediaPermalink: mediaPermalink || rule.media_permalink,
    username: safeUsername,
    text,
    regraId: rule.id,
    palavraChave: rule.palavra_chave,
    status: sendError || (crmResult && !crmResult.ok) ? 'falha' : 'sucesso',
    respostaEnviada: responseSent,
    respostaTexto: resposta,
    erro: sendError || crmResult?.error || null,
    crmLeadId: crmResult?.lead_id || null,
    campanhaNome: rule.campanha_nome || null,
    metadata: { dm_message_id: metaResponse?.message_id || null, public_reply: publicReply },
  });

  return {
    ok: !sendError && (!crmResult || crmResult.ok),
    matched: true,
    status: sendError || (crmResult && !crmResult.ok) ? 'falha' : 'sucesso',
    rule_id: rule.id,
    response_sent: responseSent,
    response_text: resposta,
    crm_lead_id: crmResult?.lead_id || null,
    is_new_lead: crmResult?.is_new || false,
    meta_response: metaResponse,
    public_reply: publicReply,
    interaction: interactionRecord,
    steps,
  };
}

// ─── Gravar Histórico de Interação ───────────────────────────────────────────
async function recordInteraction(db, {
  commentId,
  mediaId,
  mediaCaption,
  mediaPermalink,
  username,
  text,
  regraId,
  palavraChave,
  status,
  respostaEnviada = false,
  respostaTexto = null,
  erro = null,
  crmLeadId = null,
  campanhaNome = null,
  metadata = null,
}) {
  const item = { status: status || 'falha', resposta_enviada: respostaEnviada };
  if (mediaId) item.media_id = mediaId;
  if (mediaCaption) item.media_caption = mediaCaption;
  if (mediaPermalink) item.media_permalink = mediaPermalink;
  if (username) item.usuario_instagram = username.startsWith('@') ? username : `@${username}`;
  if (text) item.comentario_texto = text;
  if (palavraChave) item.palavra_chave_detectada = palavraChave;
  if (regraId) item.regra_id = regraId;
  if (respostaTexto) item.resposta_texto = respostaTexto;
  if (erro) item.erro_detalhes = erro;
  if (crmLeadId) item.crm_lead_id = crmLeadId;
  if (campanhaNome) item.campanha_nome = campanhaNome;
  if (metadata) item.metadata = metadata;
  const { data, error: updateError } = await db.from('instagram_interactions')
    .update(item).eq('comment_id', commentId).select().single();
  if (updateError) throw new Error(`Falha ao registrar resultado do comentário: ${updateError.message}`);
  return data;
}

// ─── Handler Principal da Rota /api/instagram ────────────────────────────────
export default async function handler(req, res) {
  const urlObj = new URL(req.url, 'http://localhost');
  const action = req.query?.action || urlObj.searchParams.get('action') || 'status';

  try {
    const db = getDb();
    const access = await authorize(req, db, action);
    if (access.error) return res.status(access.status).json({ ok: false, error: access.error });
    // 1. GET /api/instagram?action=status
    if (req.method === 'GET' && action === 'status') {
      const config = await getMetaConfig(db);
      if (!config?.accessToken || !config?.accountId) {
        return res.status(200).json({
          ok: false,
          status: 'disconnected',
          configured: false,
          message: 'Nenhuma conta do Instagram conectada ainda. Configure o token de acesso e ID da conta.',
          account: null,
          has_token: false,
          last_verified: null,
        });
      }

      // Validação oficial na Graph API
      const val = await validateMetaAccount(config.accessToken, config.accountId);
      return res.status(200).json({
        ...val,
        has_token: true,
        configured: true,
        account_id: config.accountId,
        source: config.source,
      });
    }

    // Credenciais da Meta são configuradas somente no ambiente do backend.
    if (req.method === 'POST' && action === 'config') {
      return res.status(405).json({ ok: false, error: 'Configure a Meta nas variáveis do backend.' });
    }

    // 3. GET /api/instagram?action=media
    if (req.method === 'GET' && action === 'media') {
      const config = await getMetaConfig(db);
      if (!config?.accessToken || !config?.accountId) {
        return res.status(200).json({
          ok: false,
          configured: false,
          media: [],
          message: 'Nenhuma credencial da Meta configurada. Configure o Token de Acesso e ID da Conta para listar publicações reais.',
        });
      }

      const mediaResult = await fetchAccountMedia(config.accessToken, config.accountId);
      if (!mediaResult.ok) {
        return res.status(200).json({
          ok: false,
          configured: true,
          error: mediaResult.error,
          media: [],
        });
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        media: mediaResult.media,
      });
    }

    // GET /api/instagram?action=insights&days=30[&media_id=...]
    if (req.method === 'GET' && action === 'insights') {
      const config = await getMetaConfig(db);
      if (!config?.accessToken || !config?.accountId) {
        return res.status(200).json({ ok: false, configured: false, error: 'Conecte a conta do Instagram para consultar Insights.' });
      }
      const days = Number(req.query?.days || urlObj.searchParams.get('days') || 30);
      const mediaId = String(req.query?.media_id || urlObj.searchParams.get('media_id') || '');
      if (![7, 30].includes(days) || (mediaId && !/^\d{1,30}$/.test(mediaId))) {
        return res.status(400).json({ ok: false, error: 'Período ou publicação inválidos.' });
      }
      try {
        const result = await fetchInstagramInsights(config.accessToken, config.accountId, days, mediaId);
        return res.status(200).json(result);
      } catch (error) {
        return res.status(200).json({ ok: false, configured: true, error: insightErrorMessage(error) });
      }
    }

    // GET /api/instagram?action=diagnose (Apenas Leitura — Exclusivo Admin)
    if (req.method === 'GET' && action === 'diagnose') {
      const diagResult = await runDiagnostics(db);
      return res.status(200).json(diagResult);
    }

    // 4. GET /api/instagram?action=rules
    if (req.method === 'GET' && action === 'rules') {
      const { data, error } = await db
        .from('instagram_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        const missing = error.code === '42P01' || error.code === 'PGRST205';
        return res.status(missing ? 409 : 500).json({
          ok: false,
          tables_missing: missing,
          rules: [],
          error: missing ? 'Execute a migração instagram_marketing_migration.sql no Supabase.' : error.message,
        });
      }

      return res.status(200).json({ ok: true, rules: data || [] });
    }

    // 5. POST /api/instagram?action=rules (Regras novas começam como 'pausado')
    if (req.method === 'POST' && action === 'rules') {
      const body = req.body || {};
      const {
        media_id,
        media_caption,
        media_permalink,
        media_url,
        media_type,
        palavra_chave,
        resposta_privada,
        status = 'pausado', // Regras novas começam pausadas!
        campanha_id,
        campanha_nome,
        encaminhar_crm = true,
        responder_comentario = false,
        resposta_publica = '',
      } = body;

      const publicValidation = publicReplyValidation(responder_comentario, resposta_publica);
      if (publicValidation) return res.status(400).json({ ok: false, error: publicValidation });

      if (!media_id || !palavra_chave || !resposta_privada) {
        return res.status(400).json({
          ok: false,
          error: 'media_id, palavra_chave e resposta_privada são obrigatórios.',
        });
      }

      const ruleObj = {
        media_id,
        media_caption: media_caption || '',
        media_permalink: media_permalink || '',
        media_url: media_url || '',
        media_type: media_type || 'IMAGE',
        palavra_chave: palavra_chave.trim().toUpperCase(),
        resposta_privada: resposta_privada.trim(),
        status: body.id && status === 'ativo' ? 'ativo' : 'pausado',
        campanha_id: campanha_id ? parseInt(campanha_id, 10) : null,
        campanha_nome: campanha_nome || null,
        encaminhar_crm: !!encaminhar_crm,
        responder_comentario,
        resposta_publica: resposta_publica.trim(),
        updated_at: new Date().toISOString(),
      };

      if (body.id) ruleObj.id = body.id;

      const { data: saved, error } = await db
        .from('instagram_rules')
        .upsert([ruleObj])
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          ok: false,
          tables_missing: error.message?.includes('does not exist') || error.code === '42P01' || error.code === 'PGRST205',
          error: `Erro ao gravar regra no banco: ${error.message}. Execute a migração instagram_marketing_migration.sql.`,
        });
      }

      return res.status(200).json({ ok: true, rule: saved });
    }

    // 6. PUT /api/instagram?action=rules
    if (req.method === 'PUT' && action === 'rules') {
      const body = req.body || {};
      const { id, status, resposta_privada, palavra_chave, encaminhar_crm } = body;

      if (!id) {
        return res.status(400).json({ ok: false, error: 'ID da regra obrigatório.' });
      }

      const updates = { updated_at: new Date().toISOString() };
      if (body.responder_comentario !== undefined || body.resposta_publica !== undefined) {
        const { data: current, error: readError } = await db.from('instagram_rules')
          .select('responder_comentario,resposta_publica').eq('id', id).single();
        if (readError) return res.status(500).json({ ok: false, error: readError.message });
        const enabled = body.responder_comentario ?? current.responder_comentario ?? false;
        const message = body.resposta_publica ?? current.resposta_publica ?? '';
        const validationError = publicReplyValidation(enabled, message);
        if (validationError) return res.status(400).json({ ok: false, error: validationError });
        updates.responder_comentario = enabled;
        updates.resposta_publica = message.trim();
      }
      if (status) updates.status = status;
      if (resposta_privada) updates.resposta_privada = resposta_privada;
      if (palavra_chave) updates.palavra_chave = palavra_chave.trim().toUpperCase();
      if (encaminhar_crm !== undefined) updates.encaminhar_crm = !!encaminhar_crm;

      const { data: updated, error } = await db
        .from('instagram_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ ok: false, error: error.message });
      }

      return res.status(200).json({ ok: true, rule: updated });
    }

    // 7. DELETE /api/instagram?action=rules
    if (req.method === 'DELETE' && action === 'rules') {
      const id = req.query?.id || urlObj.searchParams.get('id');
      if (!id) {
        return res.status(400).json({ ok: false, error: 'ID da regra obrigatório.' });
      }

      const { error } = await db.from('instagram_rules').delete().eq('id', id);
      if (error) return res.status(500).json({ ok: false, error: error.message });

      return res.status(200).json({ ok: true, deleted: id });
    }

    // 8. GET /api/instagram?action=interactions
    if (req.method === 'GET' && action === 'interactions') {
      const { data, error } = await db
        .from('instagram_interactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        const missing = error.code === '42P01' || error.code === 'PGRST205';
        return res.status(missing ? 409 : 500).json({
          ok: false,
          tables_missing: missing,
          interactions: [],
          error: missing ? 'Execute a migração instagram_marketing_migration.sql no Supabase.' : error.message,
        });
      }

      return res.status(200).json({ ok: true, interactions: data || [] });
    }

    // 9. POST /api/instagram?action=test_comment (Simulação sem envio real e sem CRM)
    if (req.method === 'POST' && action === 'test_comment') {
      const body = req.body || {};
      const {
        media_id,
        comment_id = `test_cmt_${Date.now()}`,
        username = 'paciente_teste',
        text = 'QUERO',
        media_caption = '',
        media_permalink = '',
        force_duplicate = false,
        rule = null,
      } = body;

      if (!media_id) {
        return res.status(400).json({ ok: false, error: 'media_id é obrigatório.' });
      }

      const finalCommentId = force_duplicate ? 'simulated_fixed_duplicate_id_01' : comment_id;

      // isTestSimulation: true -> Não envia Direct na Meta e Não grava no CRM!
      const result = await processCommentEvent(db, {
        commentId: finalCommentId,
        mediaId: media_id,
        username,
        text,
        mediaCaption: media_caption,
        mediaPermalink: media_permalink,
        isTestSimulation: true,
        rule,
      });

      return res.status(200).json(result);
    }

    // 10. POST /api/instagram?action=forward_crm (Encaminhamento explícito)
    if (req.method === 'POST' && action === 'forward_crm') {
      const body = req.body || {};
      const { username, comment_text, media_id, media_caption, keyword, campaign_name } = body;

      const crmRes = await forwardToCrm(db, {
        username,
        commentText: comment_text,
        mediaId: media_id,
        mediaCaption: media_caption,
        keyword: keyword || 'Interesse Manual',
        campaignName: campaign_name,
      });

      return res.status(200).json(crmRes);
    }

    return res.status(404).json({ ok: false, error: `Ação "${action}" desconhecida.` });
  } catch (err) {
    console.error('[Instagram API] Erro não tratado:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
