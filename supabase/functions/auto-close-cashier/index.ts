import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Dias de atendimento: terça a sábado. Se a data cair em domingo (0)
// ou segunda (1), avança até a próxima terça — o caixa de sábado
// herda direto para terça, sem caixa nesses dois dias.
function nextOpenDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 1) {
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return d.toISOString().split('T')[0]
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const today = new Date().toISOString().split('T')[0]
    // Dia-alvo do próximo caixa: hoje em dia de atendimento,
    // terça-feira quando roda em domingo/segunda (caminho único,
    // a checagem de existência abaixo garante idempotência)
    const targetDate = nextOpenDate(today)
    const closedIds: number[] = []
    let lastClosingBalance = 0

    // ── Step 1: Find open cashiers from previous days ────────────────
    const { data: openCashiers, error: fetchError } = await supabase
      .from('cashier_state')
      .select('*')
      .eq('status', 'aberto')
      .lt('date', today)
      .order('date', { ascending: true })

    if (fetchError) throw fetchError

    // ── Step 2: Close each stale cashier ─────────────────────────────
    if (openCashiers && openCashiers.length > 0) {
      for (const record of openCashiers) {
        const openingBal = Number(record.opening_balance || 0)
        // dinheiro_entradas/saidas = SOMENTE dinheiro físico (espécie)
        // ?? em vez de || : dinheiro_saidas = 0 é legítimo (dia sem sangria)
        // e não deve cair no fallback total_cash_out
        const dinEntradas = Number(record.dinheiro_entradas || 0)
        const dinSaidas = Number(record.dinheiro_saidas ?? record.total_cash_out ?? 0)
        const closingBal = openingBal + dinEntradas - dinSaidas

        const { error: updateError } = await supabase
          .from('cashier_state')
          .update({
            status: 'fechado',
            closing_balance: closingBal,
            closed_at: new Date().toISOString(),
            auto_closed: true,
          })
          .eq('id', record.id)

        if (updateError) {
          console.error(`Failed to close cashier ${record.id}:`, updateError.message)
          continue
        }

        closedIds.push(record.id)
        lastClosingBalance = closingBal
        console.log(`Closed cashier ${record.id} (date: ${record.date}) — opening: ${openingBal}, entradas: ${dinEntradas}, saidas: ${dinSaidas}, closing: ${closingBal}`)
      }
    }

    // ── Step 3: Get the most recent closing balance (if nothing was just closed) ─
    if (closedIds.length === 0) {
      const { data: lastClosed } = await supabase
        .from('cashier_state')
        .select('closing_balance')
        .eq('status', 'fechado')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastClosed) {
        lastClosingBalance = Number(lastClosed.closing_balance || 0)
      }
    }

    // ── Step 4: Create target-day cashier if it doesn't exist ────────
    const { data: targetCashier } = await supabase
      .from('cashier_state')
      .select('id, status')
      .eq('date', targetDate)
      .maybeSingle()

    let created = false
    let updated = false

    if (!targetCashier) {
      const { error: insertError } = await supabase
        .from('cashier_state')
        .insert([{
          status: 'aberto',
          date: targetDate,
          opening_balance: lastClosingBalance,
          closing_balance: null,
          opened_at: new Date().toISOString(),
          closed_at: null,
          auto_closed: false,
          dinheiro_entradas: 0,
          dinheiro_saidas: 0,
          total_cash_in: 0,
          total_cash_out: 0,
          // Somente colunas confirmadas em produção — sem campos legados
          // (saldo/horaAbertura/dataAbertura/sangrias) para o insert nunca falhar
        }])

      if (insertError) throw insertError
      created = true
      console.log(`Created new cashier for ${targetDate} with opening_balance: ${lastClosingBalance}`)
    } else if (targetCashier.status === 'fechado') {
      // Target-day cashier exists but is closed — re-open it with inherited balance
      const { error: reopenError } = await supabase
        .from('cashier_state')
        .update({
          status: 'aberto',
          opening_balance: lastClosingBalance,
          closing_balance: null,
          opened_at: new Date().toISOString(),
          closed_at: null,
          auto_closed: false,
          dinheiro_entradas: 0,
          dinheiro_saidas: 0,
          total_cash_in: 0,
          total_cash_out: 0,
        })
        .eq('id', targetCashier.id)

      if (reopenError) throw reopenError
      updated = true
      console.log(`Re-opened cashier for ${targetDate} with opening_balance: ${lastClosingBalance}`)
    }

    // ── Step 5: Verify final state ───────────────────────────────────
    const { data: finalState } = await supabase
      .from('cashier_state')
      .select('id, date, status, opening_balance, closing_balance, auto_closed')
      .order('date', { ascending: false })
      .limit(5)

    return new Response(
      JSON.stringify({
        success: true,
        closed: closedIds.length,
        closedIds,
        created,
        updated,
        today,
        targetDate,
        openingBalance: lastClosingBalance,
        recentCashiers: finalState,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Edge Function error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
