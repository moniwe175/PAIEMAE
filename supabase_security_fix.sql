-- ═══════════════════════════════════════════════════════════════
-- AUDITORIA DE SEGURANÇA — Script de Correção Completo
-- ERP Clínica de Estética — Supabase RLS Policies
-- Data: 2026-08-04
-- ═══════════════════════════════════════════════════════════════
--
-- INSTRUÇÕES:
-- 1. Execute a SEÇÃO A primeiro no SQL Editor (diagnóstico)
-- 2. Depois execute a SEÇÃO B (correções)
-- 3. Se sheet_transactions NÃO tiver user_id, execute a SEÇÃO C
--
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- SEÇÃO A — DIAGNÓSTICO (execute ANTES das correções)
-- ═══════════════════════════════════════════════════════════════

-- A1. Verificar RLS em todas as tabelas
SELECT relname AS tabela,
       relrowsecurity AS rls_ativo,
       relforcerowsecurity AS rls_forcado
FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = 'public'::regnamespace
ORDER BY relname;

-- A2. Ver todas as políticas existentes
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- A3. Verificar sheet_transactions especificamente
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sheet_transactions'
ORDER BY ordinal_position;

-- A4. Verificar se sheet_transactions tem RLS
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'sheet_transactions';


-- ═══════════════════════════════════════════════════════════════
-- SEÇÃO B — CORREÇÕES (execute após confirmar diagnóstico)
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- B1. sheet_transactions — Habilitar RLS + criar políticas
-- IMPORTANTE: Só execute se sheet_transactions existir e tiver user_id
-- ───────────────────────────────────────────────────────────────

-- Habilitar RLS
ALTER TABLE public.sheet_transactions ENABLE ROW LEVEL SECURITY;

-- Drop políticas antigas (se existirem) para evitar duplicatas
DROP POLICY IF EXISTS "Users can view own sheet_transactions" ON public.sheet_transactions;
DROP POLICY IF EXISTS "Users can insert own sheet_transactions" ON public.sheet_transactions;
DROP POLICY IF EXISTS "Users can update own sheet_transactions" ON public.sheet_transactions;
DROP POLICY IF EXISTS "Users can delete own sheet_transactions" ON public.sheet_transactions;

-- Criar políticas
CREATE POLICY "Users can view own sheet_transactions"
  ON public.sheet_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sheet_transactions"
  ON public.sheet_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sheet_transactions"
  ON public.sheet_transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sheet_transactions"
  ON public.sheet_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Política especial: permitir SELECT para qualquer authenticated user
-- Necessário para o Realtime funcionar (o listener roda no contexto do usuário logado)
-- e para o sync via gviz/tq que insere dados antes do user_id ser atribuído
-- DESCOMENTE APENAS SE O SYNC ESTIVER QUEBRANDO:
-- DROP POLICY IF EXISTS "Service and authenticated can manage sheet_transactions" ON public.sheet_transactions;
-- CREATE POLICY "Service and authenticated can manage sheet_transactions"
--   ON public.sheet_transactions FOR ALL
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────
-- B2. profiles — Trigger automático para novos usuários
-- ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger antigo se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Adicionar INSERT policy para profiles (caso o trigger não funcione por RLS)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ───────────────────────────────────────────────────────────────
-- B3. transactions — Adicionar UPDATE policy (faltava)
-- ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────
-- B4. expenses — Adicionar UPDATE policy (faltava)
-- ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
CREATE POLICY "Users can update own expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────
-- B5. sync_logs — Adicionar colunas faltantes + UPDATE policy
-- O código insere event/status/details que não existem no schema
-- ───────────────────────────────────────────────────────────────

ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS event text;
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS details text;

DROP POLICY IF EXISTS "Users can update own sync logs" ON public.sync_logs;
CREATE POLICY "Users can update own sync logs"
  ON public.sync_logs FOR UPDATE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────
-- B6. kr_weekly_snapshots — Adicionar UPDATE policy (faltava)
-- ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update own kr_weekly_snapshots" ON public.kr_weekly_snapshots;
CREATE POLICY "Users can update own kr_weekly_snapshots"
  ON public.kr_weekly_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────
-- B7. marketing_engine_settings — Adicionar DELETE policy (faltava)
-- Mantém using(true) pois é tabela global (single-row toggle)
-- ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can delete marketing engine settings" ON public.marketing_engine_settings;
CREATE POLICY "Users can delete marketing engine settings"
  ON public.marketing_engine_settings FOR DELETE
  TO authenticated USING (true);

-- ───────────────────────────────────────────────────────────────
-- B8. Índices faltantes em user_id (performance)
-- ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sheet_connections_user_id
  ON public.sheet_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_sheet_transactions_user_id
  ON public.sheet_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_sheet_transactions_date_ref
  ON public.sheet_transactions(date_ref);

CREATE INDEX IF NOT EXISTS idx_sheet_transactions_comanda
  ON public.sheet_transactions(comanda);

-- ───────────────────────────────────────────────────────────────
-- B9. Triggers updated_at para tabelas que não tinham
-- ───────────────────────────────────────────────────────────────

-- Adicionar updated_at column se não existir
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
ALTER TABLE public.comissoes ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

-- Criar triggers
DROP TRIGGER IF EXISTS handle_updated_at_transactions ON public.transactions;
CREATE TRIGGER handle_updated_at_transactions
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at_expenses ON public.expenses;
CREATE TRIGGER handle_updated_at_expenses
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at_comissoes ON public.comissoes;
CREATE TRIGGER handle_updated_at_comissoes
  BEFORE UPDATE ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at_sync_logs ON public.sync_logs;
CREATE TRIGGER handle_updated_at_sync_logs
  BEFORE UPDATE ON public.sync_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ═══════════════════════════════════════════════════════════════
-- SEÇÃO C — sheet_transactions: adicionar user_id se não existir
-- Execute APENAS se o diagnóstico (A3) mostrar que não tem user_id
-- ═══════════════════════════════════════════════════════════════

-- Adicionar coluna user_id
ALTER TABLE public.sheet_transactions ADD COLUMN IF NOT EXISTS user_id uuid references auth.users;

-- Backfill: atribuir todas as transações existentes ao primeiro usuário
-- AJUSTE O UUID ABAIXO para o user_id correto antes de executar!
-- UPDATE public.sheet_transactions
-- SET user_id = 'SEU-UUID-AQUI'
-- WHERE user_id IS NULL;

-- Habilitar RLS após adicionar user_id
ALTER TABLE public.sheet_transactions ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL (execute para confirmar que tudo está OK)
-- ═══════════════════════════════════════════════════════════════

-- Confirmar que TODAS as tabelas têm RLS ativo
SELECT relname AS tabela,
       CASE WHEN relrowsecurity THEN '✅ ATIVO' ELSE '❌ DESATIVADO' END AS rls_status
FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = 'public'::regnamespace
ORDER BY relrowsecurity, relname;

-- Contar políticas por tabela
SELECT tablename, COUNT(*) AS total_politicas
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
