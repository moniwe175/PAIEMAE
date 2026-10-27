// Authenticated bridge between the ERP, the private Google Sheet and Supabase.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const money = (value: unknown) => {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function allocateComandaRows(comanda: Record<string, any>) {
  const items = [...(comanda.digital_comanda_items || [])]
    .sort((a, b) => Number(a.position) - Number(b.position))
  const paidItems = items.filter((item) => !item.is_package && money(item.line_total) > 0)
  const paidTotal = paidItems.reduce((sum, item) => sum + money(item.line_total), 0)
  const sources = {
    pix: money(comanda.pix), credito: money(comanda.credito),
    debito: money(comanda.debito), dinheiro: money(comanda.dinheiro),
  }
  const used = { pix: 0, credito: 0, debito: 0, dinheiro: 0 }
  let paidIndex = 0

  return items.map((item) => {
    const payment = { pix: 0, credito: 0, debito: 0, dinheiro: 0 }
    if (!item.is_package && money(item.line_total) > 0) {
      paidIndex += 1
      const last = paidIndex === paidItems.length
      for (const key of Object.keys(payment) as Array<keyof typeof payment>) {
        payment[key] = last
          ? Number((sources[key] - used[key]).toFixed(2))
          : Number((sources[key] * money(item.line_total) / paidTotal).toFixed(2))
        used[key] = Number((used[key] + payment[key]).toFixed(2))
      }
    }
    return {
      client: comanda.client_name,
      procedure: item.service_name,
      professional: item.professional_name,
      comanda: `${comanda.command_number}-${String(item.position).padStart(2, '0')}`,
      repasse: item.is_package ? 1 : 0,
      ...payment,
    }
  })
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const userToken = authHeader.replace(/^Bearer\s+/i, '')
    if (!userToken) return json({ success: false, error: 'Não autenticado.' }, 401)

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${userToken}` } } },
    )
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(userToken)
    if (userError || !userData?.user) return json({ success: false, error: 'Sessão inválida.' }, 401)

    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch (_) { body = {} }

    const webAppUrl = Deno.env.get('SHEET_SYNC_WEB_APP_URL')
    const syncToken = Deno.env.get('SHEET_SYNC_TOKEN')
    if (!webAppUrl || !syncToken) {
      return json({ success: false, error: 'Edge Function não configurada (SHEET_SYNC_WEB_APP_URL / SHEET_SYNC_TOKEN).' }, 500)
    }

    if (body.action === 'writeComanda') {
      const comandaId = String(body.comanda_id || '')
      if (!comandaId) return json({ success: false, error: 'Comanda não informada.' }, 400)

      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)
      const { data: comanda, error: comandaError } = await supabaseAdmin
        .from('digital_comandas')
        .select('*, digital_comanda_items(*)')
        .eq('id', comandaId)
        .single()

      if (comandaError || !comanda) return json({ success: false, error: 'Comanda não encontrada.' }, 404)
      if (comanda.user_id !== userData.user.id) return json({ success: false, error: 'Acesso negado à comanda.' }, 403)
      if (!['closed', 'cancelled'].includes(comanda.status)) {
        return json({ success: false, error: 'Feche a comanda antes de enviá-la.' }, 409)
      }

      const response = await fetch(`${webAppUrl}?token=${encodeURIComponent(syncToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: comanda.status === 'cancelled' ? 'deleteComanda' : 'writeComanda', token: syncToken,
          command_number: comanda.command_number,
          date_ref: comanda.service_date,
          rows: comanda.status === 'cancelled' ? [] : allocateComandaRows(comanda),
        }),
      })
      const responseText = await response.text()
      let responseData: Record<string, unknown> = {}
      try { responseData = JSON.parse(responseText) } catch (_) { responseData = {} }
      const success = response.ok && responseData.success !== false

      await supabaseAdmin.from('digital_comandas').update({
        sheet_sync_status: success ? 'synced' : 'error',
        sheet_sync_error: success ? null : String(responseData.error || `HTTP ${response.status}`),
        sheet_synced_at: success ? new Date().toISOString() : comanda.sheet_synced_at,
      }).eq('id', comanda.id)

      if (!success) return json({ success: false, error: responseData.error || `Planilha respondeu HTTP ${response.status}.` }, 502)
      return json({ success: true, rowsProcessed: responseData.rowsProcessed ?? comanda.digital_comanda_items.length })
    }

    const response = await fetch(
      `${webAppUrl}?token=${encodeURIComponent(syncToken)}&action=sync`,
      { method: 'GET' },
    )
    const responseText = await response.text()
    let responseData: Record<string, unknown> = {}
    try { responseData = JSON.parse(responseText) } catch (_) {
      return json({ success: false, error: `Web App respondeu HTTP ${response.status}.` }, 502)
    }
    if (!response.ok) return json({ success: false, error: String(responseData.error || `HTTP ${response.status}`) }, 502)

    return json({
      success: responseData.success !== false,
      rowsProcessed: responseData.rowsProcessed || 0,
      elapsed: responseData.elapsed || null,
      message: responseData.message || null,
    })
  } catch (error) {
    console.error('[sync-google-sheet] unexpected error:', error)
    return json({ success: false, error: 'Erro interno ao sincronizar.' }, 500)
  }
})
