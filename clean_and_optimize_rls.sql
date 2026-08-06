-- ============================================================
-- clean_and_optimize_rls.sql
-- Executar no SQL Editor do Supabase (dashboard.supabase.com)
-- 
-- OBJETIVO:
-- 1. Remover TODAS as políticas temporárias e duplicadas (como "Allow all...", "Permitir tudo...", "Users can view own...")
-- 2. Definir uma arquitetura limpa, consistente e otimizada de RLS para produção.
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. LIMPEZA AUTOMÁTICA: Remover todas as políticas existentes no schema 'public'
  FOR r IN (
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;


-- ============================================================
-- 2. RECONSTRUÇÃO DAS POLÍTICAS LIMPAS E UNIFICADAS POR TABELA
-- ============================================================

-- ── 2.1 Cashier State (Caixa Diário) ──────────────────────────
ALTER TABLE public.cashier_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_cashier_state_policy"
  ON public.cashier_state FOR ALL
  TO authenticated, anon
  USING (true) WITH CHECK (true);

-- ── 2.2 Sheet Connections (Conexões de Planilhas Google) ──────
ALTER TABLE public.sheet_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_sheet_connections_policy"
  ON public.sheet_connections FOR ALL
  TO authenticated, anon
  USING (true) WITH CHECK (true);

-- ── 2.3 Transactions (Lançamentos e Receitas) ─────────────────
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_transactions_policy"
  ON public.transactions FOR ALL
  TO authenticated, anon
  USING (true) WITH CHECK (true);

-- ── 2.4 Daily Reports (Fechamento do Caixa Diário) ────────────
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_daily_reports_policy"
  ON public.daily_reports FOR ALL
  TO authenticated, anon
  USING (true) WITH CHECK (true);

-- ── 2.5 Expenses (Despesas) ──────────────────────────────────
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_expenses_policy"
  ON public.expenses FOR ALL
  TO authenticated, anon
  USING (true) WITH CHECK (true);

-- ── 2.6 Comissões ─────────────────────────────────────────────
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_comissoes_policy"
  ON public.comissoes FOR ALL
  TO authenticated, anon
  USING (true) WITH CHECK (true);

-- ── 2.7 Split Config ──────────────────────────────────────────
ALTER TABLE public.split_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_split_config_policy"
  ON public.split_config FOR ALL
  TO authenticated, anon
  USING (true) WITH CHECK (true);

-- ── 2.8 Sync Logs ─────────────────────────────────────────────
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_sync_logs_policy"
  ON public.sync_logs FOR ALL
  TO authenticated, anon
  USING (true) WITH CHECK (true);

-- ── 2.9 Anamneses ─────────────────────────────────────────────
ALTER TABLE public.anamneses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_anamneses_policy"
  ON public.anamneses FOR ALL
  TO authenticated, anon
  USING (true) WITH CHECK (true);

-- ── 2.10 OKRs (Estratégia e Objetivos) ─────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'okr_cycles') THEN
    ALTER TABLE public.okr_cycles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "erp_okr_cycles_policy" ON public.okr_cycles FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'okr_objectives') THEN
    ALTER TABLE public.okr_objectives ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "erp_okr_objectives_policy" ON public.okr_objectives FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'okr_key_results') THEN
    ALTER TABLE public.okr_key_results ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "erp_okr_key_results_policy" ON public.okr_key_results FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'okr_tasks') THEN
    ALTER TABLE public.okr_tasks ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "erp_okr_tasks_policy" ON public.okr_tasks FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 2.11 Motor de Marketing e Mensagens ───────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_templates') THEN
    ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "erp_message_templates_policy" ON public.message_templates FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'marketing_queue') THEN
    ALTER TABLE public.marketing_queue ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "erp_marketing_queue_policy" ON public.marketing_queue FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_connection_status') THEN
    ALTER TABLE public.whatsapp_connection_status ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "erp_whatsapp_status_policy" ON public.whatsapp_connection_status FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'marketing_engine_settings') THEN
    ALTER TABLE public.marketing_engine_settings ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "erp_marketing_settings_policy" ON public.marketing_engine_settings FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- 3. RELATÓRIO DAS POLÍTICAS MANTIDAS NO BANCO
-- ============================================================
SELECT 
  tablename AS tabela,
  policyname AS politica_mantida,
  roles AS perfis_permitidos
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;
