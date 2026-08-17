// ============================================================================
// Edge Function: admin-delete-user
// ----------------------------------------------------------------------------
// Permite que um ADMINISTRADOR exclua usuários de acesso direto pela página
// "Gerenciar Acessos", sem precisar abrir o painel do Supabase.
//
// SEGURANÇA:
//   - Exige JWT válido do caller (auth.getUser).
//   - Exige profiles.role = 'admin' para o caller (gate server-side).
//   - Não permite excluir a si mesmo.
//   - Não permite excluir usuários com role = 'admin'.
//   - Remove o usuário do auth e também o profile (caso o FK não seja cascade).
//
// DEPLOY (Supabase Dashboard → Edge Functions):
//   1. "New function" com o nome: admin-delete-user
//   2. Colar este código e clicar em "Deploy"
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return json({ success: false, error: 'Sessão não autenticada.' }, 401)
    }

    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Cliente com o JWT do caller para identificar quem está pedindo
    const callerClient = createClient(url, serviceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !userData?.user) {
      return json({ success: false, error: 'Sessão inválida. Entre novamente.' }, 401)
    }

    // Cliente service_role para operações administrativas
    const admin = createClient(url, serviceKey)

    // Gate: somente admin pode excluir acessos
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (callerProfile?.role !== 'admin') {
      return json({ success: false, error: 'Apenas administradores podem excluir acessos.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const userId = String(body?.userId || '').trim()

    if (!userId) {
      return json({ success: false, error: 'Usuário não informado.' })
    }
    if (userId === userData.user.id) {
      return json({ success: false, error: 'Você não pode excluir o seu próprio acesso.' })
    }

    // Proteção extra: nunca excluir outro administrador
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    if (targetProfile?.role === 'admin') {
      return json({ success: false, error: 'Não é possível excluir um administrador.' })
    }

    // Remove o usuário do auth (invalida sessões e logins futuros)
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) {
      return json({ success: false, error: delErr.message || 'Falha ao excluir o usuário.' })
    }

    // Garante que o profile também some (caso o FK não seja ON DELETE CASCADE)
    await admin.from('profiles').delete().eq('id', userId)

    return json({ success: true, id: userId })
  } catch (err) {
    console.error('admin-delete-user error:', err)
    return json({ success: false, error: (err as Error).message || 'Erro interno.' }, 500)
  }
})
