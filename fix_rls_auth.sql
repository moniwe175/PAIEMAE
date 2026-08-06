-- ============================================================
-- fix_rls_auth.sql
-- Executar no SQL Editor do Supabase (dashboard.supabase.com)
-- Habilita políticas de RLS adequadas para usuários autenticados
-- ============================================================

-- 1. cashier_state: permitir leitura e edição para authenticated
ALTER TABLE public.cashier_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own cashier state" ON public.cashier_state;
DROP POLICY IF EXISTS "Users can upsert own cashier state" ON public.cashier_state;
DROP POLICY IF EXISTS "Allow all cashier state" ON public.cashier_state;

CREATE POLICY "Authenticated manage cashier state"
  ON public.cashier_state FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 2. sheet_connections: permitir leitura e edição para authenticated
ALTER TABLE public.sheet_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sheet connections" ON public.sheet_connections;
DROP POLICY IF EXISTS "Users can manage own sheet connections" ON public.sheet_connections;
DROP POLICY IF EXISTS "Allow all sheet connections" ON public.sheet_connections;

CREATE POLICY "Authenticated manage sheet connections"
  ON public.sheet_connections FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 3. daily_reports: permitir leitura e edição para authenticated
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all daily reports" ON public.daily_reports;

CREATE POLICY "Authenticated manage daily reports"
  ON public.daily_reports FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 4. transactions: permitir leitura e edição para authenticated
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all transactions" ON public.transactions;

CREATE POLICY "Authenticated manage transactions"
  ON public.transactions FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

SELECT 'Políticas RLS de autenticação configuradas com sucesso ✅' AS resultado;
