// ============================================================================
// Edge Function: admin-create-user
// ----------------------------------------------------------------------------
// Permite que um ADMINISTRADOR crie novos usuários de acesso direto pela
// página "Gerenciar Acessos", sem precisar abrir o painel do Supabase.
//
// FLUXO:
//   Frontend (logado como admin) → esta Edge Function → auth.admin.createUser
//   O trigger handle_new_user() do banco cria o profile automaticamente;
//   em seguida a função ajusta role/cargo/permissions do profile novo.
//
// SEGURANÇA:
//   - Exige JWT válido do caller (auth.getUser).
//   - Exige profiles.role = 'admin' para o caller (gate server-side).
//   - Cria o usuário já confirmado (email_confirm: true) — sem e-mail de
//     confirmação, pois o acesso é entregue pessoalmente pela clínica.
//
// DEPLOY (Supabase Dashboard → Edge Functions):
//   1. "New function" com o nome: admin-create-user
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

    // Gate: somente admin pode criar acessos
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (callerProfile?.role !== 'admin') {
      return json({ success: false, error: 'Apenas administradores podem criar acessos.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const nome = String(body?.nome || '').trim()
    const cargo = String(body?.cargo || '').trim() || 'Recepcionista'

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, error: 'Informe um e-mail válido.' })
    }
    if (password.length < 6) {
      return json({ success: false, error: 'A senha precisa de pelo menos 6 caracteres.' })
    }

    // Cria o usuário já confirmado (o trigger do banco cria o profile)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome || undefined, nome: nome || undefined },
    })
    if (createErr) {
      const msg = /already|exists/i.test(createErr.message)
        ? 'Já existe um usuário com este e-mail.'
        : createErr.message
      return json({ success: false, error: msg })
    }

    const newId = created.user?.id

    // Ajusta o profile novo: staff + cargo + permissões do cargo
    let permissions: unknown = {}
    const { data: roleRow } = await admin
      .from('roles')
      .select('permissions')
      .eq('name', cargo)
      .maybeSingle()
    if (roleRow?.permissions) permissions = roleRow.permissions

    if (newId) {
      const { error: profErr } = await admin
        .from('profiles')
        .update({ role: 'staff', cargo, permissions })
        .eq('id', newId)
      if (profErr) {
        // Usuário foi criado, mas o ajuste do cargo falhou — avisa para
        // o admin ajustar manualmente na lista da página.
        return json({
          success: true,
          email,
          id: newId,
          warning: `Usuário criado, mas não foi possível aplicar o cargo automaticamente (${profErr.message}). Ajuste na lista acima.`,
        })
      }
    }

    return json({ success: true, email, id: newId })
  } catch (err) {
    console.error('admin-create-user error:', err)
    return json({ success: false, error: (err as Error).message || 'Erro interno.' }, 500)
  }
})
