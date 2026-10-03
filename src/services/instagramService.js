// ============================================================================
// src/services/instagramService.js — CLIENT SERVICE PARA AUTOMAÇÃO INSTAGRAM
// ----------------------------------------------------------------------------
// Centraliza as chamadas ao backend seguro (/api/instagram) sem expor
// tokens ou credenciais da Meta no bundle do cliente React/Vite.
// ============================================================================

import { supabase } from '../lib/supabase';

const API_BASE = '/api/instagram';

async function apiFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Faça login para usar o Marketing.');
  return fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${session.access_token}` },
  });
}

async function handleResponse(res) {
  try {
    const data = await res.json();
    return { ok: res.ok, status: res.status, data, error: data?.error || null };
  } catch (err) {
    return { ok: false, status: res.status, data: null, error: err.message };
  }
}

// ─── 1. Estado da Conexão e Conta Autorizada ────────────────────────────────
export async function getInstagramStatus() {
  try {
    const res = await apiFetch(`${API_BASE}?action=status`);
    const { data, error } = await handleResponse(res);
    if (error) return { ok: false, error, status: 'error' };
    return data;
  } catch (err) {
    return { ok: false, status: 'error', error: err.message };
  }
}

// ─── 3. Listar Publicações e Reels da Conta ─────────────────────────────────
export async function getInstagramMedia() {
  try {
    const res = await apiFetch(`${API_BASE}?action=media`);
    const { data, error } = await handleResponse(res);
    if (error) return { ok: false, error, media: [] };
    return data;
  } catch (err) {
    return { ok: false, error: err.message, media: [] };
  }
}

export async function getInstagramInsights(days = 30, mediaId = null) {
  try {
    const params = new URLSearchParams({ action: 'insights', days: String(days) });
    if (mediaId) params.set('media_id', mediaId);
    const res = await apiFetch(`${API_BASE}?${params}`);
    const { data, error } = await handleResponse(res);
    if (error) return { ok: false, error };
    return data;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── 4. Regras por Publicação ────────────────────────────────────────────────
export async function getInstagramRules() {
  try {
    const res = await apiFetch(`${API_BASE}?action=rules`);
    const { data, error } = await handleResponse(res);
    if (error) return { ok: false, error, rules: [] };
    return data;
  } catch (err) {
    return { ok: false, error: err.message, rules: [] };
  }
}

export async function saveInstagramRule(rule) {
  try {
    const res = await apiFetch(`${API_BASE}?action=rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    return await handleResponse(res);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function updateInstagramRule(id, updates) {
  try {
    const res = await apiFetch(`${API_BASE}?action=rules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    return await handleResponse(res);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function deleteInstagramRule(id) {
  try {
    const res = await apiFetch(`${API_BASE}?action=rules&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return await handleResponse(res);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── 5. Histórico de Comentários / Interações ────────────────────────────────
export async function getInstagramInteractions() {
  try {
    const res = await apiFetch(`${API_BASE}?action=interactions`);
    const { data, error } = await handleResponse(res);
    if (error) return { ok: false, error, interactions: [] };
    return data;
  } catch (err) {
    return { ok: false, error: err.message, interactions: [] };
  }
}

// ─── 6. Testador / Simulador de Comentário ──────────────────────────────────
export async function testInstagramComment({
  media_id,
  comment_id,
  username,
  text,
  media_caption,
  media_permalink,
  force_duplicate,
  rule,
}) {
  try {
    const res = await apiFetch(`${API_BASE}?action=test_comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_id,
        comment_id,
        username,
        text,
        media_caption,
        media_permalink,
        force_duplicate,
        rule,
      }),
    });
    return await handleResponse(res);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── 7. Encaminhar Interesse Manualmente ao CRM ─────────────────────────────
export async function forwardInstagramToCrm({
  username,
  comment_text,
  media_id,
  media_caption,
  keyword,
  campaign_name,
}) {
  try {
    const res = await apiFetch(`${API_BASE}?action=forward_crm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        comment_text,
        media_id,
        media_caption,
        keyword,
        campaign_name,
      }),
    });
    return await handleResponse(res);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── 8. Diagnóstico Oficial de Token e IDs da Meta ───────────────────────────
export async function getInstagramDiagnostics(commentId = null) {
  try {
    const params = new URLSearchParams({ action: 'diagnose' });
    if (commentId) params.set('comment_id', commentId);
    const res = await apiFetch(`${API_BASE}?${params}`);
    const { data, error } = await handleResponse(res);
    if (error) return { ok: false, error };
    return data;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
