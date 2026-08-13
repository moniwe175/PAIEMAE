// ============================================================================
// Edge Function: sync-google-sheet
// ----------------------------------------------------------------------------
// Ponte autenticada entre o frontend e o Web App do Google Apps Script
// (google-apps-script/web-app-endpoint.gs), que é quem lê a planilha
// PRIVADA com a identidade do dono e grava no Supabase.
//
// FLUXO:
//   Frontend (logado) → esta Edge Function → Web App (token secreto) → Supabase
//
// SEGURANÇA:
//   - Só responde a sessões autenticadas (JWT do Supabase válido).
//   - A URL do Web App e o token ficam em SECRETS do Supabase —
//     NUNCA no bundle do frontend, NUNCA no repositório.
//   - Não retorna dados financeiros: apenas o resultado da sincronização.
//
// DEPLOY (Supabase Dashboard → Edge Functions):
//   1. Criar função com o nome: sync-google-sheet
//   2. Colar este código e clicar em "Deploy updates"
//   3. Secrets (Edge Functions → Secrets):
//        SHEET_SYNC_WEB_APP_URL = URL do Web App (https://script.google.com/macros/s/.../exec)
//        SHEET_SYNC_TOKEN       = mesmo valor da propriedade ALLOWED_TOKEN do Apps Script
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    // ── 1. Exigir sessão autenticada ──
    // Visitantes anônimos (tela de login) nunca conseguem disparar sync.
    const authHeader = req.headers.get('Authorization') || ''
    const userToken = authHeader.replace(/^Bearer\s+/i, '')
    if (!userToken) {
      return json({ success: false, error: 'Não autenticado.' }, 401)
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${userToken}` } } }
    )
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(userToken)
    if (userError || !userData?.user) {
      return json({ success: false, error: 'Sessão inválida.' }, 401)
    }

    // ── 2. Credenciais do Web App (somente em secrets) ──
    const webAppUrl = Deno.env.get('SHEET_SYNC_WEB_APP_URL')
    const syncToken = Deno.env.get('SHEET_SYNC_TOKEN')
    if (!webAppUrl || !syncToken) {
      return json(
        { success: false, error: 'Edge Function não configurada (SHEET_SYNC_WEB_APP_URL / SHEET_SYNC_TOKEN).' },
        500
      )
    }

    // ── 3. Disparar sincronização no Web App ──
    // O Web App lê a planilha privada com a identidade do dono e faz o
    // upsert no Supabase com a service_role (configurada no Apps Script).
    const target = `${webAppUrl}?token=${encodeURIComponent(syncToken)}`
    const resp = await fetch(target, { method: 'GET' })
    const text = await resp.text()

    let result: Record<string, unknown> = {}
    try {
      result = JSON.parse(text)
    } catch (_) {
      return json({ success: false, error: `Web App respondeu HTTP ${resp.status}.` }, 502)
    }

    if (!resp.ok) {
      return json({ success: false, error: String(result.error || `HTTP ${resp.status}`) }, 502)
    }

    return json({
      success: result.success !== false,
      rowsProcessed: result.rowsProcessed || 0,
      elapsed: result.elapsed || null,
      message: result.message || null,
    })
  } catch (err) {
    console.error('[sync-google-sheet] Erro inesperado:', err)
    return json({ success: false, error: 'Erro interno ao sincronizar.' }, 500)
  }
})
